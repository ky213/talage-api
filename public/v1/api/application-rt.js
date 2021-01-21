/* eslint-disable space-before-function-paren */
/* eslint-disable brace-style */
/* eslint-disable object-curly-spacing */
/* eslint-disable multiline-ternary */
/* eslint-disable array-element-newline */
/* eslint-disable prefer-const */

/**
 * Handles all tasks related to application
 */
"use strict";
const serverHelper = require('../../../server.js');
const validator = global.requireShared('./helpers/validator.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
var Message = require('mongoose').model('Message');

/**
 * Responds to POST requests and returns the posted application and a jwt to access it
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postApplication(req, res, next) {
    // TODO: application id will be pulled from jwt, have it on application for now
    if (!req.body || !req.body.application) {
        log.info('Bad Request: Missing "application" parameter when trying update the application ' + __location);
        return next(serverHelper.requestError('A parameter is missing when trying to update the application.'));
    }
}

/**
 * Responds to PUT requests and returns the next page that should be accessed
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function putApplication(req, res, next) {
    // TODO: application id will be pulled from jwt, have it on application for now
    if (!req.body || !req.body.application) {
        log.info('Bad Request: Missing "application" parameter when trying update the application ' + __location);
        return next(serverHelper.requestError('A parameter is missing when trying to update the application.'));
    }
}

/**
 * Responds to GET requests and returns the data for the queried page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplication(req, res, next) {
    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Make sure basic elements are present
    if (!req.query.id) {
        log.error('Bad Request: Missing ID ' + __location);
        return next(serverHelper.requestError('Bad Request: You must supply an ID'));
    }

    const id = req.query.id;

    if(id > 0){
        // Validate the application ID
        if (!await validator.is_valid_id(id)) {
            log.error(`Bad Request: Invalid id ${id}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
    }

    let passedAccessCheck = false;
    // TODO: verify we can access the id provided by checking jwt
    passedAccessCheck = true;

    const applicationBO = new ApplicationBO();
    let applicationJSON = null;
    try{
        let applicationDBDoc = null;
        if(id > 0){
            applicationDBDoc = await applicationBO.loadfromMongoBymysqlId(id);
        }
        else {
            log.debug(`Getting app id  ${id} from mongo` + __location)
            applicationDBDoc = await applicationBO.getfromMongoByAppId(id);
        }

        if(applicationDBDoc){
            applicationJSON = JSON.parse(JSON.stringify(applicationDBDoc))
        }
    }
    catch(err){
        log.error("Error Getting application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(applicationJSON && applicationJSON.applicationId && !passedAccessCheck){
        log.info('Forbidden: User is not authorized for this application' + __location);
        //Return not found so do not expose that the application exists
        return next(serverHelper.notFoundError('Application Not Found'));
    }

    // TODO: do we add setupReturnedApplicationJSON to add things like agency name?

    let messageList = null;
    try {
        messageList = await Message.find({$or:[{'applicationId':applicationJSON.applicationId}, {'mysqlId':applicationJSON.mysqlId}]}, '-__v');
    }
    catch (err) {
        log.error(err + __location);
        return serverHelper.sendError(res, next, 'Internal Error');
    }
    log.debug("messageList.length: " + messageList.length);
    if(messageList.length){
        applicationJSON.messages = messageList;
    }

    // Return the response
    res.send(200, applicationJSON);
    return next();
}


/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    // server.addGetAuthAppWF('Get Quote Agency', `${basePath}/agency`, getAgency);
    server.addPost("POST Application", `${basePath}/application`, postApplication);
    server.addPut("PUT Application", `${basePath}/application`, putApplication);
    server.addGet("GET Application", `${basePath}/application`, getApplication);
};