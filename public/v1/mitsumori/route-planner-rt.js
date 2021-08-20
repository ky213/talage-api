/* eslint-disable require-jsdoc */

"use strict";
const serverHelper = require("../../../server.js");
const ApplicationBO = global.requireShared("models/Application-BO.js");

// dummy endpoint to stimulate routing
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
        nextRouteName = await getRoute(req.query.currentRoute, req.query.appId, req.header('authorization').replace("Bearer ", ""));
    }

    res.send(200, nextRouteName);
}
//, appId, redisKey
const getRoute = async(currentRoute, appId) => {
    let app = null;
    // if redis agency network id then pull it
    const redisVal = null;
    // otherwise 
    if(redisVal ){
        // if the network Id is not equla to one
        // grab the network route
        // if the custom route exists then use it
        // else nothing the default route will kick in
    }else {
        // else grab current id from application
        app = await getApplication(appId);
        if(app.agencyNetworkId){
            // store the networkId into redis
        }
        // if application agency network is not wheelhouse, currently 1 the do stuff
        if(app.agencyNetworkId !== 1){
            const customRoutingFlow = agencyNetworkDB.featureJson.appCustomRoutingFlow;
            // if there is custom routing flow then 
            if(customRoutingFlow){
                // if current route is locations then check to see if application has billing if not then route to billing else route to the customroute
                if(currentRoute === "_locations"){
                    if(app.locations && app.locations.some(location => location.billing)){
                        return customRoutingFlow["_mailing-address"];
                    }else{
                        return "_mailing-address";
                    }
                }
                const route = customRoutingFlow[currentRoute];
                if(route){
                    return route;
                }else {
                    log.error(`Error retrieving custom flow for agencyNetworkId ${app.agencyNetworkId}, application ${appId} ` + __location);
                }
            }
        }
    }
    
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
            if(app == null){
                app = await getApplication(appId);
            }
            // if there are locations and one is set as the mailing address, skip mailing page
            if(app.locations && app.locations.some(location => location.billing)){
                return "_questions";
            }
            return "_mailing-address";
        case "_mailing-address":
            return "_questions";
        case "_questions":
            return "_quotes";
        default:
            break;
    }
}

const getApplication = async(appId) => {
    const applicationBO = new ApplicationBO();
    const applicationDB = await applicationBO.getById(appId);
    return applicationDB;
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthQuoteApp("Get Next Route", `${basePath}/get-route`, getNextRoute);
}