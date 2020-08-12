/* eslint-disable curly */
'use strict';

const moment = require('moment');
const util = require("util");
const csvStringify = util.promisify(require("csv-stringify"));
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');

/**
 * Quotereport Task processor
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
        // DO STUFF

        await quoteReportTask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error abandonquotetask deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.info('removing old Abandon Application Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error quote report deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes QuotereportTask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await quoteReportTask().catch(err => error = err);
    if(error){
        log.error('quotereportTask external: ' + error + __location);
    }
    return;
}

var quoteReportTask = async function(){

    const yesterdayBegin = moment.tz("America/Los_Angeles").subtract(1,'d').startOf('day');
    const yesterdayEnd = moment.tz("America/Los_Angeles").subtract(1,'d').endOf('day');

    const startOfMonth = moment().subtract(4, 'month');
    const currentDate = moment().utc().format()
    // const twoHourAgo = moment().subtract(2,'h');
    console.log("")
    console.log(yesterdayBegin);
    console.log(startOfMonth);
    console.log("")

    //S QLAgency locations
    const quoteSQL = `
    select 
            id, name, slug, state, agency_network, created, modified, deleted 
        from    
            clw_talage_agencies 
        where 
            state = 1
            AND created BETWEEN '${startOfMonth.utc().format()}' AND '${currentDate}'
    `;
    let quoteListDBJSON = null;

    quoteListDBJSON = await db.query(quoteSQL).catch(function(err){
        log.error(`Error get quote list from DB. error:  ${err}` + __location);
        return false;
    });
    const cvsHeaderColumns = {
                            "id": "Agency ID",
                            "name": "Angency Name",
                            "slug": "state",
                            "state": "Territory",
                            "agency_network": "Agency Network",
                            "created": "Created",
                            "modified": "Modified",
                            "deleted": "Deleted"
                            };

    // Loop locations setting up activity codes.
    if(quoteListDBJSON && quoteListDBJSON.length > 0){
        for(let i = 0; i < quoteListDBJSON.length; i++){
            const quote = quoteListDBJSON[i];
            //split activity_codes
            if(quote.activity_codes){
                const activityCodeList = quote.activity_codes.split(",")
                if (activityCodeList.length > 0) quote.activitycode1 = activityCodeList[0];
                if (activityCodeList.length > 1) quote.activitycode2 = activityCodeList[1];
                if (activityCodeList.length > 2) quote.activitycode3 = activityCodeList[2];
            }
        }

        //Map Quote list to CSV
        // eslint-disable-next-line object-property-newline
        const stringifyOptions = {
                                    "header": true,
                                    "columns": cvsHeaderColumns,
                                    "cast": {
                                        date: function(value) {
                                            console.log('---------------------------------are you going here')
                                            return moment(value).format('YYYY-MM-DD');
                                        }
                                    }
                                 };

        const csvData = await csvStringify(quoteListDBJSON, stringifyOptions).catch(function(err){
            log.error("Quote Report JSON to CSV error: " + err + __location);
            return;
        });
        // log.debug(csvData);
        

        if(csvData){
            var b = Buffer.from(csvData);
            const csvContent = b.toString('base64');
            // send email
            // Production email goes to Adam.
            // non production Brian so we can test it.
            let toEmail = 'krishna@talageins.com';
            if(global.settings.ENV !== 'production'){
                toEmail = 'krishna@talageins.com';
            }
            const attachmentJson = {
                'content': csvContent,
                'filename': 'quotes.csv',
                'type': 'text/csv',
                'disposition': 'attachment'
            };
            const attachments = [];
            attachments.push(attachmentJson);
            const emailResp = await emailSvc.send(toEmail, 'Quote Report', 'Your daily quote report is attached.', {}, 'talage', 1, attachments);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to send Quote Report email.`);
            }
            return;
        }
        else {
            log.error("Quote Report JSON to CSV error: csvData empty file: " + __location);
            return;
        }
    }
    else {
        log.info("Quote Report: No quotes to report ");
        let toEmail = 'krishna@talageins.com';
        if(global.settings.ENV !== 'production'){
            toEmail = 'krishna@talageins.com';
        }
        const emailResp = await emailSvc.send(toEmail, 'Quote Report', 'Your daily quote report: No Quotes.', {}, 'talage', 1);
        if(emailResp === false){
            slack.send('#alerts', 'warning',`The system failed to send Quote Report email.`);
        }
        return;
    }
}