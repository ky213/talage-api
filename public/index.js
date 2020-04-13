'use strict';

// Register global function to load shared modules
global.sharedPath = require('path').join(__dirname, '..', 'shared');
global.requireShared = (moduleName) => require(`${sharedPath}/${moduleName}`);

// ============================================================================
// Tests
// ============================================================================

// Setup the environment like AWS.
// Copy ../aws.env.example to ../aws.env and populate it.
const environment = require('dotenv').config({path: '../aws.env'});
if (environment.error) {
	throw environment.error;
}

// Load the logger
requireShared('services/logger.js');

// Load the tests
const testMigration = require('./testMigration.js');

// Ensure the shared modules load
testMigration.TestSharedModules();

// Tests End
// ============================================================================
