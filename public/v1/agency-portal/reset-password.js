'use strict';

const crypt = global.requireShared('./services/crypt.js');
const jwt = require('jsonwebtoken');
const request = require('request');
const serverHelper = require('../../../server.js');
const emailsvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');

/**
 * Returns a limited life JWT for restting a user's password
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function PostResetPassword(req, res, next){
	let error = false;

	// Check for data
	if(!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0){
		log.info('Bad Request: Missing both email and password');
		return next(serverHelper.requestError('You must supply an email address and password'));
	}

	// Make sure an email was provided
	if(!req.body.email){
		log.info('Missing email');
		res.send(400, serverHelper.requestError('Email address is required'));
		return next();
	}

	// Authenticate the information provided by the user
	const emailHash = await crypt.hash(req.body.email);
	const sql = `
			SELECT
				\`apu\`.\`id\`,
				IFNULL(\`a\`.\`agency_network\`, \`an\`.\`id\`) AS \`agency_network\`
			FROM \`#__agency_portal_users\` AS \`apu\`
			LEFT JOIN \`#__agencies\` AS \`a\` ON \`a\`.\`id\` = \`apu\`.\`agency\`
			LEFT JOIN \`#__agency_networks\` AS \`an\` ON \`an\`.\`id\` = \`apu\`.\`agency_network\`
			WHERE \`email_hash\` = ${db.escape(emailHash)} LIMIT 1;
		`;
	const result = await db.query(sql).catch(function(e){
		log.error(e.message);
		res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
		error = true;
	});
	if(error){
		return next(false);
	}

	// Make sure we found a result before doing more processing
	if(result && result.length){
		log.info('Email found');

		// Create a limited life JWT
		const token = jwt.sign({'userID': result[0].id}, global.settings.AUTH_SECRET_KEY, {'expiresIn': '15m'});

		let brandRaw = global.settings.BRAND.toLowerCase();
		let portalurl = global.settings.PORTAL_URL;
		if(result[0].agency_network === 2){
			brandRaw = 'Digalent';
			portalurl = global.settings.DIGALENT_AGENTS_URL;
		}

		const emailData = {
			'from': brandRaw,
			'html': `<p style="text-align:center;">A request to reset your password has been recieved. To continue the reset process, please click the button below within 15 minutes.</p><br><p style="text-align: center;"><a href="${portalurl}/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Reset Password</a></p>`,
			'subject': `Reset Your ${brandRaw.charAt(0).toUpperCase() + brandRaw.substr(1).toLowerCase()} Password`,
			'to': req.body.email
		};

		const emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, brandRaw, 0);
		if(emailResp === false){
			log.error(`Failed to send the password reset email to ${req.body.email}. Please contact the user.`);
			slack.send('#alerts', 'warning',`Failed to send the password reset email to ${req.body.email}. Please contact the user.`);
		}
		else {
			log.info('Reset Password Request Complete');
		}
	}
	// Always send a success response. This prevents leaking information about valid email addresses in our database.
	res.send(200, {
		'code': 'Success',
		'message': 'Password Reset Started'
	});
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addPost('Reset Password', `${basePath}/reset-password`, PostResetPassword);
	server.addPost('Reset Password (depr)', `${basePath}/resetPassword`, PostResetPassword);
};