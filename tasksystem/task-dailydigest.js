'use strict';

const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');

/**
 * DailyDigest Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
exports.processtask = async function(queueMessage){
    let error = null;
    // check sent time over 30 minutes do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    //log.debug("messageAge: " + messageAge );
    if(messageAge < 1800){
        // DO STUFF

        await dailyDigestTask().catch(err => error = err);
        if(error){
            log.error("Error dailyDigestTask " + error + __location);
        }
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error daily digest deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.debug('removing old daily digest Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error daily digest deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes DailyDigestTask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await dailyDigestTask().catch(err => error = err);
    if(error){
        log.error('dailyDigestTask external: ' + error + __location);
    }
    return;
}

var dailyDigestTask = async function(){

    const yesterdayBegin = moment.tz("America/Los_Angeles").subtract(1,'d').startOf('day');
    const yesterdayEnd = moment.tz("America/Los_Angeles").subtract(1,'d').endOf('day');

    let agencyLocationList = null;
    const agencyLocationBO = new AgencyLocationBO();
    const query = {};
    const getAgencyName = true;
    const loadChildren = false;
    agencyLocationList = await agencyLocationBO.getList(query, getAgencyName, loadChildren).catch(function(err){
        log.error(`Error get agency location list from DB. error:  ${err}` + __location);
        return false;
    });

    if(agencyLocationList && agencyLocationList.length > 0){
        for(let i = 0; i < agencyLocationList.length; i++){
            const agencyLocationDB = agencyLocationList[i];
            // process each agency location. make sure we have an active Agency
            if(agencyLocationDB && agencyLocationDB.systemId && agencyLocationDB.agencyNetworkId && (agencyLocationDB.email || agencyLocationDB.agencyEmail)){
                await processAgencyLocation(agencyLocationDB, yesterdayBegin, yesterdayEnd).catch(function(err){
                    log.error("Error Agency Location Daily Digest error. AL: " + JSON.stringify(agencyLocationDB) + " error: " + err + __location);
                })
            }
        }
    }
    // See if any AgencyNetworks need to get a DailyDigest email
    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetworkList = await agencyNetworkBO.getList(query).catch(function(err){
        log.error(`Error get Agency Network list from DB. error:  ${err}` + __location);
        return false;
    });

    if(agencyNetworkList && agencyNetworkList.length > 0){
        for(let i = 0; i < agencyNetworkList.length; i++){
            const agencyNetworkDB = agencyNetworkList[i];

            if(agencyNetworkDB && agencyNetworkDB.featureJson && agencyNetworkDB.featureJson.agencyNetworkDailyDigestEmail && agencyNetworkDB.email){
                await processAgencyNetwork(agencyNetworkDB, yesterdayBegin, yesterdayEnd).catch(function(err){
                    log.error("Error Agency Network Daily Digest error: " + JSON.stringify(agencyNetworkDB) + " error: " + err + __location);
                })
            }
        }
    }

    return;
}

/**
 * Exposes processAgencyLocation for testing
 *
 * @param {string} agencyLocationDB - from db query not full object.
 * @returns {void}
 */

