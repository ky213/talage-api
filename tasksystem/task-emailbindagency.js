'use strict';

const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');

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

        //get filter out wholesale apps.
        // NEED insurer, quotes, codes
        const appSQL = `
            SELECT
                a.id,
                a.agency_location AS agencyLocation,
                al.phone as agencyLocationPhone,
                ag.id as agencyId,
                ag.email AS agencyEmail,
                ag.name AS agencyName,
                ag.agency_network,
                al.email AS agencyLocationEmail,
                c.email,
                c.fname,
                c.lname,
                c.phone,
                b.name as businessName,
                q.id as qouteId,
                q.number as quoteNumber,
                q.api_result,
                q.amount,
                i.agent_login,
                i.name as insurer_name,
                i.logo as insurer_logo,
                ic.description as codeDescription,
                an.email_brand AS emailBrand
            FROM clw_talage_applications AS a
                INNER JOIN clw_talage_quotes AS q ON a.id = q.application
                INNER JOIN clw_talage_agency_locations AS al ON a.agency_location = al.id
                INNER JOIN clw_talage_agencies AS ag ON al.agency = ag.id
                INNER JOIN clw_talage_agency_networks AS an ON ag.agency_network = an.id
                INNER JOIN clw_talage_industry_codes AS ic  ON ic.id = a.industry_code
                INNER JOIN clw_talage_insurers AS i  ON i.id = q.insurer
                INNER JOIN clw_talage_businesses AS b ON b.id = a.business
                INNER JOIN clw_talage_contacts AS c ON a.business = c.business
            WHERE 
            a.id =  ${applicationId}
            AND q.id =  ${quoteId}
            AND a.wholesale = 0
        `;

        let applications = null;
        try {
            applications = await db.query(appSQL);
        }
        catch (err) {
            log.error(`Error get opt out applications from DB for ${applicationId} error:  ${err}`);
            // Do not throw error other opt out may need to be processed.
            return false;
        }

        if (applications && applications.length > 0) {

            let agencyLocationEmail = null;

            //decrypt info...
            if (applications[0].agencyLocationEmail) {
                agencyLocationEmail = await crypt.decrypt(applications[0].agencyLocationEmail);
            }
            else if (applications[0].agencyEmail) {
                agencyLocationEmail = await crypt.decrypt(applications[0].agencyEmail);
            }

            //get email content.
            const agencyNetwork = applications[0].agency_network;
            let error = null;
            const agencyNetworkBO = new AgencyNetworkBO();
            const emailContentJSON = await agencyNetworkBO.getEmailContentAgencyAndCustomer(agencyNetwork, "policy_purchase_agency", "policy_purchase_customer").catch(function(err){
                log.error(`Email content Error Unable to get email content for  email bind agency. appid: ${applicationId}.  error: ${err}` + __location);
                error = true;
            });
            if(error){
                return false;
            }

            if (emailContentJSON && emailContentJSON.customerMessage && emailContentJSON.customerSubject) {

                //decrypt application fields needed.
                applications[0].email = await crypt.decrypt(applications[0].email);
                applications[0].phone = await crypt.decrypt(applications[0].phone);
                applications[0].website = await crypt.decrypt(applications[0].website);
                applications[0].fname = await crypt.decrypt(applications[0].fname);
                applications[0].lname = await crypt.decrypt(applications[0].lname);
                applications[0].businessName = await crypt.decrypt(applications[0].businessName);
                applications[0].agencyEmail = await crypt.decrypt(applications[0].agencyEmail);
                applications[0].agencyWebsite = await crypt.decrypt(applications[0].agencyWebsite);
                applications[0].agencyLocationPhone = await crypt.decrypt(applications[0].agencyLocationPhone);

                let customerPhone = '';
                if (applications[0].phone) {
                    customerPhone = formatPhone(applications[0].phone);
                }
                const fullName = stringFunctions.ucwords(stringFunctions.strtolower(applications[0].fname) + ' ' + stringFunctions.strtolower(applications[0].lname));

                let agencyPhone = '';
                if (applications[0].agencyLocationPhone) {
                    agencyPhone = formatPhone(applications[0].agencyLocationPhone);
                }

                //const quoteResult = strpos($quote['api_result'], '_') ? substr(ucwords($quote['api_result']), 0, strpos($quote['api_result'], '_')) : ucwords($quote['api_result']);
                let quoteResult = stringFunctions.ucwords(applications[0].api_result);
                if (quoteResult.indexOf('_') > 0) {
                    quoteResult = quoteResult.substring(0, quoteResult.indexOf('_'));
                }
                // TO AGENCY
                let message = emailContentJSON.agencyMessage;
                let subject = emailContentJSON.agencySubject;

                message = message.replace(/{{Agent Login URL}}/g, applications[0].agent_login);
                message = message.replace(/{{Business Name}}/g, applications[0].businessName);
                message = message.replace(/{{Carrier}}/g, applications[0].insurer_name);
                message = message.replace(/{{Contact Email}}/g, applications[0].email);
                message = message.replace(/{{Contact Name}}/g, fullName);
                message = message.replace(/{{Contact Phone}}/g, customerPhone);
                message = message.replace(/{{Industry}}/g, applications[0].codeDescription);
                message = message.replace(/{{Quote Number}}/g, applications[0].quoteNumber);
                message = message.replace(/{{Quote Result}}/g, quoteResult);


                message = message.replace(/{{Brand}}/g, applications[0].emailBrand);
                subject = subject.replace(/{{Brand}}/g, applications[0].emailBrand);

                // Send the email
                const keyData = {
                    'application': applicationId,
                    'agency_location': applications[0].agencyLocation
                };
                if (agencyLocationEmail) {
                    const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData, applications[0].emailBrand);
                    if (emailResp === false) {
                        slack.send('#alerts', 'warning', `The system failed to inform an agency of the emailbindagency for application ${applicationId}. Please follow-up manually.`);
                    }
                }
                else {
                    log.error("emailbindagency no email address for data: " + JSON.stringify(keyData) + __location);
                }

                //TO INSURED
                try{
                    message = emailContentJSON.customerMessage;
                    subject = emailContentJSON.customerSubject;


                    message = message.replace(/{{Agency}}/g, applications[0].agencyName);
                    message = message.replace(/{{Agency Email}}/g, applications[0].agencyEmail);
                    message = message.replace(/{{Agency Phone}}/g, agencyPhone);
                    message = message.replace(/{{Agency Website}}/g, applications[0].agencyWebsite ? '<a href="' + applications[0].agencyWebsite + '" rel="noopener noreferrer" target="_blank">' + applications[0].agencyWebsite + '</a>' : '');
                    message = message.replace(/{{Quotes}}/g, '<br /><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="350"><tr><td width="200"><img alt="' + applications[0].insurer_name + '" src="https://img.talageins.com/' + applications[0].insurer_logo + '" width="100%" /></td><td width="20"></td><td style="padding-left:20px;font-size:30px;">$' + stringFunctions.number_format(applications[0].amount) + '</td></tr></table></div><br />');

                    subject = subject.replace(/{{Agency}}/g, applications[0].agencyName);

                    //log.debug("sending customer email " + __location);
                    const brand = applications[0].emailBrand === 'wheelhouse' ? 'agency' : `${applications[0].emailBrand}-agency`
                    const emailResp2 = await emailSvc.send(applications[0].email, subject, message, keyData, brand, applications[0].agencyId);
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
            log.error('emailbindagency No application quotes pulled from database applicationId or quoteId: ' + applicationId + ":" + quoteId + " SQL: \n" + appSQL + '\n' + __location);
            return false;
        }
    }
    else {
        log.error('emailbindagency missing applicationId or quoteId: ' + applicationId + ":" + quoteId + __location);
        return false;
    }

}