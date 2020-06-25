'use strict';

const moment = require('moment');


/**
 * App Agency Null fix Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
exports.processtask = async function(queueMessage){
    let error = null;
    // check sent time. over 30 seconds seconds do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    if(messageAge < 30){
        // DO STUFF
        await appDataFixTask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error App Agency Null fix deleteTaskQueueItem " + error +  __location);
        }
        return;
    }
    else {
        log.debug('removing old expirePoliciesTask Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error App Agency Null fix deleteTaskQueueItem old " + error +  __location);
        }
        return;
    }
}

/**
 * Exposes appDataFixTask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await appDataFixTask().catch(err => error = err);
    if(error){
        log.error('App Agency Null fix external: ' + error +  __location);
    }
    return;
}

/**
 * expirePoliciesTask for testing
 *
 * @returns {void}
 */
var appDataFixTask = async function(){

    const updateSQL = `
    UPDATE clw_talage_applications 
        SET agency = 1, agency_location = 1
        WHERE agency is NULL
    `;
    await db.query(updateSQL).catch(function(e){
        log.error(`App Agency Null fix caused an error: ` + e.message +  __location);
    });
    return;
}