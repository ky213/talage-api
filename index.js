'use strict';

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${sharedPath}/${moduleName}`);

const colors = require('colors');
const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');
const s3 = require('./shared/services/s3.js');
const globalSettings = require('./settings.js');
const version = require('./version.js');

/**
 * Callbacks used by the server to log access and errors
 */
function LogInfoMessage(message) {
	log.info(message);
}
function LogErrorMessage(message) {
	log.error(message);
}

/**
 * Convenience method to log errors both locally and remotely 
 */
function LogLocalErrorMessage(message) {
	if (global.log) {
		log.error(message);
	}
	console.log(colors.red(message));
}

async function Main() {
	console.log(colors.green.bold('-'.padEnd(80, '-')));
	console.log(colors.green.bold('Initializing'));
	console.log(colors.green.bold('-'.padEnd(80, '-')));

	// Initialize the version
	if (!await version.Initialize()) {
		LogLocalErrorMessage('Error initializing version. Stopping.');
		return;
	}

	// Load the settings from a .env file
	if (!await globalSettings.Load()) {
		LogLocalErrorMessage('Error loading variables. Stopping.');
		return;
	}

	// Connect to the logger
	if (!await logger.Connect()) {
		LogLocalErrorMessage('Error connecting to logger. Stopping.');
		return;
	}

	// Connect to the database
	if (!await db.Connect()) {
		LogLocalErrorMessage('Error connecting to database. Stopping.');
		return;
	}

	// Connect to S3
	if (!await s3.Connect()) {
		LogLocalErrorMessage('Error connecting to S3. Stopping.');
		return;
	}

	// Load the database module and make it globally available
	global.db = requireShared('./services/db.js');

	// Load the server methods into the global namespace
	require('./server.js');

	// Configure the server and register endpoints
	const isDevelopment = settings.ENV === 'development';

	// Create the public server
	if (!await CreateServer('0.0.0.0', settings.PUBLIC_API_PORT, 'public', true, isDevelopment, LogInfoMessage, LogErrorMessage)) {
		LogLocalErrorMessage('Error starting public server. Stopping.');
		return;
	}
	// Create the uptime server
	if (!await CreateServer('0.0.0.0', settings.UPTIME_PORT, 'uptime', false, isDevelopment, LogInfoMessage, LogErrorMessage)) {
		LogLocalErrorMessage('Error starting uptime server. Stopping.');
		return;
	}
	// Create the private server
	if (!await CreateServer('0.0.0.0', settings.PRIVATE_API_PORT, 'private', false, isDevelopment, LogInfoMessage, LogErrorMessage)) {
		LogLocalErrorMessage('Error starting private server. Stopping.');
		return;
	}
}

Main();
