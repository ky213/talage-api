/* eslint-disable prefer-const */
const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBO = global.requireShared('models/Quote-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');

const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
const PolicyTypeBO = global.requireShared('models/PolicyType-BO.js');

const log = global.log;

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
        if(error){
            log.error("Error abandonquotetask " + error + __location);
        }
        error = null;
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

    const oneHourAgo = new moment().subtract(1,'h').startOf('minute');
    const twoHourAgo = new moment().subtract(2,'h').startOf('minute');

    //get list of agency network that get the quote emails
    // eslint-disable-next-line prefer-const
    let agencyNetworkIdList = [];
    // eslint-disable-next-line prefer-const
    let queryAgencyNetwork = {};
    queryAgencyNetwork["featureJson.agencyNetworkQuoteEmails"] = true;
    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetworkList = await agencyNetworkBO.getList(queryAgencyNetwork).catch(function(err){
        log.error(`Error get Agency Network list from DB. error:  ${err}` + __location);
        return false;
    });

    if(agencyNetworkList && agencyNetworkList.length > 0){
        for(let i = 0; i < agencyNetworkList.length; i++){
            agencyNetworkIdList.push(agencyNetworkList[i].systemId);
        }
    }


    //appstatusId == 50 is quoted_referred 60 = quoted

    // eslint-disable-next-line prefer-const
    let query = {
        "abandonedEmail": false,
        "gtAppStatusId": 40,
        "ltAppStatusId": 70,
        "searchenddate": oneHourAgo,
        "searchbegindate": twoHourAgo
    };
    if(agencyNetworkIdList.length > 0){
        let orList = [];
        const or1 = {"agencyPortalCreated": false}
        const or2 = {agencyNetworkId: {$in: agencyNetworkIdList}};
        orList.push(or1);
        orList.push(or2);
        query.$or = orList;
    }
    else {
        query.agencyPortalCreated = false;
    }

    let appList = null;
    const applicationBO = new ApplicationBO();
    try{
        log.debug("abandonquote query " + JSON.stringify(query))
        appList = await applicationBO.getList(query);
    }
    catch(err){
        log.error("abandonquotetask getting appid list error " + err + __location);
        throw err;
    }
    //process list.....
    if(appList && appList.length > 0){

        //get list of insurers - Small < 50 get whole list once.
        let insurerList = null;
        const insurerBO = new InsurerBO();
        try{
            insurerList = await insurerBO.getList();
        }
        catch(err){
            log.error("Error get InsurerList " + err + __location)
        }
        let policyTypeList = null;
        const policyTypeBO = new PolicyTypeBO()
        try{
            policyTypeList = await policyTypeBO.getList();
        }
        catch(err){
            log.error("Error get policyTypeList " + err + __location)
        }


        for(let i = 0; i < appList.length; i++){
            const appDoc = appList[i];

            let error = null
            let succesfulProcess = false;
            try{
                succesfulProcess = await processAbandonQuote(appDoc, insurerList, policyTypeList)
            }
            catch(err){
                error = err;
                log.debug('catch error from await ' + err);
            }

            if(error === null && succesfulProcess === true){
                await markApplicationProcess(appDoc).catch(function(err){
                    log.error(`Error marking abandon quotes in DB for ${appDoc.applicationId} error:  ${err}` + __location);
                    error = err;
                })
            }
            if(error === null){
                log.info(`Processed abandon quotes for appId: ${appDoc.applicationId}`);
            }
        }
    }

    return;
}

