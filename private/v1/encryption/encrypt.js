/**
 * Encrypts a data string
 */

'use strict';

const crypt = require('./helpers/crypt.js');

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to POST requests to encrypt data
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostEncrypt(req, res, next) {
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

	// Encrypt the data
	const encryptedData = await crypt.encrypt(req.body);

	// Return the encrypted data
	res.send(200, encryptedData);
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddPost('Encrypt', basePath + '/encrypt', PostEncrypt);
};