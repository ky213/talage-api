/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const RestifyError = require('restify-errors');
const util = require('util');

const Application = require('./helpers/models/Application.js');

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to POST requests and returns policy quotes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostApplication(req, res, next) {
	// Check for data
	if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
		log.warn('No data was received');
		return next(new RestifyError.BadRequestError('No data was received'));
	}

	// Make sure basic elements are present
	if (!req.body.business || !Object.prototype.hasOwnProperty.call(req.body, 'id') || !req.body.policies) {
		log.warn('Some required data is missing');
		return next(new RestifyError.BadRequestError('Some required data is missing. Please check the documentation.'));
	}

	const application = new Application();
	let had_error = false;

	// Load
	await application.load(req.params).catch(function (error) {
		had_error = true;
		res.send(error);
		log.warn(`Cannot Load Application: ${error.message}`);
	});
	if (had_error) {
		return next();
	}

	// Validate
	await application.validate().catch(function (error) {
		had_error = true;
		res.send(error);
		log.warn(`Invalid Application: ${error.message}`);
	});
	if (had_error) {
		return next();
	}

	// Check if Testing and Send Test Response
	if (application.test) {
		// Test Response
		await application.run_test().then(function (response) {
			log.verbose(util.inspect(response, false, null));
			res.send(200, response);
		}).catch(function (error) {
			log.error(`Error ${error.message}`);
			res.send(error);
		});
		return next();
	}

	// Send Non-Test Response
	await application.run_quotes().then(function (response) {

		// Strip out file data and log
		const logResponse = { ...response };
		logResponse.quotes.forEach(function (quote) {
			if (Object.prototype.hasOwnProperty.call(quote, 'letter') && Object.prototype.hasOwnProperty.call(quote.letter, 'data')) {
				quote.letter.data = '...';
			}
		});
		log.verbose(util.inspect(logResponse, false, null));

		// Send the response to the user
		res.send(200, response);
	}).catch(function (error) {
		log.error(`Error ${error.message}`);
		res.send(error);
	});
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath, server) => {
	server.post({
		'name': 'Post Application',
		'path': basePath + '/application'
	}, PostApplication);

	server.post({
		'name': 'Post Application (deprecated)',
		'path': basePath + '/'
	}, PostApplication);
};