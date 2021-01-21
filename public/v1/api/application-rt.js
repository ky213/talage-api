/* eslint-disable space-before-function-paren */
/* eslint-disable brace-style */
/* eslint-disable object-curly-spacing */
/* eslint-disable multiline-ternary */
/* eslint-disable array-element-newline */
/* eslint-disable prefer-const */
/**
 * Handles all tasks related to agency data
 */

"use strict";
const serverHelper = require('../../../server.js');

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
    // TODO: application id will be pulled from jwt, have it on application for now
    if (!req.query.page) {
        res.send(400, {error: 'Missing page'});
        return next();
    }
}


/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    // server.addGetAuthAppWF('Get Quote Agency', `${basePath}/agency`, getAgency);
    server.addPost("POST Application", `${basePath}/application`, postApplication);
    server.addPut("PUT Application", `${basePath}/application`, putApplication);
    server.addGet("GET Application", `${basePath}/application`, getApplication);
};