'use strict';

const fs = require('fs');

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
            const taskProcessor = require(path);
            taskProcessor.processtask(queueMessage);
        }
        else {
            log.error('No Processor file for taskname ' + messageBody.taskname + __location);
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