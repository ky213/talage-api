/* eslint-disable no-console */
'use strict';

// Load the environment
const environment = require('dotenv');
const fs = require('fs');
const colors = require('colors');


//  Read in settings in the following order:
//		- If there is a 'local.env' file present in the project root directory, read the settings from that file
//		- Read in the environment variables. The environment variables will override the local.env settings.

// Enable settings debug output at startup.
// This will dump the names/values of the settings from local.env and the names/values in the environment to aid in debugging
// Settings issues.
const settingsDebugOutput = false;


// Variables that are required to be present
const requiredVariables = [
	// Runtime profile
	'ENV',
	'BRAND',
	// Public URLs
	'SITE_URL',
	'PORTAL_URL',
	'API_URL',
	'DIGALENT_AGENTS_URL',
	'DIGALENT_SITE_URL',
	'TALAGE_AGENTS_URL',
	// Internal Credentials
	'AUTH_SECRET_KEY',
	'ENCRYPTION_KEY',
	'SALT',
	'SECRET',
	'TEST_API_TOKEN',
	// AWS
	'AWS_KEY',
	'AWS_SECRET',
	'AWS_ELASTICSEARCH_ENDPOINT',
	'AWS_ELASTICSEARCH_LOGLEVEL',
	'AWS_LOG_TO_AWS_ELASTICSEARCH',
	'AWS_REGION',
	// S3
	'S3_BUCKET',
	// Database
	'DATABASE_NAME',
	'DATABASE_HOST',
	'DATABASE_PASSWORD',
	'DATABASE_PREFIX',
	'DATABASE_USER',
	// API Server
	'PUBLIC_API_PORT',
	'PRIVATE_API_PORT',
	'UPTIME_PORT',
	// Sendgrid
	'SENDGRID_API_KEY',
	// SQS
	'SQS_TASK_QUEUE'
];

exports.load = () => {
	let variables = {};

	if (fs.existsSync('local.env')) {
		// Load the variables from the aws.env file if it exists
		console.log('Loading settings from local.env file');
		try {
			variables = environment.parse(fs.readFileSync('local.env', { 'encoding': 'utf8' }));
		} catch (error) {
			console.log(colors.red(`\tError parsing aws.env: ${error}`));
			return false;
		}
		if (settingsDebugOutput) {
			requiredVariables.forEach((variableName) => {
				if (variables.hasOwnProperty(variableName)) {
					console.log(colors.yellow(`\tSetting ${variableName}=${variables[variableName]}`));
				}
			});
		}
		console.log(colors.green('\tCompleted'));
	}
	// Load the environment variables over the local.env variables
	console.log('Loading settings from environment variables');
	requiredVariables.forEach((variableName) => {
		if (process.env.hasOwnProperty(variableName)) {
			if (settingsDebugOutput) {
				console.log(colors.yellow(`\t${variables.hasOwnProperty(variableName) ? 'Overriding' : 'Setting'} ${variableName}=${process.env[variableName]}`));
			}
			variables[variableName] = process.env[variableName];
		}
	});
	console.log(colors.green('\tCompleted'));

	// Ensure required variables exist and inject them into the global 'settings' object
	global.settings = {};

	//need to add optional settings.
	global.settings = variables;

	// Ensure required variables exist and inject them into the global 'settings' object
	for (let i = 0; i < requiredVariables.length; i++) {
		if (!Object.prototype.hasOwnProperty.call(variables, requiredVariables[i])) {
			console.log(colors.red(`\tError: missing variable '${requiredVariables[i]}'`));
			return false;
		}
		global.settings[requiredVariables[i]] = variables[requiredVariables[i]];
	}

	// Add any other global settings here
	// Global.settings. = ;

	return true;
};