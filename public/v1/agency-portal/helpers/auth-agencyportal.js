/**
 * Provides functions for authenticating users
 *
 * FROM: agency-portal/api
 */

'use strict';

const validator = global.requireShared('helpers/validator.js');
const serverHelper = global.requireRootPath('server.js');


/**
 * Returns a list of agents that this user is permitted to access. You must call validateJWT() before using this method.
 *
 * @param {object} req - The Restify request object
 * @return {Promise.<array, ServerError>} A promise that returns an array of agent IDs on success, or a ServerError on failure
 */
async function getAgents(req) {
    // Localize data variables that the user is permitted to access
    let error = false;

    // If this user does not have sufficient permissions to make decisions for themselves, just return what is allowed
    if (!req.authentication.isAgencyNetworkUser) {
        // Log.info(`allowed agents: `)
        return req.authentication.agents;
    }

    const agencyNetworkId = req.authentication.agencyNetworkId;
    let agencyResult = null;
    try{
        const AgencyBO = global.requireShared('./models/Agency-BO.js');
        const agencyBO = new AgencyBO();
        // Load the request data into it
        // TODO refactor to only return systemId from BO and mongo
        agencyResult = await agencyBO.getByAgencyNetwork(agencyNetworkId);
    }
    catch(err){
        error = serverHelper.internalError('Error querying database. Check logs.');
    }

    if (error) {
        return error;
    }
    if(!agencyResult){
        return [];
    }
    // Everything appears to be okay, return the requested agents
    return agencyResult.map(function(agency) {
        return agency.systemId;
    });
}

/**
 * Validates that the JWT includes the parameters we are expecting
 *
 * @param {object} req - The Restify request object
 * @param {string} permission - Required permissions
 * @param {string} permissionType - Required permissions type
 * @return {string} null on success, error message on error
 */
async function validateJWT(req, permission, permissionType) {
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
                return 'User does not have the correct permissions';
            }
            return null;
        }

        // Agency Portal validation
        // ====================================================================================================

        // Make sure this user is authenticated
        if (!Object.prototype.hasOwnProperty.call(req, 'authentication') || !req.authentication) {
            return 'User is not authenticated';
        }
        // Make sure the authentication payload has everything we are expecting
        if (!Object.prototype.hasOwnProperty.call(req.authentication, 'agents') || !Object.prototype.hasOwnProperty.call(req.authentication, 'userID') || !Object.prototype.hasOwnProperty.call(req.authentication, 'permissions')) {
            return 'User is not properly authenticated';
        }

        // Make sure the agents are what we are expecting
        if (typeof req.authentication.agents !== 'object') {
            return 'User is not properly authenticated';
        }

        // Check for the correct permissions
        if (permission && permissionType) {
            if (!req.authentication.permissions[permission][permissionType]) {
                return 'User does not have the correct permissions';
            }
        }

        // Make sure each of the agents are valid
        for (let i = 0; i < req.authentication.agents.length; i++) {
            const agent = req.authentication.agents[i];
            // Check the type
            if (typeof agent !== 'number') {
                return 'User is not properly authenticated';
            }
        }


        // Check if older JWT with old properties
        // if (req.authentication.isAgencyNetworkUser && typeof req.authentication.agencyNetwork !== 'number') {
        //     req.authentication.isAgencyNetworkUser = req.authentication.agencyNetwork
        // }
        // else if(req.authentication.isAgencyNetworkUser && typeof req.authentication.agencyNetwork === 'number'){
        //     req.authentication.isAgencyNetworkUser = true;
        // }

        // if(req.authentication.agencyNetworkId && typeof req.authentication.agencyNetwork === 'number'){
        //     req.authentication.agencyNetworkId = req.authentication.agencyNetwork;
        // }

        // Make sure the agencyNetwork is what we are expecting
        if (req.authentication.isAgencyNetworkUser === true && typeof req.authentication.agencyNetworkId !== 'number') {
            return 'User is not properly authenticated';
        }

        // Additional validation for group administrators
        if (req.authentication.isAgencyNetworkUser === true && req.authentication.agencyNetworkId) {
            // Validate the agency network ID
            if (!await validator.is_valid_id(req.authentication.agencyNetworkId)) {
                return 'User is not properly authenticated';
            }
        }
        else if (req.authentication.agents.length > 1) {
            // Agencies can only have one agent in their payload
            return 'User is not properly authenticated';
        }

        // Make sure the User ID is user on the system - Hits database.
        if (!await validator.agency_portal_user(req.authentication.userID)) {
            //Something might be up (attack) if we get here. - BP
            return 'User is not properly authenticated';
        }
    }
    catch (error) {
        return `An unknown error occurred when validating the JWT: ${error}`;
    }
    // Success
    try{
        req.authentication.enableGlobalView = false;
        const redisKey = "apuserinfo-" + req.authentication.userID;
        const redisValue = await global.redisSvc.getKeyValue(redisKey);
        if(redisValue.found){
            const userInfoJSON = JSON.parse(redisValue.value)
            if(Object.prototype.hasOwnProperty.call(userInfoJSON, 'enableGlobalView')
                && req.authentication.isAgencyNetworkUser === true
                && req.authentication.agencyNetworkId === 1
                && req.authentication.permissions.talageStaff === true){

                req.authentication.enableGlobalView = userInfoJSON.enableGlobalView
            }
        }
    }
    catch(err){
        log.error(`getting user redis cache ${err}` + __location)
    }


    return null;
}


/**
 * Determine if User is Authorized to manage an Agency
 *
 * @param {object} req - The Restify request object
 * @param {integer} agencyId - AgencyId (systemId) required
 * @param {integer} agencyNetworkId - agencyNetworkId - Optional
 * @return {string} null on success, error message on error
 */
async function authorizedForAgency(req, agencyId, agencyNetworkId){
    if(typeof agencyId === 'string'){
        agencyId = parseInt(agencyId, 10);
    }
    if(agencyId > 0){
        if(req.authentication.isAgencyNetworkUser
            && req.authentication.agencyNetworkId === 1
            && req.authentication.permissions.talageStaff === true){
            return true;
        }
        if(req.authentication.isAgencyNetworkUser){
            if(!agencyNetworkId){
                let error = false;
                try{
                    const AgencyBO = global.requireShared(`./models/Agency-BO.js`)
                    const agencyBO = new AgencyBO();
                    const agencyJSON = await agencyBO.getById(agencyId, false, false);
                    agencyNetworkId = agencyJSON?.agencyNetworkId;
                }
                catch(err){
                    error = true;
                }
                if(error){
                    return false;
                }
            }
            return agencyNetworkId === req.authentication.agencyNetworkId
        }
        else {
            return parseInt(req.authentication.agents[0], 10) === agencyId
        }
    }
    else {
        log.warn(`authorizedForAgency missing agencyId` + __location)
        return false;
    }

}

module.exports = {
    authorizedForAgency: authorizedForAgency,
    validateJWT: validateJWT,
    getAgents: getAgents
}