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
const groupQuestionArray = key => array => array.reduce((objectsByKeyValue, obj) => {
    const value = obj[key];
    objectsByKeyValue[value] = (objectsByKeyValue[value] || []).concat(obj.insurerQuestionId);
    return objectsByKeyValue;
}, {});


async function insurerCodeTerritoryQuestions(insurerIndustryCodeIdList){
    if(insurerIndustryCodeIdList){
        const sql = `SELECT distinct iic.territory, iq.id as insurerQuestionId
            FROM clw_talage_insurer_industry_codes AS iic
            inner JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON  iic.id = industryCodeMap.insurerIndustryCodeId
            inner JOIN clw_talage_industry_codes AS ic ON industryCodeMap.talageIndustryCodeId = ic.id
            inner JOIN clw_talage_industry_code_questions  AS icq ON icq.insurerIndustryCodeId = iic.id 
            inner JOIN clw_talage_insurer_questions AS iq ON iq.question = icq.talageQuestionId
            where iic.id in (${insurerIndustryCodeIdList})
            order by iic.territory ;`;

        let result = await db.query(sql).catch(function(error) {
            // Check if this was
            log.error("error " + error);
            process.exit(1);
        });
        if(result && result.length > 0){
            const groupByTerritory = groupQuestionArray('territory')
            const groupedQuestionList = groupByTerritory(result);
            var territoryQuestionArray = [];
            // eslint-disable-next-line guard-for-in
            for (const tqObjectGrouped in groupedQuestionList) {
                const territoryQuestionJSON = {
                    territory: tqObjectGrouped,
                    insurerQuestionIdList: groupedQuestionList[tqObjectGrouped]
                }
                territoryQuestionArray.push(territoryQuestionJSON);
            }
            //log.debug("groupedQuestions " + JSON.stringify(territoryQuestionArray))
            if(territoryQuestionArray.length === 0){
                log.debug("no questions " + sql)
            }
            return territoryQuestionArray
        }
        else {
            log.debug("no questions  returned " + sql)
            return null;
        }

    }
    else {
        log.debug("empty insurerIndustryCodeIdList")
        return null
    }
}


/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {

    const InsurerIndustryCodeModel = require('mongoose').model('InsurerIndustryCode');
    //load message model and get message list.
    const sql = `SELECT  
         iic.code,
		 iic.type,
		 iic.insurer as 'insurerId',
		 iic.description,
		 iic.attributes,
		 iic.policyType as 'policyType',
         iic.effectiveDate, 
         iic.expirationDate ,
         GROUP_CONCAT(DISTINCT iic.id) AS insurerIndustryCodeIdList,
         GROUP_CONCAT(DISTINCT iic.territory) AS territoryList,
         GROUP_CONCAT(DISTINCT ic.id) AS talageIndustryCodeIdList,
         GROUP_CONCAT(DISTINCT icq.talageQuestionId) AS talageQuestionIdList,
         GROUP_CONCAT(DISTINCT iq.id) AS insurerQuestionIdList
        FROM clw_talage_insurer_industry_codes AS iic
        Left JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON  iic.id = industryCodeMap.insurerIndustryCodeId
        left JOIN clw_talage_industry_codes AS ic ON industryCodeMap.talageIndustryCodeId = ic.id
        left JOIN clw_talage_industry_code_questions  AS icq ON icq.insurerIndustryCodeId = iic.id 
        Left JOIN clw_talage_insurer_questions AS iq ON iq.question = icq.talageQuestionId
        where industryCodeMap.talageIndustryCodeId = 2668
        GROUP BY iic.insurer, iic.code,iic.policyType, iic.attributes;`;

    const result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        process.exit(1);
    });
    log.debug("Got MySql insurerIndustryCode - result.length - " + result.length);
    for(let i = 0; i < result.length; i++){
        try {
            result[i].territoryList = stringArraytoArray(result[i].territoryList);
            result[i].talageIndustryCodeIdList = stringArraytoArray(result[i].talageIndustryCodeIdList);
            result[i].talageQuestionIdList = stringArraytoArray(result[i].talageQuestionIdList);
            result[i].insurerQuestionIdList = stringArraytoArray(result[i].insurerQuestionIdList);
            if(result[i].attributes){
                result[i].attributes = JSON.parse(result[i].attributes)
            }
            //get territory array for insurer
            try{
                if(result[i].insurerIndustryCodeIdList){
                    const insurerCodeTerritoryQuestionArray = await insurerCodeTerritoryQuestions(result[i].insurerIndustryCodeIdList);
                    if(insurerCodeTerritoryQuestionArray && insurerCodeTerritoryQuestionArray.length > 0){
                        result[i].insurerTerritoryQuestionList = insurerCodeTerritoryQuestionArray
                    }
                }
                else {
                    log.debug(`NO insurerIndustryCodeIdList for insurer: ${result[i].insurerId}`)
                }
                
            }
            catch(err){
                log.error("Question group error " + err)
                process.exit(1)
            }

            let insurerIndustryCode = new InsurerIndustryCodeModel(result[i]);
            await insurerIndustryCode.save().catch(function(err) {
                log.error('Mongo insurerIndustryCode Save err ' + err + __location);
                process.exit(1);
            });
            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating insurerIndustryCode List error " + err + __location);
            process.exit(1);
        }
    }
    log.debug("Done!");
    process.exit(1);

}

main();