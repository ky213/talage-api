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

async function insurerCodeTerritoryQuestions(insurerActivityCodeIdList, territory){
    if(insurerActivityCodeIdList && insurerActivityCodeIdList.length > 0){
        const sql = `SELECT distinct iq.id as insurerQuestionId
                    FROM clw_talage_insurer_ncci_code_questions AS ncq
                    INNER JOIN clw_talage_insurer_questions AS iq ON ncq.question = iq.question
                    WHERE ncq.ncci_code in (${insurerActivityCodeIdList}) ;`;

        let result = await db.query(sql).catch(function(error) {
            // Check if this was
            log.error("error " + error);
            process.exit(1);
        });
        if(result && result.length > 0){
            let territoryQuestionArray = [];
            for(let i = 0; i < result.length; i++){
                if(result[i].insurerQuestionId){
                    territoryQuestionArray.push(result[i].insurerQuestionId)
                }
            }
            if(territoryQuestionArray.length > 0){
                const territoryQuestionJSON = {
                    territory: territory,
                    insurerQuestionIdList: territoryQuestionArray
                };
                //log.debug("returning " + JSON.stringify(territoryQuestionJSON))
                return territoryQuestionJSON
            }
            else {
                return null;
            }

        }
        // else {
        //     log.debug("no questions  returned " + sql)
        //     return null;
        // }

    }
    else {
        log.debug("empty insurerActivityCodeIdList")
        return null
    }
}


/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {

    const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
    //load message model and get message list.
    const sql = `SELECT  inc.insurer as 'insurerId',inc.code,inc.sub,inc.description
                    ,inc.attributes ,inc.effectiveDate ,inc.expirationDate 
                    ,GROUP_CONCAT(DISTINCT territory) AS territoryList
                    ,GROUP_CONCAT(DISTINCT nca.code) AS talageActivityCodeIdList
                    ,GROUP_CONCAT(DISTINCT inc.id) AS insurerActivityCodeIdList
                FROM clw_talage_insurer_ncci_codes inc
	                left join clw_talage_activity_code_associations AS nca ON nca.insurer_code = inc.id 
                GROUP BY  inc.insurer, inc.code,inc.sub ,inc.description,inc.attributes ,inc.effectiveDate , inc.expirationDate
                ORDER BY inc.insurer, inc.code, inc.sub, inc.description;`;

                //where inc.insurer = 13  AND  inc.id in (344949) 
    let result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        process.exit(1);
    });
    log.debug("Got MySql insurerActviityCode - result.length - " + result.length);
    for(let i = 0; i < result.length; i++){
        try {
            result[i].territoryList = stringArraytoArray(result[i].territoryList);
            result[i].talageActivityCodeIdList = stringArraytoArray(result[i].talageActivityCodeIdList);
            if(result[i].attributes){
                result[i].attributes = JSON.parse(result[i].attributes)
            }
            //get territory array for insurer
            try{
                if(result[i].territoryList && result[i].territoryList.length > 0 && result[i].insurerActivityCodeIdList){
                    let insurerTerritoryQuestionList = [];
                    //for on territoryList
                    for(let j = 0; j < result[i].territoryList.length; j++){
                        const insurerCodeTerritoryQuestionJSON = await insurerCodeTerritoryQuestions(result[i].insurerActivityCodeIdList, result[i].territoryList[j]);
                        if(insurerCodeTerritoryQuestionJSON){
                            insurerTerritoryQuestionList.push(insurerCodeTerritoryQuestionJSON);
                        }
                    }
                    if(insurerTerritoryQuestionList.length > 0){
                        result[i].insurerTerritoryQuestionList = insurerTerritoryQuestionList
                        //log.debug("adding  insurerTerritoryQuestionList")
                    }
                }
            }
            catch(err){
                log.error("Question group error " + err)
                process.exit(1)
            }

            let insurerActivityCode = new InsurerActivityCodeModel(result[i]);
            await insurerActivityCode.save().catch(function(err) {
                log.error('Mongo insurerActivityCode Save err ' + err + __location);
                process.exit(1);
            });
            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating insurerActivityCode List error " + err + __location);
            process.exit(1);
        }
    }
    log.debug("Done!");
    process.exit(1);

}

main();