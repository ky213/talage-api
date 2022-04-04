/* eslint-disable curly */
'use strict';

const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const moment_timezone = require('moment-timezone');
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
const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');

const QuoteMongooseModel = global.mongoose.Quote;
//const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');


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
        let messageBody = queueMessage.Body;
        if(typeof queueMessage.Body === 'string'){
            messageBody = JSON.parse(queueMessage.Body)
        }
        quoteReportTask(messageBody).catch(err => error = err);
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error Quote Report deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.info('removing old Quote Report  Message from queue');
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

var quoteReportTask = async function(messageBody){

    let beginRefDate = moment();
    let endRefDate = moment();
    if(messageBody?.beginDate){
        try{
            const testDate = moment(messageBody.beginDate);
            if (testDate.isValid()) {
                beginRefDate = testDate;
            }

        }
        catch(err){
            log.error(`bad beginDate ${messageBody.beginDate} error ${err}` + __location)
        }
    }

    if(messageBody?.endDate){
        try{
            const testDate = moment(messageBody.endDate);
            if (testDate.isValid()) {
                endRefDate = testDate;
            }

        }
        catch(err){
            log.error(`bad beginDate ${messageBody.endDate} error ${err}` + __location)
        }
    }

    const beginDayBegin = beginRefDate.tz("America/Los_Angeles").subtract(1,'d').startOf('day');
    const endDayEnd = endRefDate.tz("America/Los_Angeles").subtract(1,'d').endOf('day');

    // const yesterdayBegin = moment.tz("America/Los_Angeles").subtract(7,'d').startOf('day');
    // const yesterdayEnd = moment.tz("America/Los_Angeles").subtract(1,'d').endOf('day');

    const quoteBO = new QuoteBO()
    let quoteIdList = null;
    try {
        //sort by policyType
        // const donotIncludeStatusList = [];
        // donotIncludeStatusList.push(quoteStatus.piOutOfAppetite.id)
        // donotIncludeStatusList.push(quoteStatus.priceIndication.id)
        const quoteQuery = {active: true}
        quoteQuery.createdAt = {
            $lte: endDayEnd,
            $gte: beginDayBegin
        };
        const queryProjection = {"quoteId": 1};
        quoteIdList = await QuoteMongooseModel.find(quoteQuery,queryProjection).lean();
    }
    catch(err){
        log.error("Error getting quote for qoute list " + err + __location);
        return false;
    }

    // Get All Industry Codes
    const industryCodeBO = new IndustryCodeBO();
    let industryCodeDocs = null;
    try {
        industryCodeDocs = await industryCodeBO.getList({
            active: true,
            talageStandard: true
        });
    }
    catch (err) {
        const error = `quotereportTask: ERROR: Could not get industry codes ${err}. ${__location}`;
        log.error(error);
    }

    // send email
    // Production email goes to quotereport.
    // non production Brian so we can test it.
    const toEmail = global.settings.ENV === 'production' ? 'quotereport@talageins.com' : 'brian@talageins.com';

    if(quoteIdList && quoteIdList.length > 0){
        const activityCodeBO = new ActivityCodeBO();
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
        let agencyNetworkList = {};
        agencyNetworkList = await agencyNetworkBO.getList({}).catch(function(err){
            log.error("Could not get agency network list " + err + __location);
        })
        //loop quote list.
        for(let i = 0; i < quoteIdList.length; i++){
            try{
                const quoteDoc = await quoteBO.getById(quoteIdList[i].quoteId);
                let getAppDoc = false;
                if(!lastAppDoc){
                    getAppDoc = true;
                }
                if(quoteDoc && getAppDoc === true || lastAppDoc && lastAppDoc.applicationId !== quoteDoc.applicationId){
                    lastAppDoc = {};
                    const applicationBO = new ApplicationBO();
                    try{

                        lastAppDoc = await applicationBO.loadDocfromMongoByAppId(quoteDoc.applicationId);
                        if(!lastAppDoc){
                            log.info(`quotereportTask did not find appid ${quoteDoc.applicationId} ` + __location);
                        }
                        else if(!lastAppDoc.activityCodes || lastAppDoc.activityCodes.length === 0){
                            lastAppDoc.updateActivityPayroll();
                        }
                    }
                    catch(err){
                        log.error(`quotereportTask getting appid ${quoteDoc.applicationId} error ` + err + __location);
                        throw err;
                    }
                }
                let insurer = {name: ''};
                if(insurerList){
                    insurer = insurerList.find(insurertest => insurertest.id === quoteDoc.insurerId);
                }
                const newRow = {};
                newRow.application = quoteDoc.applicationId;
                newRow.policy_type = quoteDoc.policyType;
                newRow.name = insurer.name;
                if(lastAppDoc){
                    // eslint-disable-next-line no-loop-func
                    const agencyNetworkJSON = agencyNetworkList.find((an) => an.agencyNetworkId === lastAppDoc.agencyNetworkId)
                    if(agencyNetworkJSON){
                        newRow.network = agencyNetworkJSON.name;
                    }
                }
                else {
                    newRow.network = "App Deleted"
                }
                if(lastAppDoc){
                    newRow.territory = lastAppDoc.mailingState;
                }
                if(lastAppDoc?.industryCode && industryCodeDocs && industryCodeDocs.length > 0){
                    const appIndustryCode = lastAppDoc?.industryCode;
                    const industryCode = industryCodeDocs.find(icDoc => icDoc.industryCodeId === parseInt(appIndustryCode,10));
                    newRow.industry_code_desc = industryCode?.description ? industryCode?.description : "";

                }
                newRow.industryCodeId = lastAppDoc?.industryCode;
                newRow.api_result = quoteDoc.apiResult;
                newRow.reasons = quoteDoc.reasons;
                newRow.seconds = quoteDoc.quoteTimeSeconds;
                //Activty codes
                if(lastAppDoc && lastAppDoc.activityCodes && lastAppDoc.activityCodes.length > 0){
                    for(let j = 0; j < lastAppDoc.activityCodes.length; j++){
                        try{
                            if(lastAppDoc.activityCodes[j].activityCodeId){
                                newRow["activitycodeId" + j] = lastAppDoc.activityCodes[j].activityCodeId;
                                const activityCodeJSON = await activityCodeBO.getById(lastAppDoc.activityCodes[j].activityCodeId)
                                if(activityCodeJSON){
                                    newRow["activitycode" + j] = activityCodeJSON.description;
                                }
                                else {
                                    newRow["activitycode" + j] = "not found";
                                }
                            }
                            else {
                                log.info(`bad activityCodeId  ${JSON.stringify(lastAppDoc.activityCodes[j])} for ${newRow.application} ` + __location)
                            }
                        }
                        catch(err){
                            log.error("activity code load error " + err + __location);
                        }
                        if(j > 2){
                            break;
                        }
                    }
                }
                else if(newRow.policy_type === "WC") {
                    log.info(`no activtycodes for ${newRow.application} ` + __location)
                }

                //Quote premium (amount)
                if(quoteDoc.amount){
                    newRow.quotePremium = quoteDoc.amount
                }

                reportRows.push(newRow)
            }
            catch(err){
                log.error("Error adding Quote to Quote Report " + err + __location)
            }
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
            "industry_code_desc": "Industry Code Description",
            "industryCodeId": "Industry Code Id",
            "activitycode0": "Activity Code 1",
            "activitycodeId0": "Activity Code 1 Id",
            "activitycode1": "Activity Code 2",
            "activitycodeId1": "Activity Code 2 Id",
            "activitycode2": "Activity Code 3",
            "activitycodeId2": "Activity Code 3 Id",
            "quotePremium": "Quoted Premium"
        };
        //Map Quote list to CSV.
        // eslint-disable-next-line object-property-newline
        const stringifyOptions = {
            "header": true,
            "columns": cvsHeaderColumns
        };
        //log.debug(`reportRows ${JSON.stringify(reportRows)}`)
        const csvData = await csvStringify(reportRows, stringifyOptions).catch(function(err){
            log.error("Quote Report JSON to CSV error: " + err + __location);
            return;
        });
        // log.debug(csvData);

        if(csvData){
            var b = Buffer.from(csvData);
            const csvContent = b.toString('base64');
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
        const emailResp = await emailSvc.send(toEmail, 'Quote Report', 'Your daily quote report: No Quotes.', {}, global.WHEELHOUSE_AGENCYNETWORK_ID, 'talage', 1);
        if(emailResp === false){
            slack.send('#alerts', 'warning',`The system failed to send Quote Report email.`);
        }
        return;
    }
}
