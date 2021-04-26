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
    }
    // eslint-disable-next-line no-console
    console.log(colors.red(message));
}

function logErrorAndExit(message) {
    console.log(colors.red(message));
    process.exit(-1);
}

function logError(message) {
    console.log(colors.red(message));
}

function logWarning(message) {
    console.log(colors.yellow(message));
}

function logSuccess(message) {
    console.log(colors.green(message));
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
})();

async function runFunction() {
    const Quote = require('mongoose').model('Quote');

    let quotes = null;
    try {
        quotes = await Quote.find({});
    } catch (e) {
        logErrorAndExit(`Error retreiving list of quotes: ${e}. Exiting.`);
    }

    if (!quotes || quotes.length === 0) {
        logErrorAndExit(`No quotes retreived. Exiting.`);
    }

    logSuccess(`${quotes.length} Quotes found...`);

    let successes = 0;
    const oldCount = quotes.length;

    // walk over each quote, ignoring quotes that already have both quoteStatus elements
    quotes = quotes.filter(q => !q.quoteStatusDescription || !q.quoteStatusId);
    const newCount = quotes.length;

    if (oldCount !== newCount && newCount !== 0) {
        logWarning(`${oldCount - newCount} quotes already have quoteStatus information, skipping those quotes.`);
    } else if (newCount === 0) {
        logWarning(`All quotes have quoteStatus information. Exiting.`);
        process.exit(0);
    }

    for (const quote of quotes) {
        const status = getStatus(quote.aggregatedStatus);

        if (status) {
            const updateJSON = {
                quoteStatusId: status.id,
                quoteStatusDescription: status.description,
                updatedAt: new Date()
            };
            const query = { "quoteId": quote.quoteId };

            try {
                await Quote.updateOne(query, updateJSON);
                successes++;
            } catch (e) {
                logError(`Error updating quote ${quote.quoteId}: ${e}.`);
            }
        } else {
            logWarning(`Quote ${quote.quoteId} has an aggregatedStatus field that doesn't match expected values.`);
        }

        // status update every 100 records
        if (successes % 100 === 0 && successes !== 0) {
            console.log(`Successfully updated ${successes} out of ${quotes.length} records.`);
        }
    }

    if (successes === quotes.length) {
        logSuccess(`All ${quotes.length} quotes updated successfully!`);
    } else {
        const diff = quotes.length - successes;
        logWarning(`${diff} quotes were not properly updated. Check script output for more info.`);
    }

    process.exit(0);
}

function getStatus(aggregatedStatus) {
    switch (aggregatedStatus) {
        case 'bound':
            return quoteStatus.bound;
        case 'request_to_bind_referred':
            return quoteStatus.bind_requested_referred;
        case 'request_to_bind':
            return quoteStatus.bind_requested;
        case 'quoted':
            return quoteStatus.quoted;
        case 'quoted_referred':
            return quoteStatus.quoted_referred;
        case 'referred':
            return quoteStatus.referred;
        case 'acord_emailed':
            return quoteStatus.ACORDEmailed;
        case 'declined':
            return quoteStatus.declined;
        case 'error':
            return quoteStatus.error;
        default:
            if (!aggregatedStatus) {
                return quoteStatus.initiated;
            } else {
                logWarning(`Cannot get status from aggregate: ${aggregatedStatus}. No valid case match in switch.`);
                return null;
            }
    }
}