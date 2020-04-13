'use strict';

// Register global function to load shared modules
global.sharedPath = require('path').join(__dirname, '..', 'shared');
global.requireShared = (moduleName) => require(`${sharedPath}/${moduleName}`);

// ============================================================================
// Tests
// ============================================================================

// Setup the environment like AWS. Ask Scott to get this file if you don't have the envvars already.
// Format is 'VARIABLE=value', one per line, with '#' denoting a comment
const envFileLines = require('fs').readFileSync('../aws.env', {encoding: 'utf8'}).split('\n');
envFileLines.forEach((line) => {
	line = line.trim();
	if (line.length == 0 || line.startsWith('#')) { return; }
	const v = line.split('=', 2);
	process.env[v[0]] = v[1];
});

// Load the logger
requireShared('services/logger.js');

// Load the tests
const testMigration = require('./testMigration.js');

// Ensure the shared modules load
testMigration.TestSharedModules();

// Tests End
// ============================================================================
