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
    // const propMappings = {
    //     insurer_location: "insurerLocationId",
    //     insurer: "insurerId",
    //     name: "businessName",
    //     "id": "mysqlId",
    //     "state": "processStateOld"
    // }
    for(const sourceProp in sourceJSON){
        if(typeof sourceJSON[sourceProp] !== "object"){
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

        }
    }
}


/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {


    const InsurerBO = global.requireShared('models/Insurer-BO.js');
    var InsurerModel = require('mongoose').model('Insurer');

    // local development of tasks run one of the task.

    //load message model and get message list.
    const sql = "SELECT id from clw_talage_insurers order by id ";

    const result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error");
        process.exit(1);
    });
    log.debug("Got MySql agencies - result.length - " + result.length);
    for(let i = 0; i < result.length; i++){
        let newMongoDoc = true;
        //load applicationBO
        const insurerBO = new InsurerBO();
        let loadResp = false;
        const mysqlId = result[i].id;
        try{
            loadResp = await insurerBO.loadFromIdMySql(mysqlId);
        }
        catch(err){
            log.error("load application error " + err)
        }
        if(loadResp){
            let insurerJSON = {};
            try{
                const mongoApp = await insurerBO.getMongoDocbyMysqlId(mysqlId)
                if(mongoApp){
                    insurerJSON = mongoApp;
                    newMongoDoc = false;
                }
            }
            catch(err){
                log.error("Getting mongo application error " + err + __location)
            }
            insurerJSON.systemId = insurerBO.id;
            insurerJSON.insurerId = insurerBO.id;

            //mapp app to app
            const alPropMappings = {
                "created": "createdAt",
                "modified": "updateAt",
                "created_by": "insurerPortalCreatedUser",
                "modified_by": "insurerPortalModifiedUser"
            }
            if(insurerBO.created === '0000-00-00 00:00:00'){
                delete insurerBO.created
            }
            if(insurerBO.modified === '0000-00-00 00:00:00'){
                delete insurerBO.modified
            }
            mapToMongooseJSON(insurerBO, insurerJSON, alPropMappings);



            let insurerModel = new InsurerModel(insurerJSON);
            // log.debug("Pre Save " + JSON.stringify(insurerModel));
            if(newMongoDoc){
                await insurerModel.save().catch(function(err) {
                    log.error('Mongo insurerModel Save err ' + err + __location);
                    process.exit(1);
                });
                log.debug("inserted insurerId " + insurerModel.insurerUuidId + " mysqlId: " + mysqlId);
            }
            else {
                try {
                    const updateAppDoc = JSON.parse(JSON.stringify(insurerModel));
                    const changeNotUpdateList = ["active",
                        "_id",
                        "id",
                        "mysqlId",
                        "insurerId"]
                    for (let j = 0; j < changeNotUpdateList.length; j++) {
                        if (updateAppDoc[changeNotUpdateList[j]]) {
                            delete updateAppDoc[changeNotUpdateList[j]];
                        }
                    }
                    const query = {"insurerId": insurerModel.insurerId};
                    await InsurerModel.updateOne(query, updateAppDoc);
                    log.debug("UPDATED: insurerId " + insurerModel.insurerId + " mysqlId: " + mysqlId);

                }
                catch(err){
                    log.error("Updating Insurer error " + err + __location);
                    process.exit(1);
                }

            }
        }


    }
    log.debug("Done!");
    process.exit(1);

}

main();