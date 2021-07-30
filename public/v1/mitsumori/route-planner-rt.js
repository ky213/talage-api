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
const getRoute = async(currentRoute, appId, token) => {
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
            const app = await getApplication(appId);
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
    // TODO: should we verify token here or does our auth do enough to prevent it?
    const applicationBO = new ApplicationBO();
    const applicationDB = await applicationBO.getById(appId);
    return applicationDB;
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthQuoteApp("Get Next Route", `${basePath}/get-route`, getNextRoute);
}