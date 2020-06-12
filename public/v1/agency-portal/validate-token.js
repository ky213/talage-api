'use strict';

const jwt = require('jsonwebtoken');
const serverHelper = require('../../../server.js');

/**
 * Checks whether or not a JWT is valid
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
function GetValidateToken(req, res, next){
	// Check for data
	if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
		log.info('Bad Request: No data received');
		return next(serverHelper.requestError('Bad Request: No data received'));
	}

	// Make sure a token was provided
	if(!req.query.token){
		log.info('Missing token');
		res.send(400, serverHelper.requestError('A token must be provided to this endpoint'));
		return next();
	}

	// Check if the token is valid or not
	let valid = false;
	try{
		jwt.verify(req.query.token, global.settings.AUTH_SECRET_KEY);
		valid = true;
	}
catch(error){
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

exports.registerEndpoint = (server, basePath) => {
	server.addGet('Validate JWT', `${basePath}/validate-token`, GetValidateToken);
	server.addGet('Validate JWT (depr)', `${basePath}/validateToken`, GetValidateToken);
};