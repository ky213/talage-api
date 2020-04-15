'use strict';
const RestifyError = require('restify-errors');
const crypt = requireShared('./services/crypt.js');
const jwt = require('jsonwebtoken');
const request = require('request');

/**
 * Returns a limited life JWT for restting a user's password
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function PostResetPassword(req, res, next) {
	let error = false;

	// Check for data
	if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
		log.info('Bad Request: Missing both email and password');
		return next(new RestifyError.BadRequestError('You must supply an email address and password'));
	}

	// Make sure an email was provided
	if (!req.body.email) {
		log.info('Missing email');
		res.send(400, new RestifyError.BadRequestError('Email address is required'));
		return next();
	}

	// Authenticate the information provided by the user
	const emailHash = await crypt.hash(req.body.email);
	const agentSQL = `
			SELECT
				\`id\`
			FROM \`#__agency_portal_users\`
			WHERE \`email_hash\` = ${db.escape(emailHash)} LIMIT 1;
		`;
	const result = await db.query(agentSQL).catch(function (e) {
		log.error(e.message);
		res.send(500, new RestifyError.InternalServerError('Error querying database. Check logs.'));
		error = true;
	});
	if (error) {
		return next(false);
	}

	// Make sure we found a result before doing more processing
	if (result && result.length) {
		log.info('Email found');

		// Create a limited life JWT
		const token = jwt.sign({ 'userID': result[0].id }, process.env.AUTH_SECRET_KEY, { 'expiresIn': '15m' });

		// Prepare the email to send to the user
		const emailData = {
			'from': process.env.BRAND,
			'html': `<p style="text-align:center;">A request to reset your password has been recieved. To continue the reset process, please click the button below within 15 minutes.</p><br><p style="text-align: center;"><a href="${process.env.PORTAL_URL}/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Reset Password</a></p>`,
			'subject': `Reset Your ${process.env.BRAND.charAt(0).toUpperCase() + process.env.BRAND.substr(1).toLowerCase()} Password`,
			'to': req.body.email
		};

		// Send an email to the user
		request({
			'json': emailData,
			'method': 'POST',
			'url': `http://email${process.env.NETWORK}`
		}, function (err) {
			if (err) {
				log.error(`Failed to send the password reset email to ${req.body.email}. Please contact the user.`);
				log.verbose(err);
			}
		});
	}

	// Always send a success response. This prevents leaking information about valid email addresses in our database.
	log.info('Reset Password Request Complete');
	res.send(200, {
		'code': 'Success',
		'message': 'Password Reset Started'
	});
	return next();
}

exports.RegisterEndpoint = (basePath, server) => {
	server.post({
		'name': 'Reset Password',
		'path': basePath + '/reset-password'
	}, PostResetPassword);

	server.post({
		'name': 'Reset Password (deprecated)',
		'path': basePath + '/resetPassword'
	}, PostResetPassword);
};