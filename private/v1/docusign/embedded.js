/**
 * Sends an email
 */

'use strict';

const util = require('util');
const serverHelper = require('../../../server.js');
const validator = global.requireShared('./helpers/validator.js');
const docusign = global.requireShared('./services/docusign.js');

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to POST requests to create a DocuSign document
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postEmbedded(req, res, next) {
	// Check for data
	if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
		log.warn('Docusign Service PostEmbedded : No data was received' + __location);
		return next(serverHelper.requestError('No data was received'));
	}

	// Validate the email parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'email') || typeof req.body.email !== 'string' || validator.email(req.body.email) !== true) {
		const message = "Invalid 'email' parameter. An email address is required and must be a valid string.";
		log.warn('Docusign Service PostEmbedded : ' + message + __location);
		return next(serverHelper.requestError(message));
	}

	// Validate the name parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'name') || typeof req.body.name !== 'string' || validator.name(req.body.name) !== true) {
		const message = "Invalid 'name' parameter. A name is required and must be a valid string.";
		log.warn('Docusign Service PostEmbedded : ' + message + __location);
		return next(serverHelper.requestError(message));
	}

	// Validate the returnUrl parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'returnUrl') || typeof req.body.returnUrl !== 'string') {
		const message = "Invalid 'returnUrl' parameter. A returnUrl is required and must be a valid string.";
		log.warn('Docusign Service PostEmbedded : ' + message + __location);
		return next(serverHelper.requestError(message));
	}

	// Validate the template parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'template') || typeof req.body.template !== 'string' || validator.uuid(req.body.template) !== true) {
		const message = "Invalid 'template' parameter. A template is required and must be a valid UUID.";
		log.warn('Docusign Service PostEmbedded : ' + message + __location);
		return next(serverHelper.requestError(message));
	}

	// Validate the user
	if (!Object.prototype.hasOwnProperty.call(req.body, 'user') || typeof req.body.user !== 'number' || validator.integer(req.body.user) !== true) {
		const message = "Invalid 'user' parameter. A user is required and must be a valid user ID.";
		log.warn('Docusign Service PostEmbedded : ' + message + __location);
		return next(serverHelper.requestError(message));
	}

	// Log the full request
	log.verbose(util.inspect(req.body, false, null));

	// Localize the parameters provided in the request
	const user = req.body.user;
	const name = req.body.name;
	const email = req.body.email;
	const returnUrl = req.body.returnUrl;
	const template = req.body.template;

	// Get the DocuSign signing URL
	const result = await docusign.createSigningRequestURL(user, name, email, null, template, returnUrl);
	// Make sure we got a View URL
	if (result === null) {
		log.error('Docusign Service PostEmbedded : Unable to create Docusign view. No URL returned. Check the API logs for more information.' + __location);
		return next(serverHelper.internalError('We were unable to generate your document for signing at this time. Someone will contact you to complete these documents and open access to your account.'));
	}

	res.send(200, {
		status: 'success',
		envelopeId: result.envelopeId,
		signingUrl: result.signingUrl
	});

	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Create Embedded DocuSign Document (depr)', `${basePath}/embedded`, postEmbedded);
};