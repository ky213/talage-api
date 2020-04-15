'use strict';
const RestifyError = require('restify-errors');
const jwt = require('jsonwebtoken');

/**
 * Checks whether or not a JWT is valid
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
function GetValidateJWT(req, res, next) {
	// Check for data
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.info('Bad Request: No data received');
		return next(new RestifyError.BadRequestError('Bad Request: No data received'));
	}

	// Make sure a token was provided
	if (!req.query.token) {
		log.info('Missing token');
		res.send(400, new RestifyError.BadRequestError('A token must be provided to this endpoint'));
		return next();
	}

	// Check if the token is valid or not
	let valid = false;
	try {
		jwt.verify(req.query.token, process.env.AUTH_SECRET_KEY);
		valid = true;
	} catch (error) {
		log.warn(error.message);
		valid = false;
	}

	// Log the result
	const message = `Token ${valid ? '' : 'Not '}Valid`;
	log.info(message);

	// Return the result
	res.send(200, {
		'code': 'Success',
		'message': message,
		'valid': valid
	});
	return next();
}

exports.RegisterEndpoint = (basePath, server) => {
	server.get({
		'name': 'Validate JWT',
		'path': basePath + '/validate-token'
	}, GetValidateJWT);

	server.get({
		'name': 'Validate JWT (deprecated)',
		'path': basePath + '/validateToken'
	}, GetValidateJWT);
};