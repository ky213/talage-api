'use strict';

const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');

/**
 * DailyDigest Task processor
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

        await dailyDigestTask().catch(err => error = err);
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(function(err){
            error = err;
        });
        if(error){
            log.error("Error daily digest deleteTaskQueueItem " + error + __location);
        }
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle);

        return;
    }
    else {
        log.debug('removing old daily digest Message from queue');
        await global.queueHandler.deleteTaskQueueItem(queueMessage.ReceiptHandle).catch(err => error = err)
        if(error){
            log.error("Error daily digest deleteTaskQueueItem old " + error + __location);
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
    await dailyDigestTask().catch(err => error = err);
    if(error){
        log.error('dailyDigestTask external: ' + error + __location);
    }
    return;
}

var dailyDigestTask = async function(){

    const yesterdayBegin = moment.tz("America/Los_Angeles").subtract(1,'d').startOf('day');
    const yesterdayEnd = moment.tz("America/Los_Angeles").subtract(1,'d').endOf('day');

    // SQLAgency locations
    const alSQL = `
    SELECT
        al.id alid,
        al.agency,
        al.email AS agencyLocationEmail,
        ag.email AS agencyEmail,
        an.name AS agencyNetorkName,
        an.id as agency_network,
        an.email_brand AS emailBrand
    FROM clw_talage_agency_locations AS al
        INNER JOIN clw_talage_agencies AS ag ON al.agency = ag.id
        INNER JOIN clw_talage_agency_networks AS an ON ag.agency_network = an.id
    WHERE 
        al.state = 1
    `;

    let alDBJSON = null;

    alDBJSON = await db.query(alSQL).catch(function(err){
        log.error(`Error get agency location list from DB. error:  ${err}` + __location);
        return false;
    });

    // Loop locations
    if(alDBJSON && alDBJSON.length > 0){
        for(let i = 0; i < alDBJSON.length; i++){
            const agencyLocationDB = alDBJSON[i];
            // process each agency location. make sure we have a good record
            if(agencyLocationDB && agencyLocationDB.alid && agencyLocationDB.agency_network && (agencyLocationDB.agencyLocationEmail || agencyLocationDB.agencyEmail)){
                await processAgencyLocation(agencyLocationDB, yesterdayBegin, yesterdayEnd).catch(function(err){
                    log.error("Error Agency Location Daily Digest error. AL: " + JSON.stringify(agencyLocationDB) + " error: " + err + __location);
                })
            }
            else {
                log.error("Bad Agency Location record Daily Digest. AL: " + JSON.stringify(alDBJSON[i]) + __location);
            }
        }
    }

    return;
}

/**
 * Exposes processAgencyLocation for testing
 *
 * @param {string} agencyLocationDB - from db query not full object.
 * @returns {void}
 */