var processAbandonQuote = async function(applicationDoc, insurerList, policyTypeList){
    if(!applicationDoc){
        return;
    }

    const quoteBO = new QuoteBO()
    let quoteList = null;
    try {
        //sort by policyType
        const quoteQuery = {
            "applicationId": applicationDoc.applicationId,
            "apiResult": ["quoted", "referred_with_price"],
            "sort": "policyType"
        }
        quoteList = await quoteBO.getList(quoteQuery);
    }
    catch(err){
        log.error("Error getting quote for abandon qoute " + err + __location);
    }


    if(quoteList && quoteList.length > 0){

        let error = null;
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
        const emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(applicationDoc.agencyId, "abandoned_quotes_agency", "abandoned_quotes_customer").catch(function(err){
            log.error(`Email content Error Unable to get email content for abandon quote. appid: ${applicationDoc.applicationId}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }

        if(emailContentJSON && emailContentJSON.customerMessage && emailContentJSON.customerSubject){

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
            //get primary contact from ApplicationDoc.
            const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);

            const customerEmail = customerContact.email;
            let agencyPhone = agencyJSON.phone;
            let agencyWebsite = agencyJSON.website;


            let agencyName = agencyJSON.name;


            if(applicationDoc.wholesale || applicationDoc.agencyId === 1 || applicationDoc.agencyId === 2){
                // Override the agency info with Talage
                agencyName = 'Talage';
                agencyPhone = '833-4-TALAGE';
                // brand = 'talage';
                agencyLocationEmail = 'info@talageins.com';
                agencyWebsite = 'https://talageins.com';
            }
            else if(agencyPhone){
                // Format the phone number
                agencyPhone = formatPhone(agencyPhone);
            }

            let quotesHTML = '<br><div align="center"><table border="0" cellpadding="0" cellspacing="0" width="425">';
            //loop quotes and include
            let lastPolicyType = '';
            for(let i = 0; i < quoteList.length; i++){
                const quoteDoc = quoteList[i];
                let insurer = {
                    name: '',
                    logo: ''
                };
                if(insurerList){
                    insurer = insurerList.find(insurertest => insurertest.id === quoteDoc.insurerId);
                }

                if(quoteList.length > 1){
                    // Show the policy type heading
                    if(quoteDoc.policyType !== lastPolicyType){
                        lastPolicyType = quoteDoc.policyType;
                        const policyTypeJSON = policyTypeList.find(policyTypeTest => policyTypeTest.abbr === quoteDoc.policyType)
                        quotesHTML += `<tr><td colspan=\"5\" style=\"text-align: center; font-weight: bold\">${policyTypeJSON.name}</td></tr>`;
                    }
                }
                // Determine the Quote Result
                const quoteResult = quoteDoc.apiResult.indexOf('_') ? quoteDoc.apiResult.substr(stringFunctions.ucwords(quoteDoc.apiResult), 0, quoteDoc.apiResult.indexOf('_')) : stringFunctions.ucwords(quoteDoc.apiResult);
                const quoteNumber = quoteDoc.quoteNumber ? quoteDoc.quoteNumber : "No Quote Number";
                // Write a row of the table
                quotesHTML = quotesHTML + `<tr><td width=\"180\"><img alt=\"${insurer.name}\" src=\"${global.settings.IMAGE_URL}/${stringFunctions.trimString(insurer.logo, 'images/')}\" width=\"100%\"></td><td width=\"20\"></td><td align=\"center\">` + quoteResult + `</td><td width=\"20\"></td><td align=\"center\">${quoteNumber}</td><td width=\"20\"></td><td style=\"padding-left:20px;font-size:30px;\">$` + stringFunctions.number_format(quoteDoc.amount) + `</td></tr>`;
            }
            quotesHTML += '</table></div><br>';


            let message = emailContentJSON.customerMessage;
            let subject = emailContentJSON.customerSubject;

            // Perform content replacements
            message = message.replace(/{{Agency}}/g, agencyName);
            message = message.replace(/{{Agency Email}}/g, agencyLocationEmail);
            message = message.replace(/{{Agency Phone}}/g, agencyPhone);
            message = message.replace(/{{Agency Website}}/g, `<a href="${agencyWebsite}">${agencyWebsite}</a>`);
            message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(emailContentJSON.emailBrand));
            message = message.replace(/{{is\/are}}/g, quoteList.length === 1 ? 'is' : 'are');
            message = message.replace(/{{s}}/g, quoteList.length === 1 ? '' : 's');
            message = message.replace(/{{Quotes}}/g, quotesHTML);
            subject = subject.replace(/{{is\/are}}/g, quoteList.length === 1 ? 'is' : 'are');
            subject = subject.replace(/{{s}}/g, quoteList.length === 1 ? '' : 's');


            //send email:
            // Send the email
            const keyData = {'applicationDoc': applicationDoc}
            let emailResp = await emailSvc.send(customerEmail, subject, message, keyData, agencyNetworkId, "");
            // log.debug("emailResp = " + emailResp);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to remind the insured to revisit their quotes for application #${applicationDoc.applicationId}. Please follow-up manually.`);
            }


            // need industry code description for agency and agencynetwork emails.
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


            /* ---=== Email to Agency (not sent to Talage) ===--- */

            // Only send for non-Talage accounts that are not wholesale
            //if(quotes[0].wholesale === false && quotes[0].agency !== 1){
            if(applicationDoc.wholesale === false){
                const portalLink = emailContentJSON.PORTAL_URL;

                // Format the full name and phone number
                const fullName = stringFunctions.ucwords(stringFunctions.strtolower(customerContact.firstName) + ' ' + stringFunctions.strtolower(customerContact.lastName));
                let phone = '';
                if(customerContact.phone){
                    phone = formatPhone(customerContact.phone);
                }

                message = emailContentJSON.agencyMessage;
                subject = emailContentJSON.agencySubject;

                //  // Perform content message.replacements
                message = message.replace(/{{Agent Login URL}}/g, insurerList[0].agent_login);
                message = message.replace(/{{Agency Portal}}/g, `<a href=\"${portalLink}\" rel=\"noopener noreferrer\" target=\"_blank\">Agency Portal</a>`);
                message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(stringFunctions.ucwords(emailContentJSON.emailBrand)));
                message = message.replace(/{{Business Name}}/g, applicationDoc.businessName);
                message = message.replace(/{{Contact Email}}/g, customerEmail);
                message = message.replace(/{{Contact Name}}/g, fullName);
                message = message.replace(/{{Contact Phone}}/g, phone);
                message = message.replace(/{{Industry}}/g, industryCodeDesc);
                message = message.replace(/{{Quotes}}/g, quotesHTML);


                // Send the email
                const keyData2 = {'applicationDoc': applicationDoc};
                if(agencyLocationEmail){
                    emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData2,agencyNetworkId, emailContentJSON.emailBrand);
                    if(emailResp === false){
                        slack.send('#alerts', 'warning','The system failed to inform an agency of the abandoned quote' + (quoteList.length === 1 ? '' : 's') + ` for application ${applicationDoc.applicationId}. Please follow-up manually.`);
                    }
                }
                else {
                    log.error(`Abandon Quote no email address for application: ${applicationDoc.applicationId} ` + __location);
                }
            }

            //Determine if Agency Network Email is required.
            if(agencyNetworkDB
                && agencyNetworkDB.featureJson
                && agencyNetworkDB.featureJson.agencyNetworkQuoteEmails
                && agencyNetworkDB.email){
                try{
                    const emailContentAgencyNetworkJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId,"abandoned_quotes_agency_network");
                    log.debug('emailContentAgencyNetworkJSON: ' + JSON.stringify(emailContentAgencyNetworkJSON))
                    if(emailContentAgencyNetworkJSON && emailContentAgencyNetworkJSON.message && emailContentAgencyNetworkJSON.subject){
                        const portalLink = emailContentAgencyNetworkJSON.PORTAL_URL;

                        // Format the full name and phone number
                        const fullName = stringFunctions.ucwords(stringFunctions.strtolower(customerContact.firstName) + ' ' + stringFunctions.strtolower(customerContact.lastName));
                        let phone = '';
                        if(customerContact.phone){
                            phone = formatPhone(customerContact.phone);
                        }

                        message = emailContentAgencyNetworkJSON.message;
                        subject = emailContentAgencyNetworkJSON.subject;

                        //already have quotesHTML from above
                        // need industry code description

                        //  // Perform content message.replacements
                        message = message.replace(/{{Agent Login URL}}/g, insurerList[0].agent_login);
                        message = message.replace(/{{Agency Portal}}/g, `<a href=\"${portalLink}\" rel=\"noopener noreferrer\" target=\"_blank\">Agency Portal</a>`);
                        message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(stringFunctions.ucwords(emailContentAgencyNetworkJSON.emailBrand)));
                        message = message.replace(/{{Business Name}}/g, applicationDoc.businessName);
                        message = message.replace(/{{Contact Email}}/g, customerEmail);
                        message = message.replace(/{{Contact Name}}/g, fullName);
                        message = message.replace(/{{Contact Phone}}/g, phone);
                        message = message.replace(/{{Industry}}/g, industryCodeDesc);
                        message = message.replace(/{{Quotes}}/g, quotesHTML);


                        // Send the email
                        const keyData2 = {'applicationDoc': applicationDoc};
                        if(agencyNetworkDB.email){
                            emailResp = await emailSvc.send(agencyNetworkDB.email, subject, message, keyData2,agencyNetworkId, emailContentAgencyNetworkJSON.emailBrand);
                            if(emailResp === false){
                                slack.send('#alerts', 'warning','The system failed to inform an agency of the abandoned quote' + (quoteList.length === 1 ? '' : 's') + ` for application ${applicationDoc.applicationId}. Please follow-up manually.`);
                            }
                        }
                        else {
                            log.error(`Abandon Quote no email address for application: ${applicationDoc.applicationId} ` + __location);
                        }
                    }
                    else {
                        log.error(`AgencyNetwork ${agencyNetworkDB.name} missing abandoned_quotes_agency_network email template` + __location)
                    }
                }
                catch(err){
                    log.error(`Sending Agency Network abandoned quote email ${err}` + __location);
                }
            }

            return true;
        }
        else {
            log.error('AbandonQuote missing emailcontent for agencynetwork: ' + agencyNetworkId + __location);
            return false;
        }
    }
    else {
        return false;
    }

}

var markApplicationProcess = async function(appDoc){
    // Call BO updateMongo
    const applicationBO = new ApplicationBO();
    const docUpdate = {"abandonedEmail": true};
    try{
        await applicationBO.updateMongo(appDoc.applicationId,docUpdate);
    }
    catch(err){
        log.error(`Error calling applicationBO.updateMongo for ${appDoc.applicationId} ` + err + __location)
        throw err;
    }

}