'use strict';
const RestifyError = require('restify-errors');
const validator = requireShared('./helpers/validator.js');
const auth = require('./helpers/auth.js');

/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetActivities(req, res, next) {
	let error = false;

	// Check for data
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.info('Bad Request: No data received');
		return next(new RestifyError.BadRequestError('Bad Request: No data received'));
	}

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req).catch(function (e) {
		error = e;
	});
	if (error) {
		return next(error);
	}

	// Make sure basic elements are present
	if (!req.query.address_id) {
		log.info('Bad Request: Missing Address ID');
		return next(new RestifyError.BadRequestError('Bad Request: You must supply an Address ID'));
	}

	// Validate the application ID
	if (!await validator.is_valid_id(req.query.address_id)) {
		log.info('Bad Request: Invalid address id');
		return next(new RestifyError.BadRequestError('Invalid address id'));
	}

	const sql = `
			SELECT act.description AS code, addr_act.payroll AS payroll
			FROM #__addresses AS addr
			LEFT JOIN #__address_activity_codes AS addr_act ON addr_act.address = addr.id
			LEFT JOIN #__activity_codes AS act ON addr_act.ncci_code = act.id
			WHERE addr.id = ${req.query.address_id};
		`;

	const activity_data = await db.query(sql).catch(function (err) {
		log.error(err.message);
		return next(new RestifyError.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	res.send(200, { 'activities': activity_data });
}

exports.RegisterEndpoint = (basePath, server) => {
	server.get({
		'name': 'Get activities',
		'path': basePath + '/activities'
	}, GetActivities);
};