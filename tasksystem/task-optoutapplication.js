'use strict';

const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const email = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

/**
 * AbandonQuote Task processor
 *
 * @param {string} queueMessage - message from queue
 * @returns {void}
 */
exports.processtask = async function(queueMessage) {
    let error = null;
    //check sent time over 30 seconds do not process.
    var sentDatetime = moment.unix(queueMessage.Attributes.SentTimestamp / 1000).utc();
    var now = moment().utc();
    const messageAge = now.unix() - sentDatetime.unix();
    if (messageAge < 30) {

        //DO STUFF

        await optoutapplicationtask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err) {
            error = err;
        });
        if (error) {
            log.error("Error optoutapplicationtask deleteTaskQueueItem " + error);
        }
        return;
    }
    else {
        log.info('removing old Opt Out Email Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if (error) {
            log.error("Error optoutapplicationtask deleteTaskQueueItem old " + error);
        }
        return;
    }
}

/**
 * Exposes optoutapplicationtask for testing
 *
 * @returns {void}
 */
exports.taskProcessorExternal = async function() {
    let error = null;
    await optoutapplicationtask().catch(err => error = err);
    if (error) {
        log.error('optoutapplicationtask external: ' + error);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */
var optoutapplicationtask = async function() {

    const oneHourAgo = moment().subtract(1, 'h');
    const twoHourAgo = moment().subtract(2, 'h');
    //get list....
    const appIdSQL = `
            SELECT DISTINCT
				a.id as 'applicationId' 
            FROM clw_talage_applications a
            WHERE a.agency_location  IS NOT NULL
                AND a.created BETWEEN  '${twoHourAgo.utc().format()}' AND '${oneHourAgo.utc().format()}'
                AND a.opted_out_online  = 1
                AND a.opted_out_online_emailsent  = 0
                AND a.state  < 13
    `;

    // log.debug(appIdSQL)

    let appIds = null;
    try {
        appIds = await db.query(appIdSQL);
        // log.debug('returned appIds');
        // log.debug(JSON.stringify(appIds));
    }
    catch (err) {
        log.error("optoutapplicationtask getting appid list error " + err);
        throw err;
    }
    //process list.....
    if (appIds && appIds.length > 0) {
        for (let i = 0; i < appIds.length; i++) {
            const appIdJson = appIds[i];
            log.debug(JSON.stringify(appIdJson.applicationId));

            let error = null
            let succesfulProcess = false;
            try {
                succesfulProcess = await processOptOutEmail(appIdJson.applicationId)
            }
            catch (err) {
                error = err;
                log.debug('catch error from await ' + err);
            }

            if (error === null && succesfulProcess === true) {
                await markApplicationProcess(appIdJson.applicationId).catch(function(err) {
                    log.error(`Error marking abandon quotes in DB for ${appIdJson.applicationId} error:  ${err}`);
                    error = err;
                })
            }
            if (error === null) {
                log.info(`Processed abandon quotes for appId: ${appIdJson.applicationId}`);
            }
        }
    }

    return;
}

var processOptOutEmail = async function(applicationId) {
    //get
    const appSQL = `
        SELECT
            a.agency_location AS agencyLocation,
            ag.agency_network,
            ag.email AS agencyEmail,
            al.agency,
            al.email AS agencyLocationEmail,
            al.phone AS agencyPhone,
            b.name AS businessName,
            c.email,
            c.fname,
            c.lname,
            c.phone,
            an.email_brand AS emailBrand
        FROM clw_talage_applications AS a
            LEFT JOIN clw_talage_businesses AS b ON b.id = a.business
            LEFT JOIN clw_talage_contacts AS c ON a.business = c.business
            LEFT JOIN clw_talage_agency_locations AS al ON a.agency_location = al.id
            LEFT JOIN clw_talage_agencies AS ag ON al.agency = ag.id
            LEFT JOIN clw_talage_agency_networks AS an ON ag.agency_network = an.id
        WHERE 
        a.id =  ${applicationId}
    `;

    let applications = null;
    try {
        applications = await db.query(appSQL);
    }
    catch (err) {
        log.error(`Error get opt out applications from DB for ${applicationId} error:  ${err}`);
        // Do not throw error other opt out may need to be processed.
        return false;
    }

    if (applications && applications.length > 0) {


        let agencyLocationEmail = null;

        //decrypt info...
        if (applications[0].agencyLocationEmail) {
            agencyLocationEmail = await crypt.decrypt(applications[0].agencyLocationEmail);
        }
        else if (applications[0].agencyEmail) {
            agencyLocationEmail = await crypt.decrypt(applications[0].agencyEmail);
        }

        applications[0].email = await crypt.decrypt(applications[0].email);
        applications[0].agencyPhone = await crypt.decrypt(applications[0].agencyPhone);
        applications[0].agencyWebsite = await crypt.decrypt(applications[0].agencyWebsite);


        let message = `A potential policyholder has requested that you reach out to help them through the process.<br/>
        <br/>
        We'll leave it too you from here!<br/>
        <br/>
        Contact Name: {{Contact Name}}<br/>
        Business Name: {{BusinessName}}<br/>
        Email: {{Contact Email}}<br/>
        Phone Number: {{Contact Phone}}<br/>
        <br/>
        Good luck!<br/>
        <br/>
        -the {{BrandName}} team<br/>`;
        let subject = "Incoming Contact from your {{BrandName}} Page!";

        // log.debug('Insured subject: ' + subject)
        // log.debug('Insured message: ' + message)

        applications[0].businessName = await crypt.decrypt(applications[0].businessName);
        applications[0].fname = await crypt.decrypt(applications[0].fname);
        applications[0].lname = await crypt.decrypt(applications[0].lname);
        applications[0].phone = await crypt.decrypt(applications[0].phone);

        // Format the full name and phone number
        const fullName = stringFunctions.ucwords(stringFunctions.strtolower(applications[0].fname) + ' ' + stringFunctions.strtolower(applications[0].lname));
        let phone = '';
        if (applications[0].phone) {
            phone = formatPhone(applications[0].phone);
        }

        //  // Perform content message.replacements
        message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(applications[0].emailBrand));
        message = message.replace(/{{BusinessName}}/g, applications[0].businessName);
        message = message.replace(/{{Contact Email}}/g, applications[0].email);
        message = message.replace(/{{Contact Name}}/g, fullName);
        message = message.replace(/{{Contact Phone}}/g, phone);
        message = message.replace(/{{BrandName}}/g, stringFunctions.ucwords(applications[0].emailBrand));

        //message = message.replace(/{{Industry}}/g, applications[0].industryCode);

        subject = subject.replace(/{{BrandName}}/g, stringFunctions.ucwords(applications[0].emailBrand));

        // Send the email
        const keyData2 = {
            'application': applicationId,
            'agency_location': applications[0].agencyLocation
        };
        if (agencyLocationEmail) {
            const emailResp = await email.send(agencyLocationEmail, subject, message, keyData2, applications[0].emailBrand);
            if (emailResp === false) {
                slack.send('#alerts', 'warning', `The system failed to inform an agency of the Opt Out Email for application ${applicationId}. Please follow-up manually.`);
            }
        }
        else {
            log.error("Opt Out Email no email address for data: " + JSON.stringify(keyData2) + __location);
        }

        return true;
    }
    else {
        return false;
    }

}

var markApplicationProcess = async function(applicationId) {

    const updateSQL = `UPDATE clw_talage_applications
	                   SET  opted_out_online_emailsent = 1 
	                   where id = ${applicationId} `;

    // Update application record
    await db.query(updateSQL).catch(function(e) {
        log.error('Opt Out Email flag update error: ' + e.message);
        throw e;
    });
}