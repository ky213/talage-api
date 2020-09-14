/* eslint sort-keys: "off"*/

'use strict';

const moment = require('moment');

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = require('./shared/services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
global.tracker = tracker;
global.WHEELHOUSE_AGENCYNETWORK_ID = 1;
global.DIGALENT_AGENCYNETWORK_ID = 2;

const colors = require('colors');

const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');
const globalSettings = require('./settings.js');
const utility = require('./shared/helpers/utility.js');
const taskDistributor = require('./tasksystem/task-distributor.js');
const queueHandler = require('./tasksystem/queuehandler.js');
const responseObject = require('./tasksystem/response-object.js')


var hasMongoMadeInitialConnected = false;

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logLocalErrorMessage(message){
    if(global.log){
        log.error("Global error trap: " + message);
    }
    // eslint-disable-next-line no-console
    console.log(colors.red(message));
}

/**
 * Processes queue messages
 *
 * @returns {void}
 */
async function processQueue(){
    // Repeatedly grab work items
    log.info('Processing task queue: ' + global.settings.SQS_TASK_QUEUE);
    while(true){
        // eslint-disable-next-line no-await-in-loop
        const status = await queueHandler.getTaskQueueItem();
        if(status.success){
            if(status.data.Messages && status.data.Messages.length > 0){
                const messages = status.data.Messages;
                // log.debug(`Retrieved ${messages.length} messages`);
                for(let i = 0; i < messages.length; i++){
                    // Set references to fields for convenience
                    const message = messages[i];
                    taskDistributor.distributeTask(message);
                }
            }
        }
        else if(status === responseObject.errorQueueWaitTimeout){
            // We timed out waiting for a message
            await utility.Sleep(100);
        }
        else {
            // We had an error waiting for a message. Add log entry
            log.error(`ERROR: ${status.error}`);
        }
    }
}


/**
 * Main entrypoint
 *
 * @returns {void}
 */
async function main(){
    // eslint-disable-next-line no-console
    console.log(Date());
    // eslint-disable-next-line no-console
    console.log(colors.green.bold('-'.padEnd(80, '-')));
    // eslint-disable-next-line no-console
    console.log(colors.green.bold('Initializing'));
    // eslint-disable-next-line no-console
    console.log(colors.green.bold('-'.padEnd(80, '-')));
    // eslint-disable-next-line no-console
    console.log(Date());

    // Load the settings from a .env file - Settings are loaded first
    if(!globalSettings.load()){
        logLocalErrorMessage('Error loading variables. Stopping.');
        return;
    }

    // Connect to the logger
    if(!logger.connect()){
        logLocalErrorMessage('Error connecting to log. Stopping.');
        return;
    }

    // Connect to the database
    if(!await db.connect()){
        logLocalErrorMessage('Error connecting to database. Stopping.');
        return;
    }

    // Load the database module and make it globally available
    global.db = global.requireShared('./services/db.js');

    // MONGO
    if(global.settings.USE_MONGO === "YES"){
        var mongoose = require('./mongoose');
        global.monogdb = mongoose();
        //Mongo connect event here to start queue processing
        talageEvent.on('mongo-connected', function() {
            //log.info('Assetws Mongoose connected to mongodb');
            if(hasMongoMadeInitialConnected === false){
                hasMongoMadeInitialConnected = true;
                startQueueProcessing();
            }

        });

        talageEvent.on('mongo-disconnected', function() {
            log.warn('Mongoose disconnected');

        });

        talageEvent.on('mongo-error', function(err) {
            log.error('Mongoose database error ' + err);
        });

    }
    else {
        startQueueProcessing();
    }
}

/**
 * Start Queue procescing
 *
 * @returns {void}
 */
async function startQueueProcessing() {

    // Ready to start the queue processing
    if(await queueHandler.initialize()){
        global.queueHandler = queueHandler;
        processQueue();
    }
    else {
        logLocalErrorMessage('Error initialzing  to queueHandler. Stopping.');
        return;
    }


    log.debug('checking develop setting RUN_LOCAL_TASK ' + (global.settings.RUN_LOCAL_TASK ? global.settings.RUN_LOCAL_TASK : "NO"))

    // local development of tasks run one of the task.
    if(global.settings.ENV === 'development' && global.settings.RUN_LOCAL_TASK && global.settings.RUN_LOCAL_TASK === 'YES'){
        log.debug('Auto Running Task');
        const taskJson = {"taskname": "abandonquote"};
        const messageTS = moment().utc().valueOf();
        const messageAtributes = {"SentTimestamp": messageTS};
        const testMessage = {
            "Body": JSON.stringify(taskJson),
            "Attributes": messageAtributes,
            "ReceiptHandle": "TEST"
        };
        const messageString = JSON.stringify(testMessage);
        log.debug(messageString);
        const resp = await taskDistributor.distributeTask(testMessage).catch(function(err){
            log.debug('taskProcessor error: ' + err + __location);
        });
        log.debug('Finished Running Task' + resp);
    }

}

main();