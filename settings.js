'use strict';

// Load the environment
const environment = require('dotenv');
const fs = require('fs');
const colors = require('colors');

/**
 * Read in settings in the following order:
 * 		- If there is a 'local.env' file present in the project root directory, read the settings from that file
 * 		- If not, read the settings from the environment
 */

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
	'SENDGRID_API_KEY'
];

exports.load = () => {
	let variables = null;

	if(fs.existsSync('local.env')){
		// Load the variables from the aws.env file if it exists
		console.log('Loading settings from local.env file'); // eslint-disable-line no-console
		try{
			variables = environment.parse(fs.readFileSync('local.env', {'encoding': 'utf8'}));
		}catch(error){
			console.log(colors.red(`\tError parsing aws.env: ${error}`)); // eslint-disable-line no-console
			return false;
		}
	}else{
		// Use the environment variables otherwise
		console.log('Loading settings from environment variables'); // eslint-disable-line no-console
		variables = process.env;
	}
	// Ensure required variables exist and inject them into the global 'settings' object
	global.settings = {};
	for(let i = 0; i < requiredVariables.length; i++){
		if(!Object.prototype.hasOwnProperty.call(variables, requiredVariables[i])){
			console.log(colors.red(`\tError: missing variable '${requiredVariables[i]}'`)); // eslint-disable-line no-console
			return false;
		}
		global.settings[requiredVariables[i]] = variables[requiredVariables[i]];
	}
	console.log(colors.green('\tCompleted')); // eslint-disable-line no-console

	/*
	 * Add any other global settings here
	 * global.settings. = ;
	 */

	return true;
};