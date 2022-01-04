/* eslint-disable require-jsdoc */
/* eslint-disable curly */
'use strict';

const moment = require('moment');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');

/**
 * EmployersImport Task processor
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
        policyCheck(messageBody).catch(err => error = err);
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
        log.info('removing old Employers policycheck Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error Employers policycheck deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}


async function policyCheck(taskBodyJSON){
    try {
        if(!taskBodyJSON.maxDaysInPast && !taskBodyJSON.quoteId){
            log.error(`Employers policycheck missing maxDaysInPast ` + __location);
            return;
        }
        const insurerId = 1; //Employers
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
        log.info("Employers PolicyCheck quote query " + JSON.stringify(query))
        const quoteJSONList = await Quote.find(query, queryProjection, queryOptions).lean()
        if(quoteJSONList?.length > 0){
            const policycheckWC = require('./insurers/employers/policycheck-wc.js');
            policycheckWC.processQuoteList(quoteJSONList, sendSlackMessage)
        }
        else {
            log.info("Employers PolicyCheck no quotes to check " + __location)
        }

    }
    catch (err) {
        log.error(err + __location);
    }


}

module.exports = {
    processtask: processtask,
    policyCheck: policyCheck
};