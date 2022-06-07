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
async function notifyUsersOfApplicationNote(applicationDoc, applicationNotes){
    if (!applicationDoc) {
        log.error('Bad application information - notification not sent ' + __location);
        return false
    }

    if (!applicationNotes) {
        log.error('Bad application Notes information - notification was not sent ' + __location);
        return false
    }

    let errorType = ''
    // parseInt all to be used Ids to ensure its not undefined or null
    const agencyNetworkId = parseInt(applicationDoc.agencyNetworkId,10);
    if(!agencyNetworkId) {
        errorType = 'Agency Network Id';
    }

    const agencyId = parseInt(applicationDoc.agencyId,10);
    if(!agencyId) {
        errorType = 'Agency Id';
    }

    const agencyLocationId = parseInt(applicationDoc.agencyLocationId,10);
    if(!agencyLocationId) {
        errorType = 'Agency Location Id';
    }

    const industryCodeId = parseInt(applicationDoc.industryCode,10);
    if(!industryCodeId) {
        errorType = 'Industry Code Id';
    }

    if(errorType){
        log.error(`Invalid ${errorType} for AppId: ${applicationDoc.Id}.  Notification was not sent. ` + __location);
        return false;
    }


    const agencyNetworkBO = new AgencyNetworkBO();
    let agencyNetworkDB = {}
    try{
        agencyNetworkDB = await agencyNetworkBO.getById(agencyNetworkId)
    }
    catch(err){
        log.error("Error getting agency Network details " + err + __location);
        return false;
    }

    // find the template for the agency
    const agencyBO = new AgencyBO();
    let emailContentJSON = {};
    try{
        emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(agencyId, "agency_portal_notes_notification", "policy_purchase_customer");
    }
    catch(err){
        log.error(`Unable to get email content for application Notes notification on agency. appid: ${applicationDoc.applicationId}.  error: ${err}` + __location);
        return false
    }


    let agencyJSON = {};
    try{
        agencyJSON = await agencyBO.getById(agencyId)
    }
    catch(err){
        log.error(`Invalid Agency Id for appid: ${applicationDoc.applicationId}. ` + err + __location);
        return false
    }

    //find the subscribers to this agency
    let agencyPortalUsersList = [];
    let agencyNotificationsList = [];
    const agencyPortalUserBO = new AgencyPortalUserBO();
    try{
        agencyPortalUsersList = await agencyPortalUserBO.getList({'agencyNotificationList' : {$in : [agencyId]}});
    }
    catch(err){
        log.error("Error getting agencyNotifications List " + err + __location);
        return false
    }

    // filter list further to ensure agency subscription only belongs to Agency Network Id
    const filteredAgencyNotificationsList = agencyPortalUsersList.filter(e => e.agencyNetworkId === agencyNetworkId);

    if(!filteredAgencyNotificationsList) {
        log.error(`No availble Agency Network Emails to send to for appId: ${applicationDoc.Id} ` + __location);
    }
    else {
        // extract the emails only from the filtered list
        agencyNotificationsList = filteredAgencyNotificationsList.map(e => e.email);
    }


    //find the current user who submitted the application note
    let currentUserName = '';
    if(applicationNotes[0] && applicationNotes[0].agencyPortalCreatedUser){
        let currentUserList = {};
        const userQueryJSON = {
            'email' : applicationNotes[0].agencyPortalCreatedUser,
            'agencyNetworkId' : agencyNetworkId
        }
        try{
            currentUserList = await agencyPortalUserBO.getList(userQueryJSON);
            if(currentUserList){
                currentUserName = currentUserList[0].firstName === '' || currentUserList[0].firstName === null ? '' : currentUserList[0].firstName;
                currentUserName += ' ' + currentUserList[0].lastName === '' || currentUserList[0].lastName === null ? '' : currentUserList[0].lastName;
            }
        }
        catch(err){
            log.error(`Error retrieving current user info on appId: ${applicationDoc.Id} ` + err + __location);
        }
    }

    //get the application agency based on location used in the application
    const agencyLocationBO = new AgencyLocationBO();
    let agencyLocationJSON = null;
    try{
        agencyLocationJSON = await agencyLocationBO.getById(agencyLocationId)
    }
    catch(err){
        log.error("Error getting agencyLocationBO " + err + __location);
        return false
    }

    // add the applications user into the email list
    if(agencyLocationJSON.email){
        agencyNotificationsList.push(agencyLocationJSON.email)
    }
    else if(agencyJSON.email){
        agencyNotificationsList.push(agencyJSON.email);
    }

    // convert arrays to array of strings
    const combinedUsersEmailToSend = JSON.stringify(agencyNotificationsList);

    let industryCodeDesc = '';
    const industryCodeBO = new IndustryCodeBO();
    try{
        const industryCodeJson = await industryCodeBO.getById(industryCodeId);
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

    log.debug('Consolidated Email addresses to notify ->> ' + combinedUsersEmailToSend);

    // Send the email with a final check on the list
    if (combinedUsersEmailToSend) {
        const emailResp = await emailSvc.send(combinedUsersEmailToSend, subject, message, keyData, agencyNetworkId, branding);
        if (emailResp === false) {
            slack.send('#alerts', 'warning', `The system failed to inform an agency of the latest application Notes in application ID ${applicationDoc.applicationId}. Please follow-up manually.`);
        }
    }
    else {
        log.error(`Application Notes notification has no email address for appId: ${applicationDoc.applicationId} ` + __location);
    }
    return true;
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('GET Application Notes', `${basePath}/application/notes`, getApplicationNotes, 'applications', 'view');
    server.addPostAuth('POST Create Application Notes', `${basePath}/application/notes`, createApplicationNote, 'applications', 'manage');
};
