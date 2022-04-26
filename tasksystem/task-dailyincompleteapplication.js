'use strict';

const moment = require('moment');
const util = require("util");
const csvStringify = util.promisify(require("csv-stringify"));
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');

/**
 * Daily Incomplete Application Task processor
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
    //log.debug("messageAge: " + messageAge );
    if(messageAge < 1800){
        dailyIncompleteApplicationTask().catch(function(err){
            log.error("Error Daily Incomplete Application Task " + err + __location);
        });
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error daily incomplete application deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.debug('removing old daily incomplete application Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error Daily Incomplete Application - deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes Daily Incomplete Application Task for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await dailyIncompleteApplicationTask().catch(err => error = err);
    if(error){
        log.error('dailyIncompleteApplicationTask external: ' + error + __location);
    }
    return;
}

const dailyIncompleteApplicationTask = async function(){

    const todayBegin = moment().tz("America/Los_Angeles").startOf('day');
    const todayEnd = moment().tz("America/Los_Angeles").endOf('day');
    const query = {"active": true};

    let agencyList = null;

    const agencyBO = new AgencyBO();
    agencyList = await agencyBO.getList(query).catch(function(err){
        log.error(`Error get agency list from DB. error:  ${err}` + __location);
        return false;
    });

    if(agencyList?.length > 0){
        for(const agency in agencyList){
            // process each agency location. make sure we have an active Agency
            if(agency?.systemId && agency?.agencyNetworkId && (agency?.email || agency?.agencyEmail)){
                log.debug('Agency: ' + JSON.stringify(agency));
                await processApplications(agency, todayBegin, todayEnd).catch(function(err){
                    log.error("Error Agency Location Daily Incomplete Application error. AL: " + JSON.stringify(agency) + " error: " + err + __location);
                })
            }
        }
    }

    return;
}

/**
 * Process Applications for each agency
 *
 * @param {string} agency - from db query not full object.
 * @param {date} todayBegin - starting date of today
 * @param {date} todayEnd - ending date of today
 * @returns {void}
 */

const processApplications = async function(agency, todayBegin, todayEnd){

    if(!agency?.agencyNetworkId){
        log.error(`Error Daily Incomplete Applications - Agency agency_network not set for Agency: ${agency.systemid}` + __location);
        return false;
    }
    //const agencyNetwork = agencyLocationDB.agencyNetworkId;

    const query = {
        "agencyId": agency.systemId,
        "searchbegindate": todayBegin,
        "searchenddate": todayEnd,
        "status":"incomplete"
    };
    let appList = null;
    const applicationBO = new ApplicationBO();

    try{

        appList = await applicationBO.getList(query);
    }
    catch(err){
        log.error("Daily Incomplete Applications getting App list error " + err + __location);
        throw err;
    }


    //let appCount = 0;
    if(appList && appList.length > 0){
        // Create spreadsheet and send the email
        sendApplicationsSpreadsheet(appList, agency)
    }
    else {
        log.info(`Daily Incomplete Application: No Activity for Agency: ${agency.systemId}.`)
    }
    return true;
}

/**
 * Send Applications to the agency customer
 *
 * @param {object} applicationList - from db query not full object.
 * @param {object} agency - starting date of today
 * @returns {void}
 */
const sendApplicationsSpreadsheet = async function(applicationList, agency){
    const dbDataColumns = {
        "applicationId": "Application ID",
        "businessName": "Business Name",
        "createdAt": "Created",
        "updatedAt": "Last Update"
    };

    const stringifyOptions = {
        "header": true,
        "columns": dbDataColumns
    };
    const csvData = await csvStringify(applicationList, stringifyOptions).catch(function(err){
        log.error("Agency Report JSON to CSV error: " + err + __location);
        return;
    });

    if(csvData){
        const buffer = Buffer.from(csvData);
        const csvContent = buffer.toString('base64');
        const todayBegin = moment().tz("America/Los_Angeles").startOf('day');
        const fileName = `IncompleteApplications-${todayBegin.format("YYYY-MM-DD")}.csv`;

        const attachmentJson = {
            'content': csvContent,
            'filename': fileName,
            'type': 'text/csv',
            'disposition': 'attachment'
        };
        const agencyName = agency.name;
        const attachments = [];
        attachments.push(attachmentJson);
        const subject = `Daily Incomplete Applications list for Agency: ${agencyName}`;
        const emailBody = 'Incomplete Applications for '

        const emailResp = await emailSvc.send(agency.email, subject, emailBody, {}, global.WHEELHOUSE_AGENCYNETWORK_ID, 'talage', 1, attachments);
        if(emailResp === false){
            slack.send('#alerts', 'warning',`The system failed to send Daily Incomplete Applications Report email.`);
        }
        return;
    }
    else {
        log.error("Daily Incomplete Application Report JSON to CSV error: csvData empty file: " + __location);
        return;
    }
}