'use strict';

const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBO = global.requireShared('models/Quote-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');

const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');


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
        //Inspect JSON for applicationId
        if (queueMessage.body && queueMessage.body.applicationId && queueMessage.body.quoteId) {
            await emailbindagency(queueMessage.body.applicationId, queueMessage.body.quoteId).catch(err => error = err);
        }
        else {
            log.error("Error emailbindagency missing applicationId " + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err) {
            error = err;
        });
        if (error) {
            log.error("Error emailbindagency deleteTaskQueueItem " + error);
        }
        return;
    }
    else {
        log.info('removing old emailbindagency Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if (error) {
            log.error("Error emailbindagency deleteTaskQueueItem old " + error);
        }
        return;
    }
}

/**
 * emailbindagency for internal use. one quote at a time.
 * @param {string} applicationId - applicationId
 * @param {string} quoteId - quoteId
 * @returns {void}
 */
exports.emailbindagency = async function(applicationId, quoteId) {
    let error = null;
    await emailbindagency(applicationId, quoteId).catch(err => error = err);
    if (error) {
        log.error('emailbindagency external: ' + error);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */

var emailbindagency = async function(applicationId, quoteId) {
    if (applicationId && quoteId) {
        let applicationDoc = null;
        const applicationBO = new ApplicationBO();
        try {
            applicationDoc = await applicationBO.getMongoDocbyMysqlId(applicationId);
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
            let quoteDoc = null;
            try {
                quoteDoc = await quoteBO.getMongoDocbyMysqlId(quoteId);
            }
            catch(err){
                log.error("Error getting quote for emailbindagency " + err + __location);
            }


            //get email content.
            const agencyNetwork = applicationDoc.agencyNetworkId;
            const agencyBO = new AgencyBO();
            const emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(applicationDoc.agencyId, "policy_purchase_agency", "policy_purchase_customer").catch(function(err){
                log.error(`Email content Error Unable to get email content for  email bind agency. appid: ${applicationId}.  error: ${err}` + __location);
                error = true;
            });
            if(error){
                return false;
            }

            if (emailContentJSON && emailContentJSON.customerMessage && emailContentJSON.customerSubject) {
                //get AgencyBO
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

                //get AgencyLocationBO
                const agencyLocationBO = new AgencyLocationBO();
                try{
                    await agencyLocationBO.loadFromId(applicationDoc.agencyLocationId)
                }
                catch(err){
                    log.error("Error getting agencyLocationBO " + err + __location);
                    error = true;

                }
                if(error){
                    return false;
                }

                let agencyLocationEmail = '';
                //decrypt info...
                if(agencyLocationBO.email){
                    agencyLocationEmail = agencyLocationBO.email
                }
                else if(agencyBO.email){
                    agencyLocationEmail = agencyBO.email;
                }

                //Insurer
                let insurerJson = {};
                const insurerBO = new InsurerBO();
                try{
                    insurerJson = await insurerBO.getById(quoteDoc.insurerId);
                }
                catch(err){
                    log.error("Error get InsurerList " + err + __location)
                }

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
                if (agencyLocationBO.phone) {
                    agencyPhone = formatPhone(agencyLocationBO.phone);
                }

                let quoteResult = stringFunctions.ucwords(quoteDoc.apiResult);
                if (quoteResult.indexOf('_') > 0) {
                    quoteResult = quoteResult.substring(0, quoteResult.indexOf('_'));
                }
                // TO AGENCY
                let message = emailContentJSON.agencyMessage;
                let subject = emailContentJSON.agencySubject;

                message = message.replace(/{{Agent Login URL}}/g, insurerJson.agent_login);
                message = message.replace(/{{Business Name}}/g, applicationDoc.businessName);
                message = message.replace(/{{Carrier}}/g, insurerJson.name);
                message = message.replace(/{{Contact Email}}/g, customerContact.email);
                message = message.replace(/{{Contact Name}}/g, fullName);
                message = message.replace(/{{Contact Phone}}/g, customerPhone);
                message = message.replace(/{{Industry}}/g, industryCodeDesc);
                message = message.replace(/{{Quote Number}}/g, quoteDoc.quoteNumber);
                message = message.replace(/{{Quote Result}}/g, quoteResult);


                message = message.replace(/{{Brand}}/g, emailContentJSON.emailBrand);
                subject = subject.replace(/{{Brand}}/g, emailContentJSON.emailBrand);

                // Send the email
                const keyData = {'applicationDoc': applicationDoc};
                if (agencyLocationEmail) {
                    const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData, agencyNetwork, "Networkdefault");
                    if (emailResp === false) {
                        slack.send('#alerts', 'warning', `The system failed to inform an agency of the emailbindagency for application ${applicationId}. Please follow-up manually.`);
                    }
                }
                else {
                    log.error(`emailbindagency no email address for appId: ${applicationId} ` + __location);
                }

                //TO INSURED
                try{
                    message = emailContentJSON.customerMessage;
                    subject = emailContentJSON.customerSubject;


                    message = message.replace(/{{Agency}}/g, agencyBO.name);
                    message = message.replace(/{{Agency Email}}/g, agencyBO.email);
                    message = message.replace(/{{Agency Phone}}/g, agencyPhone);
                    message = message.replace(/{{Agency Website}}/g, agencyBO.website ? '<a href="' + agencyBO.website + '" rel="noopener noreferrer" target="_blank">' + agencyBO.website + '</a>' : '');
                    message = message.replace(/{{Quotes}}/g, '<br /><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="350"><tr><td width="200"><img alt="' + insurerJson.name + '" src="https://img.talageins.com/' + insurerJson.logo + '" width="100%" /></td><td width="20"></td><td style="padding-left:20px;font-size:30px;">$' + stringFunctions.number_format(quoteDoc.amount) + '</td></tr></table></div><br />');

                    subject = subject.replace(/{{Agency}}/g, agencyBO.name);

                    //log.debug("sending customer email " + __location);
                    const brand = emailContentJSON.emailBrand === 'wheelhouse' ? 'agency' : `${emailContentJSON.emailBrand}-agency`
                    const emailResp2 = await emailSvc.send(customerContact.email, subject, message, keyData, agencyNetwork, brand, applicationDoc.agencyId);
                    // log.debug("emailResp = " + emailResp);
                    if (emailResp2 === false) {
                        slack.send('#alerts', 'warning', `Failed to send Policy Bind Email to Insured application #${applicationId} and quote ${quoteId}. Please follow-up manually.`);
                    }
                }
                catch(e){
                    log.error("Customer Email fillin error " + e + __location);
                }
                return true;


            }
            else {
                log.error('emailbindagency missing emailcontent for agencynetwork: ' + agencyNetwork + __location);
                return false;
            }

        }
        else {
            log.error('emailbindagency No application quotes pulled from database applicationId or quoteId: ' + applicationId + ":" + quoteId + __location);
            return false;
        }
    }
    else {
        log.error('emailbindagency missing applicationId or quoteId: ' + applicationId + ":" + quoteId + __location);
        return false;
    }

}