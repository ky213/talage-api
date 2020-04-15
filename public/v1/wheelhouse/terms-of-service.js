'use strict';
const RestifyError = require('restify-errors');
const auth = require('./helpers/auth.js');

// Current Version of the TOS and Privacy Policy
const version = 3;

/**
 * Records the user's acceptance of the Terms of Service
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PutAcceptTermsOfService(req, res, next) {
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req).catch(function (e) {
		error = e;
	});
	if (error) {
		return next(error);
	}

	// Construct the query
	const sql = `
			INSERT INTO \`#__legal_acceptances\` (\`agency_portal_user\`, \`ip\`, \`version\`)
			VALUES (${req.authentication.userID}, ${db.escape(req.connection.remoteAddress)}, ${version});
		`;
	// Run the query
	await db.query(sql).catch(function (e) {
		log.error(e.message);
		e = new RestifyError.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
	});
	if (error) {
		return next(error);
	}

	// Send a success response
	res.send(200, {
		'message': 'Acceptance recorded',
		'status': 'success'
	});
}

exports.RegisterEndpoint = (basePath, server) => {
	server.put({
		'name': 'Record Acceptance of Terms of Service',
		'path': basePath + '/terms-of-service'
	}, PutAcceptTermsOfService);
};