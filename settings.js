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
    'APPLICATION_URL',
    // Internal Credentials
    'AUTH_SECRET_KEY',
    'ENCRYPTION_KEY',
    'SALT',
    'SECRET',
    'TEST_API_TOKEN',
    // AWS
    //'AWS_KEY',
    //'AWS_SECRET',
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

// Optional variables with their defaults if they are not provided
const optionalVariables = {
    AWS_USE_KEYS: "YES",
    S3_SECURE_BUCKET: null,
    USE_MONGO: "NO",
    MONGODB_CONNECTIONURL: "",
    MONGODB_DATABASENAME: "",
    MONGODB_CONNECTIONURLQUERY: "",
    DEFAULT_QUOTE_AGENCY_SLUG: "talage",
    APPLICATION_AGE_CHECK_BYPASS: "NO",
    JWT_TOKEN_EXPIRATION: "15h",
    OVERRIDE_EMAIL: "NO",
    TEST_EMAIL: null,
    QUOTE_ONLY_INSURER: null
}

exports.load = () => {
    let variables = {};

    if (fs.existsSync('local.env')){
        // Load the variables from the aws.env file if it exists
        console.log('Loading settings from local.env file');
        try {
            variables = environment.parse(fs.readFileSync('local.env', {"encoding": 'utf8'}));
        }
        catch (error){
            console.log(colors.red(`\tError parsing aws.env: ${error}`));
            return false;
        }
        if (settingsDebugOutput){
            for (const [variableName, variableValue] of Object.entries(variables)) {
                console.log(colors.yellow(`\tSetting ${variableName}=${variableValue}`));
            }
        }
        console.log(colors.green('\tCompleted'));
    }
    // Load the environment variables over the local.env variables
    console.log('Loading required settings from environment variables');
    requiredVariables.forEach((variableName) => {
        if (process.env.hasOwnProperty(variableName)){
            if (settingsDebugOutput){
                console.log(colors.yellow(`\t${variables.hasOwnProperty(variableName) ? 'Overriding' : 'Setting'} ${variableName}=${process.env[variableName]}`));
            }
            variables[variableName] = process.env[variableName];
        }
    });
    console.log(colors.green('\tCompleted'));
    // optional array....
    console.log('Loading optional settings from environment variables');
    for (const [variableName, defaultValue] of Object.entries(optionalVariables)) {
        if (process.env.hasOwnProperty(variableName)) {
            // If the environment has this value, then the environment value will override the existing value
            if (settingsDebugOutput) {
                console.log(colors.yellow(`\t${variables.hasOwnProperty(variableName) ? 'Overriding' : 'Setting'} ${variableName}=${process.env[variableName]}`));
            }
            variables[variableName] = process.env[variableName];
        }
        else if (!variables.hasOwnProperty(variableName)) {
            // If the value is not set anywhere, then set it to the default value.
            if (settingsDebugOutput) {
                console.log(colors.yellow(`\tSetting ${variableName}=${defaultValue} (default value)`));
            }
            variables[variableName] = defaultValue;
        }
    }
    console.log(colors.green('\tCompleted'));

    // Ensure required variables exist and inject them into the global 'settings' object
    global.settings = {};

    //need to add optional settings.
    global.settings = variables;

    // Ensure required variables exist and inject them into the global 'settings' object
    for (let i = 0; i < requiredVariables.length; i++){
        if (!Object.prototype.hasOwnProperty.call(variables, requiredVariables[i])){
            console.log(colors.red(`\tError: missing variable '${requiredVariables[i]}'`));
            return false;
        }
        global.settings[requiredVariables[i]] = variables[requiredVariables[i]];
    }

    // Setting adjustments and special cases

    // ! check did not work.
    if(global.settings.S3_SECURE_BUCKET){
        //console.log('Secure bucket set');
    }
    else if(global.settings.ENV === 'development'){
        global.settings.S3_SECURE_BUCKET = global.settings.S3_BUCKET;
    }
    else {
        console.log(colors.red('\tMissing S3_SECURE_BUCKET'));
        return false;
    }
    console.log(`    JWT_TOKEN_EXPIRATION = ${global.settings.JWT_TOKEN_EXPIRATION}`);

    console.log(colors.green('\tSettings Load Completed'));

    return true;
};