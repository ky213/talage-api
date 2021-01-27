/* eslint-disable require-jsdoc */

"use strict";
const serverHelper = require("../../../server.js");

// dummy endpoint to stimulate routing
async function getNextRoute(req, res, next){
    // Check that at least some post parameters were received
    // Let basic through with no app id
    if (!req.query.currentRoute || !req.query.appid && req.query.currentRoute !== "basic") {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }
    // will probably grab info about application and determine the next route but for now use the current route to just go to the next one we have hardcoded
    let nextRouteName = null;
    switch(req.query.currentRoute){
        case "basic":
            nextRouteName = "policies";
            break;
        case "policies":
            nextRouteName = "additionalQuestions"
            break;
        case "additionalQuestions":
            nextRouteName = "mailingAddress";
            break;
        case "locations":
            nextRouteName = "owners";
            break;
        case "owners":
            nextRouteName = "claims";
            break;
        case "mailingAddress":
            nextRouteName = "locations";
            break;
        case "claims":
            // Nothing yet
            break;
        default:
            break;
    }
    res.send(200, nextRouteName);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF("Get Next Route", `${basePath}/get-route`, getNextRoute);
}