'use strict';

const moment = require('moment');

/**
 * AbandonQuote Task processor
 *
 * @param {string} message - message from queue
 * @returns {void}
 */
exports.processtask = async function (queueMessage){

    //TODO check sent time over 10 seconds do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp/1000);
    var now = moment();
    var messageAge = moment.duration(now.diff(sentDatetime),'seconds');
    if(messageAge < 10){
        const messageBody = JSON.parse(queueMessage.Body);
        log.debug(JSON.stringify(messageBody));
        log.debug('sent at: ' + sentDatetime.toString())
        
        //if proccessed ok
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle)
        return;
    }
    else {
        log.info('removing old Abandon Quote Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle)
        return;
    }
    
   

}


var abandonquotetask = async function (){
    //get list....
    // simple query on the DB to keep the work db workload down.
   
    //process list.....
    
   

}

var processAbandonApplication = async function (applicationDB){

    
    //get list....

    //process list.....
    
   

}