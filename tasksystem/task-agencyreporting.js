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
        if(error){
            log.error("Error agencyReportTask " + error + __location);
        }
        error = null;
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


    let agencyList = null;
    try{
        // Load the request data into it
        // get all non-deleted agencies
        const query = {};
        const agencyBO = new AgencyBO();
        agencyList = await agencyBO.getList(query);
    }
    catch(err){
        log.error("AgencyReporting agencybo getList error " + err + __location);
    }


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
    if(agencyList && agencyList.length > 0){
        //Load AgencyNetwork Map
        const agencyNetworkBO = new AgencyNetworkBO();
        let agencyNetworkNameMapJSON = {};
        agencyNetworkNameMapJSON = await agencyNetworkBO.getIdToNameMap().catch(function(err){
            log.error("Could not get agency network id to name map " + err + __location);
        })

        for(let i = 0; i < agencyList.length; i++){
            // eslint-disable-next-line prefer-const
            let agency = agencyList[i];

            const createdDtm = moment_timezone(agency.createdAt).tz('America/Los_Angeles');
            agency.created = moment_timezone(agency.createdAt).tz('America/Los_Angeles').format('YYYY-MM-DD');
            agency.modified = moment_timezone(agency.updatedAt).tz('America/Los_Angeles').format('YYYY-MM-DD');


            agency.state = ""
            if(agency.agency_network === 2){
                if(agency.wholesaleAgreementSigned){
                    const signedDtm = moment_timezone(agency.wholesaleAgreementSigned).tz('America/Los_Angeles')
                    agency.wholesale_agreement_signed = signedDtm.format('YYYY-MM-DD');
                    if(signedDtm < startOfMonth){
                        agency.state = "Active"
                    }
                }
            }
            else if(createdDtm < startOfMonth){
                agency.state = "Active";
                //make sure if it exists it is formatted.
                if(agency.wholesaleAgreementSigned){
                    const signedDtm = moment_timezone(agency.wholesaleAgreementSigned).tz('America/Los_Angeles')
                    agency.wholesale_agreement_signed = signedDtm.format('YYYY-MM-DD');
                }
            }


            if(agency.deletedAt){
                agency.deletedAt = moment_timezone(agency.deletedAt).tz('America/Los_Angeles').format('YYYY-MM-DD');
            }
            // get AgencyNetwork name from map
            if(agencyNetworkNameMapJSON[agencyList[i].agency_network]){
                agencyList[i].networkName = agencyNetworkNameMapJSON[agencyList[i].agency_network];
            }

        }

        //Map list of agencies to CSV
        // eslint-disable-next-line object-property-newline
        const stringifyOptions = {
            "header": true,
            "columns": dbDataColumns
        };
        const csvData = await csvStringify(agencyList, stringifyOptions).catch(function(err){
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