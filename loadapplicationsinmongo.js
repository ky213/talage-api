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
global.sharedPath = require('path').join(__dirname, 'shared');
global.requireShared = (moduleName) => require(`${global.sharedPath}/${moduleName}`);
global.rootPath = require('path').join(__dirname, '/');
global.requireRootPath = (moduleName) => require(`${global.rootPath}/${moduleName}`);
const talageEvent = global.requireShared('/services/talageeventemitter.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const crypt = global.requireShared('./services/crypt.js');


var mongoose = require('./mongoose');

const BusinessModel = global.requireShared('models/Business-model.js');
const BusinessContactModel = global.requireShared('models/BusinessContact-model.js');
const BusinessAddressModel = global.requireShared('models/BusinessAddress-model.js');
const BusinessAddressActivityCodeModel = global.requireShared('models/BusinessAddressActivityCode-model.js');


const ApplicationActivityCodesModel = global.requireShared('models/ApplicationActivityCodes-model.js');
const ApplicationPolicyTypeBO = global.requireShared('models/ApplicationPolicyType-BO.js');
const LegalAcceptanceModel = global.requireShared('models/LegalAcceptance-model.js');
const ApplicationClaimBO = global.requireShared('models/ApplicationClaim-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const QuestionBO = global.requireShared('./models/Question-BO.js');
const QuestionAnswerBO = global.requireShared('./models/QuestionAnswer-BO.js');
const QuestionTypeBO = global.requireShared('./models/QuestionType-BO.js');

const ApplicationQuestionBO = global.requireShared('./models/ApplicationQuestion-BO.js');


const colors = require('colors');


const logger = global.requireShared('/services/logger.js');
const db = global.requireShared('/services/db.js');
const globalSettings = require('./settings.js');
const {debug} = require('request');


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


//mapping function
function mapToMongooseJSON(sourceJSON, targetJSON, propMappings){
    // const propMappings = {
    //     agency_location: "agencyLocationId",
    //     agency: "agencyId",
    //     name: "businessName",
    //     "id": "mysqlId",
    //     "state": "processStateOld"
    // }
    for(const sourceProp in sourceJSON){
        if(typeof sourceJSON[sourceProp] !== "object"){
            if(propMappings[sourceProp]){
                const appProp = propMappings[sourceProp]
                targetJSON[appProp] = sourceJSON[sourceProp];
            }
            else {
                //check if snake_case
                if(sourceProp.isSnakeCase()){
                    targetJSON[sourceProp.toCamelCase()] = sourceJSON[sourceProp];
                }
                else {
                    targetJSON[sourceProp] = sourceJSON[sourceProp];
                }
            }

        }
    }
}


async function processQuestions(appId, applicationJSON){
    const applicationQuestionBO = new ApplicationQuestionBO()
    let appQuestionListMysql = null
    try{
        appQuestionListMysql = await applicationQuestionBO.loadFromApplicationId(appId);
    }
    catch(err){
        log.debug("get application questions " + err + __location);
        return;
    }
    if(appQuestionListMysql && appQuestionListMysql.length > 0){
        const questionTypeBO = new QuestionTypeBO();
        // Load the request data into it
        const questionTypeListDB = await questionTypeBO.getList().catch(function(err) {
            log.error("questionTypeBO load error " + err + __location);
        });

        applicationJSON.questions = [];
        //get text and turn into list of question objects.

        for (var i = 0; i < appQuestionListMysql.length; i++) {
            const appQuestionMysql = appQuestionListMysql[i];
            const questionJSON = {};
            questionJSON.questionId = appQuestionMysql.question;

            //get Question def for Question Text and Yes
            const questionBO = new QuestionBO();
            // Load the request data into it
            const questionDB = await questionBO.getById(questionJSON.questionId).catch(function(err) {
                log.error("questionBO load error " + err + __location);
            });
            if (questionDB) {
                questionJSON.questionText = questionDB.question;
                questionJSON.hint = questionDB.hint;
                questionJSON.hidden = questionDB.hidden;
                questionJSON.questionType = questionDB.type;
                if (questionTypeListDB) {
                    const questionType = questionTypeListDB.find(questionTypeTest => questionTypeTest.id === questionDB.type);
                    if (questionType) {
                        questionJSON.questionType = questionType.name;
                    }
                }
            }
            else {
                log.error(`no question record for id ${questionJSON.questionId} ` + __location);
            }

            if (questionJSON.questionType.toLowerCase().startsWith('text')) {
                //const cleanString = questionRequest.answer.replace(/\|/g, ',')
                questionJSON.answerValue = appQuestionMysql.text_answer;
            }
            else if (questionJSON.questionType === 'Checkboxes' && appQuestionMysql.text_answer) {
                //  const arrayString = "|" + appQuestionMysql.answer.join('|');
                const arrayString = appQuestionMysql.text_answer;
                questionJSON.answerValue = arrayString;
                if(appQuestionMysql.text_answer){
                    const answerList = appQuestionMysql.text_answer.split("|");
                    const questionAnswerBO = new QuestionAnswerBO();
                    const questionAnswerListDB = await questionAnswerBO.getListByAnswerIDList(answerList).catch(function(err) {
                        log.error(`questionBO load error questionId ${questionJSON.questionId} appId ${appId}  ` + err + __location);
                    });
                    if (questionAnswerListDB && questionAnswerListDB.length > 0) {
                        questionJSON.answerList = [];
                        for (let j = 0; j < questionAnswerListDB.length; j++) {
                            questionJSON.answerList.push(questionAnswerListDB[j].answer);
                        }

                    }
                    else {
                        log.error(`no questionAnswer record for ids ${JSON.stringify(appQuestionMysql.answer)} ` + __location);
                    }

                }
                else {
                    log.error("Checkbox question " + JSON.stringify(appQuestionMysql))
                }
            }
            else {
                questionJSON.answerId = appQuestionMysql.answer;
                // Need answer value
                const questionAnswerBO = new QuestionAnswerBO();
                // Load the request data into it
                const questionAnswerDB = await questionAnswerBO.getById(questionJSON.answerId).catch(function(err) {
                    log.error("questionBO load error " + err + __location);
                });
                if (questionAnswerDB) {
                    questionJSON.answerValue = questionAnswerDB.answer;
                }
                else {
                    log.error(`no question record for id ${questionJSON.questionId} ` + __location);
                }

            }
            applicationJSON.questions.push(questionJSON);
        }


    }

}

async function processPolicies(appId, applicationJSON, applicationBO) {
    const applicationPolicyTypeBO = new ApplicationPolicyTypeBO()
    let policyListMysql = null
    try{
        policyListMysql = await applicationPolicyTypeBO.loadFromApplicationId(appId);
    }
    catch(err){
        log.debug("get policyType " + err + __location);
        return;
    }
    if(policyListMysql && policyListMysql.length > 0){
        applicationJSON.policies = [];
        for(let i = 0; i < policyListMysql.length; i++){
            const policyMysql = policyListMysql[i];
            const policyType = policyMysql.policy_type
            const policyTypeJSON = {"policyType": policyType}
            if (policyType === "GL") {
                //GL limit and date fields.
                policyTypeJSON.effectiveDate = applicationBO.gl_effective_date
                policyTypeJSON.expirationDate = applicationBO.gl_expiration_date
                policyTypeJSON.limits = applicationBO.limits
                policyTypeJSON.deductible = applicationBO.deductible


            }
            else if (policyType === "WC") {
                policyTypeJSON.effectiveDate = applicationBO.wc_effective_date
                policyTypeJSON.expirationDate = applicationBO.wc_expiration_date
                policyTypeJSON.limits = applicationBO.wc_limits
                policyTypeJSON.coverageLapse = applicationBO.coverage_lapse
                policyTypeJSON.coverageLapseNonPayment = applicationBO.coverage_lapse_non_payment

            }
            else if (policyType === "BOP") {
                policyTypeJSON.effectiveDate = applicationBO.bop_effective_date
                policyTypeJSON.expirationDate = applicationBO.bop_expiration_date
                policyTypeJSON.limits = applicationBO.limits
                policyTypeJSON.coverage = applicationBO.coverage
                policyTypeJSON.deductible = applicationBO.deductible

            }
            //check dates
            cleanApplicationBO(policyTypeJSON);

            applicationJSON.policies.push(policyTypeJSON);
        }
    }

    return;

}

async function processActivityCodes(appId, applicationJSON){
    const applicationActivityCodesModel = new ApplicationActivityCodesModel()
    let activityCodeListMysql = null
    try{
        activityCodeListMysql = await applicationActivityCodesModel.loadFromApplicationId(appId);
    }
    catch(err){
        log.debug("get ActivityCodes " + err + __location);
        return;
    }
    if(activityCodeListMysql && activityCodeListMysql.length > 0){
        applicationJSON.activityCodes = [];
        for(let i = 0; i < activityCodeListMysql.length; i++){
            const activityCodeMysql = activityCodeListMysql[i];
            const activityCodeModelJSON = {
                "ncciCode": activityCodeMysql.ncci_code,
                "payroll": activityCodeMysql.payroll
            }
            applicationJSON.activityCodes.push(activityCodeModelJSON);
        }
    }


    return;
}

async function processClaims(appId, applicationJSON){
    const applicationClaimBO = new ApplicationClaimBO()
    let claimList = null
    try{
        claimList = await applicationClaimBO.loadFromApplicationId(appId);
    }
    catch(err){
        log.debug("get claims " + err + __location);
        return;
    }
    if(claimList && claimList.length > 0){
        applicationJSON.claims = clonedeep(claimList);
        for(let i = 0; i < applicationJSON.claims.length; i++){
            let claim = applicationJSON.claims[i];

            for (const prop in claim) {
                //check if snake_case
                if(prop.isSnakeCase()){
                    claim[prop.toCamelCase()] = claim[prop];
                    delete claim[prop];
                }
            }
            claim.eventDate = claim.date;
        }
    }

    return;
}


async function processContacts(businessId, applicationJSON){
    const businessContactModel = new BusinessContactModel()
    let businessConstactList = null;
    try{
        businessConstactList = await businessContactModel.loadFromBusinessId(businessId)
    }
    catch(err){
        log.debug("get business " + err + __location);
        return;
    }
    if(businessConstactList && businessConstactList.length > 0){
        applicationJSON.contacts = [];
        for(var i = 0; i < businessConstactList.length; i++){
            let businessContact = businessConstactList[i]
            let contactJSON = {};
            if(businessContact.email && businessContact.fname && businessContact.lname && businessContact.phone){
                contactJSON.email = businessContact.email;
                contactJSON.firstName = businessContact.fname;
                contactJSON.lastName = businessContact.lname;
                contactJSON.phone = businessContact.phone;
                contactJSON.primary = businessContact.primary;
                applicationJSON.contacts.push(contactJSON);
            }

        }
    }
    else {
        log.error("no business contact businessId " + businessId)
    }
    return;
}


async function processLocations(businessId, applicationJSON){


    const businessAddressModel = new BusinessAddressModel()
    let businessAddressList = null;
    try{
        businessAddressList = await businessAddressModel.loadFromBusinessId(businessId)
    }
    catch(err){
        //log.debug("get business Address " + err + __location);
        return;
    }
    if(businessAddressList){
        applicationJSON.locations = [];
        for(var i = 0; i < businessAddressList.length; i++){
            let businessAddress = businessAddressList[i]
            let locationJSON = {};
            const businessInfoMapping = {"state_abbr": "state"};
            mapToMongooseJSON(businessAddress, locationJSON, businessInfoMapping);
            //load activity Codes
            locationJSON.activityPayrollList = [];
            const businessAddressActivityCodeModel = new BusinessAddressActivityCodeModel();
            try{
                const query = {address: businessAddress.id}
                const addressActivityCodeList = await businessAddressActivityCodeModel.getList(query);
                for(let j = 0; j < addressActivityCodeList.length; j++){
                    const activity_code = addressActivityCodeList[j];
                    const activityPayrollJSON = {};
                    activityPayrollJSON.ncciCode = activity_code.ncci_code;
                    activityPayrollJSON.payroll = activity_code.payroll;
                    locationJSON.activityPayrollList.push(activityPayrollJSON)

                }
            }
            catch(err){
                log.error(`Error procesing Address ActivityCodes businessId  ${businessId} ${err}` + __location);
            }
            applicationJSON.locations.push(locationJSON);
        }
    }
    else {
        log.error("no business contact businessId " + businessId)
    }

    return;
}

async function processBusinessToMongo(businessId, applicationJSON){
    const businessModel = new BusinessModel();
    let businessJSON = null;
    try{
        businessJSON = await businessModel.getById(businessId)
        cleanApplicationBO(businessJSON);
    }
    catch(err){
        log.error("get business " + err + __location);
        return;
    }

    if(businessJSON.owners){
        try{
            //applicationJSON.owners = JSON.parse(businessJSON.owners);
            const testOwners = JSON.parse(businessJSON.owners);
            if(testOwners && testOwners.length > 0){
                applicationJSON.owners = [];
                for(let i = 0; i < testOwners.length; i++){
                    const owner = testOwners[i];
                    if(owner.fname && owner.lname){
                        applicationJSON.owners.push(owner)
                    }
                }
            }
            delete businessJSON.owners;
        }
        catch(err){
            //applicationJSON.owners = businessJSON.owners;
        }
    }
    if(businessJSON.ein){
        applicationJSON.einEncrypted = await crypt.encrypt(businessJSON.ein);
        delete businessJSON.ein
    }

    if(businessJSON){
        const businessInfoMapping = {
            entity_type: "entityType",
            "mailing_state_abbr": "mailingState"
        }
        mapToMongooseJSON(businessJSON, applicationJSON, businessInfoMapping);
    }


    //map address to app.locations
    return;
}

async function processQuotes(appId, applicationDoc){
    const QuoteBO = global.requireShared('./models/Quote-BO.js');
    const QuoteLimitBO = global.requireShared('./models/QuoteLimit-BO.js');
    var Quote = require('mongoose').model('Quote');
    const quoteBO = new QuoteBO()
    const quoteLimitBO = new QuoteLimitBO();
    let quoteList = null
    try{
        quoteList = await quoteBO.loadFromApplicationId(appId);
    }
    catch(err){
        log.error("get quotes " + err + __location);
    }
    // log.debug("quoteList: " + JSON.stringify(quoteList));
    if(quoteList && quoteList.length > 0){

        for(let i = 0; i < quoteList.length; i++){
            let quoteMysql = quoteList[i];
            const mysqlId = quoteMysql.id;
            let quoteJSON = {};
            let newMongoDoc = true;
            let applicationJSON = {};
            try{
                const mongoApp = await quoteBO.getMongoDocbyMysqlId(mysqlId)
                if(mongoApp){
                    quoteJSON = mongoApp;
                    newMongoDoc = false;
                }
            }
            catch(err){
                log.error("Getting mongo application error " + err + __location)
            }
            quoteJSON.applicationId = applicationDoc.applicationId;
            quoteJSON.mysqlId = quoteMysql.id;
            quoteJSON.mysqlAppId = quoteMysql.application;
            quoteJSON.insurerId = quoteMysql.insurer;

            for (const prop in quoteMysql) {
                //check if snake_case
                if(prop.isSnakeCase()){
                    quoteJSON[prop.toCamelCase()] = quoteMysql[prop];
                }
                else {
                    quoteJSON[prop] = quoteMysql[prop];
                }
            }
            quoteJSON.applicationId = applicationDoc.applicationId;
            quoteJSON.mysqlId = quoteMysql.id;
            quoteJSON.mysqlAppId = quoteMysql.application;
            quoteJSON.insurerId = quoteMysql.insurer;

            quoteJSON.packageTypeId = quoteMysql.package_type;
            quoteJSON.quoteNumber = quoteMysql.number;
            quoteJSON.paymentPlanId = quoteMysql.payment_plan;
            quoteJSON.policyType = quoteMysql.policy_type;

            //limit procressing

            try{
                const quoteLimitMysqlList = await quoteLimitBO.loadFromQuoteId(mysqlId)

                if(quoteLimitMysqlList.length > 0){
                    if(!quoteJSON.limits){
                        quoteJSON.limits = [];
                    }
                    for(let j = 0; j < quoteLimitMysqlList.length; j++){
                        const limitJSON = {
                            limitId: quoteLimitMysqlList[j].limit,
                            amount:  quoteLimitMysqlList[j].amount
                        }
                        quoteJSON.limits.push(limitJSON)
                    }
                }
            }
            catch(err){
                log.error("Error processing limits")
            }

            //save QuoteDoc
            const quote = new Quote(quoteJSON)

            if(newMongoDoc){
                await quote.save().catch(function(err){
                    log.error('Mongo Quote Save err ' + err + __location);
                });
                log.debug("inserted quote " + quote.quoteId);
            }
            else {
                try {
                    const updatequoteDoc = JSON.parse(JSON.stringify(quote));
                    const changeNotUpdateList = ["active",
                        "_id",
                        "id",
                        "mysqlId",
                        "quoteId",
                        "uuid"]
                    for (let j = 0; j < changeNotUpdateList.length; j++) {
                        if (updatequoteDoc[changeNotUpdateList[j]]) {
                            delete updatequoteDoc[changeNotUpdateList[j]];
                        }
                    }
                    const query = {"quoteId": quoteJSON.quoteId};
                    await Quote.updateOne(query, updatequoteDoc);
                    log.debug("UPDATED: quote " + quote.quoteId);
                }
                catch(err){
                    log.error("Updating Application error " + err + __location);
                    throw err;
                }

            }
        }
    }

    return;
}


// update clw_talage_applications record.
async function updateMysqlRecord(id) {
    const updateSQL = `
    UPDATE clw_talage_applications 
        SET copied_to_mongo = 1
        WHERE id = ${id}
    `;
    await db.query(updateSQL).catch(function(e) {
        log.error(`App updateMysqlRecord: ` + e);
    });

    return;
}


function cleanApplicationBO(applicationBO){

    // eslint-disable-next-line array-element-newline
    const dateCheckList = ["founded", "created", "modified","effectiveDate", "expirationDate"];
    for(let i = 0; i < dateCheckList.length; i++){
        if(applicationBO[dateCheckList[i]]){
            try{
                let testDate = moment(applicationBO[dateCheckList[i]]);
                if(!testDate.isValid() && applicationBO[dateCheckList[i]] === "0000-00-00"){
                    delete applicationBO[dateCheckList[i]];
                }
            }
            catch(err){
                delete applicationBO[dateCheckList[i]];
            }
        }
    }

}

/**
 * runFunction
 *
 * @returns {void}
 */
async function runFunction() {


    const ApplicationBO = global.requireShared('models/Application-BO.js');
    var Application = require('mongoose').model('Application');

    // local development of tasks run one of the task.

    //load message model and get message list.
    //const sql = "SELECT id from clw_talage_applications where state > 0 AND copied_to_mongo = 0 AND id > 11500 AND appStatusId > 50 limit 10";
    //const sql = "SELECT id from clw_talage_applications where state > 0 AND copied_to_mongo = 0 AND id > 11500 limit 20";
    const sql = "SELECT id from clw_talage_applications where state > 0 AND copied_to_mongo = 0 limit 1000";

    const result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error");
        process.exit(1);
    });
    log.debug("Got MySql applications - result.length - " + result.length);
    for(let i = 0; i < result.length; i++){
        let newMongoDoc = true;
        //load applicationBO
        const applicationBO = new ApplicationBO();
        let loadResp = false;
        const mysqlId = result[i].id;
        try{
            loadResp = await applicationBO.loadFromId(mysqlId);
            cleanApplicationBO(applicationBO);
        }
        catch(err){
            log.error("load application error " + err)
        }
        if(loadResp){
            let applicationJSON = {};
            try{
                const mongoApp = await applicationBO.getMongoDocbyMysqlId(mysqlId)
                if(mongoApp){
                    applicationJSON = mongoApp;
                    newMongoDoc = false;
                }
            }
            catch(err){
                log.error("Getting mongo application error " + err + __location)
            }
            applicationJSON.mysqlId = applicationBO.id;
            applicationJSON.applicationId = applicationBO.uuid;
            //mapp app to app
            const appPropMappings = {
                agency_location: "agencyLocationId",
                agency: "agencyId",
                agency_network: "agencyNetworkId",
                name: "businessName",
                "id": "mysqlId",
                "state": "processStateOld",
                "coverage_lapse": "coverageLapseWC",
                "primary_territory": "primaryState",
                "created": "createdAt",
                "modified": "updatedAt"
            }
            mapToMongooseJSON(applicationBO, applicationJSON, appPropMappings);
            //map buiness to app
            //load business..
            await processBusinessToMongo(applicationBO.business,applicationJSON)

            //map contacts to app.contact.
            await processContacts(applicationBO.business, applicationJSON)

            //map address to app.locations
            await processLocations(applicationBO.business,applicationJSON)


            //map app.policyt to app.policytes
            await processPolicies(applicationBO.id, applicationJSON, applicationBO)

            //map app.activitycode to app.activitycode
            await processActivityCodes(applicationBO.id, applicationJSON)

            //map app.claims to app.claims
            await processClaims(applicationBO.id, applicationJSON)


            await processQuestions(applicationBO.id, applicationJSON)


            //log.debug("applicationMongo: ")
            // log.debug("")
            // log.debug(JSON.stringify(applicationJSON))
            // log.debug("")
            let application = new Application(applicationJSON);
            // log.debug("insert application Doc: " + JSON.stringify(application))
            if(newMongoDoc){
                await application.save().catch(function(err) {
                    log.error('Mongo Application Save err ' + err + __location);
                    process.exit(1);
                });
                log.debug("inserted applicationId " + application.applicationId + " status: " + applicationBO.status + " mysqlId: " + mysqlId);
            }
            else {
                try {
                    const updateAppDoc = JSON.parse(JSON.stringify(application));
                    const changeNotUpdateList = ["active",
                        "_id",
                        "id",
                        "mysqlId",
                        "applicationId",
                        "uuid"]
                    for (let j = 0; j < changeNotUpdateList.length; j++) {
                        if (updateAppDoc[changeNotUpdateList[j]]) {
                            delete updateAppDoc[changeNotUpdateList[j]];
                        }
                    }
                    const query = {"applicationId": application.uuid};
                    await Application.updateOne(query, updateAppDoc);
                    log.debug("UPDATED: applicationId " + application.applicationId + " status: " + applicationBO.status + " mysqlId: " + mysqlId);
                }
                catch(err){
                    log.error("Updating Application error " + err + __location);
                    process.exit(1);
                }

            }


            //Process Quotes
            await processQuotes(applicationBO.id, application)

            //update mysql as copied
            //updateMysqlRecord
            await updateMysqlRecord(applicationBO.id);
        }


    }
    log.debug("Done!");
    process.exit(1);

}

main();