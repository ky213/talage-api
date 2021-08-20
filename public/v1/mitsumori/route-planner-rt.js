/* eslint-disable require-jsdoc */

"use strict";
const ttlSeconds = 3600; // Used for redis storage
const serverHelper = require("../../../server.js");
const ApplicationBO = global.requireShared("models/Application-BO.js");
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO');

async function getNextRoute(req, res, next){
    // Check that at least some post parameters were received
    // Let basic through with no app id
    if (!req.query.currentRoute || !req.query.appId && req.query.currentRoute !== "_basic") {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }

    if(req.userTokenData.applicationId !== req.query.appId){
        log.warn("Unauthorized attempt to access Application routing" + __location);
        res.send(403);
        return;
    }

    let nextRouteName = null;
    if(req.query.currentRoute === "_basic" || req.query.currentRoute === "_basic-created"){
        nextRouteName = "_policies";
    }
    else {
        nextRouteName = await getRoute(req.header('authorization').replace("Bearer ", ""), req.query.currentRoute, req.query.appId);
    }

    res.send(200, nextRouteName);
}
/**
 * Gets the next route, if custom route exists for an agency network it utilized that else defaults to the wheelhouse routes flow
 * @param {string} reqHeader - Request object header
 * @param {string} currentRoute - The current route of the application flow (not application as in software application)
 * @param {string} appId - Application Id (application the user is filling out)
 *
 * @returns {string}  Returns the next route, either based on the custom flow for agencyNetwork or the default for wheelhouse if one not found
 */
const getRoute = async(reqHeader, currentRoute, appId) => {
    // if our current route is locations, check if we have mailing, 
    // if we do not have mailing route to the mailing address, else continue through flow bypassing mailing
    if(currentRoute === "_locations"){
        const app = await getApplication(appId);
        if(app.locations && app.locations.some(location => location.billing) === true){
            // since we already have a mailing address, assumption is we will bypass mailing by setting current route to mailing-address
            currentRoute =  "_mailing-address";
        }
    }
    // if redis has agencyNetwork id then grab it
    const appMetaData = await getApplicationMeta(reqHeader);
    if(appMetaData){
        log.debug(`appMetaData from redis ${JSON.stringify(appMetaData)} ${__location}`);
    }else {
        log.debug(`No appMetaData found, value returned by redis: ${appMetaData} ${__location}`);
    }
    if(appMetaData && appMetaData.agencyNetworkId){
        // if we have agency network id and it is not 1 we check for custom routes
        if(appMetaData.agencyNetworkId !== 1){
            const customRoutesFlow = appMetaData.appCustomRouteFlow;
            // if we have custom route flow we grab the next route
            if(customRoutesFlow){
                const nextRoute = customRoutesFlow[currentRoute];
                // if the next route exists we return it else we log error and let app continue via default route
                if(nextRoute){
                    return nextRoute;
                }else {
                    log.warn(`Missing next route for current route ${currentRoute} from appCustomRouteFlow schema for agencyNetwork ${appMetaData.agencyNetworkId}, applicationId ${appId} ${__location}`);
                }
            }
        }
    }else {
        // We don't have agency networkId so we will grab it from application
        const app = await getApplication(appId);
        const agencyNetworkId = app.agencyNetworkId;
        log.debug(`agencyNetworkId ${agencyNetworkId}`);
        // If we have agencyNetworkId
        if(agencyNetworkId){
            // Save agencyNetworkId into redis
            await putApplicationMeta(reqHeader, {'agencyNetworkId': agencyNetworkId});
            // If agencyNetworkId is not 1 we will see if the agencyNetorkFeatures object has an appCustomRouteFlow object
            if(agencyNetworkId !== 1){
                const agencyNetworkBO = new AgencyNetworkBO();
                const agencyNetworkDB = await agencyNetworkBO.getById(agencyNetworkId);
                const customRouteFlowObj = agencyNetworkDB.featureJson.appCustomRouteFlow;
                if(customRouteFlowObj){
                    // If there is a custom route flow we will save it into redis
                    await putApplicationMeta(reqHeader, {'appCustomRouteFlow': customRouteFlowObj});
                    // we will grab the next route
                    const nextRoute = customRouteFlowObj[currentRoute];
                    // if the next route is valid (meaning not undefined or null) we will return it
                    if(nextRoute){
                        return nextRoute;
                    }
                    else {
                        // otherwise we will log a warning and continue so default functionality will kick in towards end of function
                        log.warn(`Missing next route for current route ${currentRoute} from appCustomRouteFlow schema for agencyNetwork ${appMetaData.agencyNetworkId}, applicationId ${appId} ${__location}`);
                    }
                }
            }
        }else {
            // log the warning and continue with default routing
            log.warn(`Missing agencyNetworkId from app ${appId} ${__location}`);
        }
    }
    // Default routes path
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
            break;
    }
}
// Returns the Application BO object
const getApplication = async(appId) => {
    const applicationBO = new ApplicationBO();
    const applicationDB = await applicationBO.getById(appId);
    return applicationDB;
}
// Retrieves meta data for an application from Redis
 const getApplicationMeta = async (reqHeader) => {
    const redisKey = reqHeader;
    const redisValue = await global.redisSvc.getKeyValue(redisKey);
    if(redisValue.found){
        const redisJSON = JSON.parse(redisValue.value);
        // Only return the client session
        if(redisJSON.clientSession){
            return redisJSON.clientSession;
        }
    }
        return null;
}
// Stores (puts) application meta data into Redis
const putApplicationMeta = async (reqHeader, params) => {
    if(Object.keys(params).length === 0){
        log.error(`No Metadata provided for Application ${__location}`);
        return;
    }
    const redisKey = reqHeader;
    const redisValue = await global.redisSvc.getKeyValue(redisKey);
    if(redisValue.found){
        const redisJSON = JSON.parse(redisValue.value);
        // if clientSession has not been defined yet, define it
        if(!redisJSON.clientSession)
        {
            redisJSON.clientSession = {};
        }
        // Save all client redis metadata under clientSession
        Object.keys(params).forEach(async key => {
            redisJSON.clientSession[key] = params[key];
        });

        const redisSetResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(redisJSON), ttlSeconds);
        if(!redisSetResponse.saved){
            log.error(`Failed to save for redis key: ${redisKey}` + __location);
            return;
        }
    }else{
        log.error(`Could not find redis value for key: ${redisKey}` + __location);
        return;
    }

    log.debug(`Saved metadata ${JSON.stringify(params)}`);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthQuoteApp("Get Next Route", `${basePath}/get-route`, getNextRoute);
}