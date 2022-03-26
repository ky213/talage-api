/* eslint-disable array-element-newline */
/* eslint-disable object-property-newline */
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
const axios = require('axios');
var fs = require('fs');

// Add global helpers to load shared modules
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('/services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const utility = require('./shared/helpers/utility.js');
const redisSvc = require('./shared/services/redissvc.js');

//const crypt = global.requireShared('./services/crypt.js');

var mongoose = require('./mongoose');
const colors = require('colors');
const logger = global.requireShared('/services/logger.js');
const globalSettings = require('./settings.js');


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

    if(global.settings.ENV === 'production'){
        // eslint-disable-next-line no-console
        console.log(colors.red.bold('not allowed to run on production'));
        process.exit(1);
    }

    // Connect to the logger
    if (!logger.connect()) {
        logLocalErrorMessage('Error connecting to log. Stopping.');
        return;
    }

    // // Connect to the redis
    if(!await redisSvc.connect()){
        logLocalErrorMessage('Error connecting to redis.');
        //Only used by QuoteApp V2 and public API.
        // leave rest of API functional.
        //return;
    }


    if(!await redisSvc.connectReadOnly()){
        logLocalErrorMessage('Error connecting to redis.');
        //Only used by QuoteApp V2 and public API.
        // leave rest of API functional.
        //return;
    }

    //set up global even if connect fails, errors will be contained to redisSvc vs undefined errors.
    global.redisSvc = redisSvc;
    log.info('Startup Redis Svc')


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

    // MONGO
    await mongoose.init();
}

function onErr(err) {
    // eslint-disable-next-line no-console
    console.log(err);
    return 1;
}


