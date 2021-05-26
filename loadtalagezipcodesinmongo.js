/* eslint-disable object-curly-spacing */
/* eslint-disable brace-style */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable no-lonely-if */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-process-exit */
/* eslint sort-keys: "off"*/


// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('/services/talageeventemitter.js');
global.requireShared('./helpers/tracker.js');
const { quoteStatus } = global.requireShared('./models/status/quoteStatus.js');

var mongoose = require('./mongoose');
const colors = require('colors');

const logger = global.requireShared('/services/logger.js');
const db = global.requireShared('/services/db.js');
const globalSettings = require('./settings.js');

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logError(message) {
    if (global.log) {
        log.error(message);
    } else {
        // eslint-disable-next-line no-console
        console.log(colors.red(message));
    }
}

function logErrorAndExit(message) {
    if (global.log) {
        log.error(message);
    } else {
        // eslint-disable-next-line no-console
        console.log(colors.red(message));
    }

    process.exit(-1);
}

function logWarning(message) {
    if (global.log) {
        log.warn(message);
    } else {
        // eslint-disable-next-line no-console
        console.log(colors.yellow(message));
    }
}

function logDebug(message) {
    if (global.log) {
        log.debug(message);
    } else {
        // eslint-disable-next-line no-console
        console.log(message);
    }
}

function logInfo(message) {
    if (global.log) {
        log.info(message);
    } else {
        // eslint-disable-next-line no-console
        console.log(message);
    }
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

    // eslint-disable-next-line no-console
    console.log(colors.yellow('\nScript usage includes no optional params: node <path-to-script>/updatequotestatusfromapiresult.js\n'));

    // Load the settings from a .env file - Settings are loaded first
    if (!globalSettings.load()) {
        logError('Error loading variables. Stopping.');
        return;
    }

    // Connect to the logger
    if (!logger.connect()) {
        logError('Error connecting to log. Stopping.');
        return;
    }

    // Connect to the database
    if (!await db.connect()) {
        logError('Error connecting to database. Stopping.');
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
        logWarning('Mongoose disconnected');
    });

    talageEvent.on('mongo-error', function(err) {
        logError('Mongoose database error ' + err);
    });
}

async function runFunction() {
    const ZipCodeModel = require('mongoose').model('ZipCode');

    const sql = `
        SELECT * 
        FROM clw_talage_zip_codes
    `;

    let zipCodes = null;
    try {
        zipCodes = db.query(sql);
    } catch (e) {
        logErrorAndExit(`Error retreiving list of zip codes from SQL: ${e}. Exiting.`);
    }

    if (!zipCodes || zipCodes.length === 0) {
        logErrorAndExit(`No zip codes were returned. Exiting.`);
    }

    for (const zipCodeSQL of zipCodes) {
        const zipCodeMongo = {
            zipCode: zipCodeSQL.zip,
            type: zipCodeSQL.type,
            city: zipCodeSQL.city,
            state: zipCodeSQL.territory,
            county: zipCodeSQL.county
        };

        const zipCode = ZipCodeModel(zipCodeMongo);

        console.log(JSON.stringify(zipCode, null, 4));
        process.exit(-1);
    }

    process.exit(0);
}

main();