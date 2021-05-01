'use strict';

const util = require('util');
const sendOnboardingEmail = require('./helpers/send-onboarding-email.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');


/**
 * Resends the onboarding email
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postResendOnboardingEmail(req, res, next){
    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }

    // Log the entire request
    log.verbose(util.inspect(req.body, false, null));

    // Make sure all information is present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'firstName') || typeof req.body.firstName !== 'string' || !req.body.firstName){
        log.warn('firstName is required' + __location);
        return next(serverHelper.requestError('You must enter an the First Name of the agent'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'lastName') || typeof req.body.lastName !== 'string' || !req.body.lastName){
        log.warn('lastName is required' + __location);
        return next(serverHelper.requestError('You must enter an the Last Name of the agent'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'agencyName') || typeof req.body.agencyName !== 'string' || !req.body.agencyName){
        log.warn('agencyName is required' + __location);
        return next(serverHelper.requestError('You must enter an Agency Name'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'userEmail') || typeof req.body.userEmail !== 'string' || !req.body.userEmail){
        log.warn('userEmail is required' + __location);
        return next(serverHelper.requestError('You must enter a User Email Address'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'slug') || typeof req.body.slug !== 'string' || !req.body.slug){
        log.warn('slug is required' + __location);
        return next(serverHelper.requestError('You must enter a slug'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'userID') || typeof req.body.userID !== 'number' || !req.body.userID){
        log.warn('userID is required' + __location);
        return next(serverHelper.requestError('You must enter a UserID'));
    }


    // Need AgencyNetworkId for sendOnboardingEmail. - broken before 7/12/2020.
    // sendOnboardEmail would only get Wheelhouse's emailcontent for an Agency user
    //  previous bad SQL logic allowed this vs an Error  when sending false as agencyNetwork
    // and the beauty of non Type languages.

    let agencyNetworkId = req.authentication.agencyNetworkId;
    if(agencyNetworkId === false || agencyNetworkId === "false"){
        //get agency to get agencyNetwork.
        const reqAgency = req.authentication.agents[0];
        let error = null;
        const agencyBO = new AgencyBO();
        const agencyJSON = await agencyBO.getById(reqAgency).catch(function(err) {
            log.error(`Loading agency in resend-onboarding-mail error:` + err + __location);
            agencyNetworkId = 1;
            error = err;
        });
        if(!error){
            agencyNetworkId = agencyJSON.agencyNetworkId;
            if(!agencyNetworkId){
                agencyNetworkId = 1;
            }
        }
    }

    const onboardingEmailResponse = await sendOnboardingEmail(agencyNetworkId,
        req.body.userID,
        req.body.firstName,
        req.body.lastName,
        req.body.agencyName,
        req.body.slug,
        req.body.userEmail);

    if (onboardingEmailResponse){
        return next(serverHelper.internalError(onboardingEmailResponse));
    }

    // Return the response
    res.send(200, {
        "code": 'Success',
        "message": 'Email sent'
    });
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth('Resend Onboarding Email', `${basePath}/resend-onboarding-email`, postResendOnboardingEmail, 'agencies', 'view');
    server.addPostAuth('Resend Onboarding Email (depr)', `${basePath}/resendOnboardingEmail`, postResendOnboardingEmail, 'agencies', 'view');
};