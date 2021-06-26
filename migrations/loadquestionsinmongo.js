/* eslint-disable no-lonely-if */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-process-exit */
/* eslint sort-keys: "off"*/

'use strict';

const moment = require('moment');
const moment_timezone = require('moment-timezone');
const clonedeep = require('lodash.clonedeep');

// Add global helpers to load shared modules
global.rootPath = require('path').join(__dirname, '..');
global.sharedPath = require('path').join(global.rootPath , '/shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

var mongoose = global.requireRootPath('./mongoose.js');
const colors = require('colors');


const logger = global.requireShared('/services/logger.js');
const db = global.requireShared('/services/db.js');
const globalSettings = global.requireRootPath('./settings.js');

/**
 * Convenience method to log errors both locally and remotely. This is used to display messages both on the console and in the error logs.
 *
 * @param {string} message - The message to be logged
 * @returns {void}
 */
function logLocalErrorMessage(message) {
    if (global.log) {
        log.error("Global error trap: " + message);
    }
    // eslint-disable-next-line no-console
    console.log(colors.red(message));
}


/**
 * Main entrypoint
 *
 * @returns {void}
 */
async function main() {
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
    if (!globalSettings.load()) {
        logLocalErrorMessage('Error loading variables. Stopping.');
        return;
    }

    // Connect to the logger
    if (!logger.connect()) {
        logLocalErrorMessage('Error connecting to log. Stopping.');
        return;
    }

    // Connect to the database
    if (!await db.connect()) {
        logLocalErrorMessage('Error connecting to database. Stopping.');
        return;
    }

    // Load the database module and make it globally available
    global.db = global.requireShared('./services/db.js');


    // MONGO

    global.monogdb = mongoose();
    //var mongoose = require('./mongoose');

    //Mongo connect event
    var hasMongoMadeInitialConnected = false;
    talageEvent.on('mongo-connected', function() {
        //log.info('Assetws Mongoose connected to mongodb');
        if (hasMongoMadeInitialConnected === false) {
            hasMongoMadeInitialConnected = true;
            runFunction();
        }

    });

    talageEvent.on('mongo-disconnected', function() {
        log.warn('Mongoose disconnected');

    });

    talageEvent.on('mongo-error', function(err) {
        log.error('Mongoose database error ' + err);
    });


}

/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {

    const QuestionModel = require('mongoose').model('Question');
    const sql = `select q.id as 'talageQuestionId', q.parent, q.parent_answer, q.sub_level, q.question AS text, q.hint, q.type AS typeId, qt.name AS typeDesc, q.hidden, q.state from clw_talage_questions q
                LEFT JOIN clw_talage_question_types AS qt ON q.type = qt.id`;

    let resultQ = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });


    let questionCount = 0;
    for (const questionSQL of resultQ){

        const mQuestion = new QuestionModel(questionSQL);
        if(questionSQL.state < 1){
            mQuestion.active = false;
        }

        //load message model and get message list.
        const sql2 = `select * from clw_talage_question_answers where question = ${mQuestion.talageQuestionId} `;

        let result = await db.query(sql2).catch(function(error) {
            // Check if this was
            log.error("error " + error);
            return false;
        });
        // eslint-disable-next-line array-element-newline
        mQuestion.answers = [];
        for(let i = 0; i < result.length; i++){
            try {
                if(result[i].answer){
                    const answerJSON = {
                        answerId: result[i].id,
                        answer: result[i].answer,
                        default: result[i].default
                    }
                    mQuestion.answers.push(answerJSON)
                }
            }
            catch(err){
                log.error("Adding question answers error " + err + __location);
                return false;
            }
        }
        await mQuestion.save();
        questionCount++;
        if(questionCount % 100 === 0){
            log.debug(`processed ${questionCount} of ${resultQ.length} `)
        }
    }

    log.debug("Done!");
    process.exit(1);

}

main();