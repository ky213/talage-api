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
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('/services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const crypt = global.requireShared('./services/crypt.js');


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


    // local development of tasks run one of the task.

    //load message model and get message list.
    const QuoteBO = global.requireShared('./models/Quote-BO.js');
    const quoteBO = new QuoteBO()
    //var Quote = require('mongoose').model('Quote');
    let quoteList = null
    try{
        const sql = "select id, quote_letter from clw_talage_quotes where quote_letter is not null ";
        quoteList = await db.query(sql);
    }
    catch(err){
        log.error("get quotes " + err + __location);
    }
    // log.debug("quoteList: " + JSON.stringify(quoteList));
    if(quoteList && quoteList.length > 0){
        for(let i = 0; i < quoteList.length; i++){
            const quoteMySql = quoteList[i];
            if(quoteMySql.quote_letter){
                //
                try{
                    const quoteDoc = await quoteBO.getMongoDocbyMysqlId(quoteMySql.id)
                    if(quoteDoc && quoteDoc.quoteId && !quoteDoc.quoteLetter){
                        let updateQuoteLetterJson = {"quoteLetter": quoteMySql.quote_letter}
                        await quoteBO.updateMongo(quoteDoc.quoteId, updateQuoteLetterJson);
                        log.debug(`Updated quote id  ${quoteMySql.id}`);
                    }

                    //updateMonod
                }
                catch(err){
                    log.error(`Error processing quote id  ${quoteMySql.id}` + err + __location)
                }
            }
            log.debug(`processed ${i + 1} of ${quoteList.length}`)
        }
    }
    log.debug("Done!");
    process.exit(1);

}

main();