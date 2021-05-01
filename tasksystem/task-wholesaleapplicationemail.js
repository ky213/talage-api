'use strict';

const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');

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
            if(error){
                log.error("Error wholesaleapplicationemail " + error + __location);
            }
            error = null;
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
    if(!applicationId){
        return false;
    }

    let applicationDoc = null;
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

        let error = null;
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

        //get AgencyLocationBO
        const agencyLocationBO = new AgencyLocationBO();
        let agencyLocationJSON = null;
        try{
            agencyLocationJSON = await agencyLocationBO.getMongoDocbyMysqlId(applicationDoc.agencyLocationId)
        }
        catch(err){
            log.error("Error getting agencyLocationBO " + err + __location);
            error = true;

        }
        if(error){
            return false;
        }

        let agencyLocationEmail = null;
        if(agencyLocationJSON.email){
            agencyLocationEmail = agencyLocationJSON.email
        }
        else if(agencyJSON.email){
            agencyLocationEmail = agencyJSON.email;
        }


        //get email content.
        const agencyNetworkId = applicationDoc.agencyNetworkId;

        const emailContentJSON = await agencyBO.getEmailContent(applicationDoc.agencyId, "talage_wholesale").catch(function(err){
            log.error(`Unable to get email content for Talage WholeSale application. agency_network: ${agencyNetworkId}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }

        if(emailContentJSON && emailContentJSON.message){

            let message = emailContentJSON.message;
            let subject = emailContentJSON.subject;

            message = message.replace(/{{Brand}}/g, emailContentJSON.emailBrand);
            subject = subject.replace(/{{Brand}}/g, emailContentJSON.emailBrand);

            // Send the email
            const keyData2 = {'applicationDoc': applicationDoc};
            if (agencyLocationEmail) {
                const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData2,agencyNetworkId, emailContentJSON.emailBrand);
                if (emailResp === false) {
                    slack.send('#alerts', 'warning', `The system failed to inform an agency of the wholesaleApplicationEmailTask for application ${applicationId}. Please follow-up manually.`);
                }
            }
            else {
                log.error(`wholesaleApplicationEmailTask no email address for appId: ${applicationId}` + __location);
            }

            return true;
        }
        else {
            log.error('wholesaleApplicationEmailTask missing emailcontent for agencynetwork: ' + agencyNetworkId + __location);
            return false;
        }
    }
    else {
        log.error('wholesaleApplicationEmailTask new record returned for appid: ' + applicationId + __location);
        return false;
    }

}