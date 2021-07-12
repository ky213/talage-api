/* eslint-disable curly */
'use strict';

const moment = require('moment');


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


var IndustryCode = require('mongoose').model('IndustryCode');
const ActivityCodeSvc = global.requireShared('services/activitycodesvc.js');


/**
 * Agency report Task processor
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
    if(messageAge < 1800){

        activityCodeCacheUpdate().catch(err => error = err);
        if(error){
            log.error("Error ActivityCode Cache Task " + error + __location);
        }
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error ActivityCode Cache deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.info('removing ActivityCode Cache Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error ActivityCode Cache deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes Task for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await activityCodeCacheUpdate().catch(err => error = err);
    if(error){
        log.error('ActivityCode Cache external: ' + error + __location);
    }
    return;
}

var activityCodeCacheUpdate = async function(){

    let industryCodeList = null;
    try{
        // Load the request data into it
        // get all non-deleted agencies
        const query = {active: true};
        industryCodeList = await IndustryCode.find(query);
    }
    catch(err){
        log.error("ActivityCode Cache IndustryCode getList error " + err + __location);
    }

    // Loop locations setting up activity codes.
    if(industryCodeList && industryCodeList.length > 0){

        for(let i = 0; i < industryCodeList.length; i++){
            // eslint-disable-next-line prefer-const
            let industryCodeDB = industryCodeList[i];
            await ActivityCodeSvc.updateActivityCodeCacheByIndustryCode(industryCodeDB.industryCodeId)
        }
    }
    return;
}