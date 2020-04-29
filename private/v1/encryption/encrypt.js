/**
 * Encrypts a data string
 */

'use strict';

const crypt = require('./helpers/crypt.js');
const serverHelper = require('../../../server.js').serverHelper;

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
		return next(serverHelper.RequestError('No data was received'));
	}

	// Make sure this is a string
	if (typeof req.body !== 'string') {
		log.warn('Value must be a string');
		return next(serverHelper.RequestError('Value must be a string'));
	}

	// Encrypt the data
	const encryptedData = await crypt.encrypt(req.body);

	// Return the encrypted data
	res.send(200, encryptedData);
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (server, basePath) => {
	server.AddPost('Encrypt', basePath + '/encrypt', PostEncrypt);
};