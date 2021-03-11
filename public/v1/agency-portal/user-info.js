'use strict';

const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');


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
    const isAgencyNetworkUser = req.authentication.isAgencyNetworkUser
    const agencyNetwork = parseInt(req.authentication.agencyNetworkId, 10);

    // Prepare to get the information for this user, building a query based on their user type
    let userInfoSQL = '';
    if(isAgencyNetworkUser){
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
                    agency,
                    timezone_name as tz
                FROM clw_talage_agency_portal_users
                WHERE id = ${parseInt(req.authentication.userID, 10)}
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
    let agencyNetworkId = null;
    if(isAgencyNetworkUser){
        agencyNetworkId = userInfo[0].agencyNetwork;
    }
    else {
        //load AgencyBO
        try{
            // Load the request data into it
            const agencyBO = new AgencyBO();
            const agency = await agencyBO.getById(userInfo[0].agency);
            if(agency){
                agencyNetworkId = agency.agencyNetworkId;
                userInfo[0].logo = agency.logo; // TODO: DELETE -- keep for backward compat till next sprint
                userInfo[0].logoUrl = `${global.settings.IMAGE_URL}/public/agency-network-logos/${agency.logo}`
                userInfo[0].name = agency.name;
                userInfo[0].slug = agency.slug;
                userInfo[0].wholesale = agency.wholesale;
            }
        }
        catch(err){
            log.error("agencyBO.getById load error " + err + __location);
        }


    }

    //agencynetworkBO
    //let error = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetworkJSON = await agencyNetworkBO.getById(agencyNetworkId).catch(function(err){
        //error = err;
        log.error("Get AgencyNetwork Error " + err + __location);
    })
    if(agencyNetworkJSON){
        userInfo[0].feature_json = agencyNetworkJSON.feature_json;
        if(!agencyNetworkJSON.additionalInfo){
            log.error("additionalInfo was not present on agencyNetwork: " + agencyNetworkJSON.id);
        }
        else if(!agencyNetworkJSON.additionalInfo.contactEmailAddress){
            log.error("contactEmailAddress was not present on additionalInfo for agencyNetwork: " + agencyNetworkJSON.id);
        }
        else {
            userInfo[0].contactEmailAddress = agencyNetworkJSON.additionalInfo.contactEmailAddress;
        }
        if(agencyNetwork){
            userInfo[0].logo = agencyNetworkJSON.logo; // TODO: DELETE -- keep for backward compat till next sprint
            userInfo[0].logoUrl = `${global.settings.IMAGE_URL}/public/agency-network-logos/${agencyNetworkJSON.logo}`;
            userInfo[0].name = agencyNetworkJSON.name;
        }
        else {
            userInfo[0].helpText = agencyNetworkJSON.help_text
        }
    }
    // Send the user's data back
    res.send(200, userInfo[0]);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get user information', `${basePath}/user-info`, GetUserInfo);
};