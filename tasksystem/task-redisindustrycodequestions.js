'use strict';

const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


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
        //very long running process so kill the queueitem for proecessing
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error industryCodeQuestionCacheUpdate deleteTaskQueueItem " + error + __location);
        }


        let industryCodeId = null;
        if(queueMessage.Body && queueMessage.Body.insurerId){
            await industryCodeQuestionCacheUpdateByInsurerId(queueMessage.Body.insurerId).catch(err => error = err);
        }
        else {
            if(queueMessage.Body && queueMessage.Body.industryCodeId){
                industryCodeId = queueMessage.Body.industryCodeId;
            }
            await industryCodeQuestionCacheUpdate(industryCodeId).catch(err => error = err);
        }
        return;
    }
    else {
        log.debug('removing old industryCodeQuestionCacheUpdate Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error industryCodeQuestionCacheUpdate deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes industryCodeQuestionCacheUpdate for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await industryCodeQuestionCacheUpdate().catch(err => error = err);
    if(error){
        log.error('dailyDigestTask external: ' + error + __location);
    }
    return;
}

var industryCodeQuestionCacheUpdate = async function(industryCodeId){


    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        await questionSvc.UpdateRedisIndustryQuestions(industryCodeId);
        log.info(`Redis Industry Code Question cached updated.` + __location);
    }
    catch(err){
        log.error(`Error updating Industry Code Question cached.` + __location)
    }

    return;
}

var industryCodeQuestionCacheUpdateByInsurerId = async function(insurerId){


    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        await questionSvc.UpdateRedisIndustryQuestionByInsurer(insurerId);
        log.info(`Redis Industry Code Question cached updated for insurerId ${insurerId}` + __location);
    }
    catch(err){
        log.error(`Error updating Industry Code Question cached for insurerId ${insurerId}` + __location)
    }

    return;
}