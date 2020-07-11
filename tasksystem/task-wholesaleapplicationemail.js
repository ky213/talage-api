'use strict';

const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

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
        if(queueMessage.body && queueMessage.body.applicationId){
            await wholesaleApplicationEmailTask(queueMessage.body.applicationId).catch(err => error = err);
        }
        else {
            log.error("Error wholesaleApplicationEmailTask missing applicationId " + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err) {
            error = err;
        });
        if (error) {
            log.error("Error wholesaleApplicationEmailTask deleteTaskQueueItem " + error);
        }
        return;
    }
    else {
        log.info('removing old wholesaleApplicationEmailTask Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if (error) {
            log.error("Error wholesaleApplicationEmailTask deleteTaskQueueItem old " + error);
        }
        return;
    }
}

/**
 * Exposes wholesaleApplicationEmailTask for testing
 * @param {string} applicationId - applicationId for SoleProId
 * @returns {void}
 */
exports.wholesaleApplicationEmailTask = async function(applicationId) {
    let error = null;
    await wholesaleApplicationEmailTask(applicationId).catch(err => error = err);
    if (error) {
        log.error('wholesaleApplicationEmailTask external: ' + error);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */

var wholesaleApplicationEmailTask = async function(applicationId) {
    //get
    const appSQL = `
        SELECT
            a.agency_location AS agencyLocation,
            ag.email AS agencyEmail,
            ag.agency_network,
            al.email AS agencyLocationEmail,
            an.email_brand AS emailBrand
        FROM clw_talage_applications AS a
            INNER JOIN clw_talage_agency_locations AS al ON a.agency_location = al.id
            INNER JOIN clw_talage_agencies AS ag ON al.agency = ag.id
            INNER JOIN clw_talage_agency_networks AS an ON ag.agency_network = an.id
        WHERE 
        a.id =  ${applicationId}
        AND a.wholesale = 1
    `;

    let applications = null;
    try {
        applications = await db.query(appSQL);
    }
    catch (err) {
        log.error(`Error get opt out applications from DB for ${applicationId} error:  ${err}` + __location);
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
        const emailContentSQL = `
            SELECT
                JSON_EXTRACT(custom_emails, '$.talage_wholesale') AS agencyEmailData,
                (SELECT JSON_EXTRACT(custom_emails, '$.talage_wholesale')  FROM  clw_talage_agency_networks WHERE id = 1 ) AS defaultAgencyEmailData
            FROM clw_talage_agency_networks
            WHERE id = ${db.escape(agencyNetwork)}
        `;

        let error = null;
        const emailContentResultArray = await db.query(emailContentSQL).catch(function(err){
            log.error(`DB Error Unable to get email content for abandon application. appid: ${applicationId}.  error: ${err}`);
            error = true;
        });
        if(error){
            return false;
        }

        if(emailContentResultArray && emailContentResultArray.length > 0){
            const emailContentResult = emailContentResultArray[0];
            const agencyEmailData = emailContentResult.agencyEmailData ? JSON.parse(emailContentResult.agencyEmailData) : null;
            const defaultAgencyEmailData = emailContentResult.defaultAgencyEmailData ? JSON.parse(emailContentResult.defaultAgencyEmailData) : null;

            let message = agencyEmailData && agencyEmailData.message ? agencyEmailData.message : defaultAgencyEmailData.message;
            let subject = agencyEmailData && agencyEmailData.subject ? agencyEmailData.subject : defaultAgencyEmailData.subject;

            message = message.replace(/{{Brand}}/g, applications[0].emailBrand);
            subject = subject.replace(/{{Brand}}/g, applications[0].emailBrand);

            // Send the email
            const keyData2 = {
                'application': applicationId,
                'agency_location': applications[0].agencyLocation
            };
            if (agencyLocationEmail) {
                const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData2, applications[0].emailBrand);
                if (emailResp === false) {
                    slack.send('#alerts', 'warning', `The system failed to inform an agency of the wholesaleApplicationEmailTask for application ${applicationId}. Please follow-up manually.`);
                }
            }
            else {
                log.error("wholesaleApplicationEmailTask no email address for data: " + JSON.stringify(keyData2) + __location);
            }

            return true;
        }
        else {
            log.error('wholesaleApplicationEmailTask missing emailcontent for agencynetwork: ' + agencyNetwork + __location);
            return false;
        }
    }
    else {
        return false;
    }

}