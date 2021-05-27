
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable no-lonely-if */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-process-exit */
/* eslint sort-keys: "off"*/

// Add global helpers to load shared modules
global.rootPath = require('path').join(__dirname, '..');
global.sharedPath = require('path').join(global.rootPath , '/shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('services/talageeventemitter.js');
global.requireShared('./helpers/tracker.js');

var mongoose = global.requireRootPath('./mongoose.js');
const colors = require('colors');

const logger = global.requireShared('/services/logger.js');
const globalSettings = global.requireRootPath('./settings.js');

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logError(message) {
    if (global.log) {
        log.error(message);
    }
    else{
        // eslint-disable-next-line no-console
        console.log(colors.red(message));
    }
}

function logInfo(message) {
    if (global.log) {
        log.info(message);
    }
    else{
        // eslint-disable-next-line no-console
        console.log(message);
    }
}

function logDebug(message) {
    if (global.log) {
        log.debug(message);
    }
    else{
        // eslint-disable-next-line no-console
        console.log(message);
    }
}

function logWarn(message) {
    if (global.log) {
        log.warn(message);
    }
    else{
        // eslint-disable-next-line no-console
        console.log(colors.yellow(message));
    }
}

function logErrorAndExit(message) {
    if (global.log) {
        log.error(message);
    }

    // eslint-disable-next-line no-console
    console.log(colors.red(message));

    process.exit(-1);
}


/**
 * Main entrypoint
 *
 * @returns {void}
 */
(async function main() {
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
    console.log(colors.yellow('\nScript usage includes no optional params: node <path-to-script>/updatequotestatusfromaggregate.js\n'));

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
})();

async function runFunction() {
    const WCStateIncomeLimitModel = require('mongoose').model('WCStateIncomeLimits');
    const wcStateIncomeLimitsData = require('./data/WCStateIncomeLimits.json');
    for (const wcStateIncomeLimit of wcStateIncomeLimitsData) {
        let found = null;
        const query = {
            state: wcStateIncomeLimit.state,
            entityType: wcStateIncomeLimit.entityType
        };
        try{
            found = await WCStateIncomeLimitModel.findOne(query);
        }
        catch (err) {
            logError(`Error when searching for wcStateIncomeLimit in the mongo database: ${err}`);
            continue;
        }

        if (found) {
            continue;
        }

        const newWCStateIncomeLimit = new WCStateIncomeLimitModel(wcStateIncomeLimit);
        try {
            await newWCStateIncomeLimit.save();
        }
        catch (err) {
            logError(`Error occurred when saving newWCStateIncomeLimit to mongodb: ${err}`)
            logError(`  State: ${newWCStateIncomeLimit.state}, Entity Type: ${newWCStateIncomeLimit.entityType}`);
        }
        process.exit(-1);
    }
}