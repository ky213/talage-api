/* eslint-disable require-jsdoc */
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const ApplicationNotesBO = global.requireShared('models/ApplicationNotes-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
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
        await notifyUsersOfApplicationNote(applicationDB, req.body);

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
        log.error('this is the application card ' + JSON.stringify(this.applicationDoc, '',4))
        return false
    }

    if (!applicationNotes) {
        log.error('Bad application Notes information - notification was not sent ' + __location );
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
    const emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(applicationDoc.agencyId, "agency_portal_notes_notification", "policy_purchase_customer").catch(function(err){
        log.error(`Email content Error Unable to get email content for app notification on agency. appid: ${applicationId}.  error: ${err}` + __location);
        return false
    });

    if (emailContentJSON) {
        //get AgencyBO
        let agencyJSON = {};
        try{
            agencyJSON = await agencyBO.getById(applicationDoc.agencyId)
        }
        catch(err){
            log.error("Error getting agencyBO " + err + __location);
            return false
        }

        log.debug('email content json >>> ' + JSON.stringify(applicationNotes.noteContents, '', 4));

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

        let agencyLocationEmail = '';
        //decrypt info...
        if(agencyLocationJSON.email){
            agencyLocationEmail = agencyLocationJSON.email
        }
        else if(agencyJSON.email){
            agencyLocationEmail = agencyJSON.email;
        }

        //Insurer
        // let insurerJson = {};
        // const insurerBO = new InsurerBO();
        // try{
        //     insurerJson = await insurerBO.getById(quoteDoc.insurerId);
        // }
        // catch(err){
        //     log.error("Error get Insurer " + err + __location)
        // }

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


        const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
        let customerPhone = '';
        if (customerContact.phone) {
            customerPhone = formatPhone(customerContact.phone);
        }
        const fullName = stringFunctions.ucwords(stringFunctions.strtolower(customerContact.firstName) + ' ' + stringFunctions.strtolower(customerContact.lastName));

        let agencyPhone = '';
        if (agencyLocationJSON.phone) {
            agencyPhone = formatPhone(agencyLocationJSON.phone);
        }

        // let quoteResult = stringFunctions.ucwords(quoteDoc.apiResult);
        // if (quoteResult.indexOf('_') > 0) {
        //     quoteResult = quoteResult.substring(0, quoteResult.indexOf('_'));
        // }



        const keyData = {'applicationDoc': applicationDoc};
        let message = emailContentJSON.agencyMessage;
        let subject = emailContentJSON.agencySubject;
        let contentx = applicationNotes.noteContents;
        let content2 = contentx.content.map(e => e.content.map(x => x.text));
        let content3 = flattenDeep(content2)

        // TO AGENCY
        if(agencyNetworkDB.featureJson.quoteEmailsAgency === true){
            // message = message.replace(/{{Agent Login URL}}/g, insurerJson.agent_login);
            message = message.replace(/{{Business Name}}/g, applicationDoc.businessName);
            message = message.replace(/\n/g, '<br>');
            // message = message.replace(/{{Carrier}}/g, insurerJson.name);
            message = message.replace(/{{Industry}}/g, industryCodeDesc);
            message = message.replace(/{{Brand}}/g, emailContentJSON.emailBrand);
            message = message.replace(/{{Agency}}/g, agencyJSON.name);
            message = message.replace(/{{apNotesContent}}/g, content3.join('<br><br>'));

            subject = subject.replace(/{{Business Name}}/g, applicationDoc.businessName);

            log.debug('email content message >>> ' + JSON.stringify(message, '', 4));
            log.debug('email content subject >>> ' + subject);

            const messageUpdate = await emailTemplateProceSvc.applinkProcessor(applicationDoc, agencyNetworkDB, message)
            if(messageUpdate){
                message = messageUpdate
            }
            // Special policyType processing b/c it should only show
            // for the one quote not the full applications.
            const updatedEmailObject = await emailTemplateProceSvc.policyTypeProcessor(applicationDoc, '', message, subject)
            if(updatedEmailObject.message){
                message = updatedEmailObject.message
            }
            if(updatedEmailObject.subject){
                subject = updatedEmailObject.subject
            }

            // Software hook
            let branding = "Networkdefault"
            // Sofware Hook
            const dataPackageJSON = {
                appDoc: applicationDoc,
                agencyNetworkDB: agencyNetworkDB,
                htmlBody: message,
                emailSubject: subject,
                branding: branding,
                recipients: agencyLocationEmail
            }
            // const hookName = 'request-bind-email-agency'
            // try{
            //     await global.hookLoader.loadhook(hookName, applicationDoc.agencyNetworkId, dataPackageJSON);
            //     message = dataPackageJSON.htmlBody
            //     subject = dataPackageJSON.emailSubject
            //     branding = dataPackageJSON.branding
            //     // agencyLocationEmail = dataPackageJSON.recipients
            //     agencyLocationEmail = ['carlo@talageins.com']
            // }
            // catch(err){
            //     log.error(`Error ${hookName} hook call error ${err}` + __location);
            // }


            // Send the email
            log.debug('email content subject >>> ' + JSON.stringify(applicationNotes, '', 4));
            log.debug('find content  >>> ' + JSON.stringify(applicationNotes.noteContents.content[0].content[0].text, '',4));

            if (agencyLocationEmail) {
                const emailResp = await emailSvc.send('carlo@talageins.com', subject, message, keyData, agencyNetworkId, branding);
                if (emailResp === false) {
                    slack.send('#alerts', 'warning', `The system failed to inform an agency of the emailbindagency for application ${applicationId}. Please follow-up manually.`);
                }
            }
            else {
                log.error(`emailbindagency no email address for appId: ${applicationId} ` + __location);
            }
        }


        return true;
    }
    else {
        log.error('emailbindagency missing emailcontent for agencynetwork: ' + agencyNetworkId + __location);
        return false;
    }

}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('GET Application Notes', `${basePath}/application/notes`, getApplicationNotes, 'applications', 'view');
    server.addPostAuth('POST Create Application Notes', `${basePath}/application/notes`, createApplicationNote, 'applications', 'manage');
};
