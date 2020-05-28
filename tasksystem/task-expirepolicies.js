const moment = require('moment');


/**
 * Expire Policies Task processor
 *
 * @param {string} message - message from queue
 * @returns {void}
 */
exports.processtask = async function (queueMessage){

    // check sent time. over 30 minutes seconds do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp/1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    if(messageAge < 1800){
        // DO STUFF
        try{
            await expirePoliciesTask();
            await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);
        }
        catch(err){
            log.error("Error expirePoliciesTask " + err);
        } 
        return;
    }
    else {
        log.debug('removing old expirePoliciesTask Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle)
        return;
    }
}

/**
 * Exposes expirePoliciesTask for testing
 *
 * @param {} 
 * @returns {void}
 */
exports.taskProcessorExternal = async function (){
    let error = null;
    await expirePoliciesTask().catch(err => error = err );
    if(error){
        log.error ('abandonAppTask external: ' + error);
    }
    return;
}

/**
 * expirePoliciesTask for testing
 *
 * @param {} 
 * @returns {void}
 */
var expirePoliciesTask = async function (){
    const datetimeFormat = 'YYYY-MM-DD hh:mm';
    var now = moment().utc();
 
    const updateSQL = `
        UPDATE clw_talage_policies 
        SET state = 0
        WHERE state = 1 
            AND expiration_Date < '${now.utc().format(datetimeFormat)}'
    `;
    
    await db.query(updateSQL).catch(function(e){
        log.error(`Expiring Policiies caused an error: ` + e.message);
    });
    
    return;
}
