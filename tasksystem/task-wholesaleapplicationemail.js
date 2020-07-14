'use strict';

const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
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

        let error = null;
        const agencyNetworkBO = new AgencyNetworkBO();
        const emailContentJSON = await agencyNetworkBO.getEmailContent(agencyNetwork, "talage_wholesale").catch(function(err){
            log.error(`Unable to get email content for Talage WholeSale application. agency_network: ${agencyNetwork}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }

        if(emailContentJSON && emailContentJSON.message){

            let message = emailContentJSON.message;
            let subject = emailContentJSON.subject;

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