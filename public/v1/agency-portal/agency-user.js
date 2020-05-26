'use strict';
const auth = require('./helpers/auth.js');
const crypt = require('../../../shared/services/crypt.js');
const jwt = require('jsonwebtoken');
const request = require('request');
const serverHelper = require('../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

const hasOtherOwner = require('./user').hasOtherOwner;
const hasOtherSigningAuthority = require('./user').hasOtherSigningAuthority;

/**
 * Deletes a single agency user (by an agency network)
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function deleteAgencyUser(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'agencies', 'manage').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Check that query parameters were received
	if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
		log.info('Bad Request: Query parameters missing');
		return next(serverHelper.requestError('Query parameters missing'));
	}

	// Validate the ID
	if(!Object.prototype.hasOwnProperty.call(req.query, 'id')){
		return next(serverHelper.requestError('ID missing'));
	}
	if(!await validator.userId(req.query.id)){
		return next(serverHelper.requestError('ID is invalid'));
	}
	const id = req.query.id;

	// Get the agency of this user
	const userSQL = `SELECT agency FROM #__agency_portal_users WHERE id = ${parseInt(id, 10)} LIMIT 1;`;

	// Run the query
	const userResult = await db.query(userSQL).catch(function(){
		error = serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
	});
	if(error){
		return next(error);
	}

	// Isolate the user's agency
	const userAgency = userResult[0].agency;

	// Get the agencies that we are permitted to manage
	const agencies = await auth.getAgents(req).catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Check that this Agency Network can manage this user
	if(!agencies.includes(userAgency)){
		log.warn('You do not have permission to manage users from this agency');
		return next(serverHelper.forbiddenError('You do not have permission to manage users from this agency'));
	}

	// Make sure there is an owner for this agency (we are not removing the last owner)
	if(!await hasOtherOwner(userAgency, id)){
		// Log a warning and return an error
		log.warn('This user is the account owner. You must assign ownership to another user before deleting this account');
		return next(serverHelper.requestError('This user is the account owner. You must assign ownership to another user before deleting this account.'));
	}

	// Make sure there is another signing authority (we are not removing the last one)
	if(!await hasOtherSigningAuthority(userAgency, id)){
		// Log a warning and return an error
		log.warn('This user is the account signing authority. You must assign signing authority to another user before deleting this account');
		return next(serverHelper.requestError('This user is the account signing authority. You must assign signing authority to another user before deleting this account.'));
	}

	// Update the user (we set the state to -2 to signify that the user is deleted)
	const updateSQL = `
			UPDATE \`#__agency_portal_users\`
			SET
				\`state\` = -2
			WHERE
				\`id\` = ${parseInt(id, 10)}
			LIMIT 1;
		`;

	// Run the query
	const result = await db.query(updateSQL).catch(function(){
		error = serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
	});
	if(error){
		return next(error);
	}

	// Make sure the query was successful
	if(result.affectedRows !== 1){
		log.error('User delete failed');
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	res.send(200, 'Deleted');
}

exports.registerEndpoint = (server, basePath) => {
	server.addDeleteAuth('Delete Agency User', `${basePath}/agency-user`, deleteAgencyUser);
};