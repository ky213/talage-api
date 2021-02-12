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
        let industryCodeId = null;
        if(queueMessage.Body && queueMessage.Body.industryCodeId){
            industryCodeId = queueMessage.Body.industryCodeId;
        }
        await industryCodeQuestionCacheUpdate(industryCodeId).catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error industryCodeQuestionCacheUpdate deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

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

    let sql = "select id from clw_talage_industry_codes where state > 0";
    if(industryCodeId){
        sql += ` AND id = ${db.escape(industryCodeId)}`
    }
    let error = null;
    const industryCodeList = await db.queryReadonly(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        log.error(`Error getting industry codes for Redis update ${error}` + __location)
        return false;
    }
    const questionSvc = global.requireShared('./services/questionsvc.js');
    const numOfindustryCodes = industryCodeList.length;
    for(let i = 0; i < numOfindustryCodes; i++){
        const industryCodeid = industryCodeList[i].id;
        const redisKey = await questionSvc.CreateRedisIndustryCodeQuestionEntry(industryCodeid);
        log.debug(`updated redis key ${redisKey} ` + __location)
        if((i + 1) % 20 === 0){
            log.debug(`Indusry Code Redis cached update ${i + 1} of ${numOfindustryCodes}`);
        }

    }
    log.info("Redis Industry Code Question cached updated. processed " + numOfindustryCodes + __location);


    return;
}