/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {

    // if(process.argv.length < 4){
    //     log.error("missing User info");
    //     process.exit(1);

    // }
    // const userEmail = process.argv[2];
    // const userPwd = process.argv[3];

    const promptly = require('promptly');
    const userEmail = await promptly.prompt('userEmail: ');
    const userPwd = await promptly.password('userPwd: ');

    const userRemote = await promptly.prompt('Remote(Y/N): ');

    let numOfRunsInput = await promptly.prompt('# of Runs: ');
    if(numOfRunsInput === ''){
        numOfRunsInput = "1"
    }

    const numOfRuns = parseInt(numOfRunsInput,10)

    let pauseBetweenRunsInput = await promptly.prompt('Pause between Runs(sec): ');
    if(pauseBetweenRunsInput === ''){
        pauseBetweenRunsInput = "0"
    }

    const pauseBetweenRuns = parseInt(pauseBetweenRunsInput,10)


    //get app auth token
    // eslint-disable-next-line object-curly-newline
    const postBody = {"user": userEmail, "password": userPwd};
    let apiAuthApUrl = "http://localhost:3000/v1/api/auth"
    let apiApRequoteUrlBase = "http://localhost:3000/v1/api/application"
    if(userRemote === 'Y'){
        apiAuthApUrl = "https://devapi.talageins.com/v1/api/auth"
        apiApRequoteUrlBase = "https://devapi.talageins.com/v1/api/application"
    }

    let authResponse = null;
    try{
        authResponse = await axios.post(apiAuthApUrl, JSON.stringify(postBody),{headers: {'Content-Type': 'application/json'}});
    }
    catch(err){
        log.error('API Auth AP error ' + err + __location);
        process.exit(1)
    }
    if(!authResponse.data.token){
        log.error("missing authResponse.token " + JSON.stringify(authResponse.data));
        process.exit(1);
    }

    // eslint-disable-next-line array-element-newline
    //Wheelhouse
    const path = 'testrunapplications.json';
    let appListText = fs.readFileSync(path);
    let appList = JSON.parse(appListText);
    const ApplicationBO = global.requireShared('models/Application-BO.js');
    //var Application = global.mongoose.Application;
    const updateMysql = false;
    for(let run = 0; run < numOfRuns; run++){


        for(let i = 0; i < appList.length; i++){
            const sourceAppId = appList[i].sourceAppId;
            log.debug("copying applicationId " + sourceAppId);
            try{
            //load applicationBO
                const applicationBO = new ApplicationBO();
                //setup old app to copy from;
                let mongoApp = await applicationBO.getById(sourceAppId)
                if(mongoApp){
                    if(!mongoApp.additionalInfo){
                        mongoApp.additionalInfo = {}
                    }
                    log.debug("Loaded " + appList[i].description + " sourceAppId " + sourceAppId + " applicationId " + mongoApp.applicationId)
                    mongoApp.additionalInfo.copiedFromMysqlId = mongoApp.mysqlId;
                    mongoApp.additionalInfo.copiedFromAppId = mongoApp.applicationId;

                    //Clear id's for a copy.
                    delete mongoApp.applicationId
                    delete mongoApp.uuid
                    delete mongoApp.mysqlId
                    delete mongoApp.createdAt

                    //update policies dates
                    const newEffectiveDate = moment().add(15,"days");
                    const newExpirationDate = newEffectiveDate.clone().add(1,'years');

                    if(appList[i].policyTypes){
                        log.debug("RESETTING POLICYTYPES")
                        const appPolicyList = []
                        for(const appPolicyCd of appList[i].policyTypes){
                            const policyJSON = mongoApp.policies.find((policy) => policy.policyType === appPolicyCd)
                            if(policyJSON){
                                appPolicyList.push(policyJSON)
                            }
                        }
                        if(appPolicyList.length > 0){
                            mongoApp.policies = appPolicyList
                        }
                    }

                    if(mongoApp.policies && mongoApp.policies.length > 0){
                        for(let j = 0; j < mongoApp.policies.length; j++){
                            mongoApp.policies[j].effectiveDate = newEffectiveDate;
                            mongoApp.policies[j].expirationDate = newExpirationDate;
                        }
                    }
                    //reset status to question_done
                    mongoApp.status = 'questions_done'
                    mongoApp.appStatusId = 10;
                    mongoApp.processStateOld = 1;
                    mongoApp.lastStep = 8;
                    mongoApp.progress = "unknown";
                    mongoApp.metrics = null;

                    if(appList[i].requiresNewEin){
                        mongoApp.ein = `${mongoApp.ein.substr(0, 2)}${Math.floor(Math.random() * (9999999 - 1000000) + 1000000)}`;
                        mongoApp.businessName = `${mongoApp.businessName} - ${Math.floor(Math.random() * (9999999 - 1000000) + 1000000)}`;
                    }
                    if(appList[i].agencyId){
                        mongoApp.agencyId = appList[i].agencyId
                    }
                    if(appList[i].agencyLocationId){
                        mongoApp.agencyLocationId = appList[i].agencyLocationId
                    }


                    //save mongoinsert
                    const newApplicationJSON = await applicationBO.insertMongo(mongoApp, updateMysql);
                    log.debug("Saved new sourceAppId " + sourceAppId + " applicationId " + newApplicationJSON.applicationId);

                    //get questions for new app - new policy effective date
                    const questionDefResponse = await getQuestions(newApplicationJSON.applicationId, apiApRequoteUrlBase, authResponse.data.token).catch((err) => {
                        log.error(`Error getting API questions ${err}`)
                    });
                    if(questionDefResponse && questionDefResponse.questionList){
                        let answerList = [];
                        let newQuestions = false;
                        for(let qidx = 0; qidx < questionDefResponse.questionList.length; qidx++){
                            const questionDef = questionDefResponse.questionList[qidx]
                            //
                            const existingAppQ = newApplicationJSON.questions.find((appQ) => appQ.questionId === questionDef.talageQuestionId)
                            if(existingAppQ){
                                const newAnswer = {
                                    "hidden": false,
                                    "questionId": questionDef.talageQuestionId,
                                    "questionType": existingAppQ.questionType,
                                    "questionText": questionDef.text,
                                    "answerId": existingAppQ.answerId,
                                    "answerValue": existingAppQ.answerValue
                                }
                                answerList.push(newAnswer);
                                continue;
                            }

                            if(questionDefResponse.answeredList && questionDefResponse.answeredList.length > 0){
                                const existingAnswer = questionDefResponse.answeredList.find((a) => a.questionId === questionDef.talageQuestionId)
                                //do not change existing answers
                                if(existingAnswer){
                                    answerList.push(existingAnswer);
                                    continue;
                                }
                            }
                            newQuestions = true;
                            if(questionDef.typeId === 1){
                                //Yes/NO
                                const newAnswer = {
                                    "hidden": false,
                                    "questionId": questionDef.talageQuestionId,
                                    "questionType": "Yes/No",
                                    "questionText": questionDef.text,
                                    "answerId": 1,
                                    "answerValue": "No"
                                }
                                //Get default anwser.
                                const defaultAnswer = questionDef.answers.find((a) => a.default === true)
                                if(defaultAnswer){
                                    newAnswer.answerId = defaultAnswer.answerId
                                    newAnswer.answerValue = defaultAnswer.answer
                                }
                                else if(questionDef.answers[0].answer === "No"){
                                    //1st one is suppose to NO
                                    newAnswer.answerId = questionDef.answers[0].answerId
                                    newAnswer.answerValue = questionDef.answers[0].answer
                                }
                                else {
                                    newAnswer.answerId = questionDef.answers[1].answerId
                                    newAnswer.answerValue = questionDef.answers[1].answer
                                }
                                answerList.push(newAnswer);
                            }
                            else if (questionDef.typeId === 5){
                                //special processing for known questoins (Travelers' employees shift)

                                const newAnswer = {
                                    "hidden": false,
                                    "questionId":  questionDef.talageQuestionId,
                                    "questionType": "Text - Single Line",
                                    "questionText": questionDef.text,
                                    "answerValue": ""
                                }

                                if(questionDef.text === "What is the maximum number of employees per shift at any one location?"){
                                    let totalFTE = 0;
                                    newApplicationJSON.locations.forEach((location) => {
                                        totalFTE += location.full_time_employees;
                                    });

                                    newAnswer.answerValue = totalFTE;
                                    answerList.push(newAnswer);
                                }
                            }


                        }
                        // not handling or added other question types
                        if(newQuestions){
                            const saveResp = await postApplicationQuestionAnswers(newApplicationJSON, answerList, apiApRequoteUrlBase, authResponse.data.token).catch((err) => {
                                log.error(`Error Putting API questions ${err}`)
                            });
                        }

                    }


                    //run quote process
                    const quoteURL = `${apiApRequoteUrlBase}/quote`;
                    const putBody = {"applicationId": newApplicationJSON.applicationId};
                    try{
                        const instance = axios.create();
                        instance.defaults.timeout = 4500;
                        // eslint-disable-next-line dot-notation
                        instance.defaults.headers.common["Authorization"] = authResponse.data.token;
                        await instance.put(quoteURL, JSON.stringify(putBody),{headers: {'Content-Type': 'application/json'}});
                    }
                    catch(err){
                        log.error('API AP Requote error ' + err + __location);
                        // process.exit(1)
                    }
                }
                else {
                    log.error("Failed to load sourceAppId " + sourceAppId);
                }

            }
            catch(err){
                log.error(`Copying and quoting mongo application sourceAppId: ${sourceAppId} error ` + err + __location)
            }
        }
        if(pauseBetweenRuns > 0){
            log.debug(`pausing ${pauseBetweenRuns} seconds`)
            await utility.Sleep(pauseBetweenRuns * 1000);
        }
    }
    log.debug("Done!");
    process.exit(1);
}

