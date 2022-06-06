/* eslint-disable require-jsdoc */
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const slack = global.requireShared('./services/slacksvc.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const ApplicationNotesBO = global.requireShared('models/ApplicationNotes-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
const emailTemplateProceSvc = global.requireShared('./services/emailtemplatesvc.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const flattenDeep = require('lodash.flattendeep');
const {Error} = require('mongoose');

async function getApplicationNotes(req, res, next){
    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Make sure basic elements are present
    if (!req.query.applicationId) {
        log.error('Bad Request: Missing application id ' + __location);
        return next(serverHelper.requestError('Bad Request: You must supply an application id'));
    }

    const applicationBO = new ApplicationBO();
    //get application and valid agency
    try{
        const applicationDB = await applicationBO.getById(req.query.applicationId);
        const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)

        // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
        if (!passedAgencyCheck) {
            log.info('Forbidden: User is not authorized to access the requested application');
            return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
        }

        if(!applicationDB){
            return next(serverHelper.requestError('Not Found'));
        }
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    const applicationNotesBO = new ApplicationNotesBO();
    try{
        // Return the response
        log.debug(`Getting app notes using app id  ${req.query.applicationId} from mongo` + __location)
        res.send(200, await applicationNotesBO.getByApplicationId(req.query.applicationId));
        return next();
    }
    catch(err){
        log.error("Error Getting application notes doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }
}

async function createApplicationNote(req, res, next){
    if (!req.body || typeof req.body !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    if (!req.body.applicationId) {
        log.error('Bad Request: Missing applicationId ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing applicationId'));
    }

    const applicationBO = new ApplicationBO();
    //get application and valid agency
    let passedAgencyCheck = false;
    let applicationDB = {};
    try{
        applicationDB = await applicationBO.getById(req.body.applicationId);
        passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this agency' + __location);
        return next(serverHelper.forbiddenError('You are not authorized for this agency'));
    }

    let responseAppNotesDoc = null;
    let userId = null;
    try{
        userId = req.authentication.userID;
    }
    catch(err){
        log.error("Error gettign userID " + err + __location);
    }
    try{
        const applicationNotesBO = new ApplicationNotesBO();
        log.debug('Saving app notes doc');
        responseAppNotesDoc = await applicationNotesBO.insertMongo(req.body, userId);
        if(!responseAppNotesDoc){
            // res.send(500, "No updated document");
            return next(serverHelper.internalError(new Error('No updated document')));
        }
        const appNotes = await applicationNotesBO.getByApplicationId(req.body.applicationId);
        res.send(200, {applicationNotes: appNotes});
        // call the send-email routine here
        await notifyUsersOfApplicationNote(applicationDB, appNotes, userId);

        return next();

    }
    catch(err){
        //mongoose parse errors will end up there.
        log.error("Error saving application notes " + err + __location)
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
    }
}

//***
//  @return = true, email sent successfully
//  @return = false, email had an error
// **
async function notifyUsersOfApplicationNote(applicationDoc, applicationNotes, userId){
    if (!applicationDoc) {
        log.error('Bad application information - notification not sent ' + __location);
        return false
    }

    if (!applicationNotes) {
        log.error('Bad application Notes information - notification was not sent ' + __location);
        return false
    }

    //get email content.
    const agencyNetworkId = applicationDoc.agencyNetworkId;
    const agencyNetworkBO = new AgencyNetworkBO();
    let agencyNetworkDB = {}
    try{
        agencyNetworkDB = await agencyNetworkBO.getById(agencyNetworkId)
    }
    catch(err){
        log.error("Error getting agencyBO " + err + __location);
        return false;
    }

    // find the template for the agency
    const agencyBO = new AgencyBO();
    let emailContentJSON = {};
    try{
        emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(applicationDoc.agencyId, "agency_portal_notes_notification", "policy_purchase_customer");
    }
    catch(err){
        log.error(`Unable to get email content for application Notes notification on agency. appid: ${applicationDoc.applicationId}.  error: ${err}` + __location);
        return false
    }

    //get AgencyBO
    let agencyJSON = {};
    try{
        agencyJSON = await agencyBO.getById(applicationDoc.agencyId)
    }
    catch(err){
        log.error("Error getting agencyBO " + err + __location);
        return false
    }

    //find the subscribers to this agency
    let agencyNotificationList = []
    const agencyPortalUserBO = new AgencyPortalUserBO();
    try{
        agencyNotificationList = await agencyPortalUserBO.getList({'agencyNotificationList' : {$in : [applicationDoc.agencyId]}});
    }
    catch(err){
        log.error("Error getting agencyNotifications List " + err + __location);
        return false
    }

    //find the current user who submitted the application note
    let currentUser = {};
    let currentUserName = '';
    try{
        currentUser = await agencyPortalUserBO.getById(userId);
        if(currentUser){
            currentUserName = currentUser.firstName === '' || currentUser.firstName === null ? '' : currentUser.firstName;
            currentUserName += ' ' + currentUser.lastName === '' || currentUser.lastName === null ? '' : currentUser.lastName;
        }
    }
    catch(err){
        log.error("Error retrieving current user info " + err + __location);
    }

    //get AgencyLocationBO
    const agencyLocationBO = new AgencyLocationBO();
    let agencyLocationJSON = null;
    try{
        agencyLocationJSON = await agencyLocationBO.getById(applicationDoc.agencyLocationId)
    }
    catch(err){
        log.error("Error getting agencyLocationBO " + err + __location);
        return false
    }

    let agencyLocationEmail = agencyNotificationList.map(e => e.email);
    //decrypt info...
    if(agencyLocationJSON.email){
        agencyLocationEmail.push(agencyLocationJSON.email)
    }
    else if(agencyJSON.email){
        agencyLocationEmail.push(agencyJSON.email);
    }
    agencyLocationEmail = JSON.stringify(agencyLocationEmail);

    let industryCodeDesc = '';
    const industryCodeBO = new IndustryCodeBO();
    try{
        const industryCodeJson = await industryCodeBO.getById(applicationDoc.industryCode);
        if(industryCodeJson){
            industryCodeDesc = industryCodeJson.description;
        }
    }
    catch(err){
        log.error("Error getting industryCodeBO " + err + __location);
    }

    const keyData = {'applicationDoc': applicationDoc};
    let message = emailContentJSON.agencyMessage;
    let subject = emailContentJSON.agencySubject;
    const contentx = applicationNotes[0].noteContents;
    const content2 = contentx.content.map(e => e.content.map(x => x.text));
    const content3 = flattenDeep(content2);

    // TO AGENCY
    if(agencyNetworkDB.featureJson.quoteEmailsAgency){
        message = message.replace(/{{Business Name}}/g, applicationDoc.businessName);
        message = message.replace(/{{AP User Email}}/g, applicationNotes[0].agencyPortalCreatedUser);
        message = message.replace(/\n/g, '<br>');
        message = message.replace(/{{AP User Name}}/g, currentUserName);
        message = message.replace(/{{Industry}}/g, industryCodeDesc);
        message = message.replace(/{{Brand}}/g, emailContentJSON.emailBrand);
        message = message.replace(/{{Agency}}/g, agencyJSON.name);
        message = message.replace(/{{apNotesContent}}/g, content3.join('<br><br>'));

        subject = subject.replace(/{{Business Name}}/g, applicationDoc.businessName);

        const messageUpdate = await emailTemplateProceSvc.applinkProcessor(applicationDoc, agencyNetworkDB, message)
        if(messageUpdate){
            message = messageUpdate
        }

        // update the policy type
        const updatedEmailObject = await emailTemplateProceSvc.policyTypeProcessor(applicationDoc, '', message, subject)
        if(updatedEmailObject.message){
            message = updatedEmailObject.message
        }
        if(updatedEmailObject.subject){
            subject = updatedEmailObject.subject
        }

        // Software hook
        const branding = "Networkdefault";

        log.debug('Consolidated Email addresses to notify ->> ' + agencyLocationEmail);

        // Send the email
        if (agencyLocationEmail) {
            const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData, agencyNetworkId, branding);
            if (emailResp === false) {
                slack.send('#alerts', 'warning', `The system failed to inform an agency of the latest application Notes in application ID ${applicationDoc.applicationId}. Please follow-up manually.`);
            }
        }
        else {
            log.error(`Application Notes notification has no email address for appId: ${applicationDoc.applicationId} ` + __location);
        }
    }
    return true;
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('GET Application Notes', `${basePath}/application/notes`, getApplicationNotes, 'applications', 'view');
    server.addPostAuth('POST Create Application Notes', `${basePath}/application/notes`, createApplicationNote, 'applications', 'manage');
};
