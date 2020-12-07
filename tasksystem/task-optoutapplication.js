'use strict';

const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');

/**
 * AbandonQuote Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
exports.processtask = async function(queueMessage) {
    let error = null;
    //check sent time over 30 seconds do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    if (messageAge < 30) {

        //DO STUFF

        await optoutapplicationtask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err) {
            error = err;
        });
        if (error) {
            log.error("Error optoutapplicationtask deleteTaskQueueItem " + error);
        }
        return;
    }
    else {
        log.info('removing old Opt Out Email Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if (error) {
            log.error("Error optoutapplicationtask deleteTaskQueueItem old " + error);
        }
        return;
    }
}

/**
 * Exposes optoutapplicationtask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function() {
    let error = null;
    await optoutapplicationtask().catch(err => error = err);
    if (error) {
        log.error('optoutapplicationtask external: ' + error);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */
var optoutapplicationtask = async function() {

    const now = moment();
    const oneHourAgo = moment().subtract(1, 'h');


    const query = {
        "optedOutOnline": true,
        "optedOutOnlineEmailsent": false,
        "ltAppStatusId": 50,
        "searchenddate": now,
        "searchbegindate": oneHourAgo
    };
    let appList = null;
    const applicationBO = new ApplicationBO();

    try{

        appList = await applicationBO.getList(query);
    }
    catch(err){
        log.error("abandonquotetask getting appid list error " + err + __location);
        throw err;
    }

    //process list.....
    if (appList && appList.length > 0) {
        for (let i = 0; i < appList.length; i++) {
            const appDoc = appList[i];

            let error = null
            let succesfulProcess = false;
            try {
                succesfulProcess = await processOptOutEmail(appDoc)
            }
            catch (err) {
                error = err;
                log.debug('catch error from await ' + err);
            }

            if (error === null && succesfulProcess === true) {
                await markApplicationProcess(appDoc).catch(function(err) {
                    log.error(`Error marking opt out in DB for ${appDoc.applicationId} error:  ${err}`);
                    error = err;
                })
            }
            if (error === null) {
                log.info(`Processed Opt Out email for appId: ${appDoc.applicationId}`);
            }
        }
    }

    return;
}

var processOptOutEmail = async function(applicationDoc) {

    if (applicationDoc) {
        let error = null;
        const agencyBO = new AgencyBO();
        try{
            await agencyBO.loadFromId(applicationDoc.agencyId)
        }
        catch(err){
            log.error("Error getting agencyBO " + err + __location);
            error = true;

        }
        if(error){
            return false;
        }


        const agencyLocationBO = new AgencyLocationBO();
        let agencyLocationJSON = null;
        try{
            agencyLocationJSON = await agencyLocationBO.getById(applicationDoc.agencyLocationId)
        }
        catch(err){
            log.error("Error getting agencyLocationBO " + err + __location);
            error = true;

        }
        if(error){
            return false;
        }


        //decrypt info...
        let agencyLocationEmail = null;
        if (agencyLocationJSON.email && agencyLocationJSON.email.length > 0) {
            agencyLocationEmail = agencyLocationJSON.email;
        }
        else if (agencyBO.email) {
            agencyLocationEmail = agencyBO.email;
        }

        log.debug("processing appDoc in processOptOutEmail agencyLocationEmail " + agencyLocationEmail);
        let message = `A potential policyholder has requested that you reach out to help them through the process.<br/>
        <br/>
        We'll leave it to you from here!<br/>
        <br/>
        Contact Name: {{Contact Name}}<br/>
        Business Name: {{BusinessName}}<br/>
        Email: {{Contact Email}}<br/>
        Phone Number: {{Contact Phone}}<br/>
        <br/>
        Good luck!<br/>
        <br/>
        -the {{BrandName}} team<br/>`;
        let subject = "Incoming Contact from your {{BrandName}} Page!";


        const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
        const customerEmail = customerContact.email;


        // Format the full name and phone number
        const fullName = stringFunctions.ucwords(stringFunctions.strtolower(customerContact.firstName) + ' ' + stringFunctions.strtolower(customerContact.lastName));
        let phone = '';
        if (customerContact.phone) {
            phone = formatPhone(customerContact.phone);
        }
        //Get AgencyNetworkBO settings
        error = null;
        const agencyNetworkBO = new AgencyNetworkBO();
        const agencyNetworkEnvSettings = await agencyNetworkBO.getEnvSettingbyId(applicationDoc.agencyNetworkId).catch(function(err) {
            log.error(`Unable to get env settings for OptOut email. agency_network: ${applicationDoc.agencyNetworkId}.  error: ${err}` + __location);
            error = true;
        });
        if (error) {
            return false;
        }
        if (!agencyNetworkEnvSettings || !agencyNetworkEnvSettings.PORTAL_URL) {
            log.error(`Unable to get env settings for  OptOut email. agency_network: ${applicationDoc.agencyNetworkId}.  missing additionalInfo ` + __location);
            return false;
        }

        //  // Perform content message.replacements
        message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(agencyNetworkEnvSettings.emailBrand));
        message = message.replace(/{{BusinessName}}/g, applicationDoc.businessName);
        message = message.replace(/{{Contact Email}}/g, customerEmail);
        message = message.replace(/{{Contact Name}}/g, fullName);
        message = message.replace(/{{Contact Phone}}/g, phone);
        message = message.replace(/{{BrandName}}/g, stringFunctions.ucwords(agencyNetworkEnvSettings.emailBrand));

        //message = message.replace(/{{Industry}}/g, applications[0].industryCode);

        subject = subject.replace(/{{BrandName}}/g, stringFunctions.ucwords(agencyNetworkEnvSettings.emailBrand));

        // Send the email
        const keyData2 = {'applicationDoc': applicationDoc};
        if (agencyLocationEmail) {
            const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData2, applicationDoc.agencyNetworkId, "");
            if (emailResp === false) {
                slack.send('#alerts', 'warning', `The system failed to inform an agency of the Opt Out Email for application ${applicationDoc.applicationId}. Please follow-up manually.`);
            }
        }
        else {
            log.error(`Opt Out Email no agencyLocationEmail email address for appId: ${applicationDoc.applicationId} ` + __location);
        }

        return true;
    }
    else {
        return false;
    }

}

var markApplicationProcess = async function(appDoc) {

    // Call BO updateMongo
    const applicationBO = new ApplicationBO();
    const docUpdate = {"optedOutOnlineEmailsent": true};
    try{
        await applicationBO.updateMongo(appDoc.applicationId,docUpdate);
    }
    catch(err){
        log.error(`Error calling applicationBO.updateMongo for ${appDoc.applicationId} ` + err + __location)
        throw err;
    }

}