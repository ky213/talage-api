'use strict';

const fileSvc = global.requireShared('./services/filesvc.js');
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBO = global.requireShared('models/Quote-BO.js');

/**
 * Responds to requests to get quote letters
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getQuoteLetter(req, res, next){
    let error = false;

    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
        log.info('Bad Request: No data received' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e){
        error = e;
    });
    if (error){
        return next(error);
    }

    // Make sure basic elements are present
    if (!req.query.file){
        log.info('Bad Request: Missing File' + __location);
        return next(serverHelper.requestError('Bad Request: You must supply a File'));
    }

    // Verify that this quote letter is valid AND the user has access to it
    let passedSecurityCheck = false;
    let quoteDoc = null;
    const quoteBO = new QuoteBO();
    const quoteQuery = {quoteLetter: req.query.file}
    try{
        const quoteList = await quoteBO.getList(quoteQuery);
        if(quoteList && quoteList.length === 1){
            quoteDoc = quoteList[0];
            const appId = quoteDoc.applicationId
            const applicationBO = new ApplicationBO();
            const applicationDBDoc = await applicationBO.getfromMongoByAppId(appId);
            if(applicationDBDoc && agents.includes(applicationDBDoc.agencyId)){
                passedSecurityCheck = true;
            }
        }
    }
    catch(err){
        log.error("Quote letter security check " + err + __location);
    }
    if(passedSecurityCheck === false){
        log.error('Request for quote letter denied. Possible security violation.' + __location);
        return next(serverHelper.notAuthorizedError('You do not have permission to access this resource.'));
    }

    // Reduce the result down to what we need
    const fileName = quoteDoc.quoteLetter;

    // Get the file from our cloud storage service
    const data = await fileSvc.GetFileSecure(`secure/quote-letters/${fileName}`).catch(function(err){
        log.error('file get error: ' + err.message + __location);
        error = err;
    });
    if(error){
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // Return the response
    if (data && data.Body){
        res.send(200, data.Body);
        return next();
    }
    else {
        log.error('file get error: no file content' + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Quote Letter', `${basePath}/quote-letter`, getQuoteLetter, 'applications', 'view');
};