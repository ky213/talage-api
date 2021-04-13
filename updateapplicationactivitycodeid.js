/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable no-lonely-if */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-process-exit */
/* eslint sort-keys: "off"*/

'use strict';


// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('/services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const questionMigrationSvc = global.requireShared('/services/questionmigrationsvc.js');


var mongoose = require('./mongoose');
const colors = require('colors');


const logger = global.requireShared('/services/logger.js');
const db = global.requireShared('/services/db.js');
const globalSettings = require('./settings.js');
const {debug} = require('request');


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

    console.log(colors.yellow('\nScript usage includes optional param insurerId: node <path-to-script>/loadinsurerquestionsinmongo.js <insurerId>\n'));

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

    //get all agencyLocations

    const ApplicationBO = global.requireShared('models/Application-BO.js');
    const applicationBO = new ApplicationBO();
    const ApplicationMongooseModel = require('mongoose').model('Application');


    //get agencyLocation's application
    const query = {};
    let queryProjection = {applicationId: 1};
    var queryOptions = {lean:true};
    const appList = await ApplicationMongooseModel.find(query, queryProjection, queryOptions);

    const appListLength = appList.length;
    let currentAppCount = 0;

    for(const app of appList){
        currentAppCount++;
        try {
            const queryApp = {applicationId: app.applicationId}
            const appDoc = await ApplicationMongooseModel.findOne(queryApp);
            if(appDoc){
                //loop activityCodes
                appDoc.activityCodes.forEach((activityCode) => {
                    activityCode.activityCodeId = activityCode.ncciCode;
                });
                //loop locations
                appDoc.locations.forEach((location) => {
                    location.activityPayrollList.forEach((activityPayroll) => {
                        activityPayroll.activityCodeId = activityPayroll.ncciCode;
                    });
                });
                //save
                await appDoc.save();
            }
        }
        catch (err) {
            log.error(`Getting Application ${app.applicationId} error ` + err + __location);

        }
        if(currentAppCount % 100 === 0){
            log.debug(`processed ${currentAppCount} of ${appListLength}`)
        }
    }
    log.debug("Done!");
    process.exit(0);
}

main();