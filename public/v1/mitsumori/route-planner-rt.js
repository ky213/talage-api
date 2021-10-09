/* eslint-disable require-jsdoc */

"use strict";
const ttlSeconds = 3600; // Used for redis storage
const serverHelper = require("../../../server.js");
const ApplicationBO = global.requireShared("models/Application-BO.js");
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO');
const AmTrustAgencyNetworkId = 10;
async function getNextRoute(req, res, next){
    // Check that at least some post parameters were received
    // Let basic through with no app id
    const listOfInitialLandingPages = ["_basic", "_am-basic"]
    if (!req.query.currentRoute || !req.query.appId && listOfInitialLandingPages.indexOf(req.query.currentRoute) === -1) {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }

    if(req.userTokenData.applicationId !== req.query.appId){
        log.warn("Unauthorized attempt to access Application routing" + __location);
        res.send(403);
        return;
    }
    let nextRouteName = null;

    // TODO: find a more graceful approach to this, if we have a bunch of basic pages things will get out of hand really fast
    if(req.query.currentRoute === "_basic" || req.query.currentRoute === "_am-basic" || req.query.currentRoute === "_am-basic-created" || req.query.currentRoute === "_basic-created"){
        nextRouteName = "_policies";
    }
    else {
        let userSessionMetaData = null;
        if(req.userTokenData){
            userSessionMetaData = req.userTokenData.userSessionMetaData;
        }
        nextRouteName = await getRoute(req.header('authorization').replace("Bearer ", ""), userSessionMetaData, req.query.currentRoute, req.query.appId);
    }

    res.send(200, nextRouteName);
}

/**
 * Gets the next route, if custom route exists for an agency network it utilized that else defaults to the wheelhouse routes flow
 * @param {string} jwtToken - Request jwtToken
 * @param {object} userSessionMetaData - contains info related to current user session
 * @param {string} currentRT - The current route of the application flow (not application as in software application)
 * @param {string} appId - Application Id (application the user is filling out)
 *
 * @returns {string}  Returns the next route, either based on the custom flow for agencyNetwork or the default for wheelhouse if one not found
 */
const getRoute = async(jwtToken, userSessionMetaData, currentRT, appId) => {
    // copy the current route (currentRT) value into a local variable which might change based on whether locations have a mailing address
    let currentRoute = currentRT;
    let application = null;
    // if we do not have mailing route to the mailing address, else continue through flow bypassing mailing page
    if(currentRoute === "_locations"){
        // first occurance of application, no need to check
        application = await getApplication(appId);
        if(application.locations){
            const haveMailingAddress = application.locations.some(location => location.billing) === true;
            if(haveMailingAddress === true){
                // since we already have a mailing address, assumption is we will bypass mailing by setting current route to mailing-address
                currentRoute = "_mailing-address";
            }
            else {
                return "_mailing-address";
            }
        }
    }
    // if redis userSessionMetaData has agencyNetwork id then grab it
    let agencyNetworkId = null;
    if(userSessionMetaData){
        log.debug(`UserSessionMetaData from redis ${JSON.stringify(userSessionMetaData)} ${__location}`);
        agencyNetworkId = userSessionMetaData.agencyNetworkId;
    }
    else{
        // else just for debugging
        log.debug(`No userSessionMetaData found, value returned by redis: ${userSessionMetaData} ${__location}`);
    }

    if(agencyNetworkId == null){
        if(!application){
            application = await getApplication(appId);
        }

        // We don't have agency networkId so we will grab it from application
        agencyNetworkId = application.agencyNetworkId;
        // If we have agencyNetworkId
        if(agencyNetworkId){
            // Save agencyNetworkId into redis
            await putUserSessionMetaData(jwtToken, {'agencyNetworkId': agencyNetworkId});
        }
        else{
            // log the warning and continue with default routing
            log.warn(`Missing agencyNetworkId from application ${appId} ${__location}`);
        }
    }

    let nextRoute = "_unknown";
    let customRouteFlowObj = null;

    // if we agency network id  is not equal to 1 (wheelhouse) and not equal 2 (digalent) we check for custom routes
    if(agencyNetworkId && agencyNetworkId !== 1 && agencyNetworkId !== 2){
        //look at boolean value for checkedForCustomRouting (ensures we don't just rely on Agency network id being in redis to determine
        //if we checked for custom route for an agency network)
        let checkedForCustomRouting = false;
        if(userSessionMetaData){
            checkedForCustomRouting = userSessionMetaData.checkedForCustomRouting;
        }
        // if we have already checked custom routing on the application then we look in redis to see for the custom routing object
        if(checkedForCustomRouting === true){
            customRouteFlowObj = userSessionMetaData.quoteAppCustomRouting;
        }
        else{
            // otherwise we look on the application for the custom routing
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkDB = await agencyNetworkBO.getById(agencyNetworkId);
            customRouteFlowObj = agencyNetworkDB.quoteAppCustomRouting;
            await putUserSessionMetaData(jwtToken, {
                'quoteAppCustomRouting': customRouteFlowObj,
                'checkedForCustomRouting': true
            });
        }
        // if we have custom route flow we grab the next route
        if(customRouteFlowObj){
            nextRoute = getNextRouteCustom(customRouteFlowObj, currentRoute, appId, userSessionMetaData?.agencyNetworkId);
        }
        else if(agencyNetworkId === AmTrustAgencyNetworkId){
            log.error(`Missing quoteAppCustomRouting property for Am Trust. Please Review agencyNetworkId ${agencyNetworkId} ${__location}`);
        }
    }
    // Default routes path
    // TODO: @raja, should we use a boolean to determine this, or are we good assuming if no customRouteFlowObj this is the case
    if(!customRouteFlowObj){
        nextRoute = getNextRouteDefault(currentRoute, appId);
    }

    nextRoute = checkForSkip(nextRoute, customRouteFlowObj, application, appId, userSessionMetaData?.agencyNetworkId);

    return nextRoute;
}

