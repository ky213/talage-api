/**
 * Handles all tasks related to managing quotes
 */

'use strict';

const Application = require('./helpers/models/Application.js');
const serverHelper = require('../../../server.js');
const jwt = require('jsonwebtoken');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const slack = global.requireShared('./services/slacksvc.js');

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
        log.error(`Error loading application for Quoting ${req.params.id ? req.params.id : ''}: ${error.message}` + __location);
        try{
            const attachment = {
                application_id: application.id,
                fields: [
                    {
                        short: false,
                        title: 'Agency Name',
                        value: application.agencyLocation.agency
                    },
                    {
                        short: false,
                        title: 'Business Name',
                        value: application.business.name + (application.business.dba ? ` (dba. ${application.business.dba})` : '')
                    },
                    {
                        short: false,
                        title: 'Industry',
                        value: application.business.industry_code_description
                    }
                ],
                text: `${application.business.name} from ${application.business.primary_territory} completed an application for ${application.policies.
                    map(function(policy) {
                        return policy.type;
                    }).
                    join(' and ')}`
            };
            slack.send('alerts', 'warning', `Application From Quote App failed PreQuote DataLoad. ${error} Please Check`, attachment);
        }
        catch(err){
            log.error("Failed to send load error slack " + err + __location)
        }

        //res.send(error);
        return next(serverHelper.requestError(error));
    }
    // Validate
    try {
        await application.validate();
    }
    catch (error) {
        log.error(`Error validating application from Quote App ${req.params.id ? req.params.id : ''}: ${error.message ? error.message : error}` + __location);
        //TODO Send Slack message to Alert Application From Quote App failed PreQuote Validation
        //Have access to application.applicationDocData
        //res.send(error);
        try{
            const attachment = {
                application_id: application.id,
                fields: [
                    {
                        short: false,
                        title: 'Agency Name',
                        value: application.agencyLocation.agency
                    },
                    {
                        short: false,
                        title: 'Business Name',
                        value: application.business.name + (application.business.dba ? ` (dba. ${application.business.dba})` : '')
                    },
                    {
                        short: false,
                        title: 'Industry',
                        value: application.business.industry_code_description
                    }
                ],
                text: `${application.business.name} from ${application.business.primary_territory} completed an application for ${application.policies.
                    map(function(policy) {
                        return policy.type;
                    }).
                    join(' and ')}`
            };
            slack.send('alerts', 'warning', `Application From Quote App failed PreQuote Validation. ${error} Please Check`, attachment);
        }
        catch(err){
            log.error("Failed to send validation error slack " + err + __location)
        }

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
    log.debug('running quotes' + __location)
    try {
        await application.run_quotes();
    }
    catch (error) {
        log.error(`Getting quotes on application ${application.id} failed: ${error} ${__location}`);
    }

}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    //TODO - JWT check need to request authencation from Quote APP
    server.addPost('Post Application', `${basePath}/application`, postApplication);
    server.addPost('Post Application (depr)', `${basePath}/`, postApplication);
};