var processAgencyLocation = async function(agencyLocationDB, yesterdayBegin, yesterdayEnd){

    if(!agencyLocationDB.agencyNetworkId){
        log.error(`Error DailyDigests Agency Location agency_network not set for Agency Location: ${agencyLocationDB.alid}` + __location);
        return false;
    }
    const agencyNetwork = agencyLocationDB.agencyNetworkId;

    const query = {
        "agencyLocationId": agencyLocationDB.systemId,
        "searchenddate": yesterdayEnd,
        "searchbegindate": yesterdayBegin
    };
    let appList = null;
    const applicationBO = new ApplicationBO();

    try{

        appList = await applicationBO.getList(query);
    }
    catch(err){
        log.error("dailydigest getting App list error " + err + __location);
        throw err;
    }


    let appCount = 0;
    if(appList && appList.length > 0){

        let error = null;
        const agencyBO = new AgencyBO();
        const emailContentJSON = await agencyBO.getEmailContent(agencyLocationDB.agencyId, "daily_digest").catch(function(err){
            log.error(`Unable to get email content for Daily Digest. agency ${agencyLocationDB.agencyId} agency_network: ${db.escape(agencyNetwork)}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }

        if(emailContentJSON && emailContentJSON.message){

            let message = emailContentJSON.message;
            let subject = emailContentJSON.subject;

            if(!message){
                log.error(`Daily Digest email content creation error: no message. agency_network: ${db.escape(agencyLocationDB.agencyNetworkId)}.` + __location);
                return false;
            }
            if(!subject){
                log.error(`Daily Digest email content creation error: no subject. agency_network: ${db.escape(agencyLocationDB.agencyNetworkId)}.` + __location);
                return false;
            }
            // Link setup.
            const portalLink = emailContentJSON.PORTAL_URL;

            let applicationList = '<br><table border="1" cellspacing="0" cellpadding="4" width="100%"><thead><tr><th>Business Name</th><th>Contact Name</th><th>Contact Email</th><th>Contact Phone</th><th>Wholesale</th></tr></thead><tbody>';

            appCount = appList.length;
            for(let i = 0; i < appList.length; i++){
                const applicationDoc = appList[i]
                // eslint-disable-next-line prefer-const
                //Get primary contact
                const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
                const customerPhone = formatPhone(customerContact.phone);

                let wholesale = applicationDoc.wholesale === true ? "Talage" : "";
                if(applicationDoc.solepro){
                    wholesale = "SolePro"
                }

                applicationList += '<tr><td>' + stringFunctions.ucwords(applicationDoc.businessName) + '</td><td>' + customerContact.firstName + ' ' + customerContact.lastName + '</td><td>' + customerContact.email + '</td><td>' + customerPhone + '</td><td>' + wholesale + '</td></tr>';
            }

            applicationList += '</tbody></table><br>';

            try{
                message = message.replace(/{{Application List}}/g, applicationList);
                message = message.replace(/{{Agency Portal Link}}/g, `<a href="${portalLink}" rel="noopener noreferrer" target="_blank">Agency Portal</a>`);
                message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(emailContentJSON.emailBrand));
                message = message.replace(/{{Number of Users}}/g, appCount + ' ' + (appCount > 1 ? 'users' : 'user'));
                subject = subject.replace(/{{Brand}}/g, stringFunctions.ucwords(emailContentJSON.emailBrand), subject);
            }
            catch(e){
                log.error(`Daily Digest email content creation error: ${e}` + __location);
                return false;
            }

            let agencyLocationEmail = null;

            if(agencyLocationDB.email){
                agencyLocationEmail = agencyLocationDB.email;
            }
            else if(agencyLocationDB.agencyEmail){
                agencyLocationEmail = agencyLocationDB.agencyEmail;
            }


            if(agencyLocationEmail){
                const keyData = {'agencyLocationId': agencyLocationDB.systemId};
                // send email
                const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData,agencyLocationDB.agencyNetworkId,"");
                if(emailResp === false){
                    slack.send('#alerts', 'warning',`The system failed to send daily digest email for Agency Location  #${agencyLocationDB.systemId}.`);
                }
            }
            else {
                log.error("Dailydigest no email address for AgencyLocation: " + JSON.stringify(agencyLocationDB) + __location);
            }

        }
        else {
            log.error(`DB Error Unable to get email content for Daily Digest. agency_network: ${db.escape(agencyLocationDB.agencyNetworkId)} agency:  ${agencyLocationDB.agencyId}.` + __location);
            return false;
        }
    }
    else {
        log.info(`DailyDigest: No Activity for Agency Location: ${db.escape(agencyLocationDB.systemId)}.`)
    }
    return true;
}


/**
 * Exposes processAgencyLocation for testing
 *
 * @param {string} agencyNetworkDB - from db query not full object.
 * @returns {void}
 */

