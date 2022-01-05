'use strict';

const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const moment_timezone = require('moment-timezone');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');

/**
 * emailIncomplete Task processor
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

        await emailIncompleteTask().catch(err => error = err);
        if(error){
            log.error("Error emailIncompleteTask " + error + __location);
        }
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error emailIncompleteTask deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.debug('removing old emailIncompleteTask from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error emailIncompleteTask deleteTaskQueueItem old " + error + __location);
        }
        return;
    }
}

/**
 * Exposes emailIncompleteTask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function(){
    let error = null;
    await emailIncompleteTask().catch(err => error = err);
    if(error){
        log.error('emailIncompleteTask external: ' + error + __location);
    }
    return;
}

var emailIncompleteTask = async function(){

    // this code is necessary to correct the timezone-bug in momentjs-- forgive the bad code
    const getTimeInNewYork = (date) => moment_timezone.tz(`${moment_timezone.tz('America/New_York').format('DD')} ${date}`, 'DD hh:mma', 'America/New_York')

    const triggerTime1 = getTimeInNewYork('10:00am');
    const triggerTime2 = getTimeInNewYork('02:00pm');
    let yesterdayBegin = moment_timezone.tz("America/New_York");

    if(moment_timezone.tz("America/New_York").isAfter(triggerTime2)){
        yesterdayBegin = moment_timezone.tz("America/New_York").subtract(4,'hours');
        log.info('Email Incomplete Application triggered after 2:00 pm EST');

    }
    else if(moment_timezone.tz("America/New_York").isAfter(triggerTime1)){
        yesterdayBegin = moment_timezone.tz("America/New_York").subtract(19,'hours');
        log.info('Email Incomplete Application triggered after 10:00 am EST');

    }
    else{
        log.error('Invalid time trigger for Incomplete Applications email list' + __location);
    }
    const yesterdayEnd = moment_timezone.tz("America/New_York");

    let applicationList = null;
    let appList = '<br><table border="1" cellspacing="0" cellpadding="4" width="100%"><thead><tr><th>Business Name</th><th>Contact Name</th><th>Contact Email</th><th>Contact Phone</th><th>Wholesale</th></tr></thead><tbody>';
    const query = {
        "status":"incomplete",
        // "searchenddate": yesterdayEnd,
        // "searchbegindate": yesterdayBegin
    };
    // const query = {"status":"incomplete"};
    const applicationBO = new ApplicationBO();

    applicationList = await applicationBO.getList(query).catch(function(err){
        log.error(`Error get application list from DB. error:  ${err}` + __location);
        return false;
    });
    log.info(`application list obj-> ${JSON.stringify(applicationList[0])} `); 
    let message = null;
    const subject = `Daily Incomplete Applications list`;

    if(applicationList && applicationList.length > 0){
        for(let i = 0; i < applicationList.length; i++){
            const applicationDoc = applicationList[i];
            // process each application determined from the query. make sure we have an active Agency
            const customerContact = applicationDoc.contacts.find(contactTest => contactTest.primary === true);
            let customerPhone = "ukn";
            let firstName = 'unkn';
            let lastName = 'unkn';
            let customerEmail = 'unkn';
            if(customerContact){
                customerPhone = formatPhone(customerContact.phone);
                firstName = customerContact.firstName;
                lastName = customerContact.lastName;
                customerEmail = customerContact.email
            }

            let wholesale = applicationDoc.wholesale === true ? "Talage" : "";
            if(applicationDoc.solepro){
                wholesale = "SolePro"
            }

            appList += '<tr><td>' + stringFunctions.ucwords(applicationDoc.businessName) + '</td><td>' + firstName + ' ' + lastName + '</td><td>' + customerEmail + '</td><td>' + customerPhone + '</td><td>' + wholesale + '</td></tr>';

        }
        appList += '</tbody></table><br>';

        try{
            message = appList;
            // send email
            const emailResp = await emailSvc.send('integrations@talageins.com', subject, message);
            if(emailResp === false){
                slack.send('#alerts', 'warning',`The system failed to send Incomplete Applications for the last 24 hrs.`);
            }
        }
        catch(e){
            log.error(`Incomplete Applications email content creation error: ${e}` + __location);
            return false;
        }
    }

    return;
}