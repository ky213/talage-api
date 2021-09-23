/* eslint-disable curly */
'use strict';

const moment = require('moment');
const util = require("util");
const csvStringify = util.promisify(require("csv-stringify"));
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const AgencyModel = global.mongodb.model('Agency');
const AgencyPortalUserModel = global.mongodb.model('AgencyPortalUser');

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
    const query = {"$match": {$or: [
        {"agencyId": {"$in": await AgencyModel.distinct("systemId",{"agencyNetworkId": 4})}}, {"agencyNetworkId": 4}
    ]}};

    const usersLoginInfoList = await AgencyPortalUserModel.aggregate([
        query, {$project: {
            _id:0,
            email: 1,
            lastLogin: 1
        }}
    ]);

    for (const userLoginInfo of usersLoginInfoList) {
        if (userLoginInfo.lastLogin === null) {
            userLoginInfo.lastLogin = 'never logged in';
        }
        else {
            userLoginInfo.lastLogin = userLoginInfo.lastLogin.toISOString();
        }
    }

    const dbDataColumns = {
        "email": "Email",
        "lastLogin": "Last Login"
    };

    //Map list of User Logins to CSV
    // eslint-disable-next-line object-property-newline
    const stringifyOptions = {
        "header": true,
        "columns": dbDataColumns
    };
    const csvData = await csvStringify(usersLoginInfoList, stringifyOptions).catch(function(err){
        log.error("User Login JSON to CSV error: " + err + __location);
        return;
    });

    if(csvData){
        var b = Buffer.from(csvData);
        const csvContent = b.toString('base64');
        // send email
        // non-production send to Brian so we can test it.
        let toEmail = 'jmaloney@siuins.com';
        if(global.settings.ENV !== 'production'){
            toEmail = 'brian@talageins.com';
        }
        const attachmentJson = {
            'content': csvContent,
            'filename': 'User Login Report.csv',
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