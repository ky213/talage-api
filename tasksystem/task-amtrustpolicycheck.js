/* eslint-disable require-jsdoc */
/* eslint-disable curly */
'use strict';

const moment = require('moment');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');

/**
 * AmtrustImport Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
async function processtask(queueMessage){
    let error = null;
    // check sent time over 30 minutes do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    if(messageAge < 1800){
        // DO STUFF
        //run aync  - delete task immediately.
        let messageBody = queueMessage.Body;
        if(typeof queueMessage.Body === 'string'){
            messageBody = JSON.parse(queueMessage.Body)
        }
        amtrustPolicyCheck(messageBody).catch(err => error = err);
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error Quote Report deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.info('removing old amtrust policycheck Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error amtrust policycheck deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}


async function amtrustPolicyCheck(taskBodyJSON){
    try {
        if(!taskBodyJSON.maxDaysInPast && !taskBodyJSON.quoteId){
            log.error(`Amtrust policycheck missing maxDaysInPast ` + __location);
            return;
        }
        const insurerId = 19; //Amtrust
        let query = {insurerId: -1}// return nothing

        if(taskBodyJSON.quoteId){
            query = {quoteId: taskBodyJSON.quoteId}
        }
        else {
            //query mnogo for quotes.
            let maxQuoteDate = new moment().endOf('day');
            if(taskBodyJSON.minDaysInPast > 0){
                maxQuoteDate = new moment().subtract(taskBodyJSON.minDaysInPast,'d').endOf('day');
            }
            const minQuoteDate = new moment().subtract(taskBodyJSON.maxDaysInPast,'d').startOf('day');
            query = {
                insurerId: insurerId,
                bound: false,
                active: true,
                quoteNumber: {$exists: true},
                quoteStatusId: {
                    $gte: quoteStatus.declined.id,
                    $lt: quoteStatus.bound.id
                },
                createdAt: {
                    $lte: maxQuoteDate,
                    $gte: minQuoteDate
                }
            }
        }
        let sendSlackMessage = true;
        if(taskBodyJSON.hasOwnProperty("sendSlackMessage")){
            sendSlackMessage = taskBodyJSON.sendSlackMessage
        }

        var Quote = global.mongodb.model('Quote');
        const queryProjection = {
            quoteId:1,
            applicationId: 1,
            agencyNetworkId: 1,
            agencyId: 1,
            quoteStatusId:1,
            bound: 1,
            talageWholesale: 1
        }
        var queryOptions = {};
        queryOptions.sort = {createdAt: -1};
        queryOptions.limit = 3000;
        //queryOptions.sort.createdAt = -1;
        log.debug("amtrustPolicyCheck quote query " + JSON.stringify(query))
        const quoteJSONList = await Quote.find(query, queryProjection, queryOptions).lean()
        if(quoteJSONList?.length > 0){
            const policycheckWC = require('./insurers/amtrust/policycheck-wc.js');
            if(global.settings.ENV === 'development'){
                await policycheckWC.processQuoteList(quoteJSONList, sendSlackMessage)
            }
            else {
                policycheckWC.processQuoteList(quoteJSONList, sendSlackMessage)
            }
        }
        else {
            log.debug("amtrustPolicyCheck no quotes to check " + __location)
        }

    }
    catch (err) {
        log.error(err + __location);
    }


}

module.exports = {
    processtask: processtask,
    amtrustPolicyCheck: amtrustPolicyCheck
};