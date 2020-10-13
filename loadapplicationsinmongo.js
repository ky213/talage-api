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

const BusinessModel = global.requireShared('models/Business-model.js');
const BusinessContactModel = global.requireShared('models/BusinessContact-model.js');
const BusinessAddressModel = global.requireShared('models/BusinessAddress-model.js');
const BusinessAddressActivityCodeModel = global.requireShared('models/BusinessAddressActivityCode-model.js');


const ApplicationActivityCodesModel = global.requireShared('models/ApplicationActivityCodes-model.js');
const ApplicationPolicyTypeBO = global.requireShared('models/ApplicationPolicyType-BO.js');
const LegalAcceptanceModel = global.requireShared('models/LegalAcceptance-model.js');
const ApplicationClaimBO = global.requireShared('models/ApplicationClaim-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const QuestionBO = global.requireShared('./models/Question-BO.js');
const QuestionAnswerBO = global.requireShared('./models/QuestionAnswer-BO.js');
const QuestionTypeBO = global.requireShared('./models/QuestionType-BO.js');

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


async function processQuestions(appId, applicationJSON){


}

async function processPolicies(appId, applicationJSON) {

    return;
}

async function processActivityCodes(appId, applicationJSON){
    return;
}

async function processClaims(appId, applicationJSON){
    const applicationClaimBO = new ApplicationClaimBO()
    let claimList = null
    try{
        claimList = applicationClaimBO.loadFromApplicationId(appId);
    }
    catch(err){
        log.error("get claims " + err + __location);
    }
    if(claimList && claimList.length > 0){
        applicationJSON.claims = clonedeep(claimList);
        for(let i = 0; i < applicationJSON.claims.length; i++){
            let claim = applicationJSON.claims[i];
            for (const prop in claim) {
                //check if snake_case
                if(prop.isSnakeCase()){
                    claim[prop.toCamelCase()] = claim[prop];
                    delete claim[prop];
                }
            }
        }
    }

    return;
}


async function processContacts(businessId, applicationJSON){
    const businessContactModel = new BusinessContactModel()
    let businessConstactList = null;
    try{
        businessConstactList = await businessContactModel.loadFromBusinessId(businessId)
    }
    catch(err){
        log.error("get business " + err + __location);
    }
    if(businessConstactList && businessConstactList.length > 0){
        applicationJSON.contacts = [];
        for(var i = 0; i < businessConstactList.length; i++){
            let businessContact = businessConstactList[i]
            let contactJSON = {};
            contactJSON.email = businessContact.email;
            contactJSON.firstName = businessContact.fname;
            contactJSON.lastName = businessContact.lname;
            contactJSON.phone = businessContact.phone;
            contactJSON.primary = businessContact.primary;
            applicationJSON.contacts.push(contactJSON);
        }
    }
    else {
        log.error("no business contact businessId " + businessId)
    }
    return;
}


async function processLocations(businessId, applicationJSON){


    const businessAddressModel = new BusinessAddressModel()
    let businessAddressList = null;
    try{
        businessAddressList = await businessAddressModel.loadFromBusinessId(businessId)
    }
    catch(err){
        log.error("get business " + err + __location);
    }
    if(businessAddressList){
        applicationJSON.locations = [];
        for(var i = 0; i < businessAddressList.length; i++){
            let businessAddress = businessAddressList[i]
            let locationJSON = {};
            const businessInfoMapping = {"mailing_state_abbr": "mailingState"}
            mapToMongooseJSON(businessAddress, locationJSON, businessInfoMapping);
            //TODO load activity Codes


            applicationJSON.locations.push(locationJSON);
        }
    }
    else {
        log.error("no business contact businessId " + businessId)
    }


    //activity payroll....
    return;
}

async function processBusiness(businessId, applicationJSON){
    const businessModel = new BusinessModel();
    let businessJSON = null;
    try{
        businessJSON = await businessModel.getById(businessId)
    }
    catch(err){
        log.error("get business " + err + __location);
    }

    if(businessJSON.owners){
        applicationJSON.owner = JSON.parse(businessJSON.owners);
        delete businessJSON.owners;
    }
    if(businessJSON.ein){
        applicationJSON.einEncrypted = await crypt.encrypt(businessJSON.ein);
        delete businessJSON.ein
    }

    if(businessJSON){
        const businessInfoMapping = {
            entity_type: "entityType",
            "mailing_state_abbr": "mailingState"
        }
        mapToMongooseJSON(businessJSON, applicationJSON, businessInfoMapping);
    }


    //map address to app.locations
    return;
}


// update clw_talage_applications record.
async function updateMysqlRecord(id) {
    const updateSQL = `
    UPDATE clw_talage_applications 
        SET copied_to_mongo = 1
        WHERE id = ${id}
    `;
    await db.query(updateSQL).catch(function(e) {
        log.error(`App updateMysqlRecord: ` + e);
    });

    return;
}


/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {


    const ApplicationBO = global.requireShared('models/Application-BO.js');
    var Application = require('mongoose').model('Application');

    // local development of tasks run one of the task.

    //load message model and get message list.
    const sql = "SELECT id from clw_talage_applications where state > 0 AND copied_to_mongo = 0 AND id > 11500 AND appStatusId > 50 limit 1";

    const result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error");
        process.exit(1);
    });
    log.debug("Got MySql applications - result.length - " + result.length);
    for(let i = 0; i < result.length; i++){

        //load applicationBO
        const applicationBO = new ApplicationBO();
        let loadResp = false;
        try{
            loadResp = await applicationBO.loadFromId(result[i].id);
        }
        catch(err){
            log.error("load application error " + err)
        }
        if(loadResp){
            let applicationJSON = {};
            applicationJSON.mysqlId = applicationBO.id;
            applicationJSON.applicationId = applicationBO.uuid;
            //mapp app to app
            const appPropMappings = {
                agency_location: "agencyLocationId",
                agency: "agencyId",
                name: "businessName",
                "id": "mysqlId",
                "state": "processStateOld",
                "coverage_lapse": "coverageLapseWC",
                "primary_territory": "primaryState"
            }
            mapToMongooseJSON(applicationBO, applicationJSON, appPropMappings);
            //map buiness to app
            //load business..
            await processBusiness(applicationBO.business,applicationJSON)

            //map contacts to app.contact.
            await processContacts(applicationBO.business, applicationJSON)

            //map address to app.locations
            await processLocations(applicationBO.business,applicationJSON)


            //map app.policyt to app.policytes
            await processPolicies(applicationBO.id, applicationJSON)

            //map app.activitycode to app.activitycode
            processActivityCodes(applicationBO.id, applicationJSON)

            //map app.claims to app.claims
            await processClaims(applicationBO.id, applicationJSON)


            await processQuestions(applicationBO.id, applicationJSON)


            log.debug("applicationMongo: ")
            log.debug("")
            //log.debug(JSON.stringify(applicationJSON))

            let application = new Application(applicationJSON);
            log.debug("insert application: " + JSON.stringify(application))

            //update mysql as copied
        }


    }
    log.debug("Done!");
    process.exit(1);

}

main();