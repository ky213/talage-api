'use strict';

const colors = require('colors');

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

// Load the logger (globally available as 'db')
requireShared('./services/logger.js');

// Determine the version number
global.version = '1.0.0'; //requireShared('./helpers/version.js')();

// Load the database module and make it globally available
global.db = requireShared('./services/db.js');

// Configure the server and register endpoints
let listenAddress = null;
let listenPort = null;
let useCORS = null;
switch (runMode) {
	case 'public':
		// Listen on all interfaces
		listenAddress = '0.0.0.0';
		listenPort = process.env.PUBLIC_API_PORT || 3000;
		useCORS = true;
		break;
	case 'private':
		// Listen only on localhost
		listenAddress = '127.0.0.1';
		listenPort = process.env.PRIVATE_API_PORT || 4000;
		useCORS = false;
		break;
	default:
		log.error(`Unknown run mode '${runMode}'. Must be 'public' or 'private'`);
		process.exit(-1);
}

// Load the server handler
require('./server.js');

// Create the server
CreateServer(listenAddress, listenPort, runMode, useCORS, isDevelopment, (logMessage) => {
	log.info(logMessage);
});

