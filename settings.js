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
    'S3_SECURE_BUCKET',
    'IMAGE_URL',
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
    'SQS_TASK_QUEUE',
    //MONGO
    'MONGODB_CONNECTIONURL',
    'MONGODB_DATABASENAME'
];

// Optional variables with their defaults if they are not provided
const optionalVariables = [
    'AWS_USE_KEYS',
    'MONGODB_CONNECTIONURLQUERY',
    'USING_AURORA_CLUSTER',
    'DATABASE_RO_HOST_LIST',
    'USE_REDIS',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_CLUSTER',
    'USE_REDIS_QUESTION_CACHE'
]

exports.load = () => {
    // eslint-disable-next-line prefer-const
    let variables = {};
    variables.AWS_USE_KEYS = "NO";
    //Default to no use mongo if there are not ENV settings for it.
    variables.USE_MONGO = "NO";
    // Disable binding
    variables.DISABLE_BINDING = "NO";
    // Default to use questions cached in Redis
    variables.USE_REDIS_QUESTION_CACHE = "YES";
    variables.REDIS_QUESTION_CACHE_JOB_COUNT = 3;


    if (fs.existsSync('local.env')){
        // Load the variables from the aws.env file if it exists
        console.log('Loading settings from local.env file');
        try {
            const variablesFile = environment.parse(fs.readFileSync('local.env', {"encoding": 'utf8'}));
            for (const fileProp in variablesFile) {
                if(variablesFile[fileProp]){
                    variables[fileProp] = variablesFile[fileProp]
                }
            }
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
    optionalVariables.forEach((variableName) => {
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

    // Add any other hard-coded global settings here
    console.log('Loading hard-coded settings');

    // ! check did not work.
    if (global.settings.S3_SECURE_BUCKET) {
        //console.log('Secure bucket set');
    }
    else if (global.settings.ENV === 'development') {
        global.settings.S3_SECURE_BUCKET = global.settings.S3_BUCKET;
    }
    else {
        console.log(colors.red('\tMissing S3_SECURE_BUCKET'));
        return false;
    }
    global.settings.JWT_TOKEN_EXPIRATION = '15h';
    console.log(`\tJWT_TOKEN_EXPIRATION = ${global.settings.JWT_TOKEN_EXPIRATION}`);

    console.log(colors.green('\tSettings Load Completed'));

    return true;
};