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

const questionMigrationSvc = global.requireShared('/services/questionmigrationsvc.js');

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

/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {

    const IndustryCodeModel = require('mongoose').model('IndustryCode');
    await moveIndustryCategories();
    //load message model and get message list.
    const sql = `select * from clw_talage_industry_codes `;

    let result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });
    log.debug("Got MySql IndustryCode - result.length - " + result.length);
    const updateAbleProps = ['description',
        'featured',
        'naics',
        'cgl',
        'sic',
        'ico',
        'hiscox',
        'activityCodeIdList',
        'active'];
    let updatedDocCount = 0;
    let newDocCount = 0;
    for(let i = 0; i < result.length; i++){
        try {
            result[i].industryCodeId = result[i].id;
            let industryCode = new IndustryCodeModel(result[i]);

            industryCode.talageStandard = true;
            if(result[i].state < 1){
                industryCode.active = false
            }

            //get activityCodeList
            let sqlAssoc = `select activityCodeId from clw_talage_industry_code_associations where frequency > 30 and industryCodeId = ${industryCode.industryCodeId}`

            let resultAlt = await db.query(sqlAssoc).catch(function(error) {
                // Check if this was
                log.error(`activityCodeList clw_talage_industry_code_associations ${sqlAssoc} error ` + error);

            });
            if(resultAlt && resultAlt.length > 0){
                const activityCodeList = resultAlt.map(row => row.activityCodeId)
                if(activityCodeList && activityCodeList.length > 0 && activityCodeList[0]){
                    industryCode.activityCodeIdList = activityCodeList
                }
            }


            // Determine if existing doc
            // by insurerId,  code, sub
            const query = {industryCodeId: industryCode.industryCodeId}
            const existingDoc = await IndustryCodeModel.findOne(query);
            if(existingDoc){
                //update file
                let updateHit = false;
                //loop updateable array
                updateAbleProps.forEach((updateAbleProp) => {
                    if(industryCode[updateAbleProp] && industryCode[updateAbleProp] !== existingDoc[updateAbleProp]){
                        existingDoc[updateAbleProp] = industryCode[updateAbleProp]
                        updateHit = true;
                    }
                });
                if(updateHit){
                    await existingDoc.save().catch(function(err) {
                        log.error('Mongo IndustryCode Save err ' + err + __location);
                        return false;
                    });
                    updatedDocCount++
                }
            }
            else {
                await industryCode.save().catch(function(err) {
                    log.error('Mongo IndustryCode Save err ' + err + __location);
                    return false;
                });
                newDocCount++;
            }

            // if(IndustryCode.insurerTerritoryQuestionList.length > 0){
            //     log.debug("has territoryquestions " + IndustryCode.insurerActivityCodeId)
            // }
            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating IndustryCode List error " + err + __location);
            return false;
        }
    }
    log.debug("IndustryCodes Import Done!");
    log.debug(`Updated IndustryCodes: ${updatedDocCount}`);
    log.debug(`New IndustryCodes: ${newDocCount}`);
    log.debug("Done!");
    process.exit(1);

}


async function moveIndustryCategories() {

    const IndustryCodeCategoryModel = require('mongoose').model('IndustryCodeCategory');
    //load message model and get message list.
    const sql = `select id as 'industryCodeCategoryId', name, featured from clw_talage_industry_code_categories `;

    let result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });
    log.debug("Got MySql clw_talage_industry_code_categories - result.length - " + result.length);

    let newDocCount = 0;
    for(let i = 0; i < result.length; i++){
        try {
            let industryCodeCategory = new IndustryCodeCategoryModel(result[i]);

            // Determine if existing doc
            // by insurerId,  code, sub
            const query = {industryCodeCategoryId: industryCodeCategory.industryCodeCategoryId}
            const existingDoc = await IndustryCodeCategoryModel.findOne(query);
            if(!existingDoc){
                await industryCodeCategory.save().catch(function(err) {
                    log.error('Mongo IndustryCodeCategoryModel Save err ' + err + __location);
                    return false;
                });
                newDocCount++;
            }

            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating IndustryCode List error " + err + __location);
            return false;
        }
    }
    log.debug("IndustryCodeCategor Import Done!");
    return;
}

main();