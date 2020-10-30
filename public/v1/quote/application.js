/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const Application = require('./helpers/models/Application.js');
const serverHelper = require('../../../server.js');
const jwt = require('jsonwebtoken');
const status = global.requireShared('./models/application-businesslogic/status.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');

/**
 *
 * Responds to POST requests and returns policy quotes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postApplication(req, res, next) {
    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }

    // Make sure basic elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'id')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    const application = new Application();
    // Populate the Application object
    // Load
    try {
        await application.load(req.params);
    }
    catch (error) {
        log.error(`Error loading application ${req.params.id ? req.params.id : ''}: ${error.message}` + __location);
        //res.send(error);
        return next(serverHelper.requestError(error));
    }
    // Validate
    try {
        await application.validate();
    }
    catch (error) {
        log.error(`Error validating application ${req.params.id ? req.params.id : ''}: ${error.message}` + __location);
        //res.send(error);
        return next(serverHelper.requestError(error));
    }

    // Set the application progress to 'quoting'
    const applicationBO = new ApplicationBO();
    try{
        await applicationBO.updateProgress(req.body.id, "quoting");

        const appStatusIdQuoting = 15;
        await applicationBO.updateStatus(application.id, "quoting", appStatusIdQuoting);


    }
    catch(err){
        log.error(`Error update appication progress and status appId = ${req.body.id}  for quoting. ` + err + __location);
    }


    // Build a JWT that contains the application ID that expires in 5 minutes.
    const tokenPayload = {applicationID: req.body.id};
    const token = jwt.sign(tokenPayload, global.settings.AUTH_SECRET_KEY, {expiresIn: '5m'});
    // Send back the token
    res.send(200, token);

    // Begin running the quotes
    runQuotes(application);

    return next();
}

/**
 * Runs the quote process for a given application
 *
 * @param {object} application - Application object
 * @returns {void}
 */
async function runQuotes(application) {
    log.debug('running quotes')
    try {
        await application.run_quotes();
    }
    catch (error) {
        log.error(`Getting quotes on application ${application.id} failed: ${error} ${__location}`);
    }

    // Update the application quote progress to "complete"
    const applicationBO = new ApplicationBO();
    try{
        await applicationBO.updateProgress(application.id, "complete");
    }
    catch(err){
        log.error(`Error update appication progress appId = ${application.id}  for complete. ` + err + __location);
    }

    // Update the application status
    await status.updateApplicationStatus(application.id);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    //TODO - JWT check need to request authencation from Quote APP
    server.addPost('Post Application', `${basePath}/application`, postApplication);
    server.addPost('Post Application (depr)', `${basePath}/`, postApplication);
};