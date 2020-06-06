/* eslint-disable curly */
'use strict';

const moment = require('moment');
const util = require("util");
const csvStringify = util.promisify(require("csv-stringify"));
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const email = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slack.js');

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

    //S QLAgency locations
    const quoteSQL = `
    SELECT
    q.application as application,
    q.policy_type as policy_type,
    i.name as name,
    z.territory as territory,
    q.api_result as api_result,
    q.reasons as reasons,
    q.seconds as seconds,
     IFNULL(an.name, "Talage") AS network,
    GROUP_CONCAT(DISTINCT ac.description) AS activity_codes
    FROM clw_talage_quotes AS q
        LEFT JOIN clw_talage_insurers AS i ON q.insurer = i.id
        LEFT JOIN clw_talage_applications AS a ON a.id = q.application
        LEFT JOIN clw_talage_zip_codes as z on a.zip = z.zip
        LEFT JOIN clw_talage_agencies AS ag ON a.agency = ag.id
        LEFT JOIN clw_talage_agency_networks AS an ON ag.agency_network = an.id
        LEFT JOIN clw_talage_application_activity_codes as acc on a.id = acc.application
        LEFT JOIN clw_talage_activity_codes as ac on acc.ncci_code = ac.id
    WHERE 
        q.created BETWEEN  '${yesterdayBegin.utc().format()}' AND '${yesterdayEnd.utc().format()}'
    GROUP BY
        q.id
    `;
    let quoteListDBJSON = null;

    quoteListDBJSON = await db.query(quoteSQL).catch(function(err){
        log.error(`Error get quote list from DB. error:  ${err}` + __location);
        return false;
    });
    const cvsHeaderColumns = {
                            "application": "App ID",
                            "policy_type": "Type",
                            "name": "Insurer",
                            "network": "Agency Network",
                            "territory": "Territory",
                            "api_result": "Result",
                            "reasons": "Reasons",
                            "seconds": "Seconds",
                            "activitycode1": "Activity Code 1",
                            "activitycode2": "Activity Code 2",
                            "activitycode3": "Activity Code 3"
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

        //Map Quote list to CSV.
        // eslint-disable-next-line object-property-newline
        const stringifyOptions = {
                                    "header": true,
                                    "columns": cvsHeaderColumns
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
            let toEmail = 'adam@talageins.com';
            if(global.settings.ENV !== 'production'){
                toEmail = 'brian@talageins.com';
            }
            const attachmentJson = {
                'content': csvContent,
                'filename': 'quotes.csv',
                'type': 'text/csv',
                'disposition': 'attachment'
            };
            const attachments = [];
            attachments.push(attachmentJson);
            const emailResp = await email.send(toEmail, 'Quote Report', 'Your daily quote report is attached.', {}, 'talage', 0, attachments);
            if(emailResp === false){
                slack('#alerts', 'warning',`The system failed to send Quote Report email.`);
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
        let toEmail = 'adam@talageins.com';
        if(global.settings.ENV !== 'production'){
            toEmail = 'brian@talageins.com';
        }
        const emailResp = await email.send(toEmail, 'Quote Report', 'Your daily quote report: No Quotes.', {}, 'talage', 0);
        if(emailResp === false){
            slack('#alerts', 'warning',`The system failed to send Quote Report email.`);
        }
        return;
    }
}