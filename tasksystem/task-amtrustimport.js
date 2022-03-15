/* eslint-disable require-jsdoc */
/* eslint-disable curly */
'use strict';

const moment = require('moment');

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
        amtrustImport().catch(function(err){
            log.error("Error Amtrust Import Error" + err + __location);
        });
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error  Amtrust Import deleteTaskQueueItem " + error + __location);
        }

        return;
    }
    else {
        log.info('removing old amtrustimport Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error amtrustimport deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}


async function amtrustImport(){
    try {
        const amtrustImportCodes = require('./insurers/amtrust/import-wc-codes.js');
        const amtrustImportQuestions = require('./insurers/amtrust/import-wc-questions.js');
        const amtrustCodes = await amtrustImportCodes.CodeImport();
        await amtrustImportQuestions.QuestionImport(amtrustCodes);
    }
    catch (err) {
        log.error(err + __location);
    }


}

module.exports = {
    processtask: processtask,
    amtrustImport: amtrustImport
};