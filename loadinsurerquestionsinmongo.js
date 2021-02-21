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


//mapping function
function mapToMongooseJSON(sourceJSON, targetJSON, propMappings){
    for(const sourceProp in sourceJSON){
        //if(typeof sourceJSON[sourceProp] !== "object"){
        if(propMappings[sourceProp]){
            const appProp = propMappings[sourceProp]
            targetJSON[appProp] = sourceJSON[sourceProp];
        }
        else {
            //check if snake_case
            // if(sourceProp.isSnakeCase()){
            //     targetJSON[sourceProp.toCamelCase()] = sourceJSON[sourceProp];
            // }
            // else {
            targetJSON[sourceProp] = sourceJSON[sourceProp];
            // }
        }

        // }
    }
}

function stringArraytoArray(dbString){
    if(typeof dbString === 'object'){
        return dbString;
    }
    else if(dbString && typeof dbString === 'string'){
        return dbString.split(',')
    }
    else if(dbString){
        log.debug(`dbstring type ${typeof dbString}`)
        log.debug(`dbstring  ${dbString}`)
        return [];
    }
    else {
        return [];
    }
}

/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {

    const InsurerQuestionModel = require('mongoose').model('InsurerQuestion');
    //load message model and get message list.
    const sql = `select iq.id as 'systemId',
        iq.question as talageQuestionId,
        iq.insurer as insurerId,
        iq.policy_type as 'policyType',
        iq.universal,
        iq.text,
        iq.identifier,
        iq.created as 'createdAt',
        iq.modified as 'updatedAt',
        iq.questionSubjectArea,
        iq.effectiveDate,
        iq.expirationDate,
        GROUP_CONCAT(DISTINCT t.territory) AS territoryList
        from clw_talage_insurer_questions AS iq
        left join clw_talage_insurer_question_territories t on iq.id = t.insurer_question
        group by iq.id;`;

    const result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error");
        process.exit(1);
    });
    log.debug("Got MySql insurerQuestions - result.length - " + result.length);
    for(let i = 0; i < result.length; i++){
        try {
            result[i].territoryList = stringArraytoArray(result[i].territoryList);
            if(result[i].attributes){
                result[i].attributes = JSON.parse(result[i].attributes)
            }
            let insurerQuestion = new InsurerQuestionModel(result[i]);
            await insurerQuestion.save().catch(function(err) {
                log.error('Mongo insurerQuestions Save err ' + err + __location);
                process.exit(1);
            });
            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating insurerQuestions List error " + err + __location);
            process.exit(1);
        }
    }
    log.debug("Done!");
    process.exit(1);

}

main();