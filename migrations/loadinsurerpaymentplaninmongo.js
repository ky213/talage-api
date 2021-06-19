/* eslint-disable no-lonely-if */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-process-exit */
/* eslint sort-keys: "off"*/

'use strict';

const moment = require('moment');
const moment_timezone = require('moment-timezone');
const clonedeep = require('lodash.clonedeep');

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

    //const InsurerModel = global.requireShared('./models/mongoose/Insurer.model');
    const InsurerModel = require('mongoose').model('Insurer');
    const query = {};
    const queryProjection = {"__v": 0};
    const insurerList = await InsurerModel.find(query, queryProjection);
    let insurerCount = 0;
    for (const insurerDoc of insurerList){

        //load message model and get message list.
        const sql = `select * from clw_talage_insurer_payment_plans  where insurer = ${insurerDoc.insurerId} `;

        let result = await db.query(sql).catch(function(error) {
            // Check if this was
            log.error("error " + error);
            return false;
        });
        // eslint-disable-next-line array-element-newline
        insurerDoc.paymentPlans = [];
        for(let i = 0; i < result.length; i++){
            try {
                const paymentPlanJSON = {
                    payment_plan: result[i].payment_plan,
                    premium_threshold: result[i].premium_threshold
                }
                insurerDoc.paymentPlans.push(paymentPlanJSON)
            }
            catch(err){
                log.error("Updating Insurer paymentplans error " + err + __location);
                return false;
            }
        }
        await insurerDoc.save();
        insurerCount++;
        if((insurerCount) % 10 === 0){
            log.debug(`processed ${insurerCount} of ${insurerList.length} `)
        }
    }

    log.debug("Done!");
    process.exit(1);

}

main();