/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const util = require('util');
const Application = require('./helpers/models/Application.js');
const serverHelper = require('../../../server.js');
const jwt = require('jsonwebtoken');

/**
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
	if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
		log.warn('No data was received' + __location);
		return next(serverHelper.requestError('No data was received'));
	}

	console.log('==========================================================================================');
	console.log('==========================================================================================');
	console.log('==========================================================================================');

	// Make sure basic elements are present
	if (!req.body.business || !Object.prototype.hasOwnProperty.call(req.body, 'id') || !req.body.policies) {
		log.warn('Some required data is missing' + __location);
		return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
	}

	const requestedInsurers = Object.prototype.hasOwnProperty.call(req.query, 'insurers') ? req.query.insurers.split(',') : [];

	const application = new Application();

	// Populate the Application object
	try {
		// Load
		await application.load(req.params);
		// Validate
		await application.validate(requestedInsurers);
	} catch (error) {
		log.warn(`Error with application: ${error.message}` + __location);
		res.send(error);
		return next();
	}

	// Create an application progress entry. Do not reuse an existing row since hung processes could
	// still update it.
	const sql = `
		UPDATE clw_talage_applications
		SET quote_progress = ${db.escape('working')}
		WHERE id = ${application.id}
	`;
	let result = null;
	try {
		result = await db.query(sql);
	} catch (error) {
		log.error(`Could not update the quote progress to 'working' for application ${application.id}: ${error} ${__location}`);
		return next(serverHelper.internalError('An unexpected error occurred.'));
	}

	// Build a JWT that contains the application ID that expires in 5 minutes.
	const tokenPayload = {
		applicationID: application.id
	};
	const token = jwt.sign(tokenPayload, global.settings.AUTH_SECRET_KEY, { expiresIn: '5m' });
	// Send back the token
	res.send(200, token);

	// Begin running the quotes
	runQuotes(application);

	// Check if Testing and Send Test Response - Needs rework in the quotes backend
	// if (application.test) {
	// 	// Test Response
	// 	await application
	// 		.run_test()
	// 		.then(function (response) {
	// 			log.verbose(util.inspect(response, false, null));
	// 			res.send(200, response);
	// 		})
	// 		.catch(function (error) {
	// 			log.error(`Error ${error.message}` + __location);
	// 			res.send(error);
	// 		});
	// 	return next();
	// }

	return next();
}

/**
 * Runs the quote process for a given application
 *
 * @param {object} application - Application object
 * @returns {void}
 */
async function runQuotes(application) {
	// Start quoting (no await)
	let result = null;
	try {
		result = await application.run_quotes();
	} catch (error) {
		// Update the progress table with an error
	}
	// Strip out file data and log
	const logResponse = { ...result };
	logResponse.quotes.forEach(function (quote) {
		if (Object.prototype.hasOwnProperty.call(quote, 'letter')) {
			quote.letter = '...';
		}
	});
	// log.verbose(util.inspect(logResponse, false, null));
	console.log('DONE RUNNING QUOTES');
	logResponse.quotes.forEach((quote) => {
		console.log(JSON.stringify(quote));
	});

	// Update the application quote progress to "complete"
	const sql = `
		UPDATE clw_talage_applications
		SET quote_progress = ${db.escape('complete')}
		WHERE id = ${application.id}
	`;
	try {
		await db.query(sql);
	} catch (error) {
		log.error(`Could not update the quote progress to 'complete' for application ${application.id}: ${error} ${__location}`);
	}
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Post Application', `${basePath}/application`, postApplication);
	server.addPost('Post Application (depr)', `${basePath}/`, postApplication);
};
