'use strict';

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');


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
    // Default logoName
    let logoName = '1-wheelhouse.png';

    let userId = 0;
    try{
        userId = parseInt(req.authentication.userID, 10)
    }
    catch(err){
        log.error(`Could not convert userID ${req.authentication.userID} to int. error ${err} ` + __location);
    }
    if(userId === 0){
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }
    let error = null;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const userInfo = await agencyPortalUserBO.getById(userId).catch(function(e) {
        log.error(e.message + __location);
        res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
        error = true;
    });
    if (error) {
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }
    if(!userInfo.timezoneName){
        userInfo.timezoneName = "America/Los_Angeles"
        userInfo.timezone_name = "America/Los_Angeles"
    }
    userInfo.tz = userInfo.timezoneName;

    let agencyNetworkId = null;
    if(isAgencyNetworkUser){
        agencyNetworkId = userInfo.agencyNetworkId;
    }
    else {
        //load AgencyBO
        try{
            // Load the request data into it
            const agencyBO = new AgencyBO();
            const agency = await agencyBO.getById(userInfo.agencyId);
            if(agency){
                agencyNetworkId = agency.agencyNetworkId;
                if(agency.hasOwnProperty('logo')){
                    logoName = agency.logo;
                }
                userInfo.logo = logoName; // TODO: DELETE -- keep for backward compat till next sprint
                userInfo.logoUrl = `${global.settings.IMAGE_URL}/public/agency-network-logos/${logoName}`
                userInfo.name = agency.name;
                userInfo.slug = agency.slug;
                userInfo.wholesale = agency.wholesale;
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
        userInfo.feature_json = agencyNetworkJSON.featureJson;
        if(!agencyNetworkJSON.additionalInfo){
            log.error("additionalInfo was not present on agencyNetwork: " + agencyNetworkJSON.id);
        }
        else if(!agencyNetworkJSON.additionalInfo.contactEmailAddress){
            log.error("contactEmailAddress was not present on additionalInfo for agencyNetwork: " + agencyNetworkJSON.id);
        }
        else {
            userInfo.contactEmailAddress = agencyNetworkJSON.additionalInfo.contactEmailAddress;
        }
        if(agencyNetwork){
            if(agencyNetworkJSON.hasOwnProperty('logo')){
                logoName = agencyNetworkJSON.logo;
            }
            userInfo.logo = logoName; // TODO: DELETE -- keep for backward compat till next sprint
            userInfo.logoUrl = `${global.settings.IMAGE_URL}/public/agency-network-logos/${logoName}`;
            userInfo.name = agencyNetworkJSON.name;
        }
        else {
            userInfo.helpText = agencyNetworkJSON.help_text
        }
    }
    // Send the user's data back
    res.send(200, userInfo);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get user information', `${basePath}/user-info`, GetUserInfo);
};