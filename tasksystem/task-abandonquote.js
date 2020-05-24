const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const email = global.requireShared('./services/email.js');
const slack = global.requireShared('./services/slack.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

/**
 * AbandonQuote Task processor
 *
 * @param {string} message - message from queue
 * @returns {void}
 */
exports.processtask = async function (queueMessage){

    //TODO check sent time over 10 seconds do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp/1000);
    var now = moment();
    var messageAge = moment.duration(now.diff(sentDatetime),'seconds');
    if(messageAge < 10){
        const messageBody = JSON.parse(queueMessage.Body);
        log.debug(JSON.stringify(messageBody));
        log.debug('sent at: ' + sentDatetime.toString())
        
        //DO STUFF
        //let error = null;
        try{
            await abandonquotetask();
            await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);
        }
        catch(err){
            log.error("Error abandonquotetask " + err);
        } 
        return;
    }
    else {
        log.info('removing old Abandon Quote Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle)
        return;
    }
}

/**
 * Exposes abandonquotetask for testing
 *
 * @param {} 
 * @returns {void}
 */
exports.abandonquotetaskExternal = async function (){
    let error = null;
    await abandonquotetask().catch(err => error = err );
    if(error){
        log.error ('abandonquotetask external: ' + error);
    }
    return;
}

var abandonquotetask = async function (){
     
     const oneHourAgo =  moment().subtract(1,'h');
     const twoHourAgo =  moment().subtract(2,'h');
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
            ORDER BY q.policy_type DESC
    `;
    
    log.debug(appIdSQL)
    
    let appIds = null;
	try{
        appIds = await db.query(appIdSQL);
        // log.debug('returned appIds');
        // log.debug(JSON.stringify(appIds));
	}catch(err){
		log.error("abandonquotetask getting appid list error " + err);
		throw err;
	}
    //process list.....
    if (appIds && appIds.length >0   ){
        for(let i = 0; i < appIds.length; i++){
            const quoteAppid= appIds[i];
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
                    log.error(`Error marking abandon quotes in DB for ${quoteAppid.applicationId} error:  ${err}`);
                    error = err;
                })
            }
            if(error === null){
                log.info(`Process abandon quotes for appId: ${quoteAppid.applicationId}`);
            }
        }
    }

    return;
}

var processAbandonQuote = async function (applicationId){
    //get   
    const quoteAppSQL = `
        SELECT
            a.agency_location AS agencyLocation,
            a.wholesale,
            ag.agency_network,
            ag.name AS agencyName,
            ag.website AS agencyWebsite,
            al.agency,
            al.email AS agencyEmail,
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
            q.number,
            an.email_brand AS emailBrand
        FROM clw_talage_applications AS a
            LEFT JOIN clw_talage_quotes AS q ON a.id = q.application
            LEFT JOIN clw_talage_businesses AS b ON b.id = a.business
            LEFT JOIN clw_talage_insurers AS i ON q.insurer = i.id
            LEFT JOIN clw_talage_policy_types AS pt ON q.policy_type = pt.abbr
            LEFT JOIN clw_talage_contacts AS c ON a.business = c.business
            LEFT JOIN clw_talage_industry_codes AS ic ON a.industry_code = ic.id
            LEFT JOIN clw_talage_agency_locations AS al ON a.agency_location = al.id
            LEFT JOIN clw_talage_agencies AS ag ON al.agency = ag.id
            LEFT JOIN clw_talage_agency_networks AS an ON ag.agency_network = an.id
        WHERE 
        a.id =  ${applicationId}
    `;
    
    let quotes = null;
	try {
        quotes = await db.query(quoteAppSQL);
    }
    catch(err){
        log.error(`Error get abandon quotes from DB for ${applicationId} error:  ${err}`);
        // Do not throw error other abandon quotes may need to be processed.
        return false;
    }

    if(quotes && quotes.length > 0){
       
        const agencyNetwork = quotes[0].agency_network; 
        //Get email content
        const emailContentSQL = `
            SELECT
                JSON_EXTRACT(custom_emails, '$.abandoned_quotes_agency') AS agencyEmailData,
                JSON_EXTRACT(custom_emails, '$.abandoned_quotes_customer') AS customerEmailData,
                (SELECT JSON_EXTRACT(custom_emails, '$.abandoned_quotes_agency')  FROM  clw_talage_agency_networks WHERE id = 1 ) AS defaultAgencyEmailData,
                (SELECT JSON_EXTRACT(custom_emails, '$.abandoned_quotes_customer')  FROM  clw_talage_agency_networks WHERE id = 1 ) AS defaultCustomerEmailData
            FROM clw_talage_agency_networks
            WHERE id = ${db.escape(agencyNetwork)}
            ORDER BY id DESC
            LIMIT 2; 
        `;
       
        let error = null;
        const emailContentResultArray = await db.query(emailContentSQL).catch(function(err){
            log.error(`DB Error Unable to get email content for abandon quote. appid: ${applicationId}.  error: ${err}`);
            error = true;
        });
        if(error){
            return false;
        }
            
        if(emailContentResultArray && emailContentResultArray.length >0 ){
            const emailContentResult = emailContentResultArray[0];
            //decrypt info...
            quotes[0].email =  await crypt.decrypt(quotes[0].email);
            quotes[0].agencyEmail =  await crypt.decrypt(quotes[0].agencyEmail);
            quotes[0].agencyPhone =  await crypt.decrypt(quotes[0].agencyPhone);
            quotes[0].agencyWebsite =  await crypt.decrypt(quotes[0].agencyWebsite);

            let customerEmailData = emailContentResult.customerEmailData ? JSON.parse(emailContentResult.customerEmailData) : null;
            let defaultCustomerEmailData = emailContentResult.defaultCustomerEmailData ? JSON.parse(emailContentResult.defaultCustomerEmailData) : null;

            let agencyName = quotes[0].agencyName
            let agencyPhone = '';
            let brand = quotes[0].emailBrand === 'wheelhouse' ? 'agency' : quotes[0].emailBrand.agency;

            if(quotes[0].wholesale || quotes[0].agency == 1 || quotes[0].agency == 2){
                // Override the agency info with Talage
                agencyName = 'Talage';
                agencyPhone = '833-4-TALAGE';
                brand = 'talage';
                quotes[0].agencyEmail = 'info@talageins.com';
                quotes[0].agencyWebsite = 'https://talageins.com';
            } else{
                // Format the phone number
                if(quotes[0].agencyPhone){
                    agencyPhone = formatPhone(quotes[0].agencyPhone);
                }
            }

            let quotesHTML = '<br><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="425">';
            //loop quotes and include
            let lastPolicyType = '';
            for(i=0;i< quotes.length;i++){
                const quote = quotes[i];
                if(quotes.length > 1){
                    // Show the policy type heading
                    if(quote.policyType !== lastPolicyType){
                        lastPolicyType = quote.policyType;
                        quotesHTML = quotesHTML +  `<tr><td colspan=\"5\" style=\"text-align: center; font-weight: bold\">${quote.policyType}</td></tr>`;
                    }
                }
                // Determine the Quote Result
                quoteResult = quote.api_result.indexOf('_') ?  quote.api_result.substr(stringFunctions.ucwords(quote.api_result), 0,  quote.api_result.indexOf('_')) : stringFunctions.ucwords(quote.api_result);
                // Write a row of the table
                quotesHTML = quotesHTML +  `<tr><td width=\"180\"><img alt=\"${quote.insurer}\" src=\"https://talageins.com/${quote.logo}\" width=\"100%\"></td><td width=\"20\"></td><td align=\"center\">` + quoteResult + `</td><td width=\"20\"></td><td style=\"padding-left:20px;font-size:30px;\">` + stringFunctions.number_format(quote.amount) + `</td></tr>`;
            }
            quotesHTML = quotesHTML +  '</table></div><br>';

            message = customerEmailData && customerEmailData.message  ? customerEmailData.message : defaultCustomerEmailData.message;
            subject = customerEmailData && customerEmailData.subject ? customerEmailData.subject : defaultCustomerEmailData.subject;
           
            // Perform content replacements
            message = message.replace(/{{Agency}}/g, agencyName);
            message = message.replace(/{{Agency Email}}/g, quotes[0].agencyEmail);
            message = message.replace(/{{Agency Phone}}/g, agencyPhone);
            message = message.replace(/{{Agency Website}}/g, `<a href="${quotes[0].agencyWebsite}">${quotes[0].agencyWebsite}</a>`);
            message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(quotes[0].emailBrand));
            message = message.replace(/{{is\/are}}/g, quotes.length === 1 ? 'is' : 'are');
            message = message.replace(/{{s}}/g, quotes.length === 1 ? '' : 's');
            message = message.replace(/{{Quotes}}/g, quotesHTML);
            subject = subject.replace(/{{is\/are}}/g, quotes.length === 1 ? 'is' : 'are');
            subject = subject.replace(/{{s}}/g, quotes.length === 1 ? '' : 's');

            // log.debug('Insured subject: ' + subject)
            // log.debug('Insured message: ' + message)

            //send email:
            // Send the email
            emailResp = await email.send(quotes[0].email, subject, message, {'application': applicationId, 'agency_location': quotes[0].agencyLocation}, quotes[0].emailBrand);
            log.debug("emailResp = " + emailResp);
            if(emailResp === false){
               slack('#alerts', 'warning','The system failed to remind the insured to revisit their quotes for application #${applicationId}. Please follow-up manually.' );
            }

            /* ---=== Email to Agency (not sent to Talage) ===--- */

            // Only send for non-Talage accounts that are not wholesale
            if(quotes[0].wholesale == false && quotes[0].agency !== 1){
               
                quotes[0].businessName =  await crypt.decrypt(quotes[0].businessName);
                quotes[0].fname =  await crypt.decrypt(quotes[0].fname);
                quotes[0].lname =  await crypt.decrypt(quotes[0].lname);
                quotes[0].phone =  await crypt.decrypt(quotes[0].phone);

                let agencyEmailData = emailContentResult.agencyEmailData ? JSON.parse(emailContentResult.agencyEmailData) : null;
                let defaultAgencyEmailData = emailContentResult.defaultAgencyEmailData ? JSON.parse(emailContentResult.defaultAgencyEmailData) : null;
                
                const portalLink = global.settings.PORTAL_URL;
                
                // Format the full name and phone number
                fullName = stringFunctions.ucwords(stringFunctions.strtolower(quotes[0].fname) + ' ' + stringFunctions.strtolower(quotes[0].lname));
                phone = '';
                if(quotes[0].phone){
                    phone = formatPhone(quotes[0].phone);;
                }

                //  // Determine which message and subject to use
                 message = agencyEmailData && agencyEmailData.message  ? agencyEmailData.message : defaultAgencyEmailData.message;
                 subject = agencyEmailData && agencyEmailData.subject ? agencyEmailData.subject : defaultAgencyEmailData.subject;
                

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
                  emailResp = await email.send(quotes[0].agencyEmail, subject, message, {'application': applicationId, 'agency_location': quotes[0].agencyLocation}, quote.emailBrand);
                  if(emailResp === false){
                        slack('#alerts', 'warning','The system failed to inform an agency of the abandoned quote' + (quotes.length === 1 ? '' : 's') + ' for application ${applicationId}. Please follow-up manually.');
                    }

                // log.debug('Agency subject: ' + subject)
                // log.debug('Agency message: ' + message)
            }

            return true;
        }
        else {
            log.error('AbandonQuote missing emailcontent for agencynetwork: ' + agencyNetwork);
            return false ;
        }
    }
    else {
        return false;
    }

}

var markApplicationProcess = async function (applicationId){
    
    const updateSQL = `UPDATE clw_talage_applications
	                   SET  abandoned_email = 1 
	                   where id = ${applicationId} `;
    
    // Update application record
	await db.query(updateSQL).catch(function(e){
		log.error('Abandon Quote flage update error: ' + e.message);
		throw e;
	});
}