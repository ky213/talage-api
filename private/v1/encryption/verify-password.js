/**
 * Hashes a password string
 */

'use strict';

const serverHelper = require('../../../server.js');
const cryptsvc = global.requireShared('./services/crypt.js');

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
async function PostVerifyPassword(req, res, next){
	// Check for data
	if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
		log.warn('No data was received' + __location);
		return next(serverHelper.requestError('No data was received'));
	}

	// Make sure we have a data object
	if(typeof req.body !== 'object'){
		log.warn('Data recieved was not a JSON object. Check your Content-Type header.' + __location);
		return next(serverHelper.requestError('Incorrect data format'));
	}

	// Hash
	if(!Object.prototype.hasOwnProperty.call(req.body, 'hash') || !req.body.hash){
		log.warn('Bad Request: Missing Hash' + __location);
		return next(serverHelper.requestError('You must supply a known good password hash to be checked'));
	}

	// Password
	if(!Object.prototype.hasOwnProperty.call(req.body, 'password') || !req.body.password){
		log.warn('Bad Request: Missing Password' + __location);
		return next(serverHelper.requestError('You must supply a password to check against the hash'));
	}
	// TODO system error handling...
	const pwdChkResp = await cryptsvc.verifyPassword(req.body.hash, req.body.password)

	res.send(200, pwdChkResp);
	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Verify Password', `${basePath}/verify-password`, PostVerifyPassword);
	server.addPost('Verify Password (depr)', `${basePath}/verifyPassword`, PostVerifyPassword);
};