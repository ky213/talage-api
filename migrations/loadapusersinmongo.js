/* eslint-disable no-lonely-if */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-process-exit */
/* eslint sort-keys: "off"*/

'use strict';

const moment = require('moment');

// Add global helpers to load shared modules
global.rootPath = require('path').join(__dirname, '..');
global.sharedPath = require('path').join(global.rootPath , '/shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var mongoose = global.requireRootPath('./mongoose.js');
const colors = require('colors');
const crypt = global.requireShared('./services/crypt.js');

const logger = global.requireShared('/services/logger.js');
const db = global.requireShared('/services/db.js');
const globalSettings = global.requireRootPath('./settings.js');

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logLocalErrorMessage(message) {
    if (global.log) {
        log.error("Global error trap: " + message);
    }
    // eslint-disable-next-line no-console
    console.log(colors.red(message));
}


/**
 * Main entrypoint
 *
 * @returns {void}
 */
async function main() {
    // eslint-disable-next-line no-console
    console.log(Date());
    // eslint-disable-next-line no-console
    console.log(colors.green.bold('-'.padEnd(80, '-')));
    // eslint-disable-next-line no-console
    console.log(colors.green.bold('Initializing'));
    // eslint-disable-next-line no-console
    console.log(colors.green.bold('-'.padEnd(80, '-')));
    // eslint-disable-next-line no-console
    console.log(Date());

    // Load the settings from a .env file - Settings are loaded first
    if (!globalSettings.load()) {
        logLocalErrorMessage('Error loading variables. Stopping.');
        return;
    }

    // Connect to the logger
    if (!logger.connect()) {
        logLocalErrorMessage('Error connecting to log. Stopping.');
        return;
    }

    // Connect to the database
    if (!await db.connect()) {
        logLocalErrorMessage('Error connecting to database. Stopping.');
        return;
    }

    // Load the database module and make it globally available
    global.db = global.requireShared('./services/db.js');


    // MONGO

    global.monogdb = mongoose();
    //var mongoose = require('./mongoose');

    //Mongo connect event
    var hasMongoMadeInitialConnected = false;
    talageEvent.on('mongo-connected', function() {
        //log.info('Assetws Mongoose connected to mongodb');
        if (hasMongoMadeInitialConnected === false) {
            hasMongoMadeInitialConnected = true;
            runFunction();
        }

    });

    talageEvent.on('mongo-disconnected', function() {
        log.warn('Mongoose disconnected');

    });

    talageEvent.on('mongo-error', function(err) {
        log.error('Mongoose database error ' + err);
    });


}

/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {

    const AgencyPortUserModel = require('mongoose').model('AgencyPortalUser');

    //load message model and get message list.
    const sql = `select * from clw_talage_agency_portal_users  `;

    let result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });
    log.debug("Got MySql AgencyPortUser - result.length - " + result.length);


    let updatedDocCount = 0;
    let newDocCount = 0;
    // eslint-disable-next-line array-element-newline
    for(let i = 0; i < result.length; i++){
        try {
            let agencyPortalUser = new AgencyPortUserModel(result[i]);

            agencyPortalUser.agencyPortalUserId = result[i].id;
            if(result[i].clear_email && result[i].clear_email.length > 0){
                agencyPortalUser.email = result[i].clear_email.toLowerCase();
            }
            else {
                try{
                    agencyPortalUser.email = await crypt.decrypt(result[i].email)
                    if(agencyPortalUser.email === result[i].email){
                        log.error(`did not decrypt email`);
                    }
                    agencyPortalUser.email = agencyPortalUser.email.toLowerCase();
                }
                catch(err){
                    log.debug(`Error decrypting user ${result[i].id} email `)
                }

            }
            agencyPortalUser.legalAcceptance = [];
            //get legal acceptance
            const sqlLA = `select * from clw_talage_legal_acceptances where agency_portal_user = ${result[i].id}`
            try {
                let resultLA = await db.query(sqlLA)
                if(resultLA && resultLA.length > 0){
                    // eslint-disable-next-line no-loop-func
                    resultLA.forEach((la) => {
                        if(!la.version){
                            la.version = 1;
                        }
                        const laJSON = {
                            ip: la.ip,
                            version: la.version,
                            acceptanceDate: moment(la.timestamp)
                        }
                        agencyPortalUser.legalAcceptance.push(laJSON);
                        agencyPortalUser.requiredLegalAcceptance = false;
                    })
                }
            }
            catch(err){
                log.debug(`Error Legal Acceptance user ${result[i].id} email `)
            }


            // Determine if existing doc
            // by insurerId,  code, sub
            const query = {agencyPortalUserId: result[i].id}
            const existingDoc = await AgencyPortUserModel.findOne(query);
            if(!existingDoc){
                await agencyPortalUser.save().catch(function(err) {
                    log.error('Mongo AgencyPortUserModel Save err ' + err + __location);
                    return false;
                });
                newDocCount++;
            }

            // if(PolicyType.insurerTerritoryQuestionList.length > 0){
            //     log.debug("has territoryquestions " + PolicyType.insurerActivityCodeId)
            // }
            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating AgencyPortUserModel List error " + err + __location);
            return false;
        }
    }

    log.debug("AgencyPortUserModel Import Done!");
    log.debug(`Updated AgencyPortUserModel: ${updatedDocCount}`);
    log.debug(`New AgencyPortUserModel: ${newDocCount}`);
    log.debug("Done!");
    process.exit(1);

}

main();