/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const Application = require('./helpers/models/Application.js');
const serverHelper = require('../../../server.js');
const jwt = require('jsonwebtoken');
const status = global.requireShared('./helpers/status.js');

/**
 *
 * Responds to POST requests and returns policy quotes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postApplication(req, res, next) {
	// Check for data
	if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
		log.warn('No data was received' + __location);
		return next(serverHelper.requestError('No data was received'));
	}

	// Make sure basic elements are present
	if (!req.body.business || !Object.prototype.hasOwnProperty.call(req.body, 'id') || !req.body.policies) {
		log.warn('Some required data is missing' + __location);
		return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
	}

	const requestedInsurers = Object.prototype.hasOwnProperty.call(req.query, 'insurers') ? req.query.insurers.split(',') : [];

	const application = new Application();
	// Populate the Application object
	// Load
	try {
		await application.load(req.params);
	} catch (error) {
		log.error(`Error loading application ${req.params.id ? req.params.id : ''}: ${error.message}` + __location);
		res.send(error);
		return next();
	}
	// Validate
	try {
		await application.validate(requestedInsurers);
	} catch (error) {
		log.error(`Error validating application ${req.params.id ? req.params.id : ''}: ${error.message}` + __location);
		res.send(error);
		return next();
	}

	// Set the application progress to 'quoting'
	const sql = `
		UPDATE clw_talage_applications
		SET progress = ${db.escape('quoting')}
		WHERE id = ${db.escape(req.body.id)}
	`;
	let result = null;
	try {
		result = await db.query(sql);
	} catch (error) {
		log.error(`Could not update the quote progress to 'quoting' for application ${req.body.id}: ${error} ${__location}`);
		return next(serverHelper.internalError('An unexpected error occurred.'));
	}
	if (result === null || result.affectedRows !== 1) {
		log.error(`Could not update the quote progress to 'quoting' for application ${req.body.id}: ${sql} ${__location}`);
		return next(serverHelper.internalError('An unexpected error occurred.'));
	}

	// Build a JWT that contains the application ID that expires in 5 minutes.
	const tokenPayload = {applicationID: req.body.id};
	const token = jwt.sign(tokenPayload, global.settings.AUTH_SECRET_KEY, {expiresIn: '5m'});
	// Send back the token
	res.send(200, token);

	// Begin running the quotes
	runQuotes(application);

	return next();
}

/**
 * Runs the quote process for a given application
 *
 * @param {object} application - Application object
 * @returns {void}
 */
async function runQuotes(application) {
	try {
		await application.run_quotes();
	} catch (error) {
		log.error(`Getting quotes on application ${application.id} failed: ${error} ${__location}`);
	}

	// Update the application quote progress to "complete"
	const sql = `
		UPDATE clw_talage_applications
		SET progress = ${db.escape('complete')}
		WHERE id = ${application.id}
	`;
	try {
		await db.query(sql);
	} catch (error) {
		log.error(`Could not update the quote progress to 'complete' for application ${application.id}: ${error} ${__location}`);
	}

	// Update the application status
	await status.updateApplicationStatus(application.id);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Post Application', `${basePath}/application`, postApplication);
	server.addPost('Post Application (depr)', `${basePath}/`, postApplication);
};