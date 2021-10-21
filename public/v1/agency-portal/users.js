/* eslint-disable max-statements-per-line */
'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

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
        const agencyId = parseInt(req.query.agency, 10);
        const agencyBO = new AgencyBO();
        const agencydb = await agencyBO.getById(agencyId);
        if(agencydb?.agencyNetworkId !== req.authentication.agencyNetworkId){
            log.info('Forbidden: User is not authorized to manage th is user');
            return next(serverHelper.forbiddenError('You are not authorized to manage this user'));
        }

        retrievingAgencyUsersForAgencyNetwork = true;
    }
    else if (req.authentication.isAgencyNetworkUser){
        query.agencyNetworkId = parseInt(req.authentication.agencyNetworkId, 10);
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

        query.agencyId = parseInt(agents[0], 10);
    }

    let users = null;
    if(retrievingAgencyUsersForAgencyNetwork){
        try{
            const agencyPortalUserBO = new AgencyPortalUserBO();
            users = await agencyPortalUserBO.getByAgencyId(parseInt(req.query.agency, 10));
            users.forEach((user) => {
                user.id = user.agencyPortalUserId
            })
        }
        catch(err){
            log.error('DB query failed while retrieving agency users for agency network: ' + err.message + __location);
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        }
    }
    else {
        try{
            log.debug(`agencyPortalUserBO.getList(query ${JSON.stringify(query)}` + __location)
            const agencyPortalUserBO = new AgencyPortalUserBO();
            const addPermissions = true;
            users = await agencyPortalUserBO.getList(query, addPermissions);
            users.forEach((user) => {
                user.id = user.agencyPortalUserId
            })
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