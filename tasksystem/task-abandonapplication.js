'use strict';

const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const ApplicationBO = global.requireShared('models/Application-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');

const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');


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
        if(error){
            log.error("Error abandonAppTask " + error + __location);
        }
        error = null;
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
        //get agencyNetworList.  pass to processAbandonApp
        let agencyNetworkList = null;

        const agencyNetworkBO = new AgencyNetworkBO();
        try {
            agencyNetworkList = await agencyNetworkBO.getList()
        }
        catch (err) {
            log.error("Error getting Agency Network List " + err + __location);
        }


        for(let i = 0; i < appList.length; i++){
            const appDoc = appList[i];
            let error = null;
            let succesfulProcess = false;
            try{
                succesfulProcess = await processAbandonApp(appDoc,agencyNetworkList);
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

var processAbandonApp = async function(applicationDoc,agencyNetworkList){

    if(applicationDoc){
        let succesfulProcess = true;
        let error = null;
        let agencyLocationEmail = null;

        const agencyLocationBO = new AgencyLocationBO();
        let agencyLocationJSON = null
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
        if(agencyLocationJSON.email){
            agencyLocationEmail = agencyLocationJSON.email
        }
        else if(agencyJSON.email){
            agencyLocationEmail = agencyJSON.email;
        }


        //Load AgencyNetwork
        const agencyNetworkId = applicationDoc.agencyNetworkId;
        const agencyNetworkJSON = agencyNetworkList.find((ag) => ag.agencyNetworkId === agencyNetworkId);

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
        //only hit db for email content if we are going to send.
        let emailContentJSON = null;

        //Use AgencyNetwork feature agencyAbandonAppEmails to determine who get the email.

        if(agencyNetworkJSON.featureJson.abandonAppEmailsCustomer === true && applicationDoc.agencyPortalCreated === false){
            emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(applicationDoc.agencyId, "abandoned_applications_agency", "abandoned_applications_customer").catch(function(err){
                log.error(`Email content Error Unable to get email content for abandon application. appid: ${applicationDoc.applicationId}.  error: ${err}` + __location);
                error = true;
            });
            if(emailContentJSON && emailContentJSON.customerMessage && emailContentJSON.customerSubject){
                let customerEmail = '';

                const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
                customerEmail = customerContact.email;

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
                const emailResp = await emailSvc.send(customerEmail, subject, message, keys ,agencyNetworkId, emailContentJSON.emailBrand, applicationDoc.agencyId);
                //log.debug("emailResp = " + emailResp);
                if(emailResp === false){
                    slack.send('#alerts', 'warning',`The system failed to remind the insured to revisit their application ${applicationDoc.applicationId}. Please follow-up manually.`, {'application_id': applicationDoc.applicationId});
                }
            }
            else {
                log.error(`AbandonApp missing emailcontent for agencyid ${applicationDoc.agencyId} and  agencynetwork: ` + agencyNetworkId + __location);
                succesfulProcess = false;
            }

        }

        if(agencyNetworkJSON.featureJson.abandonAppEmailsAgency === true){
            if(!emailContentJSON){
                emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(applicationDoc.agencyId, "abandoned_applications_agency", "abandoned_applications_customer").catch(function(err){
                    log.error(`Email content Error Unable to get email content for abandon application. appid: ${applicationDoc.applicationId}.  error: ${err}` + __location);
                    error = true;
                });
            }
            if(emailContentJSON && emailContentJSON.agencyMessage && emailContentJSON.agencySubject){
                let customerEmail = '';

                const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
                customerEmail = customerContact.email;

                const portalLink = emailContentJSON.PORTAL_URL;

                // Format the full name and phone number
                const fullName = stringFunctions.ucwords(stringFunctions.strtolower(customerContact.firstName) + ' ' + stringFunctions.strtolower(customerContact.lastName));
                let phone = '';
                if(customerContact.phone){
                    phone = formatPhone(customerContact.phone);
                }

                let message2 = emailContentJSON.agencyMessage;
                const subject2 = emailContentJSON.agencySubject;


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
                //  // Perform content message.replacements
                message2 = message2.replace(/{{Agency Portal}}/g, `<a href=\"${portalLink}\" rel=\"noopener noreferrer\" target=\"_blank\">Agency Portal</a>`);
                message2 = message2.replace(/{{Brand}}/g, stringFunctions.ucwords(stringFunctions.ucwords(emailContentJSON.emailBrand)));
                message2 = message2.replace(/{{Business Name}}/g, applicationDoc.businessName);
                message2 = message2.replace(/{{Contact Email}}/g, customerEmail);
                message2 = message2.replace(/{{Contact Name}}/g, fullName);
                message2 = message2.replace(/{{Contact Phone}}/g, phone);
                message2 = message2.replace(/{{Industry}}/g, industryCodeDesc);

                // Send the email
                const keyData2 = {'applicationDoc': applicationDoc};
                if(agencyLocationEmail){
                    const emailResp = await emailSvc.send(agencyLocationEmail, subject2, message2, keyData2,agencyNetworkId, emailContentJSON.emailBrand);
                    if(emailResp === false){
                        slack.send('#alerts', 'warning',`The system failed to inform an agency of the abandoned app for application ${applicationDoc.applicationId}. Please follow-up manually.`);
                    }
                }
                else {
                    log.error(`Abandon App no email address for application: ${applicationDoc.applicationId} ` + __location);
                }
            }
            else {
                log.error(`AbandonApp missing emailcontent for agencyid ${applicationDoc.agencyId} and  agencynetwork: ` + agencyNetworkId + __location);
                succesfulProcess = false;
            }

        }

        return succesfulProcess;
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