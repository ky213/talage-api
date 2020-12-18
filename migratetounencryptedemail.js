/* eslint-disable no-process-exit */
'use strict';

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);

const colors = require('colors');
const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');
const globalSettings = require('./settings.js');
const version = require('./version.js');
const mongoose = require('./mongoose');
const talageEvent = require('./shared/services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
global.tracker = tracker;

function logErrorAndExit(message){
    // eslint-disable-next-line no-console
    console.log(colors.red(message));
    process.exit(-1);
}

function logError(message){
    // eslint-disable-next-line no-console
    console.log(colors.red(message));
}

function logStatus(message){
    // eslint-disable-next-line no-console
    console.log(colors.yellow(message));
}

function logSuccess(message){
    // eslint-disable-next-line no-console
    console.log(colors.green(message));
}

/**
 * Main entrypoint
 *
 * @returns {void}
 */
async function main(){

    logSuccess('\n');
    logSuccess("============================================================================================");
    logSuccess(`Storing decrypted emails in a new column clear_email on the clw_talage_agency_portal_users table`);
    logSuccess("============================================================================================");
    logSuccess('\n');

    // Load the settings from a .env file - Settings are loaded first
    if(!globalSettings.load()){
        logErrorAndExit('Error loading variables. Stopping.');
    }

    // Initialize the version
    if(!await version.load()){
        logErrorAndExit('Error initializing version. Stopping.');
    }

    // Connect to the logger
    if(!logger.connect()){
        logErrorAndExit('Error connecting to logger. Stopping.');
    }

    // Connect to the database
    if(!await db.connect()){
        logErrorAndExit('Error connecting to database. Stopping.');
    }

    // Load the database module and make it globally available
    global.db = global.requireShared('./services/db.js');

    mongoose();

    //Mongo connect event
    var mongoInitiated = false;
    talageEvent.on('mongo-connected', function() {
        if (!mongoInitiated) {
            mongoInitiated = true;
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

async function runFunction() {
    logSuccess(`Starting Migration\n`);

    const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
    const agencyPortalUserBO = new AgencyPortalUserBO();

    logSuccess(`Adding new clear_email column\n`);

    // first, add the new column
    try {
        const sql = `
            ALTER TABLE clw_talage_agency_portal_users
            ADD \`clear_email\` varchar(255)
            AFTER email
        `;
        await db.query(sql);
    } catch (e) {
        if (e.code && e.code === "ER_DUP_FIELDNAME") {
            logStatus(`Column clear_email already exists on clw_talage_agency_portal_users. Continuing...`);
        } else {
            logErrorAndExit(`Could not add column clear_email to clw_talage_agency_portal_users: ${e}. Stopping.`)
        }
    }

    // get all the portal users (decrypted)
    const usersDecrypted = await agencyPortalUserBO.getList({}, false, true);

    if (!usersDecrypted) {
        logErrorAndExit(`Failed to get list of agency portal users. Stopping.`);
    }

    logSuccess(`Processing user records and updating records with decrypted email\n`);

    // insert the decrypted email into the clear_email column
    for (const user of usersDecrypted) {
        try {
            const sql = `
                UPDATE clw_talage_agency_portal_users
                SET \`clear_email\` = "${user.email}"
                WHERE \`id\` = ${user.id}
            `;

            await db.query(sql);
        } catch (e) {
            logError(`Could not add decrypted email to clear_email column for user ${user.id}: ${e}. Continuing...`);
        }
    }

    logSuccess(`========================================\n`);
    logSuccess(`Successfully migrated encrypted emails to clear text.`);
    logSuccess(`Note: Old encrypted email data is preserved in the new \`email_old\` column in the clw_talage_agency_portal_users table.`);
}

main();