'use strict';

const fs = require('fs');
const moment = require('moment');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

/**
 * Task Distributor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
exports.distributeTask = async function(queueMessage){

    const messageBody = JSON.parse(queueMessage.Body);

    if(messageBody.taskname){
        const path = `${__dirname}/task-${messageBody.taskname}.js`;
        //log.debug('task file: ' + path);
        if(fs.existsSync(path)){
            log.info('processing ' + messageBody.taskname)
            queueMessage.Body = JSON.parse(queueMessage.Body)
            const taskProcessor = require(path);
            taskProcessor.processtask(queueMessage);
        }
        else {
            //time check.  kill if old or so bad queue entry does not fill logs.
            var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
            var now = moment().utc();
            const messageAge = now.unix() - sentDatetime.unix();
            if(messageAge > 5){
                let error = null;
                await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
                if(error){
                    log.error(`Error ${messageBody.taskname} deleteTaskQueueItem old ` + error + __location);
                }
            }
            else {
                log.warn('No Processor file for taskname ' + messageBody.taskname + __location);
            }
        }
        return true;
    }
    else {
        //Bad taskqueue message
        log.error('Bad taskqueue message ' + JSON.stringify(queueMessage) + __location);
        //delete the message
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);
        return true;
    }
}