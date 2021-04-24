const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
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
            await emailbindagency(queueMessage.body.applicationId, queueMessage.body.quoteId, false).catch(err => error = err);
            if(error){
                log.error("Error emailbindagency " + error + __location);
            }
            error = null;
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
 * @param {boolean} noCustomerEmail - noCustomerEmail
 * @returns {void}
 */
exports.emailbindagency = async function(applicationId, quoteId, noCustomerEmail) {
    let error = null;
    await emailbindagency(applicationId, quoteId, noCustomerEmail).catch(err => error = err);
    if (error) {
        log.error('emailbindagency external: ' + error + __location);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */

var emailbindagency = async function(applicationId, quoteId, noCustomerEmail) {
    log.debug(`emailbindagency noCustomerEmail: ${noCustomerEmail}` + __location)
    if (applicationId && quoteId) {
        let applicationDoc = null;
        const ApplicationBO = global.requireShared('models/Application-BO.js');
        const QuoteBO = global.requireShared('models/Quote-BO.js');

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
            const agencyNetworkId = applicationDoc.agencyNetworkId;
            const agencyNetworkBO = new AgencyNetworkBO();
            let agencyNetworkDB = {}
            try{
                agencyNetworkDB = await agencyNetworkBO.getById(agencyNetworkId)
            }
            catch(err){
                log.error("Error getting agencyBO " + err + __location);
                error = true;

            }
            if(error){
                return false;
            }

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
                    agencyLocationJSON = await agencyLocationBO.getById(applicationDoc.agencyLocationId)
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
                if(agencyLocationJSON.email){
                    agencyLocationEmail = agencyLocationJSON.email
                }
                else if(agencyJSON.email){
                    agencyLocationEmail = agencyJSON.email;
                }

                //Insurer
                let insurerJson = {};
                const insurerBO = new InsurerBO();
                try{
                    insurerJson = await insurerBO.getById(quoteDoc.insurerId);
                }
                catch(err){
                    log.error("Error get Insurer " + err + __location)
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
                if (agencyLocationJSON.phone) {
                    agencyPhone = formatPhone(agencyLocationJSON.phone);
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
                    const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData, agencyNetworkId, "Networkdefault");
                    if (emailResp === false) {
                        slack.send('#alerts', 'warning', `The system failed to inform an agency of the emailbindagency for application ${applicationId}. Please follow-up manually.`);
                    }
                }
                else {
                    log.error(`emailbindagency no email address for appId: ${applicationId} ` + __location);
                }

                //TO INSURED
                if(noCustomerEmail === false){
                    try{
                        message = emailContentJSON.customerMessage;
                        subject = emailContentJSON.customerSubject;


                        message = message.replace(/{{Agency}}/g, agencyJSON.name);
                        message = message.replace(/{{Agency Email}}/g, agencyJSON.email);
                        message = message.replace(/{{Agency Phone}}/g, agencyPhone);
                        message = message.replace(/{{Agency Website}}/g, agencyJSON.website ? '<a href="' + agencyJSON.website + '" rel="noopener noreferrer" target="_blank">' + agencyJSON.website + '</a>' : '');
                        message = message.replace(/{{Quotes}}/g, '<br /><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="350"><tr><td width="200"><img alt="' + insurerJson.name + `" src="${global.settings.IMAGE_URL}/${stringFunctions.trimString(insurerJson.logo, 'images/')}" width="100%" /></td><td width="20"></td><td style="padding-left:20px;font-size:30px;">$` + stringFunctions.number_format(quoteDoc.amount) + '</td></tr></table></div><br />');

                        subject = subject.replace(/{{Agency}}/g, agencyJSON.name);

                        //log.debug("sending customer email " + __location);
                        const brand = emailContentJSON.emailBrand === 'wheelhouse' ? 'agency' : `${emailContentJSON.emailBrand}-agency`
                        const emailResp2 = await emailSvc.send(customerContact.email, subject, message, keyData, agencyNetworkId, brand, applicationDoc.agencyId);
                        // log.debug("emailResp = " + emailResp);
                        if (emailResp2 === false) {
                            slack.send('#alerts', 'warning', `Failed to send Policy Bind Email to Insured application #${applicationId} and quote ${quoteId}. Please follow-up manually.`);
                        }
                    }
                    catch(e){
                        log.error("Customer Email fillin error " + e + __location);
                    }
                }


                //Determine if Agency Network Email is required.
                if(agencyNetworkDB
                    && agencyNetworkDB.featureJson
                    && agencyNetworkDB.featureJson.agencyNetworkQuoteEmails
                    && agencyNetworkDB.email){
                    try{
                        const emailContentAgencyNetworkJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId,"policy_purchase_agency_network");
                        if(!emailContentAgencyNetworkJSON || !emailContentAgencyNetworkJSON.message || !emailContentAgencyNetworkJSON.subject){
                            log.error(`AgencyNetwork ${agencyNetworkDB.name} missing policy_purchase_agency_network email template` + __location)
                            return true;
                        }

                        message = emailContentAgencyNetworkJSON.message;
                        subject = emailContentAgencyNetworkJSON.subject;

                        message = message.replace(/{{Agent Login URL}}/g, insurerJson.agent_login);
                        message = message.replace(/{{Business Name}}/g, applicationDoc.businessName);
                        message = message.replace(/{{Carrier}}/g, insurerJson.name);
                        message = message.replace(/{{Contact Email}}/g, customerContact.email);
                        message = message.replace(/{{Contact Name}}/g, fullName);
                        message = message.replace(/{{Contact Phone}}/g, customerPhone);
                        message = message.replace(/{{Industry}}/g, industryCodeDesc);
                        message = message.replace(/{{Quote Number}}/g, quoteDoc.quoteNumber);
                        message = message.replace(/{{Quote Result}}/g, quoteResult);


                        message = message.replace(/{{Brand}}/g, emailContentAgencyNetworkJSON.emailBrand);
                        subject = subject.replace(/{{Brand}}/g, emailContentAgencyNetworkJSON.emailBrand);

                        // Send the email
                        const keyData3 = {'applicationDoc': applicationDoc};
                        if (agencyNetworkDB.email) {
                            const emailResp = await emailSvc.send(agencyNetworkDB.email, subject, message, keyData3, agencyNetworkId, "Networkdefault");
                            if (emailResp === false) {
                                slack.send('#alerts', 'warning', `The system failed to inform an agency of the emailbindagency for application ${applicationId}. Please follow-up manually.`);
                            }
                        }
                        else {
                            log.error(`emailbindagency no AgencyNetwork email address for appId: ${applicationId} ` + __location);
                        }

                    }
                    catch(err){
                        log.error(`Sending Agency Network bind email ${err}` + __location);
                    }
                }
                return true;
            }
            else {
                log.error('emailbindagency missing emailcontent for agencynetwork: ' + agencyNetworkId + __location);
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