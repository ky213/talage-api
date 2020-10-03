'use strict';
const serverHelper = require('../../../server.js');
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
    // // Get the user groups, excluding 'Administrator' for now as this permission is currently unused. It will be added soon.
    // const userGroupsSQL = `
    // 		SELECT
    // 			\`id\`,
    // 			\`name\`,
    // 			\`permissions\`
    // 		FROM \`#__agency_portal_user_groups\`
    // 		WHERE \`id\` != 3 and name != 'Talage Super User';
    // 	`;
    // //TODO Fix Catch logic
    // const userGroups = await db.query(userGroupsSQL).catch(function(err){
    //     log.error('__agency_portal_user_groups error ' + err + __location);
    // 	return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    // });
    let userGroups = null;
    try{
        const agencyPortalUserBO = new AgencyPortalUserBO();
        userGroups = await agencyPortalUserBO.getGroupList();
    }
    catch(err){
        log.error('__agency_portal_user_groups error ' + err + __location);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }



    // Return the response
    res.send(200, userGroups);
    return next();
}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get User Groups', `${basePath}/user-groups`, getUserGroups);
};