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
exports.processtask = async function(queueMessage){
    let error = null;
    //check sent time over 30 seconds do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    if(messageAge < 30){

        //DO STUFF

        await abandonquotetask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error abandonquotetask deleteTaskQueueItem " + error + __location);
        }
        return;
    }
    else {
        log.info('removing old Abandon Quote Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error abandonquotetask deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes abandonquotetask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await abandonquotetask().catch(err => error = err);
    if(error){
        log.error('abandonquotetask external: ' + error);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */
var abandonquotetask = async function(){

    const oneHourAgo = moment().subtract(1,'h');
    const twoHourAgo = moment().subtract(2,'h');
    //get list....
    const appIdSQL = `
            SELECT DISTINCT
				a.id as 'applicationId' 
            FROM clw_talage_applications a
            LEFT JOIN clw_talage_quotes q  ON a.id  = q.application
            WHERE q.amount  > 0
                AND a.agency_location  IS NOT NULL
                AND a.created BETWEEN  '${twoHourAgo.utc().format()}' AND '${oneHourAgo.utc().format()}'
                AND a.abandoned_email  = 0
                AND a.state  = 13
                AND q.api_result in ("quoted", "referred_with_price")
            ORDER BY q.policy_type DESC
    `;

    //log.debug(appIdSQL)

    let appIds = null;
    try{
        appIds = await db.query(appIdSQL);
        // log.debug('returned appIds');
        // log.debug(JSON.stringify(appIds));
    }
    catch(err){
        log.error("abandonquotetask getting appid list error " + err + __location);
        throw err;
    }
    //process list.....
    if(appIds && appIds.length > 0){
        for(let i = 0; i < appIds.length; i++){
            const quoteAppid = appIds[i];
            log.debug(JSON.stringify(quoteAppid.applicationId));

            let error = null
            let succesfulProcess = false;
            try{
                succesfulProcess = await processAbandonQuote(quoteAppid.applicationId)
            }
            catch(err){
                error = err;
                log.debug('catch error from await ' + err);
            }

            if(error === null && succesfulProcess === true){
                await markApplicationProcess(quoteAppid.applicationId).catch(function(err){
                    log.error(`Error marking abandon quotes in DB for ${quoteAppid.applicationId} error:  ${err}` + __location);
                    error = err;
                })
            }
            if(error === null){
                log.info(`Processed abandon quotes for appId: ${quoteAppid.applicationId}`);
            }
        }
    }

    return;
}

var processAbandonQuote = async function(applicationId){
    //get
    const quoteAppSQL = `
        SELECT
            a.agency_location AS agencyLocation,
            a.wholesale,
            ag.agency_network,
            ag.name AS agencyName,
            ag.website AS agencyWebsite,
            ag.email AS agencyEmail,
            al.agency,
            al.email AS agencyLocationEmail,
            al.phone AS agencyPhone,
            b.name AS businessName,
            c.email,
            c.fname,
            c.lname,
            c.phone,
            i.agent_login,
            i.logo,
            i.name AS insurer,
            ic.description AS industryCode,
            pt.name AS policyType,
            q.amount,
            q.api_result,
            q.application,
            q.number
        FROM clw_talage_applications AS a
            LEFT JOIN clw_talage_quotes AS q ON a.id = q.application
            LEFT JOIN clw_talage_businesses AS b ON b.id = a.business
            LEFT JOIN clw_talage_insurers AS i ON q.insurer = i.id
            LEFT JOIN clw_talage_policy_types AS pt ON q.policy_type = pt.abbr
            LEFT JOIN clw_talage_contacts AS c ON a.business = c.business
            LEFT JOIN clw_talage_industry_codes AS ic ON a.industry_code = ic.id
            LEFT JOIN clw_talage_agency_locations AS al ON a.agency_location = al.id
            LEFT JOIN clw_talage_agencies AS ag ON al.agency = ag.id
        WHERE 
        a.id =  ${applicationId}
        AND q.api_result in ("quoted", "referred_with_price")
    `;

    let quotes = null;
    try{
        quotes = await db.query(quoteAppSQL);
    }
    catch(err){
        log.error(`Error get abandon quotes from DB for ${applicationId} error:  ${err}` + __location);
        // Do not throw error other abandon quotes may need to be processed.
        return false;
    }

    if(quotes && quotes.length > 0){
        const agencyNetwork = quotes[0].agency_network;
        let error = null;
        const agencyNetworkBO = new AgencyNetworkBO();
        const emailContentJSON = await agencyNetworkBO.getEmailContentAgencyAndCustomer(agencyNetwork, "abandoned_quotes_agency", "abandoned_quotes_customer").catch(function(err){
            log.error(`Email content Error Unable to get email content for abandon quote. appid: ${applicationId}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }

        if(emailContentJSON && emailContentJSON.customerMessage && emailContentJSON.customerSubject){

            let agencyLocationEmail = null;

            //decrypt info...
            if(quotes[0].agencyLocationEmail){
                agencyLocationEmail = await crypt.decrypt(quotes[0].agencyLocationEmail);
            }
            else if(quotes[0].agencyEmail){
                agencyLocationEmail = await crypt.decrypt(quotes[0].agencyEmail);
            }

            quotes[0].email = await crypt.decrypt(quotes[0].email);
            quotes[0].agencyPhone = await crypt.decrypt(quotes[0].agencyPhone);
            quotes[0].agencyWebsite = await crypt.decrypt(quotes[0].agencyWebsite);

            let agencyName = quotes[0].agencyName
            let agencyPhone = '';

            if(quotes[0].wholesale || quotes[0].agency === 1 || quotes[0].agency === 2){
                // Override the agency info with Talage
                agencyName = 'Talage';
                agencyPhone = '833-4-TALAGE';
                // brand = 'talage';
                agencyLocationEmail = 'info@talageins.com';
                quotes[0].agencyWebsite = 'https://talageins.com';
            }
            else if(quotes[0].agencyPhone){
                // Format the phone number
                agencyPhone = formatPhone(quotes[0].agencyPhone);
            }

            let quotesHTML = '<br><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="425">';
            //loop quotes and include
            let lastPolicyType = '';
            for(let i = 0; i < quotes.length; i++){
                const quote = quotes[i];
                if(quotes.length > 1){
                    // Show the policy type heading
                    if(quote.policyType !== lastPolicyType){
                        lastPolicyType = quote.policyType;
                        quotesHTML += `<tr><td colspan=\"5\" style=\"text-align: center; font-weight: bold\">${quote.policyType}</td></tr>`;
                    }
                }
                // Determine the Quote Result
                const quoteResult = quote.api_result.indexOf('_') ? quote.api_result.substr(stringFunctions.ucwords(quote.api_result), 0, quote.api_result.indexOf('_')) : stringFunctions.ucwords(quote.api_result);
                const quoteNumber = quote.number ? quote.number : "No Quote Number";
                // Write a row of the table
                //TODO get ENV IMAGE_URL
                quotesHTML = quotesHTML + `<tr><td width=\"180\"><img alt=\"${quote.insurer}\" src=\"https://img.talageins.com/${quote.logo}\" width=\"100%\"></td><td width=\"20\"></td><td align=\"center\">` + quoteResult + `</td><td width=\"20\"></td><td align=\"center\">${quoteNumber}</td><td width=\"20\"></td><td style=\"padding-left:20px;font-size:30px;\">` + stringFunctions.number_format(quote.amount) + `</td></tr>`;
            }
            quotesHTML += '</table></div><br>';

            // let message = customerEmailData && customerEmailData.message ? customerEmailData.message : defaultCustomerEmailData.message;
            // let subject = customerEmailData && customerEmailData.subject ? customerEmailData.subject : defaultCustomerEmailData.subject;

            let message = emailContentJSON.customerMessage;
            let subject = emailContentJSON.customerSubject;

            // Perform content replacements
            message = message.replace(/{{Agency}}/g, agencyName);
            message = message.replace(/{{Agency Email}}/g, agencyLocationEmail);
            message = message.replace(/{{Agency Phone}}/g, agencyPhone);
            message = message.replace(/{{Agency Website}}/g, `<a href="${quotes[0].agencyWebsite}">${quotes[0].agencyWebsite}</a>`);
            message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(emailContentJSON.emailBrand));
            message = message.replace(/{{is\/are}}/g, quotes.length === 1 ? 'is' : 'are');
            message = message.replace(/{{s}}/g, quotes.length === 1 ? '' : 's');
            message = message.replace(/{{Quotes}}/g, quotesHTML);
            subject = subject.replace(/{{is\/are}}/g, quotes.length === 1 ? 'is' : 'are');
            subject = subject.replace(/{{s}}/g, quotes.length === 1 ? '' : 's');


            //send email:
            // Send the email
            const keyData = {
                'application': applicationId,
                'agency_location': quotes[0].agencyLocation
            }
            let emailResp = await emailSvc.send(quotes[0].email, subject, message, keyData, agencyNetwork, "");
            // log.debug("emailResp = " + emailResp);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to remind the insured to revisit their quotes for application #${applicationId}. Please follow-up manually.`);
            }

            /* ---=== Email to Agency (not sent to Talage) ===--- */

            // Only send for non-Talage accounts that are not wholesale
            //if(quotes[0].wholesale === false && quotes[0].agency !== 1){
            if(quotes[0].wholesale === 0){
                quotes[0].businessName = await crypt.decrypt(quotes[0].businessName);
                quotes[0].fname = await crypt.decrypt(quotes[0].fname);
                quotes[0].lname = await crypt.decrypt(quotes[0].lname);
                quotes[0].phone = await crypt.decrypt(quotes[0].phone);


                const portalLink = emailContentJSON.PORTAL_URL;

                // Format the full name and phone number
                const fullName = stringFunctions.ucwords(stringFunctions.strtolower(quotes[0].fname) + ' ' + stringFunctions.strtolower(quotes[0].lname));
                let phone = '';
                if(quotes[0].phone){
                    phone = formatPhone(quotes[0].phone);
                }

                message = emailContentJSON.agencyMessage;
                subject = emailContentJSON.agencySubject;

                //already have quotesHTML from above

                //  // Perform content message.replacements
                message = message.replace(/{{Agent Login URL}}/g, quotes[0].agent_login);
                message = message.replace(/{{Agency Portal}}/g, `<a href=\"${portalLink}\" rel=\"noopener noreferrer\" target=\"_blank\">Agency Portal</a>`);
                message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(quotes[0].emailBrand));
                message = message.replace(/{{Business Name}}/g, quotes[0].businessName);
                message = message.replace(/{{Contact Email}}/g, quotes[0].email);
                message = message.replace(/{{Contact Name}}/g, fullName);
                message = message.replace(/{{Contact Phone}}/g, phone);
                message = message.replace(/{{Industry}}/g, quotes[0].industryCode);
                message = message.replace(/{{Quotes}}/g, quotesHTML);


                // Send the email
                const keyData2 = {
                    'application': applicationId,
                    'agency_location': quotes[0].agencyLocation
                };
                if(agencyLocationEmail){
                    log.info(`Send agency location abandonquote email from ${quotes[0].emailBrand} to ${agencyLocationEmail} for application ${applicationId} `)
                    emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData2,agencyNetwork, quotes[0].emailBrand);
                    if(emailResp === false){
                        slack.send('#alerts', 'warning','The system failed to inform an agency of the abandoned quote' + (quotes.length === 1 ? '' : 's') + ` for application ${applicationId}. Please follow-up manually.`);
                    }
                }
                else {
                    log.error("Abandon Quote no email address for data: " + JSON.stringify(keyData2) + __location);
                }
            }

            return true;
        }
        else {
            log.error('AbandonQuote missing emailcontent for agencynetwork: ' + agencyNetwork + __location);
            return false;
        }
    }
    else {
        return false;
    }

}

var markApplicationProcess = async function(applicationId){

    const updateSQL = `UPDATE clw_talage_applications
	                   SET  abandoned_email = 1 
	                   where id = ${applicationId} `;

    // Update application record
    await db.query(updateSQL).catch(function(e){
        log.error('Abandon Quote flag update error: ' + e.message + __location);
        throw e;
    });
}