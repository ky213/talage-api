'use strict';

const serverHelper = global.requireRootPath('server.js');
const moment = require('moment');
// Current Version of the TOS and Privacy Policy
const version = 3;

/**
 * Records the user's acceptance of the Terms of Service
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PutAcceptTermsOfService(req, res, next){
    // Construct the query
    let error = false;

    const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const agencyPortalUserDoc = await agencyPortalUserBO.getMongoDocbyUserId(parseInt(req.authentication.userID, 10), true).catch(function(err){
        log.error(err + __location);
        error = true;
    });
    if(error){
        return next(error);
    }
    if(!agencyPortalUserDoc){
        log.error(`Legal Acceptance bad user ${req.authentication.userID} ` + __location);
        return serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
    }
    try{
        const laJSON = {
            ip: req.connection.remoteAddress,
            version: version,
            acceptanceDate: moment()
        }
        agencyPortalUserDoc.requiredLegalAcceptance = false;
        agencyPortalUserDoc.legalAcceptance.push(laJSON);
        await agencyPortalUserDoc.save();
    }
    catch(err){
        log.error(err + __location);
        return next(err);
    }

    // Send a success response
    res.send(200, {
        'message': 'Acceptance recorded',
        'status': 'success'
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPutAuth('Record Acceptance of TOS', `${basePath}/terms-of-service`, PutAcceptTermsOfService);
};