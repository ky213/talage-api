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

/**
 * Agency report Task processor
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

        await agencyReportTask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error Agency Report deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.info('removing old Agency Report Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error agency report deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes Agency Report for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await agencyReportTask().catch(err => error = err);
    if(error){
        log.error('quotereportTask external: ' + error + __location);
    }
    return;
}

var agencyReportTask = async function(){

    const startOfMonth = moment().tz("America/Los_Angeles").startOf('month');
    //const currentDate = moment().utc().format(db.dbTimeFormat())

    //S QLAgency locations
    const quoteSQL = `
    select 
            id, name, slug, agency_network, created, modified, deleted, wholesale_agreement_signed
        from    
            clw_talage_agencies 
        where 
            state = 1;`

    // AND created BETWEEN '${startOfMonth.utc().format(db.dbTimeFormat())}' AND '${currentDate}'`;

    let agencyListDBJSON = null;

    agencyListDBJSON = await db.query(quoteSQL).catch(function(err){
        log.error(`Error get agency list from DB. error:  ${err}` + __location);
        return false;
    });
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

    // Loop locations setting up activity codes.
    if(agencyListDBJSON && agencyListDBJSON.length > 0){
        //Load AgencyNetwork Map
        const agencyNetworkBO = new AgencyNetworkBO();
        let agencyNetworkNameMapJSON = {};
        agencyNetworkNameMapJSON = await agencyNetworkBO.getIdToNameMap().catch(function(err){
            log.error("Could not get agency network id to name map " + err + __location);
        })

        for(let i = 0; i < agencyListDBJSON.length; i++){
            const quote = agencyListDBJSON[i];

            quote.created = moment_timezone(quote.created).tz('America/Los_Angeles').format('YYYY-MM-DD');
            quote.modified = moment_timezone(quote.modified).tz('America/Los_Angeles').format('YYYY-MM-DD');


            quote.state = ""
            if(quote.wholesale_agreement_signed){
                const signedDtm = moment_timezone(quote.wholesale_agreement_signed).tz('America/Los_Angeles')
                quote.wholesale_agreement_signed = signedDtm.format('YYYY-MM-DD');
                if(signedDtm < startOfMonth){
                    quote.state = "Active"
                }
            }

            if(quote.deleted){
                quote.deleted = moment_timezone(quote.deleted).tz('America/Los_Angeles').format('YYYY-MM-DD');
            }
            // get AgencyNetwork name from map
            if(agencyNetworkNameMapJSON[agencyListDBJSON[i].agency_network]){
                agencyListDBJSON[i].networkName = agencyNetworkNameMapJSON[agencyListDBJSON[i].agency_network];
            }

        }

        //Map list of agencies to CSV
        // eslint-disable-next-line object-property-newline
        const stringifyOptions = {
            "header": true,
            "columns": dbDataColumns
        };
        const csvData = await csvStringify(agencyListDBJSON, stringifyOptions).catch(function(err){
            log.error("Agency Report JSON to CSV error: " + err + __location);
            return;
        });


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
                'filename': 'AgencyReport.csv',
                'type': 'text/csv',
                'disposition': 'attachment'
            };
            const attachments = [];
            attachments.push(attachmentJson);
            const emailResp = await emailSvc.send(toEmail, 'Agency Report', 'Monthly report with number of agencies, active/inactive, and onboarding dates as of the 1st of that month.', {}, global.WHEELHOUSE_AGENCYNETWORK_ID, 'talage', 1, attachments);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to send Agency Report email.`);
            }
            return;
        }
        else {
            log.error("Agency Report JSON to CSV error: csvData empty file: " + __location);
            return;
        }

    }
    else {
        log.info("Agency Report: No agencies to report ");
        let toEmail = 'adam@talageins.com';
        if(global.settings.ENV !== 'production'){
            toEmail = 'brian@talageins.com';
        }
        const emailResp = await emailSvc.send(toEmail, 'Agency Report', 'Your "Agency Report report: No Agencies.', {}, global.WHEELHOUSE_AGENCYNETWORK_ID , 'talage', 1);
        if(emailResp === false){
            slack.send('#alerts', 'warning',`The system failed to send "Agency Report email.`);
        }
        return;
    }
}