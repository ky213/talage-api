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
const emailTemplateProceSvc = global.requireShared('./services/emailtemplatesvc.js');


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

var emailbindagency = async function(applicationId, quoteId, noCustomerEmail = false) {
    log.debug(`emailbindagency noCustomerEmail: ${noCustomerEmail}` + __location)
    if (applicationId && quoteId) {
        let applicationDoc = null;
        const ApplicationBO = global.requireShared('models/Application-BO.js');
        const QuoteBO = global.requireShared('models/Quote-BO.js');

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
            let quoteDoc = null;
            try {
                quoteDoc = await quoteBO.getById(quoteId);
            }
            catch(err){
                log.error("Error getting quote for emailbindagency " + err + __location);
            }
            const quotePolicyTypeList = [quoteDoc.policyType]

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

                const keyData = {'applicationDoc': applicationDoc};
                let message = emailContentJSON.agencyMessage;
                let subject = emailContentJSON.agencySubject;

                // TO AGENCY
                if(agencyNetworkDB.featureJson.quoteEmailsAgency === true){
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
                    message = message.replace(/{{Agency}}/g, agencyJSON.name);
                    message = message.replace(/{{Agency Email}}/g, agencyJSON.email);
                    message = message.replace(/{{Agency Phone}}/g, agencyPhone);
                    message = message.replace(/{{Agency Website}}/g, agencyJSON.website ? '<a href="' + agencyJSON.website + '" rel="noopener noreferrer" target="_blank">' + agencyJSON.website + '</a>' : '');

                    message = message.replace(/{{Quotes}}/g, '<br /><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="350"><tr><td width="200"><img alt="' + insurerJson.name + `" src="${global.settings.IMAGE_URL}/${stringFunctions.trimString(insurerJson.logo, 'images/')}" width="100%" /></td><td width="20"></td><td style="padding-left:20px;font-size:30px;">$` + stringFunctions.number_format(quoteDoc.amount) + '</td></tr></table></div><br />');

                    subject = subject.replace(/{{Brand}}/g, emailContentJSON.emailBrand);
                    subject = subject.replace(/{{Agency}}/g, agencyJSON.name);
                    subject = subject.replace(/{{Business Name}}/g, applicationDoc.businessName);


                    const messageUpdate = await emailTemplateProceSvc.applinkProcessor(applicationDoc, agencyNetworkDB, message)
                    if(messageUpdate){
                        message = messageUpdate
                    }
                    // Special policyType processing b/c it should only show
                    // for the one quote not the full applications.
                    const updatedEmailObject = await emailTemplateProceSvc.policyTypeQuoteProcessor(quoteDoc.policyType, message, subject)
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
                    const hookName = 'request-bind-email-agency'
                    try{
                        await global.hookLoader.loadhook(hookName, applicationDoc.agencyNetworkId, dataPackageJSON);
                        message = dataPackageJSON.htmlBody
                        subject = dataPackageJSON.emailSubject
                        branding = dataPackageJSON.branding
                        agencyLocationEmail = dataPackageJSON.recipients
                    }
                    catch(err){
                        log.error(`Error ${hookName} hook call error ${err}` + __location);
                    }


                    // Send the email

                    if (agencyLocationEmail) {
                        const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData, agencyNetworkId, branding);
                        if (emailResp === false) {
                            slack.send('#alerts', 'warning', `The system failed to inform an agency of the emailbindagency for application ${applicationId}. Please follow-up manually.`);
                        }
                    }
                    else {
                        log.error(`emailbindagency no email address for appId: ${applicationId} ` + __location);
                    }
                }
                //TO INSURED
                if(agencyNetworkDB.featureJson.quoteEmailsCustomer === true && noCustomerEmail === false){
                    try{
                        message = emailContentJSON.customerMessage;
                        subject = emailContentJSON.customerSubject;


                        message = message.replace(/{{Agency}}/g, agencyJSON.name);
                        message = message.replace(/{{Agency Email}}/g, agencyJSON.email);
                        message = message.replace(/{{Agency Phone}}/g, agencyPhone);
                        message = message.replace(/{{Agency Website}}/g, agencyJSON.website ? '<a href="' + agencyJSON.website + '" rel="noopener noreferrer" target="_blank">' + agencyJSON.website + '</a>' : '');
                        message = message.replace(/{{Quotes}}/g, '<br /><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="350"><tr><td width="200"><img alt="' + insurerJson.name + `" src="${global.settings.IMAGE_URL}/${stringFunctions.trimString(insurerJson.logo, 'images/')}" width="100%" /></td><td width="20"></td><td style="padding-left:20px;font-size:30px;">$` + stringFunctions.number_format(quoteDoc.amount) + '</td></tr></table></div><br />');
                        message = message.replace(/{{Agency}}/g, agencyJSON.name);
                        message = message.replace(/{{Brand}}/g, emailContentJSON.emailBrand);

                        subject = subject.replace(/{{Brand}}/g, emailContentJSON.emailBrand);
                        subject = subject.replace(/{{Agency}}/g, agencyJSON.name);
                        subject = subject.replace(/{{Business Name}}/g, applicationDoc.businessName);

                        //log.debug("sending customer email " + __location);
                        const brand = 'agency'
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
                if(agencyNetworkDB?.featureJson?.agencyNetworkQuoteEmails
                    && agencyNetworkDB?.email){
                    try{
                        const emailContentAgencyNetworkJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId,"policy_purchase_agency_network");
                        if(!emailContentAgencyNetworkJSON || !emailContentAgencyNetworkJSON.message || !emailContentAgencyNetworkJSON.subject){
                            log.error(`appId: ${applicationId} AgencyNetwork ${agencyNetworkDB.name} missing policy_purchase_agency_network email template` + __location)
                            return true;
                        }

                        message = emailContentAgencyNetworkJSON.message;
                        subject = emailContentAgencyNetworkJSON.subject;

                        message = message.replace(/{{Agency}}/g, agencyJSON.name);
                        message = message.replace(/{{Agency Email}}/g, agencyJSON.email);
                        message = message.replace(/{{Agency Phone}}/g, agencyPhone);

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
                        message = message.replace(/{{Quotes}}/g, '<br /><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="350"><tr><td width="200"><img alt="' + insurerJson.name + `" src="${global.settings.IMAGE_URL}/${stringFunctions.trimString(insurerJson.logo, 'images/')}" width="100%" /></td><td width="20"></td><td style="padding-left:20px;font-size:30px;">$` + stringFunctions.number_format(quoteDoc.amount) + '</td></tr></table></div><br />');

                        subject = subject.replace(/{{Brand}}/g, emailContentAgencyNetworkJSON.emailBrand);
                        subject = subject.replace(/{{Agency}}/g, agencyJSON.name);
                        subject = subject.replace(/{{Business Name}}/g, applicationDoc.businessName);

                        const messageUpdate = await emailTemplateProceSvc.applinkProcessor(applicationDoc, agencyNetworkDB, message)
                        if(messageUpdate){
                            message = messageUpdate
                        }
                        // Special policyType processing b/c it should only show
                        // for the one quote not the full applications.
                        const updatedEmailObject = await emailTemplateProceSvc.policyTypeQuoteProcessor(quoteDoc.policyType, message, subject)
                        if(updatedEmailObject.message){
                            message = updatedEmailObject.message
                        }
                        if(updatedEmailObject.subject){
                            subject = updatedEmailObject.subject
                        }


                        let recipientsString = agencyNetworkDB.email
                        //Check for AgencyNetwork users are suppose to get notifications for this agency.
                        if(applicationDoc.agencyId){
                            // look up agencyportal users by agencyNotificationList
                            try{
                                log.debug(`appId: ${applicationId} emailbindagency checking agencynotificationsvc` + __location)
                                const agencynotificationsvc = global.requireShared('services/agencynotificationsvc.js');
                                const anRecipents = await agencynotificationsvc.getUsersByAgency(applicationDoc.agencyId,quotePolicyTypeList)
                                log.debug(`appId: ${applicationId} emailbindagency agencynotificationsvc returned ${anRecipents}` + __location)
                                if(anRecipents.length > 2){
                                    recipientsString += `,${anRecipents}`
                                }
                            }
                            catch(err){
                                log.error(`AppId: ${applicationDoc.applicationId} agencyId ${applicationDoc.agencyId} agencynotificationsvc.getUsersByAgency error: ${err}` + __location)
                            }
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
                            recipients: recipientsString
                        }
                        const hookName = 'request-bind-email-agencynetwork'
                        try{
                            await global.hookLoader.loadhook(hookName, applicationDoc.agencyNetworkId, dataPackageJSON);
                            message = dataPackageJSON.htmlBody
                            subject = dataPackageJSON.emailSubject
                            branding = dataPackageJSON.branding
                            recipientsString = dataPackageJSON.recipients
                        }
                        catch(err){
                            log.error(`Error ${hookName} hook call error ${err}` + __location);
                        }

                        // Send the email
                        const keyData3 = {'applicationDoc': applicationDoc};
                        if (recipientsString) {
                            const emailResp = await emailSvc.send(recipientsString, subject, message, keyData3, agencyNetworkId, branding);
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
                else {
                    log.debug(`Agency Network not setup for agencyNetworkQuoteEmails ${agencyNetworkDB?.featureJson?.agencyNetworkQuoteEmails}  in emailbindagency appId: ${applicationId} `)
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