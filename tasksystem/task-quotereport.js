/* eslint-disable curly */
'use strict';

const moment = require('moment');
const util = require("util");
const csvStringify = util.promisify(require("csv-stringify"));
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBO = global.requireShared('models/Quote-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
//const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');

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

    const quoteBO = new QuoteBO()
    let quoteList = null;
    try {
        //sort by policyType
        const quoteQuery = {
            "searchenddate": yesterdayEnd,
            "searchbegindate": yesterdayBegin
        }
        quoteList = await quoteBO.getList(quoteQuery);
    }
    catch(err){
        log.error("Error getting quote for qoute list " + err + __location);
        return false;
    }


    if(quoteList && quoteList.length > 0){
        let lastAppDoc = null;
        const reportRows = [];
        // get insurer list
        //get list of insurers - Small < 50 get whole list once.
        let insurerList = null;
        const insurerBO = new InsurerBO();
        try{
            insurerList = await insurerBO.getList();
        }
        catch(err){
            log.error("Error get InsurerList " + err + __location)
        }

        //Load AgencyNetwork Map
        const agencyNetworkBO = new AgencyNetworkBO();
        let agencyNetworkNameMapJSON = {};
        agencyNetworkNameMapJSON = await agencyNetworkBO.getIdToNameMap().catch(function(err){
            log.error("Could not get agency network id to name map " + err + __location);
        })
        //loop quote list.
        for(let i = 0; i < quoteList.length; i++){
            const quoteDoc = quoteList[i];
            let getAppDoc = false;
            if(!lastAppDoc){
                getAppDoc = true;
            }
            if(getAppDoc === true || lastAppDoc && lastAppDoc.applicationId !== quoteDoc.applicationId){
                lastAppDoc = {};
                const applicationBO = new ApplicationBO();
                try{

                    lastAppDoc = await applicationBO.getfromMongoByAppId(quoteDoc.applicationId);
                }
                catch(err){
                    log.error("abandonquotetask getting appid list error " + err + __location);
                    throw err;
                }
            }
            let insurer = {name: ''};
            if(insurerList){
                insurer = insurerList.find(insurertest => insurertest.id === quoteDoc.insurerId);
            }
            const newRow = {};
            newRow.application = lastAppDoc.applicationId;
            newRow.policy_type = quoteDoc.policyType;
            newRow.name = insurer.name;
            newRow.network = agencyNetworkNameMapJSON[lastAppDoc.agencyNetworkId];
            newRow.territory = lastAppDoc.mailingState;
            newRow.api_result = quoteDoc.apiResult;
            newRow.reasons = quoteDoc.reasons;
            newRow.seconds = quoteDoc.quoteTimeSeconds;
            //Activty codes
            if(lastAppDoc && lastAppDoc.activityCodes && lastAppDoc.activityCodes.length > 0){
                for(let j = 0; j < lastAppDoc.activityCodes.length; j++){
                    const activityCodeBO = new ActivityCodeBO();
                    try{
                        const activityCodeJSON = await activityCodeBO.getById(lastAppDoc.activityCodes[j].ncciCode)
                        newRow["activitycode" + j] = activityCodeJSON.description;
                    }
                    catch(err){
                        log.error("activity code load error " + err + __location);
                    }
                    if(j > 1){
                        break;
                    }
                }
            }
            reportRows.push(newRow)
        }

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
        //Map Quote list to CSV.
        // eslint-disable-next-line object-property-newline
        const stringifyOptions = {
            "header": true,
            "columns": cvsHeaderColumns
        };

        const csvData = await csvStringify(reportRows, stringifyOptions).catch(function(err){
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
            const emailResp = await emailSvc.send(toEmail, 'Quote Report', 'Your daily quote report is attached.', {}, global.WHEELHOUSE_AGENCYNETWORK_ID, 'talage', 1, attachments);
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
        let toEmail = 'adam@talageins.com';
        if(global.settings.ENV !== 'production'){
            toEmail = 'brian@talageins.com';
        }
        const emailResp = await emailSvc.send(toEmail, 'Quote Report', 'Your daily quote report: No Quotes.', {}, global.WHEELHOUSE_AGENCYNETWORK_ID, 'talage', 1);
        if(emailResp === false){
            slack.send('#alerts', 'warning',`The system failed to send Quote Report email.`);
        }
        return;
    }
}