'use strict';

const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');


/**
 * Retrieves the information for a single user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetUserInfo(req, res, next){

    // Localize data variables that the user is permitted to access
    const agencyNetwork = parseInt(req.authentication.agencyNetwork, 10);

    // Prepare to get the information for this user, building a query based on their user type
    let userInfoSQL = '';
    if(agencyNetwork){
        userInfoSQL = `
            SELECT
                au.agency_network AS agencyNetwork,
                au.timezone_name as tz
            FROM clw_talage_agency_portal_users AS au 
            WHERE au.id = ${parseInt(req.authentication.userID, 10)}
            LIMIT 1;
			`;
    }
    else{
        userInfoSQL = `
                SELECT
                    a.agency_network AS agencyNetwork,
                    a.id AS agency,
                    a.logo,
                    a.name,
                    a.slug,
                    a.wholesale,
                    au.timezone_name as tz
                FROM clw_talage_agencies AS a
                    LEFT JOIN clw_talage_agency_portal_users AS au ON au.agency =a.id
                WHERE au.id = ${parseInt(req.authentication.userID, 10)}
                LIMIT 1;
			`;
    }

    // Going to the database to get the user's
    let error = null;
    const userInfo = await db.query(userInfoSQL).catch(function(err){
        log.error(err.message + __location);
        error = err;
    });
    if(error){
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }

    //agencynetworkBO
    //let error = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetworkJSON = await agencyNetworkBO.getById(userInfo[0].agencyNetwork).catch(function(err){
        //error = err;
        log.error("Get AgencyNetwork Error " + err + __location);
    })
    if(agencyNetworkJSON){
        userInfo[0].feature_json = agencyNetworkJSON.feature_json;
        if(agencyNetwork){
            userInfo[0].logo = agencyNetworkJSON.logo;
            userInfo[0].name = agencyNetworkJSON.name;
        }
        else {
            userInfo[0].helpText = agencyNetworkJSON.help_text
        }
    }
    log.debug(JSON.stringify(userInfo[0]));
    // Send the user's data back
    res.send(200, userInfo[0]);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get user information', `${basePath}/user-info`, GetUserInfo);
};