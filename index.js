'use strict';

const colors = require('colors');
const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');

function LogMessage(message) {
	log.info(message);
}

async function Main() {
	// Ensure we have a run mode argument ('public' or 'private')
	if (process.argv.length !== 3 || (process.argv[2] !== 'public' && process.argv[2] !== 'private')) {
		console.log(`${colors.red('Error:')} missing run mode argument`);
		console.log('Usage: node index.js [public | private]');
		console.log(`    Run the public API:  ${colors.green('node index.js public')}`);
		console.log(`    Run the private API: ${colors.green('node index.js private')}`);
		process.exit(-1);
	}
	// Set the run mode ('public' or 'private')
	const runMode = process.argv[2];

	const isDevelopment = process.env.ENV === 'development';

	// Load the environment
	const environment = require('dotenv').config({ path: 'aws.env' });
	if (environment.error) {
		throw environment.error;
	}

	// Add global helpers to load shared modules
	global.sharedPath = require('path').join(__dirname, 'shared');
	global.requireShared = (moduleName) => require(`${sharedPath}/${moduleName}`);

	// Connect to the logger
	if (!await logger.Connect()) {
		console.log('Error connecting to logger. Stopping.');
		return;
	}

	// Connect to the database
	if (!await db.Connect()) {
		console.log('Error connecting to database. Stopping.');
		return;
	}

	// Determine the version number
	global.version = '1.0.0'; //requireShared('./helpers/version.js')();

	// Load the database module and make it globally available
	global.db = requireShared('./services/db.js');

	// Load the server methods into the global namespace
	require('./server.js');

	// Configure the server and register endpoints
	let listenPort = null;
	switch (runMode) {
		case 'public':
			// Create the public server
			listenPort = process.env.PUBLIC_API_PORT || 3000;
			if (!await CreateServer('0.0.0.0', listenPort, 'public', true, isDevelopment, LogMessage)) {
				log.error('Error starting public server. Stopping.');
				return;
			}

			// Create the uptime server
			listenPort = process.env.UPTIME_PORT || 3008;
			if (!await CreateServer('0.0.0.0', listenPort, 'uptime', false, isDevelopment, LogMessage)) {
				log.error('Error starting uptime server. Stopping.');
				return;
			}
			break;
		case 'private':
			// Create the server
			listenPort = process.env.PRIVATE_API_PORT || 4000;
			if (!await CreateServer('127.0.0.1', listenPort, 'private', false, isDevelopment, LogMessage)) {
				log.error('Error starting private server. Stopping.');
				return;
			}
			break;
		default:
			log.error(`Unknown run mode '${runMode}'. Must be 'public' or 'private'`);
			process.exit(-1);
	}
}

Main();