var processAgencyNetwork = async function(agencyNetworkDB, yesterdayBegin, yesterdayEnd){

    
    const agencyNetworkId = agencyNetworkDB.agencyNetworkId;

    const query = {
        "agencyNetworkId": agencyNetworkId,
        "searchenddate": yesterdayEnd,
        "searchbegindate": yesterdayBegin
    };
    let appList = null;
    const applicationBO = new ApplicationBO();

    try{

        appList = await applicationBO.getList(query);
    }
    catch(err){
        log.error("dailydigest getting App list error " + err + __location);
        throw err;
    }


    let appCount = 0;
    if(appList && appList.length > 0){

        let error = null;
        const agencyNetworkBO = new AgencyNetworkBO();
        const emailContentJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId, "daily_digest").catch(function(err){
            log.error(`Unable to get email content for Daily Digest. agency_network: ${db.escape(agencyNetworkId)}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }

        if(emailContentJSON && emailContentJSON.message){

            let message = emailContentJSON.message;
            let subject = emailContentJSON.subject;

            if(!message){
                log.error(`Daily Digest email content creation error: no message. agency_network: ${db.escape(agencyNetworkDB.agencyNetworkId)}.` + __location);
                return false;
            }
            if(!subject){
                log.error(`Daily Digest email content creation error: no subject. agency_network: ${db.escape(agencyNetworkDB.agencyNetworkId)}.` + __location);
                return false;
            }
            // Link setup.
            const portalLink = emailContentJSON.PORTAL_URL;

            let applicationList = '<br><table border="1" cellspacing="0" cellpadding="4" width="100%"><thead><tr><th>Business Name</th><th>Contact Name</th><th>Contact Email</th><th>Contact Phone</th><th>Wholesale</th></tr></thead><tbody>';

            appCount = appList.length;
            for(let i = 0; i < appList.length; i++){
                const applicationDoc = appList[i]
                // eslint-disable-next-line prefer-const
                //Get primary contact
                const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
                const customerPhone = formatPhone(customerContact.phone);

                let wholesale = applicationDoc.wholesale === true ? "Talage" : "";
                if(applicationDoc.solepro){
                    wholesale = "SolePro"
                }

                applicationList += '<tr><td>' + stringFunctions.ucwords(applicationDoc.businessName) + '</td><td>' + customerContact.firstName + ' ' + customerContact.lastName + '</td><td>' + customerContact.email + '</td><td>' + customerPhone + '</td><td>' + wholesale + '</td></tr>';
            }

            applicationList += '</tbody></table><br>';

            try{
                message = message.replace(/{{Application List}}/g, applicationList);
                message = message.replace(/{{Agency Portal Link}}/g, `<a href="${portalLink}" rel="noopener noreferrer" target="_blank">Agency Portal</a>`);
                message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(emailContentJSON.emailBrand));
                message = message.replace(/{{Number of Users}}/g, appCount + ' ' + (appCount > 1 ? 'users' : 'user'));
                subject = subject.replace(/{{Brand}}/g, stringFunctions.ucwords(emailContentJSON.emailBrand), subject);
            }
            catch(e){
                log.error(`Daily Digest email content creation error: ${e}` + __location);
                return false;
            }

            if(agencyNetworkDB.email){
                const keyData = {'agencyNetworkId': agencyNetworkDB.systemId};
                // send email
                const emailResp = await emailSvc.send(agencyNetworkDB.email, subject, message, keyData,agencyNetworkDB.agencyNetworkId,"");
                if(emailResp === false){
                    slack.send('#alerts', 'warning',`The system failed to send daily digest email for AgencyNetwork  #${agencyNetworkDB.systemId}.`);
                }
            }
            else {
                log.error("Dailydigest no email address for AgencyNetwork: " + JSON.stringify(agencyNetworkDB) + __location);
            }

        }
        else {
            log.error(`DB Error Unable to get email content for Daily Digest. agency_network: ${db.escape(agencyNetworkDB.agencyNetworkId)} agency:  ${agencyNetworkDB.agencyId}.` + __location);
            return false;
        }
    }
    else {
        log.info(`DailyDigest: No Activity for AgencyNetwork: ${db.escape(agencyNetworkDB.systemId)}.`)
    }
    return true;
}