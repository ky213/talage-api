/* eslint-disable array-element-newline */
/* eslint-disable object-property-newline */
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
const axios = require('axios');
var fs = require('fs');

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('/services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

//const crypt = global.requireShared('./services/crypt.js');

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

    if(global.settings.ENV === 'production'){
        // eslint-disable-next-line no-console
        console.log(colors.red.bold('not allowed to run on production'));
        process.exit(1);
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

function onErr(err) {
    // eslint-disable-next-line no-console
    console.log(err);
    return 1;
}


/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {

    // if(process.argv.length < 4){
    //     log.error("missing User info");
    //     process.exit(1);

    // }
    // const userEmail = process.argv[2];
    // const userPwd = process.argv[3];

    const promptly = require('promptly');
    const userEmail = await promptly.prompt('userEmail: ');
    const userPwd = await promptly.password('userPwd: ');

    const userRemote = await promptly.password('Remote(Y/N): ');

    //get app auth token
    // eslint-disable-next-line object-curly-newline
    const postBody = {"email": userEmail, "password": userPwd};
    let apiAuthApUrl = "http://localhost:3000/v1/auth/agency-portal"
    let apiApRequoteUrlBase = "http://localhost:3000/v1/agency-portal/application"
    if(userRemote === 'Y'){
        apiAuthApUrl = "https://devapi.talageins.com/v1/auth/agency-portal"
        apiApRequoteUrlBase = "https://devapi.talageins.com/v1/agency-portal/application"
    }

    let authResponse = null;
    try{
        authResponse = await axios.post(apiAuthApUrl, JSON.stringify(postBody),{headers: {'Content-Type': 'application/json'}});
    }
    catch(err){
        log.error('API Auth AP error ' + err + __location);
        process.exit(1)
    }
    if(!authResponse.data.token){
        log.error("missing authResponse.token " + JSON.stringify(authResponse.data));
        process.exit(1);
    }

    const quote_promises = [];
    // eslint-disable-next-line array-element-newline
    //Wheelhouse
    const path = 'testrunapplications.json';
    let appListText = fs.readFileSync(path);
    let appList = JSON.parse(appListText);
    const ApplicationBO = global.requireShared('models/Application-BO.js');
    //var Application = require('mongoose').model('Application');
    const updateMysql = true;
    for(let i = 0; i < appList.length; i++){
        const sourceAppId = appList[i].sourceAppId;
        log.debug("copying applicationId " + sourceAppId);
        try{
        //load applicationBO
            const applicationBO = new ApplicationBO();
            //setup old app to copy from;
            let mongoApp = await applicationBO.getById(sourceAppId)
            if(mongoApp){
                if(!mongoApp.additionalInfo){
                    mongoApp.additionalInfo = {}
                }
                log.debug("Loaded sourceAppId " + sourceAppId + " applicationId " + mongoApp.applicationId)
                mongoApp.additionalInfo.copiedFromMysqlId = mongoApp.mysqlId;
                mongoApp.additionalInfo.copiedFromAppId = mongoApp.applicationId;

                //Clear id's for a copy.
                delete mongoApp.applicationId
                delete mongoApp.uuid
                delete mongoApp.mysqlId
                delete mongoApp.createdAt

                //update policies dates
                const newEffectiveDate = moment().add(1,"months");
                const newExpirationDate = newEffectiveDate.clone().add(1,'years');

                if(mongoApp.policies && mongoApp.policies.length > 0){
                    for(let j = 0; j < mongoApp.policies.length; j++){
                        mongoApp.policies[j].effectiveDate = newEffectiveDate;
                        mongoApp.policies[j].expirationDate = newExpirationDate;
                    }
                }
                //reset status to question_done
                mongoApp.status = 'questions_done'
                mongoApp.appStatusId = 10;
                mongoApp.processStateOld = 1;
                mongoApp.lastStep = 8;
                mongoApp.progress = "unknown";

                if(appList[i].requiresNewEin){
                    mongoApp.ein = `${mongoApp.ein.substr(0, 2)}${Math.floor(Math.random() * (9999999 - 1000000) + 1000000)}`;
                    mongoApp.businessName = `${mongoApp.businessName} - ${Math.floor(Math.random() * (9999999 - 1000000) + 1000000)}`;
                }

                //save mongoinsert
                const newApplicationJSON = await applicationBO.insertMongo(mongoApp, updateMysql);
                log.debug("Saved new sourceAppId " + sourceAppId + " applicationId " + newApplicationJSON.applicationId);

                //run quote process
                const requoteURL = `${apiApRequoteUrlBase}/${newApplicationJSON.applicationId}/requote`;
                const putBody = {"id": newApplicationJSON.applicationId};
                try{
                    const instance = axios.create();
                    instance.defaults.timeout = 4500;
                    // eslint-disable-next-line dot-notation
                    instance.defaults.headers.common["Authorization"] = authResponse.data.token;
                    await instance.put(requoteURL, JSON.stringify(putBody),{headers: {'Content-Type': 'application/json'}});
                }
                catch(err){
                    log.error('API AP Requote error ' + err + __location);
                    // process.exit(1)
                }
            }
            else {
                log.error("Failed to load sourceAppId " + sourceAppId);
            }


        }
        catch(err){
            log.error(`Copying and quoting mongo application sourceAppId: ${sourceAppId} error ` + err + __location)
        }
    }
    if(quote_promises.length > 0){
        try {
            await Promise.all(quote_promises);
        }
        catch (error) {
            log.error(`Quoting did not complete successfully: ${error} ${__location}`);
        }
    }


    log.debug("Done!");
    process.exit(1);
}

main();