async function getQuestions(applicationId, apiPostAppUrlBase, authToken){

    //log.debug(`Getting Questions for ${currCompanyAppJSON.businessName}`)
    const instance = axios.create();
    instance.defaults.timeout = 4500;
    // eslint-disable-next-line dot-notation
    instance.defaults.headers.common["Authorization"] = authToken;
    const responseAppDoc = await instance.get(apiPostAppUrlBase + `/${applicationId}/questions`,{headers: {'Content-Type': 'application/json'}});
    return responseAppDoc.data;

}

async function postApplicationQuestionAnswers(currCompanyAppJSON, questionAnswerList, apiPostAppUrlBase, authToken){
    if(!currCompanyAppJSON?.applicationId){
        return;
    }

    //log.debug(`Putting Application QuestionAnswers for ${currCompanyAppJSON.businessName} - ${currCompanyAppJSON.applicationId}`)

    const newAppData = {
        applicationId: currCompanyAppJSON.applicationId,
        questions: questionAnswerList
    }

    const instance = axios.create();
    instance.defaults.timeout = 4500;
    // eslint-disable-next-line dot-notation
    instance.defaults.headers.common["Authorization"] = authToken;
    await instance.put(apiPostAppUrlBase, JSON.stringify(newAppData),{headers: {'Content-Type': 'application/json'}});
    return {saved: true};
}

main();
