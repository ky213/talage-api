/**
 * Provides functions for authenticating users
 * 
 * FROM: agency-portal/api
 */

'use strict';

const validator = requireShared('helpers/validator.js');
const serverHelper = require('../../../../server.js');

/**
 * Returns a list of agents that this user is permitted to access. You must call validateJWT() before using this method.
 *
 * @param {object} req - The Restify request object
 * @return {Promise.<array, ServerError>} A promise that returns an array of agent IDs on success, or a ServerError on failure
 */
exports.getAgents = function (req) {
	return new Promise(async function (fulfill, reject) {
		// Localize data variables that the user is permitted to access
		const agencyNetwork = req.authentication.agencyNetwork;
		let error = false;

		// If this user does not have sufficient permissions to make decisions for themselves, just return what is allowed
		if (!agencyNetwork) {
			// Log.info(`allowed agents: `)
			fulfill(req.authentication.agents);
			return;
		}

		// Make sure this agency network is allowed to access all agents they requested
		const agencySQL = `
			SELECT \`id\`
			FROM \`#__agencies\`
			WHERE \`agency_network\` = ${db.escape(agencyNetwork)};
		`;
		const agencyResult = await db.query(agencySQL).catch(function (e) {
			log.error(e.message);
			error = serverHelper.InternalServerError('Error querying database. Check logs.');
		});
		if (error) {
			reject(error);
			return;
		}

		// Everything appears to be okay, return the requested agents
		fulfill(agencyResult.map(function (agency) {
			return agency.id;
		}));
	});
};

/**
 * Validates that the JWT includes the parameters we are expecting
 *
 * @param {object} req - The Restify request object
 * @return {Promise.<Boolean, ServerError>} A promise that returns boolean true on success, or a ServerError on failure
 */
exports.validateJWT = function (req, permission, permissionType) {
	return new Promise(async function (fulfill, reject) {

		// Make sure this user is authenticated
		if (!Object.prototype.hasOwnProperty.call(req, 'authentication')) {
			log.info('Forbidden: User is not authenticated');
			reject(serverHelper.ForbiddenError('User is not authenticated'));
			return;
		}

		// Make sure the authentication payload has everything we are expecting
		if(!Object.prototype.hasOwnProperty.call(req.authentication, 'agents') || !Object.prototype.hasOwnProperty.call(req.authentication, 'userID') || !Object.prototype.hasOwnProperty.call(req.authentication, 'permissions')){
			log.info('Forbidden: JWT payload is missing parameters');
			reject(serverHelper.ForbiddenError('User is not properly authenticated'));
			return;
		}

		// Make sure the agents are what we are expecting
		if (typeof req.authentication.agents !== 'object') {
			log.info('Forbidden: JWT payload is invalid (agents)');
			reject(serverHelper.ForbiddenError('User is not properly authenticated'));
			return;
		}
		
		// Check for the correct permissions
		if(permission && permissionType){
			if(!req.authentication.permissions[permission][permissionType]){
				log.info('Forbidden: User does not have the correct permissions');
				reject(new RestifyError.ForbiddenError('User does not have the correct permissions'));
				return;
			}
		}

		// Make sure each of the agents are valid
		let hadError = false;
		const agentIDs = [];
		await req.authentication.agents.forEach(function (agent) {
			// Check the type
			if (typeof agent !== 'number') {
				log.info('Forbidden: JWT payload is invalid (single agent)');
				reject(serverHelper.ForbiddenError('User is not properly authenticated'));
				hadError = true;
				return;
			}

			// Add this Agent ID to the list of IDs
			agentIDs.push(agent);
		});
		if (hadError) {
			return;
		}

		// Validate all agents
		if (!await validator.agents(agentIDs)) {
			log.info('Forbidden: JWT payload is invalid (one or more agent)');
			reject(serverHelper.ForbiddenError('User is not properly authenticated'));
			hadError = true;
		}

		// Make sure the agencyNetwork is what we are expecting
		if (typeof req.authentication.agencyNetwork !== 'number' && typeof req.authentication.agencyNetwork !== 'boolean') {
			log.info('Forbidden: JWT payload is invalid (agencyNetwork)');
			reject(serverHelper.ForbiddenError('User is not properly authenticated'));
			return;
		}

		// Additional validation for group administrators
		if (req.authentication.agencyNetwork) {
			// Validate the agency network ID
			if (!await validator.is_valid_id(req.authentication.agencyNetwork)) {
				log.info('Forbidden: User is not authenticated (agencyNetwork)');
				reject(serverHelper.ForbiddenError('User is not properly authenticated'));
				return;
			}

			// Make sure this user has insurers
			if (!Object.prototype.hasOwnProperty.call(req.authentication, 'insurers')) {
				log.info('Forbidden: User is not authenticated');
				reject(serverHelper.ForbiddenError('User is not authenticated'));
				return;
			}
		} else if (req.authentication.agents.length > 1) {
			// Agencies can only have one agent in their payload
			log.info('Forbidden: JWT payload is invalid (too many agents)');
			reject(serverHelper.ForbiddenError('User is not properly authenticated'));
			return;
		}

		// Make sure the User ID is valid
		if (!await validator.agency_portal_user(req.authentication.userID)) {
			log.info('Forbidden: JWT payload is invalid (invalid User ID)');
			reject(serverHelper.ForbiddenError('User is not properly authenticated'));
			return;
		}

		// Everything looks okay
		fulfill(true);
	});
};