'use strict';
const RestifyError = require('restify-errors');
const crypt = requireShared('./services/crypt.js');
const validator = requireShared('./helpers/validator.js');

/**
 * Responds to PUT requests for changing a user's password
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PutChangePassword(req, res, next) {
	// Security Note: The validateJWT function was not called here because in the password reset function a modified JWT is issued that only contains a userId

	// Make sure this user is authenticated
	if (!Object.prototype.hasOwnProperty.call(req, 'authentication')) {
		log.info('Forbidden: User is not authenticated');
		return next(new RestifyError.ForbiddenError('User is not authenticated'));
	}

	// Make sure the authentication payload has everything we are expecting
	if (!Object.prototype.hasOwnProperty.call(req.authentication, 'userID')) {
		log.info('Forbidden: JWT payload is missing parameters');
		return next(new RestifyError.ForbiddenError('User is not properly authenticated'));
	}

	// Check for data
	if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
		log.warn('No data was received');
		return next(new RestifyError.BadRequestError('No data was received'));
	}

	// Establish some variables
	let password = '';

	// Check if the request has each datatype, and if so, validate and save it locally
	if (Object.prototype.hasOwnProperty.call(req.body, 'password')) {
		if (validator.password(req.body.password)) {
			// Hash the password
			password = await crypt.hashPassword(req.body.password);
		} else {
			log.warn('Password does not meet requirements');
			return next(new RestifyError.BadRequestError('Password does not meet the complexity requirements. It must be at least 8 characters and contain one uppercase letter, one lowercase letter, one number, and one special character'));
		}
	}

	// Do we have something to update?
	if (!password) {
		log.warn('There is nothing to update');
		return next(new RestifyError.BadRequestError('There is nothing to update. Please check the documentation.'));
	}

	// Create and run the UPDATE query
	const sql = `UPDATE \`#__agency_portal_users\` SET \`password\`=${db.escape(password)}, \`reset_required\`=0 WHERE id = ${db.escape(req.authentication.userID)} LIMIT 1;`;
	await db.query(sql).catch(function (err) {
		log.error(err.message);
		return next(new RestifyError.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Everything went okay, send a success response
	res.send(200, 'Account Updated');
}

exports.RegisterEndpoint = (basePath, server) => {
	server.put({
		'name': 'Change Password',
		'path': basePath + '/change-password'
	}, PutChangePassword);

	server.put({
		'name': 'Change Password (deprecated)',
		'path': basePath + '/changePassword'
	}, PutChangePassword);
};