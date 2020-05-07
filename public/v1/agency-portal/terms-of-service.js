'use strict';

const serverHelper = require('../../../server.js');

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
async function PutAcceptTermsOfService(req, res, next){
	// Construct the query
	let error = false;
	const sql = `
			INSERT INTO \`#__legal_acceptances\` (\`agency_portal_user\`, \`ip\`, \`version\`)
			VALUES (${req.authentication.userID}, ${db.escape(req.connection.remoteAddress)}, ${version});
		`;
	// Run the query
	await db.query(sql).catch(function(e){
		log.error(e.message);
		error = serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
	});
	if(error){
		return next(error);
	}

	// Send a success response
	res.send(200, {
		'message': 'Acceptance recorded',
		'status': 'success'
	});
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addPutAuth('Record Acceptance of TOS', `${basePath}/terms-of-service`, PutAcceptTermsOfService);
};