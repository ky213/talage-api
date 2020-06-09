/**
 * Sends an email
 */

'use strict';

const DocuSign = require('docusign-esign');
const util = require('util');
const serverHelper = require('../../../server.js');
const validator = requireShared('./helpers/validator.js');

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
async function PostEmbedded(req, res, next) {
	let error = false;

	// Check for data
	if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
		log.warn("Docusign Service PostEmbedded : " + 'No data was received');
		return next(serverHelper.requestError('No data was received'));
	}

	// Validate the email parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'email') || typeof req.body.email !== 'string' || validator.email(req.body.email) !== true) {
		const message = 'Invalid \'email\' parameter. An email address is required and must be a valid string.';
		log.warn("Docusign Service PostEmbedded : " + message);
		return next(serverHelper.requestError(message));
	}

	// Validate the name parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'name') || typeof req.body.name !== 'string' || validator.name(req.body.name) !== true) {
		const message = 'Invalid \'name\' parameter. A name is required and must be a valid string.';
		log.warn("Docusign Service PostEmbedded : " + message);
		return next(serverHelper.requestError(message));
	}

	// Validate the returnUrl parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'returnUrl') || typeof req.body.returnUrl !== 'string') {
		const message = 'Invalid \'returnUrl\' parameter. A returnUrl is required and must be a valid string.';
		log.warn("Docusign Service PostEmbedded : " + message);
		return next(serverHelper.requestError(message));
	}

	// Validate the template parameter
	if (!Object.prototype.hasOwnProperty.call(req.body, 'template') || typeof req.body.template !== 'string' || validator.uuid(req.body.template) !== true) {
		const message = 'Invalid \'template\' parameter. A template is required and must be a valid UUID.';
		log.warn("Docusign Service PostEmbedded : " + message);
		return next(serverHelper.requestError(message));
	}

	// Validate the user
	if (!Object.prototype.hasOwnProperty.call(req.body, 'user') || typeof req.body.user !== 'number' || validator.integer(req.body.user) !== true) {
		const message = 'Invalid \'user\' parameter. A user is required and must be a valid user ID.';
		log.warn("Docusign Service PostEmbedded : " + message);
		return next(serverHelper.requestError(message));
	}

	// Log the full request
	log.verbose(util.inspect(req.body, false, null));

	// Localize the parameters provided in the request
	const email = req.body.email;
	const name = req.body.name;
	const returnUrl = req.body.returnUrl;
	const template = req.body.template;
	const user = req.body.user;

	// Before we do anything, get a reference to the DocuSign API
	const {
		accountId,
		docusignApiClient
	} = await require('./helpers/configureAPI.js')();

	/* ---=== Step 1: Create a complete envelope ===--- */

	// Create a Template Role that matches the one in our template
	const role = new DocuSign.TemplateRole();
	role.clientUserId = user;
	role.roleName = 'Producer';
	role.name = name;
	role.email = email;

	// Create an Envelope from the Template in our account
	const envelope = new DocuSign.EnvelopeDefinition();
	envelope.templateId = template;
	envelope.templateRoles = [role];
	envelope.status = 'sent';


	/* ---=== Step 2: Send this envelope to our DocuSign account ===--- */

	// Get a reference to the Envelopes API
	const envelopesApi = new DocuSign.EnvelopesApi(docusignApiClient);

	// Exceptions will be caught by the calling function
	const envelopeSummary = await envelopesApi.createEnvelope(accountId, { 'envelopeDefinition': envelope }).catch(function (e) {
		const errorMessage = 'Unable to create DocuSign envelope. Check the API logs for more information.';
		log.error("Docusign Service PostEmbedded : " + errorMessage + __location);
		log.verbose(`${e.message} - ${e.response.body.message}`);
		error = serverHelper.internalError(errorMessage);
	});

	if (error) {
		return next(error);
	}


	/* ---=== Step 3: Create the Signing Ceremony that the user will see ===--- */

	const viewRequest = new DocuSign.RecipientViewRequest();

	// Set the url where you want the recipient to go once they are done signing
	viewRequest.returnUrl = returnUrl;

	// Indicate how we authenticated the user
	viewRequest.authenticationMethod = 'email';

	// Recipient information must match embedded recipient info
	viewRequest.clientUserId = user;
	viewRequest.email = email;
	viewRequest.userName = name;

	// Call the CreateRecipientView API
	const viewResults = await envelopesApi.createRecipientView(accountId, envelopeSummary.envelopeId, { 'recipientViewRequest': viewRequest }).catch(function (e) {
		const errorMessage = 'Unable to create DocuSign view. Check the API logs for more information.';
		log.error("Docusign Service PostEmbedded : " + errorMessage + __location);
		log.verbose(`${e.message} - ${e.response.body.message}`);
		error = serverHelper.internalError(errorMessage);
	});

	if (error) {
		return next(error);
	}

	// Get the URL from the response
	const viewUrl = viewResults.url;

	// Make sure we got a View URL
	if (!viewUrl) {
		log.error("Docusign Service PostEmbedded : " + 'Unable to create Docusign view. No URL returned. Check the API logs for more information.' + error.message + __location);
		return next(serverHelper.internalError('We were unable to generate your document for signing at this time. Someone will contact you to complete these documents and open access to your account.'));
	}

	res.send(200, {
		'signingUrl': viewUrl,
		'status': 'success'
	});

	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Create Embedded DocuSign Document', `${basePath}/embedded`, PostEmbedded);
};