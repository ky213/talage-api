'use strict';
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

/**
 * Responds to get requests for the userGroups endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getUserGroups(req, res, next){
    let userGroups = null;
    try{
        let agencyNetworkRoles = false;
        if(req.query.forAgencyNetwork){
            agencyNetworkRoles = true;
        }
        const agencyPortalUserBO = new AgencyPortalUserBO();
        userGroups = await agencyPortalUserBO.getGroupList({},agencyNetworkRoles);
    }
    catch(err){
        log.error('agencyPortalUserBO error ' + err + __location);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }



    // Return the response
    res.send(200, userGroups);
    return next();
}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get User Groups', `${basePath}/user-groups`, getUserGroups);
};