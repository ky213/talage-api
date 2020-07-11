'use strict';

const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');

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
            await soleproApplicationEmailTask(queueMessage.body.applicationId).catch(err => error = err);
        }
        else {
            log.error("Error soleproApplicationEmailTask missing applicationId " + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err) {
            error = err;
        });
        if (error) {
            log.error("Error soleproApplicationEmailTask deleteTaskQueueItem " + error);
        }
        return;
    }
    else {
        log.info('removing old soleproApplicationEmailTask Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if (error) {
            log.error("Error soleproApplicationEmailTask deleteTaskQueueItem old " + error);
        }
        return;
    }
}

/**
 * Exposes soleproApplicationEmailTask for testing
 * @param {integer} applicationId - applicationId for SoleProId
 * @returns {void}
 */
exports.soleproApplicationEmailTask = async function(applicationId) {
    let error = null;
    await soleproApplicationEmailTask(applicationId).catch(err => error = err);
    if (error) {
        log.error('soleproApplicationEmailTask external: ' + error);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */

var soleproApplicationEmailTask = async function(applicationId) {
    //get
    const appSQL = `
        SELECT
            a.agency_location AS agencyLocation,
            ag.email AS agencyEmail,
            al.email AS agencyLocationEmail
        FROM clw_talage_applications AS a
            INNER JOIN clw_talage_agency_locations AS al ON a.agency_location = al.id
            LEFT JOIN clw_talage_agencies AS ag ON al.agency = ag.id
        WHERE 
        a.id =  ${applicationId}
        AND a.solepro = 1
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

        const message = `<p>Good news! A business owner is being routed to SolePro through your Digalent site. It’s a business that fell below normal appetite and will be handled by the SolePro team. Nothing else for you to do, we just wanted you to know!</p>
        <p>If you have any questions, you can reach out to SolePro at hello@solepro.com or 804-418-3201.</p>
        <p>Thanks for your continued partnership!</p>
        <p>-The Digalent team</p>`;
        const subject = "A business owner has been routed to SolePro through your Digalent site'";

        // Send the email
        const keyData2 = {
            'application': applicationId,
            'agency_location': applications[0].agencyLocation
        };
        if (agencyLocationEmail) {
            const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData2, 'digalent');
            if (emailResp === false) {
                slack.send('#alerts', 'warning', `The system failed to inform an agency of the soleproApplicationEmailTask for application ${applicationId}. Please follow-up manually.`);
            }
        }
        else {
            log.error("soleproApplicationEmailTask no email address for data: " + JSON.stringify(keyData2) + __location);
        }

        return true;
    }
    else {
        return false;
    }

}