/* eslint-disable prefer-const */
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
        let messageBody = queueMessage.Body;
        if(typeof queueMessage.Body === 'string'){
            messageBody = JSON.parse(queueMessage.Body)
        }

        agencyReportTask(messageBody).catch(function(err){
            log.error("Error agencyReportTask " + err + __location);
        });

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

var agencyReportTask = async function(taskBodyJSON){

    const fortyFiveDaysAgo = moment().tz("America/Los_Angeles").subtract(45,"d").startOf('d').toDate();
    const forteenDaysAgo = moment().tz("America/Los_Angeles").subtract(14,"d").startOf('d').toDate();
    let deadbeatReport = false;
    if(taskBodyJSON.deadBeat){
        deadbeatReport = true
    }
    const deadBeatCuttOff = moment('2010-01-01').tz("America/Los_Angeles").subtract(1,"months").startOf('month').toDate();
    const deadBeatAppCuttOff = moment().tz("America/Los_Angeles").subtract(1,"months").startOf('month').toDate();
    const deadBeatAppCuttOffEnd = moment().tz("America/Los_Angeles").subtract(1,"months").endOf('month').toDate();

    // log.debug(`fortyFiveDaysAgo ${fortyFiveDaysAgo}`)
    // log.debug(`forteenDaysAgo ${forteenDaysAgo}`)

    // log.debug(`deadBeatCuttOff ${deadBeatCuttOff}`)
    // log.debug(`deadBeatAppCuttOff ${deadBeatAppCuttOff}`)


    const Application = global.mongoose.Application;
    const Agency = global.mongoose.Agency;
    const agencyBO = new AgencyBO();

    let agencyList = [];
    try{
        if(!deadbeatReport){
            const pipline = [
                {$match: {
                    agencyNetworkId: 1,
                    active: true,
                    agencyId: {$nin: [42,44]},
                    createdAt: {$gte: fortyFiveDaysAgo}
                }},
                {$group: {
                    _id: {agencyId: '$agencyId'},
                    maxAppDate: {$max: "$createdAt"}
                }},
                {"$replaceRoot": {"newRoot": {"$mergeObjects": ["$_id", {"maxAppDate": "$maxAppDate"}]}}},
                {$match: {maxAppDate: {$lte: forteenDaysAgo}}},
                {$sort: {'maxAppDate': -1}}
            ];

            const agencyFellOffList = await Application.aggregate(pipline);
            for (const aggJSON of agencyFellOffList){
                //get Agency records
                // eslint-disable-next-line prefer-const
                let agencyJSON = await agencyBO.getById(aggJSON.agencyId);
                if(agencyJSON){
                    agencyJSON.lastAppDt = moment_timezone(aggJSON.maxAppDate).tz('America/Los_Angeles').format('YYYY-MM-DD');
                    agencyJSON.created = moment_timezone(agencyJSON.createdAt).tz('America/Los_Angeles').format('YYYY-MM-DD');
                    agencyList.push(agencyJSON);
                }
            }

            const pipline2 = [
                {$match: {
                    agencyNetworkId: 1,
                    active: true,
                    createdAt: {$gte: fortyFiveDaysAgo},
                    systemId: {$nin: [42,44]}
                }},
                {$lookup:
                    {
                        from: "applications",
                        let: {agencyId: "$systemId"},
                        pipeline: [
                            {$match:
                            {$expr:
                            {$and:
                                [
                                    {$eq: ["$agencyId", "$$agencyId"]}, {$gte: ["$createdAt", forteenDaysAgo]}
                                ]}}}, {$project: {
                                createdAt: 1,
                                applicationId: 1
                            }}
                        ],
                        as: "apps"
                    }},
                {$match: {apps: {$size: 0}}},
                {$sort: {'createdAt': -1}}
            ];
            const agencyNoAppsList = await Agency.aggregate(pipline2);
            for (let agencyJSON of agencyNoAppsList){
                //get Agency records
                agencyJSON.lastAppDt = "No Apps";
                agencyJSON.created = moment_timezone(agencyJSON.createdAt).tz('America/Los_Angeles').format('YYYY-MM-DD');
                agencyList.push(agencyJSON);
            }
        }
        else {
            const pipline2 = [
                {$match: {
                    agencyNetworkId: 1,
                    active: true,
                    createdAt: {$gte: deadBeatCuttOff},
                    systemId: {$nin: [42,44]}
                }},
                {$lookup:
                    {
                        from: "applications",
                        let: {agencyId: "$systemId"},
                        pipeline: [
                            {$match:
                            {$expr:
                            {$and:
                                [
                                    {$eq: ["$agencyId", "$$agencyId"]},
                                    {$gte: ["$createdAt", deadBeatAppCuttOff]},
                                    {$lte: ["$createdAt", deadBeatAppCuttOffEnd]}
                                ]}}}, {$project: {
                                createdAt: 1,
                                applicationId: 1
                            }}
                        ],
                        as: "apps"
                    }},
                {$match: {apps: {$size: 0}}},
                {$sort: {'createdAt': -1}}
            ];
            log.debug(`pipline2 ${JSON.stringify(pipline2)}`)
            const agencyNoAppsList = await Agency.aggregate(pipline2);
            for (let agencyJSON of agencyNoAppsList){
                //get Agency records
                agencyJSON.lastAppDt = "No Apps";
                agencyJSON.created = moment_timezone(agencyJSON.createdAt).tz('America/Los_Angeles').format('YYYY-MM-DD');
                agencyList.push(agencyJSON);
            }
        }
    }
    catch(err){
        log.error("AgencyReporting agencybo getList error " + err + __location);
    }


    const dbDataColumns = {
        "systemId": "Agency ID",
        "name": "Agency Name",
        "firstName": "First Name",
        "lastName": "Last Name",
        "phone": "Agency Phone",
        "email": "Agency Email",
        "created": "Created",
        "lastAppDt": "Last App Date"
    };


    let toEmail = 'service@talageins.com';
    if(global.settings.ENV !== 'production'){
        toEmail = 'brian@talageins.com';
    }
    // Loop locations setting up activity codes.
    if(agencyList && agencyList.length > 0){
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
            let fileName = 'AgencyInactvityReport-14Day.csv'
            if(deadbeatReport){
                fileName = `AgencyInactvityReport-${moment_timezone(deadBeatAppCuttOff).tz('America/Los_Angeles').format('MMM YYYY')}.csv`;
            }

            const attachmentJson = {
                'content': csvContent,
                'filename': fileName,
                'type': 'text/csv',
                'disposition': 'attachment'
            };
            const attachments = [];
            attachments.push(attachmentJson);
            let subject = 'Agency 45 Day Inactivity Report';
            let emailBody = 'Agencies with no applications in last 14 days.'
            if(deadbeatReport){
                subject = `Agency Inactivity in ${moment_timezone(deadBeatAppCuttOff).tz('America/Los_Angeles').format('MMM, YYYY')} Report`
                emailBody = `Agencies with no applications in  ${moment_timezone(deadBeatAppCuttOff).tz('America/Los_Angeles').format('MMM, YYYY')}.`
            }
            const emailResp = await emailSvc.send(toEmail, subject, emailBody, {}, global.WHEELHOUSE_AGENCYNETWORK_ID, 'talage', 1, attachments);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to send Agency Inactivity Report email.`);
            }
            return;
        }
        else {
            log.error("Agency Report JSON to CSV error: csvData empty file: " + __location);
            return;
        }

    }
    else {
        log.info("Agency Inactvity Report: No agencies to report ");
        const emailResp = await emailSvc.send(toEmail, 'Agency Inactivity Report', 'Your "Agency Inactivity Report report: No Agencies.', {}, global.WHEELHOUSE_AGENCYNETWORK_ID , 'talage', 1);
        if(emailResp === false){
            slack.send('#alerts', 'warning',`The system failed to send "Agency Inactivity Report email.`);
        }
        return;
    }
}
