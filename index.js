'use strict';

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${sharedPath}/${moduleName}`);

const colors = require('colors');
const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');
const s3 = require('./shared/services/s3.js');

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
	log.error(message);
	console.log(colors.red(message));
}

async function Main() {
	// Command-line processing: ensure we have a run mode argument ('public' or 'private')
	if (process.argv.length !== 3 || (process.argv[2] !== 'public' && process.argv[2] !== 'private')) {
		console.log(`${colors.red('Error:')} missing run mode argument`);
		console.log('Usage: node index.js [public | private]');
		console.log(`    Run the public API:  ${colors.green('node index.js public')}`);
		console.log(`    Run the private API: ${colors.green('node index.js private')}`);
		process.exit(-1);
	}
	// Set the run mode ('public' or 'private')
	const runMode = process.argv[2];

	// Load the settings from a .env file
	if (!require('./settings.js').Load('aws.env')) {
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

	// Determine the version number
	global.version = '1.0.0'; //requireShared('./helpers/version.js')();

	// Load the database module and make it globally available
	global.db = requireShared('./services/db.js');

	// Load the server methods into the global namespace
	require('./server.js');

	// Configure the server and register endpoints
	const isDevelopment = settings.ENV === 'development';
	let listenPort = null;
	switch (runMode) {
		case 'public':
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
			break;
		case 'private':
			// Create the private server
			if (!await CreateServer('127.0.0.1', settings.PRIVATE_API_PORT, 'private', false, isDevelopment, LogInfoMessage, LogErrorMessage)) {
				LogLocalErrorMessage('Error starting private server. Stopping.');
				return;
			}
			break;
		default:
			LogLocalErrorMessage(`Unknown run mode '${runMode}'. Must be 'public' or 'private'. Stopping.`);
			return;
	}
}

Main();