var processAgencyLocation = async function(agencyLocationDB, yesterdayBegin, yesterdayEnd){

    if(!agencyLocationDB.agency_network){
        log.error(`Error DailyDigests Agency Location agency_network not set for Agency Location: ${agencyLocationDB.alid}` + __location);
        return false;
    }
    const agencyNetwork = agencyLocationDB.agency_network;

    // SQL for agencylocation's applications
    const appSQL = `
            SELECT
            b.name AS businessName,
            c.email,
            c.fname,
            c.lname,
            c.phone,
            a.wholesale,
            a.solepro
        FROM clw_talage_applications AS a
            LEFT JOIN clw_talage_businesses AS b ON b.id = a.business
            LEFT JOIN clw_talage_contacts AS c ON a.business = c.business
        WHERE 
        a.agency_location = ${agencyLocationDB.alid}
        AND a.created BETWEEN  '${yesterdayBegin.utc().format()}' AND '${yesterdayEnd.utc().format()}'
    `;

    let appDBJSON = null;

    appDBJSON = await db.query(appSQL).catch(function(err){
        log.error(`Error get DailyDigests Agency Location applications from DB for ${agencyLocationDB.alid} error:  ${err}` + __location);
        return false;
    });
    let appCount = 0;
    if(appDBJSON && appDBJSON.length > 0){

        let error = null;
        const agencyNetworkBO = new AgencyNetworkBO();
        const emailContentJSON = await agencyNetworkBO.getEmailContent(agencyLocationDB.agency_network, "daily_digest").catch(function(err){
            log.error(`Unable to get email content for Daily Digest. agency_network: ${db.escape(agencyLocationDB.agency_network)}.  error: ${err}` + __location);
            error = true;
        });
        if(error){
            return false;
        }

        if(emailContentJSON && emailContentJSON.message){

            let message = emailContentJSON.message;
            let subject = emailContentJSON.subject;

            if(!message){
                log.error(`Daily Digest email content creation error: no message. agency_network: ${db.escape(agencyLocationDB.agency_network)}.` + __location);
                return false;
            }
            if(!subject){
                log.error(`Daily Digest email content creation error: no subject. agency_network: ${db.escape(agencyLocationDB.agency_network)}.` + __location);
                return false;
            }
            // Link setup.
            const portalLink = agencyNetwork === 1 ? global.settings.PORTAL_URL : global.settings.DIGALENT_AGENTS_URL;

            let applicationList = '<br><table border="1" cellspacing="0" cellpadding="4" width="100%"><thead><tr><th>Business Name</th><th>Contact Name</th><th>Contact Email</th><th>Contact Phone</th><th>Wholesale</th></tr></thead><tbody>';

            appCount = appDBJSON.length;
            for(let i = 0; i < appDBJSON.length; i++){
                const appDB = appDBJSON[i];
                // eslint-disable-next-line prefer-const
                let app = {};
                app.name = stringFunctions.ucwords(await crypt.decrypt(appDB.businessName));
                app.fname = stringFunctions.ucwords(await crypt.decrypt(appDB.fname));
                app.lname = stringFunctions.ucwords(await crypt.decrypt(appDB.lname));
                app.email = await crypt.decrypt(appDB.email);
                app.phone = await crypt.decrypt(appDB.phone);
                app.phone = formatPhone(app.phone);

                let wholesale = appDB.wholesale > 0 ? "Talage" : "";
                if(appDB.solepro === 1){
                    wholesale = "SolePro"
                }

                applicationList += '<tr><td>' + app.name + '</td><td>' + app.fname + ' ' + app.lname + '</td><td>' + app.email + '</td><td>' + app.phone + '</td><td>' + wholesale + '</td></tr>';
            }

            applicationList += '</tbody></table><br>';

            try{
                message = message.replace(/{{Application List}}/g, applicationList);
                message = message.replace(/{{Agency Portal Link}}/g, `<a href="${portalLink}" rel="noopener noreferrer" target="_blank">Agency Portal</a>`);
                message = message.replace(/{{Brand}}/g, stringFunctions.ucwords(agencyLocationDB.emailBrand));
                message = message.replace(/{{Number of Users}}/g, appCount + ' ' + (appCount > 1 ? 'users' : 'user'));
                subject = subject.replace(/{{Brand}}/g, stringFunctions.ucwords(agencyLocationDB.emailBrand), subject);
            }
            catch(e){
                log.error(`Daily Digest email content creation error: ${e}` + __location);
                return false;
            }

            let agencyLocationEmail = null;

            if(agencyLocationDB.agencyLocationEmail){
                agencyLocationEmail = await crypt.decrypt(agencyLocationDB.agencyLocationEmail);
            }
            else if(agencyLocationDB.agencyEmail){
                agencyLocationEmail = await crypt.decrypt(agencyLocationDB.agencyEmail);
            }


            if(agencyLocationEmail){
                const keyData = {'agency_location': agencyLocationDB.alid};
                // send email
                const emailResp = await emailSvc.send(agencyLocationEmail, subject, message, keyData, agencyLocationDB.emailBrand);
                if(emailResp === false){
                    slack.send('#alerts', 'warning',`The system failed to send daily digest email for Agency Location  #${agencyLocationDB.alid}.`);
                }
            }
            else {
                log.error("Dailydigest no email address for AgencyLocation: " + JSON.stringify(agencyLocationDB) + __location);
            }

        }
        else {
            log.error(`DB Error Unable to get email content for Daily Digest. agency_network: ${db.escape(agencyLocationDB.agency_network)}.` + __location);
            return false;
        }
    }
    else {
        log.info(`DailyDigest: No Activity for Agency Location: ${db.escape(agencyLocationDB.alid)}.`)
    }
    return true;
}