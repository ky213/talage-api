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
    //     agency_location: "agencyLocationId",
    //     agency: "agencyId",
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
                if(sourceProp.isSnakeCase()){
                    targetJSON[sourceProp.toCamelCase()] = sourceJSON[sourceProp];
                }
                else {
                    targetJSON[sourceProp] = sourceJSON[sourceProp];
                }
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


    const AgencyBO = global.requireShared('models/Agency-BO.js');
    var Agency = require('mongoose').model('Agency');

    // local development of tasks run one of the task.

    //load message model and get message list.
    const sql = "SELECT id from clw_talage_agencies where state > 0  order by id ";

    const result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error");
        process.exit(1);
    });
    log.debug("Got MySql agencies - result.length - " + result.length);
    for(let i = 0; i < result.length; i++){
        let newMongoDoc = true;
        //load applicationBO
        const agencyBO = new AgencyBO();
        let loadResp = false;
        const mysqlId = result[i].id;
        try{
            loadResp = await agencyBO.loadFromIdMysql(mysqlId);
        }
        catch(err){
            log.error("load application error " + err)
        }
        if(loadResp){
            let agencyJSON = {};
            try{
                const mongoApp = await agencyBO.getMongoDocbyMysqlId(mysqlId)
                if(mongoApp){
                    agencyJSON = mongoApp;
                    newMongoDoc = false;
                }
            }
            catch(err){
                log.error("Getting mongo application error " + err + __location)
            }
            agencyJSON.mysqlId = agencyBO.id;
            agencyJSON.systemId = agencyBO.id;

            //mapp app to app
            const alPropMappings = {
                agency_network: "agencyNetworkId",
                ca_license_number: "caLicenseNumber",
                "fname": "firstName",
                "lname": "lastName",
                wholesale_agreement_signed: "wholesaleAgreementSigned",
                docusign_envelope_id: "docusignEnvelopeId",
                do_not_report: "doNotReport",
                enable_optout: "enabelOptOut",
                "created": "createdAt",
                "modified": "updateAt",
                "created_by": "agencyPortalCreatedUser",
                "modified_by": "agencyPortalModifiedUser"
            }
            if(agencyBO.created === '0000-00-00 00:00:00'){
                delete agencyBO.created
            }
            if(agencyBO.modified === '0000-00-00 00:00:00'){
                delete agencyBO.modified
            }
            mapToMongooseJSON(agencyBO, agencyJSON, alPropMappings);

            if(agencyBO.additionalInfo){
                agencyJSON.additionalInfo = agencyBO.additionalInfo;
                if(agencyJSON.additionalInfo.donotShowEmailAddress){
                    agencyJSON.donotShowEmailAddress = agencyJSON.additionalInfo.donotShowEmailAddress;
                }
            }

            let agencyModel = new Agency(agencyJSON);
            log.debug("Pre Save " + JSON.stringify(agencyModel));
            if(newMongoDoc){
                await agencyModel.save().catch(function(err) {
                    log.error('Mongo agencyModel Save err ' + err + __location);
                    process.exit(1);
                });
                log.debug("inserted agencyId " + agencyModel.agencyId + " mysqlId: " + mysqlId);
            }
            else {
                try {
                    const updateAppDoc = JSON.parse(JSON.stringify(agencyModel));
                    const changeNotUpdateList = ["active",
                        "_id",
                        "id",
                        "mysqlId",
                        "agencyId"]
                    for (let j = 0; j < changeNotUpdateList.length; j++) {
                        if (updateAppDoc[changeNotUpdateList[j]]) {
                            delete updateAppDoc[changeNotUpdateList[j]];
                        }
                    }
                    const query = {"agencyId": agencyModel.agencyId};
                    await Agency.updateOne(query, updateAppDoc);
                    log.debug("UPDATED: agencyId " + agencyModel.agencyId + " mysqlId: " + mysqlId);

                }
                catch(err){
                    log.error("Updating Agency error " + err + __location);
                    process.exit(1);
                }

            }
        }


    }
    log.debug("Done!");
    process.exit(1);

}

main();