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
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');

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

        emailIncompleteTask().catch(function(err){
            log.error("Error emailIncompleteTask " + err + __location);
        });

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
    const agencyBO = new AgencyBO();
    const industryCodeBO = new IndustryCodeBO();
    const agencyNetworkBO = new AgencyNetworkBO();
    const agencyNetworkList = await agencyNetworkBO.getList().catch(function(err){
        log.error(`Error get Agency Network list form DB. error: ${err}` + __location);
        return false;
    })

    if(agencyNetworkList && agencyNetworkList.length > 0){
        for(let i = 0; i < agencyNetworkList.length; i++){
            const agencyNetworkDoc = agencyNetworkList[i];
            // build the query for the applicationList
            const query = {
                "status":"incomplete",
                "agencyNetworkId":agencyNetworkDoc.agencyNetworkId,
                "searchenddate": yesterdayEnd,
                "searchbegindate": yesterdayBegin
            }

            // build incomplete application list
            const applicationBO = new ApplicationBO();
            let applicationList = null;
            applicationList = await applicationBO.getList(query).catch(function(err){
                log.error(`Error get application list from DB. error:  ${err}` + __location);
                return false;
            });

            if(applicationList && applicationList.length > 0){

                let appList = '<br><table border="1" cellspacing="0" cellpadding="4" width="100%"><thead><tr><th>Business Name</th><th>Agency Name</th><th>Industry</th><th>Business Address</th><th>Contact info</th></tr></thead><tbody>';
                log.info(`Building Agency Network list -> ${agencyNetworkDoc.name} with ${applicationList.length} Incomplete Applications`);

                let message = null;
                const subject = `Daily Incomplete Applications list for ${agencyNetworkDoc.name}`;
                const emailTo = agencyNetworkDoc.email ? agencyNetworkDoc.email : 'integrations@talageins.com';

                for(let x = 0; x < applicationList.length; x++){
                    const applicationDoc = applicationList[x];
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

                    // find the agency name and industry
                    let agencyName = '';
                    let industryName = '';
                    let businessAddress = '';
                    const agencyDoc = await agencyBO.getById(applicationDoc.agencyId).catch(function(err){
                        log.error(`Error get Agency ID did not have a result - ${err}` + __location);
                    })
                    if(agencyDoc && agencyDoc.name){
                        agencyName = agencyDoc.name;
                    }

                    const industryDoc = await industryCodeBO.getById(applicationDoc.industryCode).catch(function(err){
                        log.error(`Error getting Industry Codes from database - ${err}` + __location);
                    })
                    if(industryDoc && industryDoc.description){
                        industryName = industryDoc.description;
                    }
                    if(applicationDoc.mailingAddress){
                        businessAddress = applicationDoc.mailingAddress + '<br>' + applicationDoc.mailingCity + '<br>' + applicationDoc.mailingState + '<br>' + applicationDoc.mailingZipcode + '<br>';
                    }
                    const customerInfo = firstName + ' ' + lastName + '<br>' + customerPhone + '<br>' + customerEmail
                    appList += '<tr><td>' + stringFunctions.ucwords(applicationDoc.businessName) + '</td><td>' + agencyName + '</td><td>' + industryName + '</td><td><address>' + businessAddress + '</address></td><td><address>' + customerInfo + '</address></td></tr>';

                }
                appList += '</tbody></table><br>';

                try{
                    message = appList;
                    // send email
                    const emailResp = await emailSvc.send(emailTo, subject, message);
                    if(emailResp === false){
                        slack.send('#alerts', 'warning',`The system failed to send Incomplete Applications for the last 24 hrs.`);
                    }
                }
                catch(e){
                    log.error(`Incomplete Applications email content creation error: ${e}` + __location);
                    return false;
                }
            }

        }
    }


    return;
}