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

const getRoute = async(currentRoute, appId, redisKey) => {
    // will probably grab info about application and determine the next route but for now use the current route to just go to the next one we have hardcoded
    // const applicationBO = new ApplicationBO();
    // const applicationDB = await applicationBO.loadfromMongoByAppId(appId);

    switch(currentRoute){
        case "_policies":
            return "_businessQuestions"
        case "_businessQuestions":
            return "_officers";
        case "_officers":
            return "_claims";
        case "_claims":
            return "_locations";
        case "_locations":
            return "_mailingAddress";
        case "_mailingAddress":
            return "_questions";
        case "_questions":
            return "_quotes";
        default:
            break;
    }
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthQuoteApp("Get Next Route", `${basePath}/get-route`, getNextRoute);
}