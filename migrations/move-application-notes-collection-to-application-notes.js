/* eslint-disable no-console */
/* eslint-disable no-process-exit */
/* eslint sort-keys: "off"*/

// Add global helpers to load shared modules
global.rootPath = require('path').join(__dirname, '..');
global.sharedPath = require('path').join(global.rootPath , '/shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
global.requireShared('./helpers/tracker.js');
const cliProgress = require('cli-progress');

const logger = global.requireShared('/services/logger.js');
const globalSettings = global.requireRootPath('./settings.js');
const colors = require('colors');

const mongoose = require('../mongoose');

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

/**
 * Convert each row in applicationnotescollections into a row in the brand new
 * applicationnotes collection.
 *
 * @returns {void}
 */
async function main() {
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

    await mongoose.init();
    log.info(`Starting migration`)

    const rows = await global.mongodb.collection('applicationnotescollections').find();
    const p = [];
    await rows.forEach(async (r) => {
        p.push(global.mongodb.collection('applicationnotes').insertOne({
            applicationId: r.applicationId,
            noteContents: r.applicationNotesJSON,
            updatedAt: r.updatedAt,
            createdAt: r.createdAt
        }));
    })
    await Promise.all(p);

    console.log('Done!');
    process.exit(0);
}

main().catch(err => {
    console.log(err);
    process.exit(0);
});