/* eslint sort-keys: "off"*/

'use strict';
// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);

const AWS = require('aws-sdk');
const colors = require('colors');

const logger = require('./shared/services/logger.js');
const db = require('./shared/services/db.js');
const globalSettings = require('./settings.js');
const utility = require('./shared/helpers/utility.js');
const taskDistributor = require('./tasksystem/task-distributor.js');
const queueHandler = require('./tasksystem/queueHandler.js');


/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logLocalErrorMessage(message){
	if(global.log){
		log.error(message);
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
	log.info('Processing task queue...');
	while(true){
		// eslint-disable-next-line no-await-in-loop
		const status = await queueHandler.getTaskQueueItem();
		if(status.success){
			if(status.data.Messages && status.data.Messages.length >0){
				const messages = status.data.Messages;
				//log.debug(`Retrieved ${messages.length} messages`);
				for(let i = 0; i < messages.length; i++){
					// Set references to fields for convenience
					const message = messages[i];
					taskDistributor.distributeTask(message);
				}
			}
		}else if(status === statusObject.errorQueueWaitTimeout){
			// We timed out waiting for a message
			await utility.Sleep(100);
		}else{
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

	// Ready to start the queue processing
	if(await queueHandler.initialize()){
		global.queueHandler = queueHandler;
		processQueue();
	}
	else {
		logLocalErrorMessage('Error initialzing  to queueHandler. Stopping.');
		return;
	}
	log.debug('checking develop settings ' + global.settings.RUN_LOCAL_TASK )
	//local development of tasks run one of the task.
	if(global.settings.ENV === 'development' && global.settings.RUN_LOCAL_TASK && global.settings.RUN_LOCAL_TASK === 'YES'){
		log.debug('Auto Running Task');
		//require file.
		const taskAbandonQuote = require('./tasksystem/task-abandonquote.js');
		//run task
		await taskAbandonQuote.abandonquotetaskExternal().catch(function(err){
			log.debug(error);
		});

	}

	
}

main();