'use strict';

const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');

const ApplicationBO = global.requireShared('models/Application-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');

//const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');


/**
 * AbandonApplication Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
exports.processtask = async function(queueMessage){
    let error = null;
    // Check sent time over 30 seconds do not process.
    const sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    const now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();

    if(messageAge < 30){

        // DO STUFF
        await abandonAppTask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error abandonAppTask deleteTaskQueueItem " + error + __location);
        }
        return;
    }
    else {
        log.debug('removing old Abandon Application Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error abandonAppTask deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
};

/**
 * Exposes abandonAppTask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await abandonAppTask().catch(err => error = err);
    if(error){
        log.error('abandonAppTask external: ' + error + __location);
    }
    return;
};

var abandonAppTask = async function(){

    const oneHourAgo = moment().subtract(1,'h');
    const twoHourAgo = moment().subtract(2,'h');


    const query = {
        "agencyPortalCreated": false,
        "abandonedAppEmail": false,
        "solepro": false,
        "optedOutOnline": false,
        "ltAppStatusId": 11,
        "searchenddate": oneHourAgo,
        "searchbegindate": twoHourAgo
    };
    let appList = null;
    const applicationBO = new ApplicationBO();

    try{
        appList = await applicationBO.getList(query);
    }
    catch(err){
        log.error("abandonAppTask getting appid list error " + err + __location);
        throw err;
    }
    //process list.....
    if(appList && appList.length > 0){
        for(let i = 0; i < appList.length; i++){
            const appDoc = appList[i];
            let error = null;
            let succesfulProcess = false;
            try{
                succesfulProcess = await processAbandonApp(appDoc);
            }
            catch(err){
                error = err;
                log.debug('abandon app catch error from await ' + err);
            }

            if(error === null && succesfulProcess === true){
                await markApplicationProcess(appDoc).catch(function(err){
                    log.error(`Error marking abandon app in DB for ${appDoc.applicationId} error:  ${err}` + __location);
                    error = err;
                });
            }
            if(error === null){
                log.info(`Processed abandon app for appId: ${appDoc.applicationId}`);
            }

        }
    }

    return;
};

var processAbandonApp = async function(applicationDoc){

    if(applicationDoc){

        //Load AgencyNetwork
        const agencyNetwork = applicationDoc.agencyNetworkId;
        //Get email content
        // TODO only uses customer...
        let error = null;
        const agencyBO = new AgencyBO();
        let agencyJSON = {};
        try{
            agencyJSON = await agencyBO.getById(applicationDoc.agencyId)
        }
        catch(err){
            error = true;

        }
        if(error){
            return false;
        }
        const emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(applicationDoc.agencyId, "abandoned_applications_customer", "abandoned_applications_customer").catch(function(err){
            log.error(`Email content Error Unable to get email content for abandon application. appid: ${applicationDoc.applicationId}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }


        if(emailContentJSON && emailContentJSON.customerMessage && emailContentJSON.customerSubject){

            const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
            const customerEmail = customerContact.email;

            let agencyPhone = agencyJSON.phone;
            let agencyWebsite = agencyJSON.website;


            if(!agencyWebsite){
                agencyWebsite = "";
            }

            if(agencyPhone){
                agencyPhone = formatPhone(agencyPhone);
            }
            else {
                agencyPhone = '';
            }
            //  get from AgencyNetwork BO
            const brandurl = emailContentJSON.APPLICATION_URL;
            const agencyLandingPage = `${brandurl}/${agencyJSON.slug}`;

            let message = emailContentJSON.customerMessage;
            const subject = emailContentJSON.customerSubject;

            // Perform content replacements
            message = message.replace(/{{Agency}}/g, agencyJSON.name);
            message = message.replace(/{{Agency Email}}/g, agencyJSON.email);
            message = message.replace(/{{Agency Page Link}}/g, `<a href="${agencyLandingPage}" rel="noopener noreferrer" target="_blank">${agencyLandingPage}</a>`);
            message = message.replace(/{{Agency Phone}}/g, agencyPhone);
            message = message.replace(/{{Agency Website}}/g, `<a href="${agencyWebsite}" rel="noopener noreferrer" target="_blank">${agencyWebsite}</a>`);


            //send email:
            // Send the email
            const keys = {'applicationDoc': applicationDoc};
            const emailResp = await emailSvc.send(customerEmail, subject, message, keys ,agencyNetwork, emailContentJSON.emailBrand, applicationDoc.agencyId);
            //log.debug("emailResp = " + emailResp);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to remind the insured to revisit their application ${applicationDoc.applicationId}. Please follow-up manually.`, {'application_id': applicationDoc.applicationId});
            }
            return true;
        }
        else {
            log.error(`AbandonApp missing emailcontent for agencyid ${applicationDoc.agencyId} and  agencynetwork: ` + agencyNetwork + __location);
            return false;
        }
    }
    else {
        return false;
    }

};

var markApplicationProcess = async function(appDoc){

    // Call BO updateMongo
    const applicationBO = new ApplicationBO();
    const docUpdate = {"abandonedAppEmail": true};
    try{
        await applicationBO.updateMongo(appDoc.applicationId,docUpdate);
    }
    catch(err){
        log.error(`Error calling applicationBO.updateMongo for ${appDoc.applicationId} ` + err + __location)
        throw err;
    }

};