/**
 * Encrypts a data string
 */

'use strict';

const crypt = require('./helpers/crypt.js');

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to POST requests to dcrypt data
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostDecrypt(req, res, next) {
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

	// A valid encryptin string will include a pipe character which separates the cryptographic string from the nonce
	if (req.body.indexOf('|') < 0) {
		log.warn('Value is missing a pipe, indicating it is not an encrypted string');
		return next(ServerRequestError('Value is not an encrypted string'));
	}

	// Decrypt the data
	const decryptedData = await crypt.decrypt(req.body);

	// Return the encrypted data
	res.send(200, decryptedData);
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddPost('Decrypt', basePath + '/decrypt', PostDecrypt);
};