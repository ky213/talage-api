/**
 * Hashes a password string
 */

'use strict';

const crypt = require('./helpers/crypt.js');

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to POST requests to hash a password string
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostHashPassword(req, res, next) {
	// Check for data
	if (!req.body) {
		log.warn('No data was received');
		return next(ServerRequestError('No data was received'));
	}

	// Make sure this is a string
	if (typeof req.body !== 'string') {
		log.warn('Value must be a string');
		return next(ServerRequestError('Value must be a string'));
	}

	// Hash the password
	const hashedPassword = await crypt.hashPassword(req.body);

	// Return the hashed password
	res.send(200, hashedPassword);
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddPost('Hash Password', basePath + '/hash-password', PostHashPassword);
	ServerAddPost('Hash Password (depr)', basePath + '/hashPassword', PostHashPassword);
};