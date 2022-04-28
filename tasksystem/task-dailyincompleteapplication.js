'use strict';

const moment = require('moment');
const util = require("util");
const csvStringify = util.promisify(require("csv-stringify"));
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');

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
            log.error("Error Daily Incomplete Applications Task " + err + __location);
        });
        error = null;
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error daily incomplete applications deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);
    }
    else {
        log.debug('removing old daily incomplete application Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error Daily Incomplete Applications - deleteTaskQueueItem old " + error + __location);
        }
    }
    return;
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

    const yesterdayBegin = moment().tz("America/Los_Angeles").subtract(1,'d').startOf('day');
    const yesterdayEnd = moment().tz("America/Los_Angeles").subtract(1,'d').endOf('day');
    const query = {
        "active": true,
        "dailyApplicationEmail": true
    };

    let agencyList = null;

    const agencyBO = new AgencyBO();
    agencyList = await agencyBO.getList(query).catch(function(err){
        log.error(`Error get agency list from DB. error:  ${err}` + __location);
        return false;
    });

    if(agencyList?.length > 0){
        for(const agency of agencyList){
            // process each agency. make sure we have an active Agency
            if(agency?.systemId && agency?.agencyNetworkId && (agency?.email || agency?.agencyEmail)){
                await processApplications(agency, yesterdayBegin, yesterdayEnd).catch(function(err){
                    log.error("Error Agency Daily Incomplete Application error. AL: " + JSON.stringify(agency) + " error: " + err + __location);
                })
            }
        }
    }
    else{
        log.info(`Daily Incomplete Applications: No Active Agencies with dailyApplicationEmail set`)
    }

    return;
}

/**
 * Process Applications for each agency
 *
 * @param {string} agency - from db query not full object.
 * @param {date} yesterdayBegin - starting date of yesterday
 * @param {date} yesterdayEnd - ending date of yesterday
 * @returns {void}
 */

const processApplications = async function(agency, yesterdayBegin, yesterdayEnd){

    if(!agency?.agencyNetworkId){
        log.error(`Error Daily Incomplete Applications - Agency agency_network not set for Agency: ${agency.systemid}` + __location);
        return false;
    }
    const industryCodeBO = new IndustryCodeBO();

    const query = {
        "agencyId": agency.systemId,
        "searchbegindate": yesterdayBegin,
        "searchenddate": yesterdayEnd,
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

    if(appList?.length > 0){
        for (const applicationDoc of appList){
            //process customer contact
            const customerContact = applicationDoc.contacts.find(contact => contact.primary === true);
            if(customerContact){
                customerContact.phone = customerContact?.phone ? formatPhone(customerContact.phone) : 'unknown';
                customerContact.firstName = customerContact?.firstName ? customerContact.firstName : 'unknown';
                customerContact.lastName = customerContact?.lastName ? customerContact.lastName : 'unknown';
                customerContact.customerEmail = customerContact?.email ? customerContact.email : 'unknown'

                applicationDoc.customerContact = customerContact;

                //process industry name
                const industryDoc = await industryCodeBO.getById(applicationDoc.industryCode).catch(function(err){
                    log.error(`Error getting Industry Codes from database - ${err}` + __location);
                })

                if(industryDoc?.description){
                    applicationDoc.industryName = industryDoc.description;
                }
                //process business address
                if(applicationDoc.mailingAddress){
                    applicationDoc.businessAddress = `${applicationDoc.mailingAddress} ${applicationDoc.mailingCity} ${applicationDoc.mailingState} ${applicationDoc.mailingZipcode}`
                }
            }
        }
        log.debug(JSON.stringify(appList, null, 2));
        // Create spreadsheet and send the email
        await sendApplicationsSpreadsheet(appList, agency)
    }
    else {
        log.info(`Daily Incomplete Applications: No Activity for Agency: ${agency.systemId}.`)
    }
    return true;
}

/**
 * Send Applications to the agency customer
 *
 * @param {object} applicationList - from db query not full object.
 * @param {object} agency - starting date of yesterday
 * @returns {void}
 */
const sendApplicationsSpreadsheet = async function(applicationList, agency){
    const dbDataColumns = {
        "applicationId": "Application ID",
        "businessName": "Business Name",
        "createdAt": "Created",
        "updatedAt": "Last Update",
        "industryname": "Industry Name",
        "businessAddress": "Business Address",
        "customerContact.firstName": "Customer First Name",
        "customerContact.lastName": "Customer Last Name",
        "customerContact.email": "Customer Email",
        "customerContact.phone": "Customer Phone"
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
        const yesterday = moment().tz("America/Los_Angeles").subtract(1,'d');
        const fileName = `IncompleteApplications-${yesterday.format("YYYY-MM-DD")}.csv`;

        const attachmentJson = {
            'content': csvContent,
            'filename': fileName,
            'type': 'text/csv',
            'disposition': 'attachment'
        };
        const agencyName = agency.name;
        const attachments = [];
        attachments.push(attachmentJson);
        const subject = `Daily Incomplete Applications for Agency: ${agencyName}`;
        const emailBody = `Hi, you will find attached the file with the incomplete applications for the Agency ${agency.name} of ${yesterday}`

        log.debug(`Sending spreadsheet of the incomplete applications for Agency: ${agency.systemId} - ${agency.name}`);
        const emailResp = await emailSvc.send(agency.email, subject, emailBody, {}, global.WHEELHOUSE_AGENCYNETWORK_ID, 'talage', 1, attachments);
        if(emailResp === false){
            slack.send('#alerts', 'warning',`The system failed to send Daily Incomplete Applications Report email.`);
        }
        else {
            log.debug(`Successfuly send the email to - ${agency.email}`)
        }
        return;
    }
    else {
        log.error("Daily Incomplete Application Report JSON to CSV error: csvData empty file: " + __location);
        return;
    }
}