'use strict';

const moment = require('moment');
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
    //move to here some mongo setup time is not an issue at process startup.
    const ApplicationBO = global.requireShared('models/Application-BO.js');
    const AgencyBO = global.requireShared('models/Agency-BO.js');
    const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');

    let applicationDoc = null;
    const applicationBO = new ApplicationBO();
    try {
        applicationDoc = await applicationBO.getMongoDocbyMysqlId(applicationId);
    }
    catch (err) {
        log.error(`Error get opt out applications from DB for ${applicationId} error:  ${err}`);
        // Do not throw error other opt out may need to be processed.
        return false;
    }

    if (applicationDoc) {
        let error = null;
        const agencyBO = new AgencyBO();
        try{
            await agencyBO.loadFromId(applicationDoc.agencyId)
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
        let agencyLocationEmail = null;
        if(agencyLocationJSON.email){
            agencyLocationEmail = agencyLocationJSON.email
        }
        else if(agencyBO.email){
            agencyLocationEmail = agencyBO.email;
        }

        const message = `<p>Good news! A business owner is being routed to SolePro through your Digalent site. It’s a business that fell below normal appetite and will be handled by the SolePro team. Nothing else for you to do, we just wanted you to know!</p>
        <p>If you have any questions, you can reach out to SolePro at hello@solepro.com or 804-418-3201.</p>
        <p>Thanks for your continued partnership!</p>
        <p>-The Digalent team</p>`;
        const subject = "A business owner has been routed to SolePro through your Digalent site'";

        // Send the email
        const keyData2 = {'applicationDoc': applicationDoc};
        if (agencyLocationEmail) {
            const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData2, global.DIGALENT_AGENCYNETWORK_ID, 'NetworkDefault');
            if (emailResp === false) {
                slack.send('#alerts', 'warning', `The system failed to inform an agency of the soleproApplicationEmailTask for application ${applicationId}. Please follow-up manually.`);
            }
        }
        else {
            log.error(`soleproApplicationEmailTask no email address for appId: ${applicationId}` + __location);
        }

        return true;
    }
    else {
        return false;
    }

}