'use strict';

const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');

const AgencyBO = global.requireShared('models/Agency-BO.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const QuoteBO = global.requireShared('models/Quote-BO.js');


/**
 * Task processor
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

        // Inspect JSON for applicationId
        if (queueMessage.body && queueMessage.body.applicationId) {
            await sendEmodEmail(queueMessage.body.applicationId).catch(err => error = err);
            if(error){
                log.error("Error soleproApplicationEmailTask " + error + __location);
            }
            error = null;
        }
        else {
            log.error("Error sendEmodEmail missing applicationId " + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err) {
            error = err;
        });
        if (error) {
            log.error("Error sendEmodEmail deleteTaskQueueItem " + error);
        }
        return;
    }
    else {
        log.info('removing old sendEmodEmail Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if (error) {
            log.error("Error sendEmodEmail deleteTaskQueueItem old " + error);
        }
        return;
    }
}

/**
 * sendEmodEmail: Send an email to insurer about business' E Mod rating issue.
 * @param {string} applicationId - applicationId
 * @param {string} quoteId - quoteId
 * @returns {void}
 */
exports.sendEmodEmail = async function(applicationId) {
    let error = null;
    await sendEmodEmail(applicationId).catch(err => error = err);
    if (error) {
        log.error('sendEmodEmail external: ' + error);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */

const sendEmodEmail = async function(applicationId) {
    if (applicationId) {
        let applicationDoc = null;
        const applicationBO = new ApplicationBO();
        try {
            applicationDoc = await applicationBO.getById(applicationId);
        }
        catch (err) {
            log.error(`Error get opt out applications from DB for ${applicationId} error:  ${err}`);
            // Do not throw error other opt out may need to be processed.
            return false;
        }

        if (applicationDoc) {

            //get Quote
            let error = null;
            const quoteBO = new QuoteBO();
            let quoteDoc = {quoteNumber: ""};

            try {
                const quoteQuery = {"applicationId": applicationId}
                const quoteList = await quoteBO.getList(quoteQuery);
                if(quoteList && quoteList.length > 0){
                    //need AF (15) or compuwest(12) quote.
                    for(let i = 0; i < quoteList.length; i++){
                        const quote = quoteList[i];
                        if((quote.insurerId === 15 || quote.insurerId === 12) && quote.quoteNumber){
                            quoteDoc = quote;
                            break;
                        }
                    }
                }
            }
            catch(err){
                log.error("Error getting quote for wce mod email " + err + __location);
            }


            //Get AgencyNetworkBO settings
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkEnvSettings = await agencyNetworkBO.getEnvSettingbyId(applicationDoc.agencyNetworkId).catch(function(err){
                log.error(`Unable to get env settings for New Agency Portal User. agency_network: ${applicationDoc.agencyNetworkId}.  error: ${err}` + __location);
                error = true;
            });
            if(error){
                return false;
            }
            if(!agencyNetworkEnvSettings || !agencyNetworkEnvSettings.PORTAL_URL){
                log.error(`Unable to get env settings for New Agency Portal User. agency_network: ${applicationDoc.agencyNetworkId}.  missing additionalInfo ` + __location);
                return false;
            }
            // log.debug("agencyNetworkEnvSettings: " + JSON.stringify(agencyNetworkEnvSettings))

            const agencyBO = new AgencyBO();
            let agencyJSON = {};
            try{
                agencyJSON = await agencyBO.getById(applicationDoc.agencyId)
            }
            catch(err){
                log.error("Error getting agencyBO " + err + __location);
                error = true;

            }
            if(error){
                return false;
            }

            //get AgencyLocationBO
            const agencyLocationBO = new AgencyLocationBO();
            let agencyLocationJSON = null;
            try{
                agencyLocationJSON = await agencyLocationBO.getMongoDocbyMysqlId(applicationDoc.agencyLocationId)
            }
            catch(err){
                log.error("Error getting agencyLocationBO " + err + __location);
                error = true;

            }
            if(error){
                return false;
            }


            let agencyLocationEmail = null;
            if(agencyLocationJSON.email){
                agencyLocationEmail = agencyLocationJSON.email
            }
            else if(agencyJSON.email){
                agencyLocationEmail = agencyJSON.email;
            }

            // Get AgencyNetwork's portal url
            const portalLink = agencyNetworkEnvSettings.PORTAL_URL;

            let message = `
                <p>{{Business Owner}} tried to get a quote in {{STATE}} but they were declined due to E-Mod rating issues. The quote is in your E-Link portal, and can be accessed by you and potentially still be bound, but you will have to verify the E-Mod information.</p>
                <ul>
                <li><b>Business Name</b>: {{Business Name}}</li>
                <li><b>Quote Number</b>: {{Quote Number}}</li>
                <li><b>Contact Name</b>: {{Contact Name}}</li>
                <li><b>Contact Email</b>: {{Contact Email}}</li>
                <li><b>Contact Phone</b>: {{Contact Phone}}</li>
                </ul>
                <p>You can see more details on this application in your {{Agency Portal}}.</p>
                <p>-The {{Brand}} team</p>
            `;
            const subject = "New Customer Tried to Get a Quote but Encountered an Issue with their E-Mod";

            const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);

            const customerEmail = customerContact.email;

            let customerPhone = '';
            if(customerContact.phone){
                customerPhone = formatPhone(customerContact.phone);
            }

            const fullName = stringFunctions.ucwords(stringFunctions.strtolower(customerContact.firstName) + ' ' + stringFunctions.strtolower(customerContact.lastName));

            // replace fields in template w/ actual values
            message = message.replace(/{{Business Owner}}/g, fullName);
            message = message.replace(/{{Business Name}}/g, applicationDoc.businessName);
            message = message.replace(/{{Quote Number}}/g, quoteDoc.quoteNumber);
            message = message.replace(/{{Contact Email}}/g, customerEmail);
            message = message.replace(/{{Contact Name}}/g, fullName);
            message = message.replace(/{{Contact Phone}}/g, customerPhone);
            message = message.replace(/{{Agency Portal}}/g, `<a href=\"${portalLink}\" rel=\"noopener noreferrer\" target=\"_blank\">Agency Portal</a>`);
            message = message.replace(/{{STATE}}/g, applicationDoc.mailingState);

            message = message.replace(/{{Brand}}/g, agencyNetworkEnvSettings.brandName);

            const keyData = {'applicationDoc': applicationDoc};

            // Send the email
            if (agencyLocationEmail) {
                const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData, applicationDoc.agencyNetworkId,"");
                if (emailResp === false) {
                    slack.send('#alerts', 'warning', `The system failed to inform an agency of the sendEmodEmail for application ${applicationId}. Please follow-up manually.`);
                }
            }
            else {
                log.error(`sendEmodEmail no email address for applicationId: ${applicationId} ` + __location);
            }
            return true;
        }
        else {
            log.error('sendEmodEmail No application quotes pulled from database applicationId : ' + applicationId + __location);
            return false;
        }
    }
    else {
        log.error('sendEmodEmail missing applicationId: ' + applicationId + " " + __location);
        return false;
    }

}