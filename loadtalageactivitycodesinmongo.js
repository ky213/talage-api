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

    const ActivityCodeModel = require('mongoose').model('ActivityCode');
    const InsurerActivityCodeModel = require('mongoose').model('ActivityCode');
    //load message model and get message list.
    const sql = `select id as 'activityCodeId', description, state from clw_talage_activity_codes where id > 1858 `;

    let result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });
    log.debug("Got MySql ActivityCode - result.length - " + result.length);
    const updateAbleProps = ['description',
        'alternateNames',
        'ncciCode',
        'active'];
    let updatedDocCount = 0;
    let newDocCount = 0;
    for(let i = 0; i < result.length; i++){
        try {
            let activityCode = new ActivityCodeModel(result[i]);

            activityCode.talageStandard = true;
            if(result[i].state < 1){
                activityCode.active = false
            }

            //Get AlternateNames
            activityCode.alternateNames = [];
            let sqlAlt = `select name from clw_talage_activity_code_alt_names where activity_code = ${activityCode.activityCodeId}`
            let resultAlt = await db.query(sqlAlt).catch(function(error) {
                // Check if this was
                log.error(`Alternate name ${sqlAlt} error ` + error);

            });
            if(resultAlt && resultAlt.length > 0){
                const listOfAltNames = resultAlt.map(row => row.name)
                if(listOfAltNames && listOfAltNames.length > 0 && listOfAltNames[0]){
                    activityCode.alternateNames = listOfAltNames
                }
            }
            //lockup ncci code from Markel and Liberty (3,14) if conflict do not add.
            // use AR a standard ncci state to filter out PA, DE and CA (when CA is different).
            const activityCodeQuery = {
                insurerId: {$in: [3,14]},
                territoryList: "AR",
                active: true,
                talageActivityCodeIdList: activityCode.activityCodeId
            }

            const insurerActivityCodeList = await InsurerActivityCodeModel.find(activityCodeQuery).lean()
            if(insurerActivityCodeList && insurerActivityCodeList.length > 0){
                if(insurerActivityCodeList.length === 1){
                    activityCode.ncciCode = insurerActivityCodeList[0].code;
                }
                else if (insurerActivityCodeList.length === 2
                    && insurerActivityCodeList[0].code === insurerActivityCodeList[1].code
                ) {
                    activityCode.ncciCode = insurerActivityCodeList[0].code;
                }
                // more than 2 or different do nothing.
            }


            // Determine if existing doc
            // by insurerId,  code, sub
            const query = {activityCodeId: activityCode.activityCodeId}
            const existingDoc = await ActivityCodeModel.findOne(query);
            if(existingDoc){
                //update file
                let updateHit = false;
                //loop updateable array
                updateAbleProps.forEach((updateAbleProp) => {
                    if(activityCode[updateAbleProp] && activityCode[updateAbleProp] !== existingDoc[updateAbleProp]){
                        existingDoc[updateAbleProp] = activityCode[updateAbleProp]
                        updateHit = true;
                    }
                });
                if(updateHit){
                    await existingDoc.save().catch(function(err) {
                        log.error('Mongo ActivityCode Save err ' + err + __location);
                        return false;
                    });
                    updatedDocCount++
                }
            }
            else {
                await activityCode.save().catch(function(err) {
                    log.error('Mongo ActivityCode Save err ' + err + __location);
                    return false;
                });
                newDocCount++;
            }

            // if(ActivityCode.insurerTerritoryQuestionList.length > 0){
            //     log.debug("has territoryquestions " + ActivityCode.insurerActivityCodeId)
            // }
            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating ActivityCode List error " + err + __location);
            return false;
        }
    }
    log.debug("ActivityCodes Import Done!");
    log.debug(`Updated ActivityCodes: ${updatedDocCount}`);
    log.debug(`New ActivtiyCodes: ${newDocCount}`);
    log.debug("Done!");
    process.exit(1);

}

main();