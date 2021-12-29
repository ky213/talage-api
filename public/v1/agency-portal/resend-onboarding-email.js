'use strict';

//const util = require('util');
const sendOnboardingEmail = require('./helpers/send-onboarding-email.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const jwt = require('jsonwebtoken');
const emailsvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');

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

/**
 * Resends the onboarding email for agency network users
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postAgencyNetworkUserOnboardingEmail(req, res, next){
    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'userId')){
        log.warn('userId is required' + __location);
        return next(serverHelper.requestError('Missing required prameters.'));
    }
    let agencyNetworkId = null;
    let reqUserAgencyNetworkId = null;
    let error = null;
    if(req.authentication.isAgencyNetworkUser === true){
        reqUserAgencyNetworkId = parseInt(req.authentication.agencyNetworkId, 10);
    }
    else {
        log.warn(`Attempt at sending an agency network user onboarding email, but the req is not from an agency network: ${JSON.stringify(req.authentication)} ${__location}`);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }
    // grab the user
    const userId = parseInt(req.body.userId, 10);
    const agencyPortalUserBO = new AgencyPortalUserBO();

    let userAgencyNetworkId = null;
    const userDocJSON = await agencyPortalUserBO.getMongoDocbyUserId(userId).catch(function(err) {
        log.error(`Error retrieving user object from db for userId; ${userId} from Database ` + err + __location);
        error = true;
    });
    if(error){
        return next(serverHelper.requestError('Not Found'));
    }
    if(userDocJSON){
        userAgencyNetworkId = userDocJSON.agencyNetworkId;
    }
    else {
        log.warn(`Agency portal user ${userId} user object not found ${__location}`);
    }
    // TODO: Maybe global view scenario in future?
    if(reqUserAgencyNetworkId !== userAgencyNetworkId){
        log.warn(`Request coming in from agency network ${reqUserAgencyNetworkId} doesn't match user ${userId} agency network ${userAgencyNetworkId} ${__location}`);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }
    // set the agencyNetworkId to that of the user object
    agencyNetworkId = userAgencyNetworkId;

    // generate the onboarding email
    const jsonEmailProp = 'new_agency_network_user'
    const agencyNetworkBO = new AgencyNetworkBO();
    const emailContentJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId, jsonEmailProp).catch(function(err){
        log.error(`Unable to get email content for New Agency Portal Network User ${userId}. agency_network: ${agencyNetworkId}.  error: ${err}` + __location);
        error = true;
    });
    if(error){
        return serverHelper.requestError('Failed to send email, if this continues please contact us.')
    }

    if(emailContentJSON && emailContentJSON.message){

        // By default, use the message and subject of the agency network
        const emailMessage = emailContentJSON.message;
        const emailSubject = emailContentJSON.subject;

        // Create a limited life JWT
        const token = jwt.sign({userID: userId}, global.settings.AUTH_SECRET_KEY, {expiresIn: '7d'});

        // Format the brands
        let brand = emailContentJSON.emailBrand;
        if(brand){
            brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
        }
        else {
            log.error(`Email Brand missing for agencyNetworkId ${agencyNetworkId} ` + __location);
        }
        const portalurl = emailContentJSON.PORTAL_URL;

        // Prepare the email to send to the user
        const emailData = {
            html: emailMessage.
                replace(/{{Brand}}/g, brand).
                replace(/{{Activation Link}}/g,
                    `<a href="${portalurl}/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Activate My Account</a>`),
            subject: emailSubject.replace('{{Brand}}', brand),
            to: userDocJSON.email
        };
        const emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, agencyNetworkId, brand);
        if (emailResp === false) {
            log.error(`Unable to send new user email to ${userDocJSON.email}. Please send manually.`);
            slack.send('#alerts', 'warning', `Unable to resend new user email to ${userDocJSON.email}. Please send manually.`);
        }
    }
    else {
        log.error(`Unable to get email content for New Agency Portal User. agency_network: ${agencyNetworkId}.` + __location);
        slack.send('#alerts', 'warning', `Unable to resend new user email to ${userDocJSON.email}. Please send manually.`);
    }
    res.send(200, {
        "code": 'Success',
        "message": 'Onboarding Email Sent'
    });
}
exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth('Resend Onboarding Email', `${basePath}/resend-onboarding-email`, postResendOnboardingEmail, 'agencies', 'view');
    server.addPostAuth('Resend Onboarding Email (depr)', `${basePath}/resendOnboardingEmail`, postResendOnboardingEmail, 'agencies', 'view');
    server.addPostAuth('Resend Onboarding Email for Agency Network Users', `${basePath}/resend-onboarding-email/agency-network-users`, postAgencyNetworkUserOnboardingEmail, 'users', 'manage');
};