// take both application and app id in case we need to look up the application (this is the first place it is needed)
const checkForSkip = async(nextRoute, customRouteFlowObj, application, appId, agencyNetworkId) => {
    let next = nextRoute;

    // skip officers if only cyber policy
    if(nextRoute === "_officers"){
        if(!application){
            application = await getApplication(appId);
        }
        if(application.policies?.length === 1 && application.policies.some(p => p.policyType === "CYBER")){
            if(customRouteFlowObj){
                next = getNextRouteCustom(customRouteFlowObj, nextRoute, appId, agencyNetworkId);
                log.debug(`skipping from ${nextRoute} to ${next} on app ${appId} ${__location}`);
            }
            else{
                next = getNextRouteDefault(nextRoute, appId);
                log.debug(`skipping from ${nextRoute} to ${next} on app ${appId} ${__location}`);
            }
        }
    }
    return next;
}

const getNextRouteDefault = (currentRoute, appId) => {
    switch(currentRoute){
        case "_policies":
            return "_business-questions"
        case "_business-questions":
            return "_officers";
        case "_officers":
            return "_claims";
        case "_claims":
            return "_locations";
        case "_locations":
            return "_mailing-address";
        case "_mailing-address":
            return "_questions";
        case "_questions":
            return "_quotes";
        default:
            log.warn(`User trying to navigate from a route not part of their application flow for application ${appId}, on current route of ${currentRoute} ${__location}`);
            return "_unknown";
    }
}

const getNextRouteCustom = (customRouteFlowObj, currentRoute, appId, agencyNetworkId) => {
    // If there is a custom route flow we will save it into redis
    const customRoute = customRouteFlowObj[currentRoute];
    // if the next route exists we return it else we log error and let app continue via default route
    if(customRoute && customRoute.next){
        return customRoute.next;
    }
    else {
        log.error(`Missing next route for current route ${currentRoute} from quoteAppCustomRouting schema for agencyNetwork ${agencyNetworkId}, applicationId ${appId} ${__location}`);
        return "_unknown";
    }
}

// Returns the Application BO object
const getApplication = async(appId) => {
    const applicationBO = new ApplicationBO();
    const applicationDB = await applicationBO.getById(appId);
    return applicationDB;
}
// Stores (puts) application meta data into Redis
const putUserSessionMetaData = async(jwtToken, params) => {
    if(Object.keys(params).length === 0){
        log.error(`No Metadata provided for Application ${__location}`);
        return;
    }
    const redisKey = jwtToken;
    const redisValue = await global.redisSvc.getKeyValue(redisKey);
    if(redisValue.found){
        const redisJSON = JSON.parse(redisValue.value);
        // if userSessionMetaData has not been defined yet, define it
        if(!redisJSON.userSessionMetaData){
            redisJSON.userSessionMetaData = {};
        }
        // Save all user redis metadata under userSession
        Object.keys(params).forEach(async key => {
            redisJSON.userSessionMetaData[key] = params[key];
        });

        const redisSetResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(redisJSON), ttlSeconds);
        if(!redisSetResponse.saved){
            log.error(`Failed to save for redis key: ${redisKey}` + __location);
            return;
        }
    }
    else{
        log.error(`Could not find redis value for key: ${redisKey}` + __location);
        return;
    }

    log.debug(`Saved metadata ${JSON.stringify(params)}`);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthQuoteApp("Get Next Route", `${basePath}/get-route`, getNextRoute);
}