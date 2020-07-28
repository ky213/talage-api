/**
 * Provides functions for authenticating users
 *
 * FROM: agency-portal/api
 */

'use strict';

const validator = global.requireShared('helpers/validator.js');
const serverHelper = require('../../../../server.js');

/**
 * Returns a list of agents that this user is permitted to access. You must call validateJWT() before using this method.
 *
 * @param {object} req - The Restify request object
 * @return {Promise.<array, ServerError>} A promise that returns an array of agent IDs on success, or a ServerError on failure
 */
exports.getAgents = async function (req) {
	// Localize data variables that the user is permitted to access
	const agencyNetwork = req.authentication.agencyNetwork;
	let error = false;

	// If this user does not have sufficient permissions to make decisions for themselves, just return what is allowed
	if (!agencyNetwork) {
		// Log.info(`allowed agents: `)
		return req.authentication.agents;
	}

	// Make sure this agency network is allowed to access all agents they requested
	const agencySQL = `
		SELECT \`id\`
		FROM \`#__agencies\`
		WHERE \`agency_network\` = ${db.escape(agencyNetwork)};
	`;
	const agencyResult = await db.query(agencySQL).catch(function (e) {
		log.error(e.message);
		error = serverHelper.internalError('Error querying database. Check logs.');
	});
	if (error) {
		return error;
	}

	// Everything appears to be okay, return the requested agents
	return agencyResult.map(function (agency) {
		return agency.id;
	});
};

/**
 * Validates that the JWT includes the parameters we are expecting
 *
 * @param {object} req - The Restify request object
 * @param {string} permission - Required permissions
 * @param {string} permissionType - Required permissions type
 * @return {string} null on success, error message on error
 */
exports.validateJWT = async function (req, permission, permissionType) {
	try {
		// NOTE: This function should be moved to a shared module. That module should also token creation

		// Tokens should have a 'namespace' added for where they are valid, in addition to a permission and permissionType.
		// That namespace should be 'agency-portal' or 'administration'
		// Then we can validate the tokens using the namespace, permission, permissionType, and different requirements.
		// For now, detect if the permission is "administration" and validate just it until we can refactor to include
		// a validation namespace.

		// Administration validation
		// ====================================================================================================
		if (permission && permission === 'administration') {
			if (!req.authentication.permissions[permission][permissionType]) {
				log.info('Forbidden: User does not have the correct permissions');
				return 'User does not have the correct permissions';
			}
			return null;
		}

		// Agency Portal validation
		// ====================================================================================================

		// Make sure this user is authenticated
		if (!Object.prototype.hasOwnProperty.call(req, 'authentication') || !req.authentication) {
			log.info('Forbidden: User is not authenticated');
			return 'User is not authenticated';
		}
		// Make sure the authentication payload has everything we are expecting
		if (!Object.prototype.hasOwnProperty.call(req.authentication, 'agents') || !Object.prototype.hasOwnProperty.call(req.authentication, 'userID') || !Object.prototype.hasOwnProperty.call(req.authentication, 'permissions')) {
			log.info('Forbidden: JWT payload is missing parameters');
			return 'User is not properly authenticated';
		}

		// Make sure the agents are what we are expecting
		if (typeof req.authentication.agents !== 'object') {
			log.info('Forbidden: JWT payload is invalid (agents)');
			return 'User is not properly authenticated';
		}

		// Check for the correct permissions
		if (permission && permissionType) {
			if (!req.authentication.permissions[permission][permissionType]) {
				log.info('Forbidden: User does not have the correct permissions');
				return 'User does not have the correct permissions';
			}
		}

		// Make sure each of the agents are valid
		const agentIDs = [];
		for (let i = 0; i < req.authentication.agents.length; i++) {
			const agent = req.authentication.agents[i];
			// Check the type
			if (typeof agent !== 'number') {
				log.info('Forbidden: JWT payload is invalid (single agent)');
				return 'User is not properly authenticated';
			}

			// Add this Agent ID to the list of IDs
			agentIDs.push(agent);
		}

		// Make sure the agencyNetwork is what we are expecting
		if (typeof req.authentication.agencyNetwork !== 'number' && typeof req.authentication.agencyNetwork !== 'boolean') {
			log.info('Forbidden: JWT payload is invalid (agencyNetwork)');
			return 'User is not properly authenticated';
		}

		// Additional validation for group administrators
		if (req.authentication.agencyNetwork) {
			// Validate the agency network ID
			if (!(await validator.is_valid_id(req.authentication.agencyNetwork))) {
				log.info('Forbidden: User is not authenticated (agencyNetwork)');
				return 'User is not properly authenticated';
			}

			// Make sure this user has insurers
			if (!Object.prototype.hasOwnProperty.call(req.authentication, 'insurers')) {
				log.info('Forbidden: User is not authenticated');
				return 'User is not authenticated';
			}
		} else if (req.authentication.agents.length > 1) {
			// Agencies can only have one agent in their payload
			log.info('Forbidden: JWT payload is invalid (too many agents)');
			return 'User is not properly authenticated';
		}

		// Make sure the User ID is valid
		if (!(await validator.agency_portal_user(req.authentication.userID))) {
			log.info('Forbidden: JWT payload is invalid (invalid User ID)');
			return 'User is not properly authenticated';
		}
	} catch (error) {
		return `An unknown error occurred when validating the JWT: ${error}`;
	}

	// Success
	return null;
};
