'use strict';

const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
// const outreachsvc = global.requireShared('./services/outreachsvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');

const AgencyBO = global.requireShared('models/Agency-BO.js');

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
    //get list....
    // We need an agency to look email templates in the database
    // Agency cannot be NULL or zero.
    const appIdSQL = `
            SELECT DISTINCT
                a.id as 'applicationId' 
            FROM clw_talage_applications a
            WHERE  a.agency > 0 
                AND a.created BETWEEN  '${twoHourAgo.utc().format()}' AND '${oneHourAgo.utc().format()}'
                AND a.last_step BETWEEN 1 AND 7
                AND a.solepro  = 0
                AND a.abandoned_app_email = 0
                AND a.opted_out_online = 0
                AND a.state  = 1
    `;
    //log.debug(appIdSQL)
    let appIds = null;
    try{
        appIds = await db.query(appIdSQL);
    }
    catch(err){
        log.error("abandonAppTask getting appid list error " + err + __location);
        throw err;
    }
    //process list.....
    if(appIds && appIds.length > 0){
        for(let i = 0; i < appIds.length; i++){
            const appIdDbRec = appIds[i];
            // log.debug(JSON.stringify(appIdDbRec.applicationId));

            let error = null;
            let succesfulProcess = false;
            try{
                succesfulProcess = await processAbandonApp(appIdDbRec.applicationId);
            }
            catch(err){
                error = err;
                log.debug('abandon app catch error from await ' + err);
            }

            if(error === null && succesfulProcess === true){
                await markApplicationProcess(appIdDbRec.applicationId).catch(function(err){
                    log.error(`Error marking abandon app in DB for ${appIdDbRec.applicationId} error:  ${err}` + __location);
                    error = err;
                });
            }
            if(error === null){
                log.info(`Processed abandon app for appId: ${appIdDbRec.applicationId}`);
            }

        }
    }

    return;
};

var processAbandonApp = async function(applicationId){
    //get contacts
    const appSQL = `
        SELECT
            a.agency,
            a.agency_location AS agencyLocation,
            a.id,
            a.wholesale,
            ag.agency_network,
            ag.slug,
            ag.name AS agencyName,
            ag.website AS agencyWebsite,
            al.agency,
            al.email AS agencyEmail,
            al.phone AS agencyPhone,
            c.email,
            c.fname,
            c.lname,
            c.phone
        FROM clw_talage_applications AS a
            LEFT JOIN clw_talage_agencies AS ag ON a.agency = ag.id
            LEFT JOIN clw_talage_agency_locations AS al ON a.agency_location = al.id
            LEFT JOIN clw_talage_contacts AS c ON a.business = c.business
        WHERE 
            a.id =  ${applicationId}
    `;

    let appDBJSON = null;

    appDBJSON = await db.query(appSQL).catch(function(err){
        log.error(`Error get abandon applications from DB for ${applicationId} error:  ${err}` + __location);
        // Do not throw error other abandon applications may need to be processed.
        return false;
    });

    if(appDBJSON && appDBJSON.length > 0){

         // TODO Load AgencyNetwork

        const agencyNetwork = appDBJSON[0].agency_network;
        //Get email content
        // TODO only uses customer...
        let error = null;
        const agencyBO = new AgencyBO();
        const emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(appDBJSON[0].agency, "abandoned_applications_customer", "abandoned_applications_customer").catch(function(err){
            log.error(`Email content Error Unable to get email content for abandon application. appid: ${applicationId}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }


        if(emailContentJSON && emailContentJSON.customerMessage && emailContentJSON.customerSubject){

            //decrypt info...
            appDBJSON[0].email = await crypt.decrypt(appDBJSON[0].email);
            appDBJSON[0].agencyEmail = await crypt.decrypt(appDBJSON[0].agencyEmail);
            appDBJSON[0].agencyPhone = await crypt.decrypt(appDBJSON[0].agencyPhone);
            appDBJSON[0].agencyWebsite = await crypt.decrypt(appDBJSON[0].agencyWebsite);

            if(!appDBJSON[0].agencyWebsite){
                appDBJSON[0].agencyWebsite = "";
            }


            let agencyPhone = '';

            if(appDBJSON[0].agencyPhone){
                agencyPhone = formatPhone(appDBJSON[0].agencyPhone);
            }
            // TODO get from AgencyNetwork BO
            const brandurl = emailContentJSON.APPLICATION_URL;
            const agencyLandingPage = `${brandurl}/${appDBJSON[0].slug}`;

            let message = emailContentJSON.customerMessage;
            const subject = emailContentJSON.customerSubject;

            // Perform content replacements
            message = message.replace(/{{Agency}}/g, appDBJSON[0].agencyName);
            message = message.replace(/{{Agency Email}}/g, appDBJSON[0].agencyEmail);
            message = message.replace(/{{Agency Page Link}}/g, `<a href="${agencyLandingPage}" rel="noopener noreferrer" target="_blank">${agencyLandingPage}</a>`);
            message = message.replace(/{{Agency Phone}}/g, agencyPhone);
            message = message.replace(/{{Agency Website}}/g, `<a href="${appDBJSON[0].agencyWebsite}" rel="noopener noreferrer" target="_blank">${appDBJSON[0].agencyWebsite}</a>`);


            //send email:
            // Send the email
            const keys = {
                'application': applicationId,
                'agency_location': appDBJSON[0].agencyLocation
            };
            const emailResp = await emailSvc.send(appDBJSON[0].email, subject, message, keys ,agencyNetwork, appDBJSON[0].emailBrand, appDBJSON[0].agency);
            //log.debug("emailResp = " + emailResp);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to remind the insured to revisit their application ${applicationId}. Please follow-up manually.`, {'application_id': applicationId});
            }
            return true;
        }
        else {
            log.error(`AbandonApp missing emailcontent for agencyid ${appDBJSON[0].agency} and  agencynetwork: ` + agencyNetwork + __location);
            return false;
        }
    }
    else {
        return false;
    }

};

var markApplicationProcess = async function(applicationId){

    const updateSQL = `UPDATE clw_talage_applications
                       SET  abandoned_app_email = 1
	                   where id = ${applicationId} `;

    // Update application record
    await db.query(updateSQL).catch(function(e){
        log.error('Abandon Application flag update error: ' + e.message + __location);
        throw e;
    });
};