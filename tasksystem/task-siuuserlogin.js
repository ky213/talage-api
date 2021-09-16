/* eslint-disable curly */
'use strict';

const moment = require('moment');
const moment_timezone = require('moment-timezone');
const util = require("util");
const csvStringify = util.promisify(require("csv-stringify"));
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

/**
 * User Login Task processor
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

        await siuUserLoginReportTask().catch(err => error = err);
        if(error){
            log.error("Error Task " + error + __location);
        }
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error User Login deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.info('removing old User Login Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error User Login deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}


var siuUserLoginReportTask = async function(){

   // query for SIU users.


    const dbDataColumns = {
        "id": "Agency ID",
        "name": "Angency Name",
        "state": "Active",
        "networkName": "Agency Network",
        "created": "Created",
        "wholesale_agreement_signed":"Wholesale Agreement Signed",
        "modified": "Modified",
        "deleted": "Deleted"
    };

    

        //Map list of agencies to CSV
        // eslint-disable-next-line object-property-newline
        const stringifyOptions = {
            "header": true,
            "columns": dbDataColumns
        };
        const csvData = await csvStringify(agencyList, stringifyOptions).catch(function(err){
            log.error("User Login JSON to CSV error: " + err + __location);
            return;
        });


        if(csvData){
            var b = Buffer.from(csvData);
            const csvContent = b.toString('base64');
            // send email
            // Production email goes to Adam.
            // non production Brian so we can test it.
            let toEmail = 'jmaloney@siuins.com';
            if(global.settings.ENV !== 'production'){
                toEmail = 'brian@talageins.com';
            }
            const attachmentJson = {
                'content': csvContent,
                'filename': 'AgencyReport.csv',
                'type': 'text/csv',
                'disposition': 'attachment'
            };
            const attachments = [];
            attachments.push(attachmentJson);
            const emailResp = await emailSvc.send(toEmail, 'User Login', 'User Login Report', {}, global.WHEELHOUSE_AGENCYNETWORK_ID, 'talage', 1, attachments);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to send User Login email.`);
            }
            return;
        }
        else {
            log.error("User Login JSON to CSV error: csvData empty file: " + __location);
            return;
        }

    }
    // else {
    //     // no users .... big error /bug
    //     return;
    // }
}