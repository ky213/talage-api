/* eslint-disable max-statements-per-line */
'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

/**
 * Responds to get requests for the users endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getUsers(req, res, next){
    let error = false;
    const query = {};
    // eslint-disable-next-line no-unused-vars
    //  let where = ``;
    let retrievingAgencyUsersForAgencyNetwork = false;
    let getAgencyNetworkRoles = false;
    // Authentication required since endpoint serves users now for network agency for an agency
    // if network agency and wanting agency info confirm the agency is part of the network
    const jwtErrorMessage = await auth.validateJWT(req, req.authentication.isAgencyNetworkUser ? 'agencies' : 'users', 'view');
    if(jwtErrorMessage){
        return next(serverHelper.forbiddenError(jwtErrorMessage));
    }

    if(req.authentication.isAgencyNetworkUser && req.query.agency){
        const agencies = await auth.getAgents(req).catch(function(e){error = e;})
        if(error){
            return next(error);
        }
        if (!await validator.integer(req.query.agency)) {
            log.warn(`Agency validation error: ${__location}`)
            return next(serverHelper.notFoundError('Agency is invalid'));
        }
        if (!agencies.includes(parseInt(req.query.agency, 10))) {
            log.warn(`Agency network tried to modify agency that is not part of its network. ${__location}`);
            return next(serverHelper.notFoundError('Agency is invalid'));
        }
        retrievingAgencyUsersForAgencyNetwork = true;
    }
    else if (req.authentication.isAgencyNetworkUser){
        query.agencynetworkid = parseInt(req.authentication.agencyNetworkId, 10);
        getAgencyNetworkRoles = true;
    }
    else {
        // Get the agents that we are permitted to view
        const agents = await auth.getAgents(req).catch(function(e){
            error = e;
        });
        if (error){
            return next(error);
        }

        query.agencyid = parseInt(agents[0], 10);
    }

    let users = null;
    if(retrievingAgencyUsersForAgencyNetwork){
        try{
            const agencyPortalUserBO = new AgencyPortalUserBO();
            users = await agencyPortalUserBO.getByAgencyId(parseInt(req.query.agency, 10));
        }
        catch(err){
            log.error('DB query failed while retrieving agency users for agency network: ' + err.message + __location);
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        }
    }
    else {
        try{
            const agencyPortalUserBO = new AgencyPortalUserBO();
            const addPermissions = true;
            users = await agencyPortalUserBO.getList(query, addPermissions);
        }
        catch(err){
            log.error('DB query failed while trying to retrieve users' + err.message + __location);
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        }
    }


    // Sort the list by email address
    users.sort(function(a, b){
        return a.email > b.email ? 1 : -1;
    });

    let userGroups = null;
    try{
        const agencyPortalUserBO = new AgencyPortalUserBO();
        userGroups = await agencyPortalUserBO.getGroupList(getAgencyNetworkRoles);
    }
    catch(err){
        log.error('agencyPortalUserBO error ' + err + __location);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }

    // Return the response
    res.send(200, {
        "userGroups": userGroups,
        "users": users
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get users', `${basePath}/users`, getUsers, 'users', 'view');
};