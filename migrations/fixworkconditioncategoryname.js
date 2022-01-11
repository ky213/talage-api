
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
const fs = require('fs');

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
    console.log(colors.yellow('\nScript usage includes no optional params: node <path-to-script>/loadwcstateincomelimitsinmongo.js\n'));

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
    const QuestionModel = global.mongoose.Question;

    let successes = 0;
    let errors = 0;

    const query = {
        active: true,
        categoryName: "WorkCondidtions"
    };
    const queryProjection = {"__v": 0};

    let questionResults = null;
    try {
        questionResults = await QuestionModel.find(query, queryProjection);
    }
    catch (e) {
        logErrorAndExit(`An error occurred while grabbing Talage questions: ${e}. Exiting...`);
        process.exit(-1);
    }

    if (!questionResults) {
        logErrorAndExit(`No questions with 'categoryName: WorkCondidtions' were returned. Exiting...`);
        process.exit(0);
    }

    for (const questionResult of questionResults) {
        questionResult.categoryName = "WorkConditions";

        try {
            await questionResult.save();
            successes++;
        }
        catch (e) {
            logError(`An error occurred updating categoryName for question ${questionResult.talageQuestionId}: ${e}. Skipping...`);
            errors++;
        }
    }

    logDebug("=================================");
    logDebug(`Successful Updates ........ : ${successes}`);
    logDebug(`Failed Updates ............ : ${errors}`);
    logDebug("=================================");

    logInfo(`Script finished executing. Exiting...`);
    process.exit(0);
}
