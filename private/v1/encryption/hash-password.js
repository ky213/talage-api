/**
 * Hashes a password string
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const serverHelper = require('../../../server.js').serverHelper;

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
async function PostHashPassword(req, res, next){
	// Check for data
	if(!req.body){
		log.warn('No data was received' + __location);
		return next(serverHelper.requestError('No data was received'));
	}

	// Make sure this is a string
	if(typeof req.body !== 'string'){
		log.warn('Value must be a string' + __location);
		return next(serverHelper.requestError('Value must be a string'));
	}

	// Hash the password
	const hashedPassword = await crypt.hashPassword(req.body);

	// Return the hashed password
	res.send(200, hashedPassword);
	return next();
}

/* -----==== Endpoints ====-----*/
// should require Auth - internal function during user creation.
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Hash Password', `${basePath}/hash-password`, PostHashPassword);
	server.addPost('Hash Password (depr)', `${basePath}/hashPassword`, PostHashPassword);
};