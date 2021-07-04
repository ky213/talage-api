/* eslint-disable no-unused-vars */
'use strict';

//global setup mimic index.js.
global.sharedPath = require('path').join(__dirname, '../shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}${moduleName}`);

const logger = require('../shared/services/logger.js');
const globalSettings = require('../settings.js');
const AWS = require('aws-sdk');
const queueHandler = require('../tasksystem/queuehandler.js');

// eslint-disable-next-line require-jsdoc
function logLocalErrorMessage(message){
    if(global.log){
        log.error(message + __location);
    }
    // eslint-disable-next-line no-console
    console.log(message);
}

// ####### setup globals for mocking ###################################

// Load the settings from a .env file - Settings are loaded first
if(!globalSettings.load()){
    logLocalErrorMessage('Error loading variables. Stopping.');
    return;
}

//logger for mocking  - no AWS
// like local dev console only.
global.settings.AWS_LOG_TO_AWS_ELASTICSEARCH = 'NO'
if(!logger.connect()){
    logLocalErrorMessage('Error connecting to logger. Stopping.');
    return;
}


//S3 for mocking
global.s3 = new AWS.S3();

global.queueHandler = queueHandler;


// // ##########  TESTS #################################
// var testTaskCheckinrecords = require('./test-task-checkinrecords.js')
// var testSlackSvc = require('./test-slacksvc.js')