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
function logLocalErrorMessage(message) {
    if (global.log) {
        log.error("Global error trap: " + message);
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

async function runFunction() {
    const Quote = require('mongoose').model('Quote');

    let quotes = null;
    let query = {
        aggregatedStatus: {$exists: false},
        quoteStatusId: 0,
        mysqlId: {$exists: true, $lte: 17214}
    };
    try {
        quotes = await Quote.find(query);
    } catch (e) {
        logErrorAndExit(`Error retreiving list of quotes: ${e}. Exiting.`);
    }

    if (!quotes || quotes.length === 0) {
        logErrorAndExit(`No quotes retreived. Exiting.`);
    }

    log.debug(`${quotes.length} Quotes found...`);

    let successes = 0;
    for (const quote of quotes) {
        const status = getStatus(quote.apiResult, quote.bound);

        if (status) {
            const updateJSON = {
                quoteStatusId: status.id,
                quoteStatusDescription: status.description,
                updatedAt: new Date()
            };
            query = { "quoteId": quote.quoteId };

            try {
                await Quote.updateOne(query, updateJSON);
                successes++;
            } catch (e) {
                log.error(`Error updating quote ${quote.quoteId}: ${e}.`);
            }
        } else {
            log.warn(`Quote ${quote.quoteId} has an apiResult field that doesn't match expected values.`);
        }

        // status update every 100 records
        if (successes % 100 === 0 && successes !== 0) {
            log.debug(`Successfully updated ${successes} out of ${quotes.length} records.`);
        }
    }

    if (successes === quotes.length) {
        log.info(`All ${quotes.length} quotes updated successfully!`);
    } else {
        const diff = quotes.length - successes;
        log.warn(`${diff} quotes were not properly updated. Check script output for more info.`);
    }

    process.exit(0);
}

function getStatus(apiResult, bound) {
    if (bound) {
        return quoteStatus.bound;
    }

    switch (apiResult) {
        case "0":
        case "Initiated":
            return quoteStatus.initiated;
        case "acord_emailed":
            return quoteStatus.ACORDEmailed;
        case "autodeclined":
        case "autodeclined-1":
        case "autodeclined-2":
        case "autodeclined-3":
        case "autodeclined-4":
        case "declined":
            return quoteStatus.declined;
        case "error":
        case "outage":
            return quoteStatus.error;
        case "quoted":
            return quoteStatus.quoted;
        case "referred":
        case "referred_with_price":
            return quoteStatus.referred;
        default:
            if (!apiResult) {
                return quoteStatus.initiated;
            } else {
                log.warn(`Cannot get status from apiResult: ${apiResult}. No valid case match in switch.`);
                return null;
            }
    }
}


main();