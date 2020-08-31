'use strict';

const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');

/**
 * Task processor
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

        // Inspect JSON for applicationId
        if (queueMessage.body && queueMessage.body.applicationId) {
            await sendEmodEmail(queueMessage.body.applicationId).catch(err => error = err);
        }
        else {
            log.error("Error sendEmodEmail missing applicationId " + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err) {
            error = err;
        });
        if (error) {
            log.error("Error sendEmodEmail deleteTaskQueueItem " + error);
        }
        return;
    }
    else {
        log.info('removing old sendEmodEmail Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if (error) {
            log.error("Error sendEmodEmail deleteTaskQueueItem old " + error);
        }
        return;
    }
}

/**
 * sendEmodEmail: Send an email to insurer about business' E Mod rating issue.
 * @param {string} applicationId - applicationId
 * @param {string} quoteId - quoteId
 * @returns {void}
 */
exports.sendEmodEmail = async function(applicationId) {
    let error = null;
    await sendEmodEmail(applicationId).catch(err => error = err);
    if (error) {
        log.error('sendEmodEmail external: ' + error);
    }
    return;
}

/**
 * task processor
 *
 * @returns {void}
 */

const sendEmodEmail = async function(applicationId) {
    if (applicationId) {

        // filter out wholesale apps.
        // NEED insurer, codes
        const appSQL = `
            SELECT
                a.id,
                a.agency_location AS agencyLocation,
                al.phone as agencyLocationPhone,
                ag.id as agencyId,
                ag.email AS agencyEmail,
                ag.name AS agencyName,
                ag.agency_network,
                al.email AS agencyLocationEmail,
                c.email,
                c.fname,
                c.lname,
                c.phone,
                a.state,
                b.name as businessName,
                b.mailing_zip,
                q.id as quoteId,
                q.number as quoteNumber,
                q.api_result,
                q.amount,
                i.agent_login,
                i.name as insurer_name,
                i.logo as insurer_logo,
                ic.description as codeDescription,
                t.name AS territory_state
            FROM clw_talage_applications AS a
                INNER JOIN clw_talage_quotes AS q ON a.id = q.application
                INNER JOIN clw_talage_agency_locations AS al ON a.agency_location = al.id
                INNER JOIN clw_talage_agencies AS ag ON al.agency = ag.id
                INNER JOIN clw_talage_industry_codes AS ic  ON ic.id = a.industry_code
                INNER JOIN clw_talage_insurers AS i  ON i.id = q.insurer
                INNER JOIN clw_talage_businesses AS b ON b.id = a.business
                INNER JOIN clw_talage_contacts AS c ON a.business = c.business
                INNER JOIN clw_talage_zip_codes AS z ON b.mailing_zip = z.zip
                INNER JOIN clw_talage_territories AS t ON z.territory = t.abbr
            WHERE 
            a.id = ${applicationId}
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
            //Get AgencyNetworkBO settings
            let error = null;
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkEnvSettings = await agencyNetworkBO.getEnvSettingbyId(applications[0].agency_network).catch(function(err){
                log.error(`Unable to get env settings for New Agency Portal User. agency_network: ${applications[0].agency_network}.  error: ${err}` + __location);
                error = true;
            });
            if(error){
                return false;
            }
            if(!agencyNetworkEnvSettings || !agencyNetworkEnvSettings.PORTAL_URL){
                log.error(`Unable to get env settings for New Agency Portal User. agency_network: ${applications[0].agency_network}.  missing additionalInfo ` + __location);
                return false;
            }

            // decrypt info...
            if (applications[0].agencyLocationEmail) {
                agencyLocationEmail = await crypt.decrypt(applications[0].agencyLocationEmail);
            }
            else if (applications[0].agencyEmail) {
                agencyLocationEmail = await crypt.decrypt(applications[0].agencyEmail);
            }

            // decrypt necessary application fields
            applications[0].email = await crypt.decrypt(applications[0].email);
            applications[0].phone = await crypt.decrypt(applications[0].phone);
            applications[0].fname = await crypt.decrypt(applications[0].fname);
            applications[0].lname = await crypt.decrypt(applications[0].lname);
            applications[0].businessName = await crypt.decrypt(applications[0].businessName);
            applications[0].agencyEmail = await crypt.decrypt(applications[0].agencyEmail);

            // Get AgencyNetwork's portal url
            const portalLink = agencyNetworkEnvSettings.PORTAL_URL;

            let message = `
                <p>{{Business Owner}} tried to get a quote in {{STATE}} but they were declined due to E-Mod rating issues. The quote is in your E-Link portal, and can be accessed by you and potentially still be bound, but you will have to verify the E-Mod information.</p>
                <ul>
                <li><b>Business Name</b>: {{Business Name}}</li>
                <li><b>Quote Number</b>: {{Quote Number}}</li>
                <li><b>Contact Name</b>: {{Contact Name}}</li>
                <li><b>Contact Email</b>: {{Contact Email}}</li>
                <li><b>Contact Phone</b>: {{Contact Phone}}</li>
                </ul>
                <p>You can see more details on this application in your {{Agency Portal}}.</p>
                <p>-The {{Brand}} team</p>
            `;
            const subject = "New Customer Tried to Get a Quote but Encountered an Issue with their E-Mod";

            let customerPhone = '';
            if (applications[0].phone) {
                customerPhone = formatPhone(applications[0].phone);
            }

            const fullName = stringFunctions.ucwords(stringFunctions.strtolower(applications[0].fname) + ' ' + stringFunctions.strtolower(applications[0].lname));

            // replace fields in template w/ actual values
            message = message.replace(/{{Business Owner}}/g, fullName);
            message = message.replace(/{{Business Name}}/g, applications[0].businessName);
            message = message.replace(/{{Quote Number}}/g, applications[0].quoteId);
            message = message.replace(/{{Contact Email}}/g, applications[0].email);
            message = message.replace(/{{Contact Name}}/g, fullName);
            message = message.replace(/{{Contact Phone}}/g, customerPhone);
            message = message.replace(/{{Agency Portal}}/g, `<a href=\"${portalLink}\" rel=\"noopener noreferrer\" target=\"_blank\">Agency Portal</a>`);
            message = message.replace(/{{STATE}}/g, applications[0].territory_state);

            message = message.replace(/{{Brand}}/g, applications[0].emailBrand);

            const keyData = {
                'application': applicationId,
                'agency_location': applications[0].agencyLocation
            };

            // Send the email
            if (agencyLocationEmail) {
                const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData, applications[0].agency_network,"");
                if (emailResp === false) {
                    slack.send('#alerts', 'warning', `The system failed to inform an agency of the sendEmodEmail for application ${applicationId}. Please follow-up manually.`);
                }
            }
            else {
                log.error("sendEmodEmail no email address for data: " + JSON.stringify(keyData) + __location);
            }
            return true;
        }
        else {
            log.error('sendEmodEmail No application quotes pulled from database applicationId : ' + applicationId + "  SQL: \n" + appSQL + '\n' + __location);
            return false;
        }
    }
    else {
        log.error('sendEmodEmail missing applicationId: ' + applicationId + " " + __location);
        return false;
    }

}