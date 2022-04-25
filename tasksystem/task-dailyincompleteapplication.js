'use strict';

const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const emailSvc = global.requireShared('./services/emailsvc.js');
//const slack = global.requireShared('./services/slacksvc.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
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
        // DO STUFF

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
 * Exposes DailyDigestTask for testing
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

    const yesterdayBegin = moment().tz("America/Los_Angeles").subtract(1,'d').startOf('day');
    const yesterdayEnd = moment().tz("America/Los_Angeles").subtract(1,'d').endOf('day');

    let agencyLocationList = null;
    const agencyLocationBO = new AgencyLocationBO();
    const query = {};
    const getAgencyName = true;
    const loadChildren = false;
    agencyLocationList = await agencyLocationBO.getList(query, getAgencyName, loadChildren).catch(function(err){
        log.error(`Error get agency location list from DB. error:  ${err}` + __location);
        return false;
    });

    if(agencyLocationList && agencyLocationList.length > 0){
        for(let i = 0; i < agencyLocationList.length; i++){
            const agencyLocationDB = agencyLocationList[i];
            // process each agency location. make sure we have an active Agency
            if(agencyLocationDB && agencyLocationDB.systemId && agencyLocationDB.agencyNetworkId && (agencyLocationDB.email || agencyLocationDB.agencyEmail)){
                await processAgencyLocation(agencyLocationDB, yesterdayBegin, yesterdayEnd).catch(function(err){
                    log.error("Error Agency Location Daily Digest error. AL: " + JSON.stringify(agencyLocationDB) + " error: " + err + __location);
                })
            }
        }
    }

    return;
}

/**
 * Exposes processAgencyLocation
 *
 * @param {string} agencyLocationDB - from db query not full object.
 * @returns {void}
 */

var processAgencyLocation = async function(agencyLocationDB, yesterdayBegin, yesterdayEnd){

    if(!agencyLocationDB.agencyNetworkId){
        log.error(`Error Daily Incomplete Applications - Agency Location agency_network not set for Agency Location: ${agencyLocationDB.alid}` + __location);
        return false;
    }
    //const agencyNetwork = agencyLocationDB.agencyNetworkId;

    const query = {
        "agencyLocationId": agencyLocationDB.systemId,
        "searchenddate": yesterdayEnd,
        "searchbegindate": yesterdayBegin,
        "appStatusId": 0 //incomplete applications
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
    }
    else {
        log.info(`DailyDigest: No Activity for Agency Location: ${agencyLocationDB.systemId}.`)
    }
    return true;
}