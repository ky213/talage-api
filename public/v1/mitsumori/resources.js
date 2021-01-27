/* eslint-disable default-case */
/* eslint-disable object-curly-newline */
/* eslint-disable require-jsdoc */

"use strict";
const serverHelper = require("../../../server.js");
// const validator = global.requireShared("./helpers/validator.js");
// const ApplicationBO = global.requireShared("models/Application-BO.js");
// const AgencyBO = global.requireShared('models/Agency-BO.js');
// const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
// const ApplicationQuoting = global.requireRootPath('public/v1/quote/helpers/models/Application.js');
// const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');

// dummy endpoint to stimulate resources
async function getResources(req, res, next){
    // Let basic through with no app id
    if (!req.query.page || !req.query.appid && req.query.page !== "basic") {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }

    const resources = {
        test: "test"
    };

    switch(req.query.page) {
        case "additionalQuestions":
            break;
        case "basic":
            resources.entityTypes = [
                'Association',
                'Corporation',
                'Limited Liability Company',
                'Limited Partnership',
                'Partnership',
                'Sole Proprietorship',
                'Other'
            ];
            break;
        case "business":
            break;
        case "claims":
            break;
        case "locations":
            break;
        case "mailingAddress":
            break;
        case "owners":
            break;
        case "policies":
            break;
    }

    res.send(200, resources);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppWF("Get Next Route", `${basePath}/resources`, getResources);
}