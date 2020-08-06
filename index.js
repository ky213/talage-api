'use strict';

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);

const colors = require('colors');
const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');
const s3 = require('./shared/services/s3.js');
const cognitoSvc = require('./shared/services/cognitosvc.js');
const globalSettings = require('./settings.js');
const version = require('./version.js');
const server = require('./server.js');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
global.tracker = tracker;

// Inject the tracker code
//require('./tracker.js');

/**
 * Log informational messages
 *
 * @param {string} message - The informational message to log
 * @returns {void}
 */
function logInfoMessage(message){
	log.info(message);
}

/**
 * Log error messages
 *
 * @param {string} message - The error message to log
 * @returns {void}
 */
function logErrorMessage(message){
	log.error(message + __location);
}

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logLocalErrorMessage(message){
	if(global.log){
		log.error(message + __location);
	}
	// eslint-disable-next-line no-console
	console.log(colors.red(message));
}

/**
 * Main entrypoint
 *
 * @returns {void}
 */
async function main(){
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

	// Connect to S3
	if(!await s3.connect()){
		logLocalErrorMessage('Error connecting to S3. Stopping.');
		return;
    }

    // Connect to Cognito
	if(!await cognitoSvc.connect()){
		logLocalErrorMessage('Error connecting to cognitoSvc. Stopping.');
		return;
    }
    global.cognitoSvc = cognitoSvc;

	// Load the database module and make it globally available
	global.db = global.requireShared('./services/db.js');

	// Configure the server and register endpoints
	const isDevelopment = global.settings.ENV === 'development';

	// Create the public server
	if(!await server.create('0.0.0.0', global.settings.PUBLIC_API_PORT, 'public/public-endpoints', true, isDevelopment, logInfoMessage, logErrorMessage)){
		logLocalErrorMessage('Error starting public server. Stopping.');
		return;
	}
	// Create the uptime server
	if(!await server.create('0.0.0.0', global.settings.UPTIME_PORT, 'uptime/uptime-endpoints', false, isDevelopment, logInfoMessage, logErrorMessage)){
		logLocalErrorMessage('Error starting uptime server. Stopping.');
		return;
	}
	// Create the private server
	if(!await server.create('0.0.0.0', global.settings.PRIVATE_API_PORT, 'private/private-endpoints', false, isDevelopment, logInfoMessage, logErrorMessage)){
		logLocalErrorMessage('Error starting private server. Stopping.');

	}
}

main();