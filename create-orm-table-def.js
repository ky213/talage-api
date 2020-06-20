/* eslint-disable no-process-exit */
'use strict';

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);

const colors = require('colors');
const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');
const globalSettings = require('./settings.js');
const version = require('./version.js');

// Inject the tracker code
//require('./tracker.js');

/**
 * Log informational messages
 *
 * @param {string} message - The informational message to log
 * @returns {void}
 */
// function logInfoMessage(message){
// 	log.info(message);
// }

// /**
//  * Log error messages
//  *
//  * @param {string} message - The error message to log
//  * @returns {void}
//  */
// function logErrorMessage(message){
// 	log.error(message);
// }

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logLocalErrorMessage(message){
	if(global.log){
		log.error(message);
	}
	// eslint-disable-next-line no-console
	console.log(colors.red(message));
}

let tableName = "clw_talage_applications"

/**
 * Main entrypoint
 *
 * @returns {void}
 */
async function main(){
    // Load the settings from a .env file - Settings are loaded first
	if(!globalSettings.load()){
		logLocalErrorMessage('Error loading variables. Stopping.');
		return;
	}

	// Initialize the version
	if(!await version.load()){
		logLocalErrorMessage('Error initializing version. Stopping.');
		return;
	}

	// Connect to the logger
	if(!logger.connect()){
		logLocalErrorMessage('Error connecting to logger. Stopping.');
		return;
	}

	// Connect to the database
	if(!await db.connect()){
		logLocalErrorMessage('Error connecting to database. Stopping.');
		return;
	}

	// Load the database module and make it globally available
    global.db = global.requireShared('./services/db.js');

    if(process.argv.length > 2){
        log.debug('table: ' + process.argv[2])
        tableName = process.argv[2];
    }

    const tableDef = await db.query(`SHOW COLUMNS FROM ${tableName}`).catch(function(e){
        log.debug(e);
        process.exit(1);
    });
    const numberFieldTypeList = ['int', 'float'];
  //  log.debug(JSON.stringify(tableDef));
    const ormTableDef = {};
    for (var i = 0; i < tableDef.length; i++) {
        const fieldDef = tableDef[i];

        const ormFieldDef = {
            'default': null,
            'encrypted': false,
            'required': false,
            'rules': null,
            'type': 'string'
        }
        for(var j = 0; j < numberFieldTypeList.length; j++){
            if(fieldDef.Type.indexOf(numberFieldTypeList[j]) > -1){
                ormFieldDef.type = "number";
            }
        }
        if(fieldDef.Type === "blob"){
            ormFieldDef.encrypted = true;
        }

        if(fieldDef.Extra && fieldDef.Extra === 'auto_increment'){
            ormFieldDef.default = 0;
        }
        if(fieldDef.Default && fieldDef.Default !== null){
            if(fieldDef.Default === "0"){
                ormFieldDef.default = 0;
            }
            else {
                ormFieldDef.default = fieldDef.Default;
            }
        }
        else if (fieldDef.Null === "NO" && ormFieldDef.type === 'string'){
            ormFieldDef.default = "";
        }
        else if (fieldDef.Null === "NO" && ormFieldDef.type === 'number'){
            ormFieldDef.default = 0;
        }
        if(fieldDef.Null === "NO"){
            ormFieldDef.required = true;
        }
        if(fieldDef.Type === "timestamp" || fieldDef.Type === "date" || fieldDef.Type === "datetime"){
            ormFieldDef.type = fieldDef.Type;
            ormFieldDef.required = false;
            ormFieldDef.default = null;
        }

        ormTableDef[fieldDef.Field] = ormFieldDef;
    }
    log.debug(JSON.stringify(ormTableDef))
    process.exit(0);


}

main();