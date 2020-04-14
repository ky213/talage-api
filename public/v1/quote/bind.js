/**
 * Handles all tasks related to binding a quote
 */

'use strict';

const RestifyError = require('restify-errors');
const Quote = require('./helpers/models/Quote.js');
const util = require('util');



/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to PUT requests and returns a result
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PutBind(req, res, next) {

	// Check for data
	if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
		log.warn('No data was received');
		return next(new RestifyError.BadRequestError('No data was received'));
	}
	log.verbose(util.inspect(req.body, false, null));

	// Make sure basic elements are present
	if (!Object.prototype.hasOwnProperty.call(req.body, 'quote') || !req.body.quote) {
		log.warn('Quote must be specified to bind');
		return next(new RestifyError.BadRequestError('A quote must be specified. Please check the documentation'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'payment_plan') || !req.body.payment_plan) {
		log.warn('Payment Plan must be specified to bind');
		return next(new RestifyError.BadRequestError('A payment plan must be specified. Please check the documentation'));
	}

	const quote = new Quote();
	let error = false;

	// Load
	await quote.load(req.body.quote, req.body.payment_plan).catch(function (err) {
		error = err;
		log.warn(`Cannot Load Quote: ${err.message}`);
	});
	if (error) {
		return next(error);
	}

	// Bind
	await quote.bind().catch(function (err) {
		error = err;
		log.warn(`Cannot Bind: ${err.message}`);
	}).then(function (result) {
		// Everything looks good, send a positive response
		res.send(200, {
			'code': result,
			'message': result === 'Bound' ? 'Quote successfully bound' : 'Quote was referred to underwriting. The agent of record should follow up.'
		});
	});
	if (error) {
		return next(error);
	}

	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath, server) => {
	log.info(`    Registering ${basePath}/bind (PUT)`);

	server.put({
		'name': 'Bind Quote',
		'path': basePath + '/bind'
	}, PutBind);
};