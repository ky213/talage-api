/**
 * Hashes a password string
 */

'use strict';

const sodium = require('sodium').api;

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to POST requests to verify a password. Expects two arguments
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
function PostVerifyPassword(req, res, next) {
	// Check for data
	if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
		log.warn('No data was received');
		return next(ServerRequestError('No data was received'));
	}

	// Make sure we have a data object
	if (typeof req.body !== 'object') {
		log.warn('Data recieved was not a JSON object. Check your Content-Type header.');
		return next(ServerRequestError('Incorrect data format'));
	}

	// Hash
	if (!Object.prototype.hasOwnProperty.call(req.body, 'hash') || !req.body.hash) {
		log.warn('Bad Request: Missing Hash');
		return next(ServerRequestError('You must supply a known good password hash to be checked'));
	}

	// Password
	if (!Object.prototype.hasOwnProperty.call(req.body, 'password') || !req.body.password) {
		log.warn('Bad Request: Missing Password');
		return next(ServerRequestError('You must supply a password to check against the hash'));
	}

	// Pad the end with null bytes because node sodium is fucking insane
	req.body.hash = req.body.hash.padEnd(128, '\u0000');

	// Check the password and return the result
	res.send(200, sodium.crypto_pwhash_str_verify(Buffer.from(req.body.hash), Buffer.from(req.body.password)));
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddPost('Verify Password', basePath + '/verify-password', PostVerifyPassword);
	ServerAddPost('Verify Password (depr)', basePath + '/verifyPassword', PostVerifyPassword);
};