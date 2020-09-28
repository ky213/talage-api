'use strict';
const moment = require('moment');
const DatabaseObject = require('./DatabaseObject.js');
const BusinessModel = require('./Business-model.js');
const ApplicationActivityCodesModel = require('./ApplicationActivityCodes-model.js');
const ApplicationPolicyTypeBO = require('./ApplicationPolicyType-BO.js');
const LegalAcceptanceModel = require('./LegalAcceptance-model.js');
const ApplicationClaimBO = require('./ApplicationClaim-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const status = global.requireShared('./models/application-businesslogic/status.js');
const afBusinessdataSvc = global.requireShared('services/af-businessdata-svc.js');

const QuoteModel = require('./Quote-model.js');
const taskWholesaleAppEmail = global.requireRootPath('tasksystem/task-wholesaleapplicationemail.js');
const taskSoleProAppEmail = global.requireRootPath('tasksystem/task-soleproapplicationemail.js');
const taskEmailBindAgency = global.requireRootPath('tasksystem/task-emailbindagency.js');

//const moment = require('moment');
const { 'v4': uuidv4 } = require('uuid');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


const convertToIntFields = [];

const tableName = 'clw_talage_applications';
//businessDataJSON
const QUOTE_STEP_NUMBER = 9;
module.exports = class ApplicationModel {

    #dbTableORM = null;
    doNotSnakeCase = ['appStatusId','businessDataJSON','additionalInfo'];

    constructor() {
        this.agencyLocation = null;
        this.business = null;
        this.id = 0;
        this.insurers = [];
        this.policies = [];
        this.questions = {};
        this.test = false;
        this.WorkFlowSteps = {
            'contact': 2,
            'coverage': 3,
            'locations': 4,
            'owners': 5,
            'details': 6,
            'claims': 7,
            'questions': 8,
            'quotes': 9,
            'cart': 10,
            'bindRequest': 10,
        };




        this.#dbTableORM = new ApplicationOrm();
        this.#dbTableORM.doNotSnakeCase = this.doNotSnakeCase;
    }


    /**
   * Load new application JSON with optional save.
     *
   * @param {object} applicationJSON - application JSON
     * @param {boolean} save - Saves application if true
   * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application , or an Error if rejected
   */
    saveApplicationStep(applicationJSON, workflowStep) {
        return new Promise(async (resolve, reject) => {
            if (!applicationJSON) {
                reject(new Error("empty application object given"));
                return;
            }

            //log.debug("Beginning applicationJSON: " + JSON.stringify(applicationJSON));

            const stepMap = {
                'contact': 2,
                'coverage': 3,
                'locations': 4,
                'owners': 5,
                'details': 6,
                'claims': 7,
                'questions': 8,
                'quotes': 9,
                'cart': 10,
                'bindRequest': 10,
            };

            if (!stepMap[workflowStep]) {
                reject(new Error("Unknown Application Workflow Step"))
                return;
            }

            const stepNumber = stepMap[workflowStep];
            log.debug('workflowStep: ' + workflowStep + ' stepNumber: ' + stepNumber);

            if (!applicationJSON.id && applicationJSON.step !== "contact") {
                log.error('saveApplicationStep missing application id ' + __location)
                reject(new Error("missing application id"));
                return;
            }
            if (applicationJSON.id) {
                //load application from database.
                await this.#dbTableORM.getById(applicationJSON.id).catch(function (err) {
                    log.error("Error getting application from Database " + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                //Check that is still updateable.
                if (this.state > 15 && this.state < 1) {
                    log.warn(`Attempt to update a finished or deleted application. appid ${applicationJSON.id}` + __location);
                    reject(new Error("Data Error:Application may not be updated."));
                    return;
                }
                // //Check that it is too old (1 hours) from creation
                if (this.created) {
                    const dbCreated = moment(this.created);
                    const nowTime = moment().utc();;
                    const ageInMinutes = nowTime.diff(dbCreated, 'minutes');
                    log.debug('Application age in minutes ' + ageInMinutes);
                    if (ageInMinutes > 60) {
                        log.warn(`Attempt to update an old application. appid ${applicationJSON.id}` + __location);
                        reject(new Error("Data Error:Application may not be updated."));
                        return;
                    }
                }
                else {
                    log.warn(`Application missing created value. appid ${applicationJSON.id}` + __location);
                }
                // if Application has been Quoted and this is an earlier step
                if (this.last_step >= QUOTE_STEP_NUMBER && stepNumber < QUOTE_STEP_NUMBER) {
                    log.warn(`Attempt to update a Quoted application. appid ${applicationJSON.id}` + __location);
                    reject(new Error("Data Error:Application may not be updated."));
                    return;
                }
                //check for 

            }
            else {
                //set uuid on new application
                applicationJSON.uuid = uuidv4().toString();
                //Agency Defaults
                if (applicationJSON.agency_id && !applicationJSON.agency) {
                    applicationJSON.agency = applicationJSON.agency_id
                }
                if (!applicationJSON.agency) {
                    applicationJSON.agency = 1
                    applicationJSON.agency_location = 1
                }
                if (applicationJSON.agency === 0 && applicationJSON.agency === "0") {
                    applicationJSON.agency = 1
                    applicationJSON.agency_location = 1
                }
                if (applicationJSON.agencylocation_id === null) {
                    delete applicationJSON.agencylocation_id
                }
                if (applicationJSON.agency_location === null) {
                    delete applicationJSON.agency_location
                }
                //agency location defaults
                if (applicationJSON.agencylocation_id && !applicationJSON.agency_location) {
                    applicationJSON.agency_location = applicationJSON.agencylocation_id
                    delete applicationJSON.agencylocation_id
                }
                //set to Agencylocation to Agency's primary if not set by request
                if (typeof applicationJSON.agency_location !== 'number' && typeof applicationJSON.agency_location !== 'string') {
                    log.info(`Setting App agency location to primary ${applicationJSON.uuid}` + __location)
                    let agencyLocationBO = new AgencyLocationBO();
                    const locationPrimaryJSON = await agencyLocationBO.getByAgencyPrimary(applicationJSON.agency).catch(function (err) {
                        log.error("Error getting Agency Primary Location ${applicationJSON.uuid} " + err + __location);
                    });
                    if (locationPrimaryJSON && locationPrimaryJSON.id) {
                        applicationJSON.agency_location = locationPrimaryJSON.id
                        log.info(`Set App agency location to primary for ${applicationJSON.uuid} agency ${applicationJSON.agency} Location ${applicationJSON.agency_location}` + __location)
                    }
                    else {
                        log.warn(`Data problem prevented setting App agency location to primary for ${applicationJSON.uuid} agency ${applicationJSON.agency} Location ${applicationJSON.agency_location}` + __location)
                    }

                }

            }

            //log.debug("applicationJSON: " + JSON.stringify(applicationJSON));
            let error = null;
            let updateBusiness = false;
            switch (workflowStep) {
                case "contact":
                    applicationJSON.progress = 'incomplete';
                    applicationJSON.status = 'incomplete';
                    applicationJSON.appStatusId = 0;
                    //setup business special case need new business ID back.
                    if (applicationJSON.businessInfo) {
                        //load business
                        const businessModel = new BusinessModel();
                        // 1st step might have a business ID or appID if user looped back
                        if (applicationJSON.business) {
                            applicationJSON.businessInfo.id = this.business;
                        }
                        await businessModel.saveBusiness(applicationJSON.businessInfo).catch(function (err) {
                            log.error("Creating new business error:" + err + __location);
                            reject(err);
                        })
                        applicationJSON.business = businessModel.id;
                        if (applicationJSON.business === 0) {
                            reject(new Error('Error create Business record ' + __location))
                            return;
                        }
                    }
                    else {
                        log.info('No Business for Application ' + __location)
                        reject(new Error("No Business Information supplied"));
                        return;
                    }

                    break;
                case 'locations':
                    // update business data
                    if (applicationJSON.total_payroll) {
                        await this.processActivityCodes(applicationJSON.total_payroll).catch(function (err) {
                            log.error('Adding claims error:' + err + __location);
                            reject(err);
                        });
                    }
                    else {
                        log.warn("Application missing total_payroll appID " + this.id + __location)
                    }
                    updateBusiness = true;
                    break;
                case 'coverage':
                    //processPolicyTypes
                    if (applicationJSON.policy_types) {
                        await this.processPolicyTypes(applicationJSON.policy_types).catch(function (err) {
                            log.error('Adding claims error:' + err + __location);
                            reject(err);
                        });
                    }
                    // update business data
                    updateBusiness = true;
                    break;
                case 'owners':
                    updateBusiness = true;
                    break;
                case 'details':
                    updateBusiness = true;
                    break;
                case 'claims':
                    if (applicationJSON.claims) {
                        await this.processClaimsWF(applicationJSON.claims).catch(function (err) {
                            log.error('Adding claims error:' + err + __location);
                            reject(err);
                        });
                    }
                    break;
                case 'questions':
                    if (applicationJSON.questions) {
                        await this.processQuestions(applicationJSON.questions).catch(function (err) {
                            log.error('Adding Questions error:' + err + __location);
                            reject(err);
                        });
                    }
                    await this.processLegalAcceptance(applicationJSON).catch(function (err) {
                        log.error('Adding Legal Acceptance error:' + err + __location);
                        reject(err);
                    });
                    //applicationJSON.status = 'incomplete';
                    //applicationJSON.appStatusId = 10;
                    if (applicationJSON.wholesale === 1 || applicationJSON.solepro === 1) {
                        //save the app for the email.
                        this.#dbTableORM.load(applicationJSON, false).catch(function (err) {
                            log.error("Error loading application orm " + err + __location);
                        });
                        //save
                        await this.#dbTableORM.save().catch(function (err) {
                            reject(err);
                        });

                        // Email decision.  Where is wholesale or solepro decision made and saved //if wholesale or solepro - launch email tasks
                        if (applicationJSON.wholesale === 1) {
                            log.debug("sending wholesale email for AppId " + this.id);
                            //no need to await app save should
                            taskWholesaleAppEmail.wholesaleApplicationEmailTask(this.id);
                        }
                        //if solepro - launch email tasks
                        if (applicationJSON.solepro === 1) {
                            //no need to await
                            log.debug("sending solepro email for AppId " + this.id);
                            taskSoleProAppEmail.soleproApplicationEmailTask(this.id);
                        }
                    }
                    break;
                case 'quotes':
                    // Do nothing - we only save here to update the last step
                    workflowStep = "quotes";


                    break;
                case 'bindRequest':
                    if (applicationJSON.quotes) {
                        applicationJSON.appStatusId = this.appStatusId;
                        await this.processQuotes(applicationJSON).catch(function (err) {
                            log.error('Processing Quotes error:' + err + __location);
                            reject(err);
                        });
                    }
                    break;
                default:
                    // not from old Web application application flow.
                    reject(new Error("Unknown Application Workflow Step"))
                    return;
                    break;
            }
            if (updateBusiness === true) {
                if (applicationJSON.businessInfo) {
                    applicationJSON.businessInfo.id = this.business;
                    await this.processBusiness(applicationJSON.businessInfo).catch(function (err) {
                        log.error("updating business error:" + err + __location);
                        reject(err);
                    });
                    delete applicationJSON.businessInfo
                }
            }


            if (!this.#dbTableORM.last_step) {
                this.#dbTableORM.last_step = stepNumber;
            }
            else if (stepNumber > this.#dbTableORM.last_step) {
                this.#dbTableORM.last_step = stepNumber;
            }

            await this.cleanupInput(applicationJSON);

            //$app->created_by = $user->id;
            this.#dbTableORM.load(applicationJSON, false).catch(function (err) {
                log.error("Error loading application orm " + err + __location);
            });
            if (!this.#dbTableORM.uuid) {
                this.#dbTableORM.uuid = applicationJSON.uuid;
            }
            //save
            await this.#dbTableORM.save().catch(function (err) {
                reject(err);
            });
            this.updateProperty();
            this.id = this.#dbTableORM.id;

            if(workflowStep === "contact"){
                //async call do not await processing.
                this.getBusinessInfo(applicationJSON);
            }

            resolve(true);


        });
    }

    /**
    * update business object
    *
    * @param {object} businessInfo - businessInfo JSON
    * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessModel , or an Error if rejected
    */
    processBusiness(businessInfo) {
        return new Promise(async (resolve, reject) => {
            if (!businessInfo.id) {
                reject(new Error("no business id"));
                return;
            }
            const businessModel = new BusinessModel();
            await businessModel.saveBusiness(businessInfo).catch(function (err) {
                log.error("Updating new business error:" + err + __location);
                reject(err);
                return;
            });
            resolve(businessModel);
        });
    }


    /**
    * update business object
    *
    * @param {object} businessInfo - businessInfo JSON
    * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessModel , or an Error if rejected
    */
    processClaimsWF(claims) {
        return new Promise(async (resolve, reject) => {
            //delete existing.
            const applicationClaimModelDelete = new ApplicationClaimBO();
            //remove existing addresss acivity codes. we do not get ids from UI.
            await applicationClaimModelDelete.DeleteClaimsByApplicationId(this.id).catch(function (err) {
                log.error("Error deleting ApplicationClaimModel " + err + __location);
            });
            for (var i = 0; i < claims.length; i++) {
                let claim = claims[i];
                claim.application = this.id;
                const applicationClaimModel = new ApplicationClaimBO();
                await applicationClaimModel.saveModel(claim).catch(function (err) {
                    log.error("Adding new claim error:" + err + __location);
                    reject(err);
                    return;
                });
            }
            resolve(true);

        });
    }

    processActivityCodes(activtyListJSON) {

        return new Promise(async (resolve, reject) => {
            //delete existing.
            const applicationActivityCodesModelDelete = new ApplicationActivityCodesModel();
            //remove existing addresss acivity codes. we do not get ids from UI.
            await applicationActivityCodesModelDelete.DeleteByApplicationId(this.id).catch(function (err) {
                log.error("Error deleting ApplicationActivityCodesModel " + err + __location);
            });

            for (const activity in activtyListJSON) {
                //for(var i=0; i < total_payrollJSON.length;i++){
                //activityPayrollJSON = total_payrollJSON[i];
                const activityCodeJSON = {
                    'application': this.id,
                    "ncci_code": activity,
                    "payroll": activtyListJSON[activity]
                }
                const applicationActivityCodesModel = new ApplicationActivityCodesModel();
                await applicationActivityCodesModel.saveModel(activityCodeJSON).catch(function (err) {
                    log.error(`Adding new applicationActivityCodesModel for Appid ${this.id} error:` + err + __location);
                    reject(err);
                    return;
                });
            }

            resolve(true);

        });

    }


    processPolicyTypes(policyTypeArray) {

        return new Promise(async (resolve, reject) => {
            //delete existing.
            const applicationPolicyTypeModelDelete = new ApplicationPolicyTypeBO();
            //remove existing addresss acivity codes. we do not get ids from UI.
            await applicationPolicyTypeModelDelete.DeleteByApplicationId(this.id).catch(function (err) {
                log.error("Error deleting ApplicationPolicyTypeModel " + err + __location);
            });


            for (var i = 0; i < policyTypeArray.length; i++) {
                const policyType = policyTypeArray[i];
                const policyTypeJSON = {
                    'application': this.id,
                    "policy_type": policyType
                }
                const applicationPolicyTypeModel = new ApplicationPolicyTypeBO();
                await applicationPolicyTypeModel.saveModel(policyTypeJSON).catch(function (err) {
                    log.error(`Adding new applicationPolicyTypeModel for Appid ${this.id} error:` + err + __location);
                    reject(err);
                    return;
                });
            }

            resolve(true);

        });

    }


    processQuestions(questions) {

        return new Promise(async (resolve, reject) => {
            ///delete existing ?? old system did not.
            let valueList = []
            for (var i = 0; i < questions.length; i++) {
                let question = questions[i];
                questions.application = this.id;
                let valueLine = '';
                if (question.type === 'text') {
                    const cleanString = question.answer.replace(/\|/g, ',')
                    valueLine = `(${this.id}, ${question.id}, NULL, ${db.escape(cleanString)})`

                } else if (question.type === 'array') {
                    const arrayString = "|" + question.answer.join('|');
                    valueLine = `(${this.id}, ${question.id},NULL, ${db.escape(arrayString)})`
                }
                else {
                    valueLine = `(${this.id}, ${question.id}, ${question.answer}, NULL)`
                }
                valueList.push(valueLine);
            }
            const valueListString = valueList.join(",\n");
            //Set process the insert, Do not
            const insertSQL = `INSERT INTO clw_talage_application_questions 
                            (application, question, answer, text_answer)
                        Values  ${valueListString} 
                        ON DUPLICATE KEY UPDATE answer = VALUES (answer), text_answer = VALUES( text_answer );
                        `;
            //log.debug("question InsertSQL:\n" + insertSQL);
            let rejected = false;
            const result = await db.query(insertSQL).catch(function (error) {
                // Check if this was
                log.error("Database Object clw_talage_application_questions INSERT error :" + error + __location);
                rejected = true;
                reject(error);
            });
            if (rejected) {
                return false;
            }
            resolve(true);

        });

    }

    processLegalAcceptance(applicationJSON) {

        return new Promise(async (resolve, reject) => {
            //delete existing ?? old system did not.

            //agreement version
            const version = 3;
            const legalAcceptanceJSON = {
                'application': this.id,
                'ip': applicationJSON.remoteAddress,
                'version': version
            }

            const legalAcceptanceModel = new LegalAcceptanceModel();
            await legalAcceptanceModel.saveModel(legalAcceptanceJSON).catch(function (err) {
                log.error(`Adding new Legal Acceptance for Appid ${this.id} error:` + err + __location);
                reject(err);
                return;
            });
            resolve(true);

        });

    }

    processQuotes(applicationJSON) {

        return new Promise(async (resolve, reject) => {
            if (applicationJSON.quotes) {
                for (var i = 0; i < applicationJSON.quotes.length; i++) {
                    const quote = applicationJSON.quotes[i];
                    log.debug("quote: " + JSON.stringify(quote) + __location)
                    log.debug("Sending Bind Agency email for AppId " + this.id + " quote " + quote.quote + __location);
                    //no need to await.
                    taskEmailBindAgency.emailbindagency(this.id, quote.quote);

                    //load quote from database.
                    let quoteModel = new QuoteModel();
                    //update quote record.
                    await quoteModel.loadFromId(quote.quote).catch(function (err) {
                        log.error(`Loading quote for status and payment plan update quote ${quote.quote} error:` + err + __location);
                        //reject(err);
                        //return;

                    });
                    const quoteUpdate = {
                        "status": "bind_requested",
                        "payment_plan": quote.payment
                    }
                    await quoteModel.saveModel(quoteUpdate).catch(function (err) {
                        log.error(`Updating  quote with status and payment plan quote ${quote.quote} error:` + err + __location);
                        // reject(err);
                        //return;

                    });

                    applicationJSON.state = quote['api_result'] === 'referred_with_price' ? 12 : 16;
                    if (applicationJSON.state === 12 && applicationJSON.appStatusId < 80) {
                        applicationJSON.status = 'request_to_bind_referred';
                        applicationJSON.appStatusId = 80;
                    }
                    else if (applicationJSON.state === 16 && applicationJSON.appStatusId < 70) {
                        applicationJSON.status = 'request_to_bind';
                        applicationJSON.appStatusId = 70;
                    }
                }
            }
            else {
                log.error("in AppBO Process quote, but no quotes included in JSON " + JSON.stringify(applicationJSON) + __location)
            }
            resolve(true);

        });

    }
    // Get Business Data from AF Business Data API.
    //call only have this.id has been set.
    async getBusinessInfo(applicationJSON) {
        let error = null;
        //Information will be in the applicationJSON.businessInfo
        if(applicationJSON.businessInfo && applicationJSON.businessInfo.name && this.id){
            let currentAppDBJSON = await this.getById(this.id).catch(function(err){
                log.error(`error getBusinessInfo getting application record, appid ${this.id} error:` + e + __location)
            });
            if(typeof currentAppDBJSON !== 'object'){
                return false;
            }
            //Setup goodplace 
            let saveBusinessData = false;
            let afBusinessDataJSON = {};
            let newBusinessDataJSON  = currentAppDBJSON.businessDataJSON;
            if(!newBusinessDataJSON){
                newBusinessDataJSON = {};
            }
            if(applicationJSON.google_place){
                if(applicationJSON.address){
                    applicationJSON.google_place.address = applicationJSON.address;
                }
                newBusinessDataJSON.googleBusinessData = applicationJSON.google_place;
                saveBusinessData = true;
            }
            let agencyNetworkId = 0;
            try{
                agencyNetworkId = await this.getAgencyNewtorkIdById(this.id);
            }
            catch(err){
                log.error(`Error getting agencyNetworkId, application - ${this.id} ` + err + __location)
            }
            //Only process AF call if digalent.             
            if(agencyNetworkId === 2){
                const businessInfoRequestJSON = {
                    "company_name": applicationJSON.businessInfo.name
                };
                // if(applicationJSON.businessInfo.address && applicationJSON.businessInfo.address.state_abbr){
                //     businessInfo.state = applicationJSON.businessInfo.address.state_abbr
                // } else if(applicationJSON.address.state_abbr){
                //     businessInfo.state = applicationJSON.address.state_abbr
                // }
                const addressFieldList = ["address","address2","city","state_abbr","zip"];
                const address2AFRequestMap = {
                        "addresss" : "street_address1",
                        "addresss2" : "street_address2",
                        "state_abbr": "state"
                        };
                for(let i=0; i < addressFieldList.length; i++){
                    if(applicationJSON.address[addressFieldList[i]]){
                        let propertyName = addressFieldList[i];
                        if(address2AFRequestMap[addressFieldList[i]]){
                            propertyName = address2AFRequestMap[addressFieldList[i]]
                        }
                        businessInfoRequestJSON[propertyName] = applicationJSON.address[addressFieldList[i]];
                    }
                }
                try {
                    afBusinessDataJSON = await afBusinessdataSvc.getBusinessData(businessInfoRequestJSON);
                }
                catch (e) {
                    log.error(`error call AF Business Data API, appid ${this.id} error:` + e + __location)
                   
                    afBusinessDataJSON.error = "Error call in AF Business Data API";
                }
                if(afBusinessDataJSON){
                    afBusinessDataJSON.requestTime = new moment().toISOString();
                    //save it back to applcation record.
                    // Use Update  to limit the change 
                    //This process is async so other updates may have happend.
                    newBusinessDataJSON.afBusinessData = afBusinessDataJSON;
                    saveBusinessData = true;
                }
                else {
                    log.warn(`AF Business Data API returned no data., appid ${this.id} error:` + e + __location)
                }
            }
            if(saveBusinessData){
                const sql = `Update ${tableName} 
                    SET businessDataJSON = ${db.escape(JSON.stringify(newBusinessDataJSON))}
                    WHERE id = ${db.escape(this.id)}
                `;
                
                const result = await db.query(sql).catch(function (err) {
                    // Check if this was
                    log.error("Database Object ${tableName} UPDATE businessDataJSON error :" + err + __location);
                    error = err;
                });
                log.info(`Application ${this.id} update BusinessDataJSON`);
                if(afBusinessDataJSON){
                    //update application Business and address.
                }           
            }
            // update application.businessDataJSON
        }// if applicationJSON.businessInfo
        //no errors....
       return false;
    }
  
    // save(asNew = false) {
    //     return new Promise(async (resolve, reject) => {
    //         //validate

    //         resolve(true);
    //     });
    // }

    loadFromId(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if (id && id > 0) {
                await this.#dbTableORM.getById(id).catch(function (err) {
                    log.error("Error getting application from Database " + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                resolve(true);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    getById(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if (id && id > 0) {
                await this.#dbTableORM.getById(id).catch(function (err) {
                    log.error(`Error getting  ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                resolve(this.#dbTableORM.cleanJSON());
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    deleteSoftById(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if (id && id > 0) {

                //Remove old records.
                const sql = `Update ${tableName} 
                        SET state = -2
                        WHERE id = ${db.escape(id)}
                `;
                let rejected = false;
                const result = await db.query(sql).catch(function (error) {
                    // Check if this was
                    log.error("Database Object ${tableName} UPDATE State error :" + error + __location);
                    rejected = true;
                    reject(error);
                });
                if (rejected) {
                    return false;
                }
                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    async getAgencyNewtorkIdById(id) {
        return new Promise(async (resolve, reject) => {

            let rejected = false;

            let sql = `
            select agency_network from clw_talage_applications a
            inner join clw_talage_agencies ag on ag.id = a.agency
            where a.id = ${db.escape(id)}
            `;
            const result = await db.query(sql).catch(function (error) {
                rejected = true;
                log.error(`getList ${tableName} sql: ${sql}  error ` + error + __location)
                reject(error);
            });
            if (rejected) {
                return;
            }
            if (result && result.length > 0) {
                resolve(result[0].agency_network)
            }
            else {
                rejected(new Error("Not Found"));
            }
        });
    }


    async cleanupInput(inputJSON) {
        //convert to ints
        for (const property in properties) {
            if (inputJSON[property]) {
                // Convert to number
                try {
                    if (properties[property].type === "number" && "string" === typeof inputJSON[property]) {
                        if (properties[property].dbType.indexOf("int") > -1) {
                            inputJSON[property] = parseInt(inputJSON[property], 10);
                        }
                        else if (properties[property].dbType.indexOf("float") > -1) {
                            inputJSON[property] = parseFloat(inputJSON[property]);
                        }
                    }
                }
                catch (e) {
                    log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location);
                }
            }
        }
    }

    updateProperty(noNulls = false) {
        const dbJSON = this.#dbTableORM.cleanJSON(noNulls)
        // eslint-disable-next-line guard-for-in
        for (const property in properties) {
            if (noNulls === true) {
                if (dbJSON[property]) {
                    this[property] = dbJSON[property];
                } else if (this[property]) {
                    delete this[property];
                }
            }
            else {
                this[property] = dbJSON[property];
            }
        }
    }
}

const properties = {
    "id": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "state": {
        "default": "1",
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "status": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(32)"
    },
    "appStatusId": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "abandoned_email": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "abandoned_app_email": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "opted_out_online_emailsent": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "opted_out_online": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)",
        "dbType": "tinyint(1)"
    },
    "additional_insured": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "agency": {
        "default": 1,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "agency_location": {
        "default": 1,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "bop_effective_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date",
        "dbType": "date"
    },
    "bop_expiration_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date",
        "dbType": "date"
    },
    "business": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "completion_time": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "bigint(14) unsigned"
    },
    "corporation_type": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "coverage": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11)"
    },
    "coverage_lapse": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11)"
    },
    "coverage_lapse_non_payment": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1) unsigned"
    },
    "deductible": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11)"
    },
    "dq1": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1) unsigned"
    },
    "eo_effective_date": {
        "default": "0000-00-00",
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "date"
    },
    "eo_effective_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date",
        "dbType": "date"
    },
    "eo_expiration_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date",
        "dbType": "date"
    },
    "experience_modifier": {
        "default": 1.0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "float(5,3)"
    },
    "family_covered": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1) unsigned"
    },
    "gl_effective_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date",
        "dbType": "date"
    },
    "gl_expiration_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date",
        "dbType": "date"
    },
    "gross_sales_amt": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "has_ein": {
        "default": "1",
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1) unsigned"
    },
    "industry_code": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "landing_page": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "last_step": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "limits": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "management_structure": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "owners_covered": {
        "default": "1",
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "progress": {
        "default": "unknown",
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "referrer": {
        "default": "unknown",
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "request_id": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "solepro": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "umb_effective_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },
    "umb_expiration_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },
    "unincorporated_association": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "uuid": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "waiver_subrogation": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "wc_effective_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },
    "wc_expiration_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },

    "wc_limits": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "wholesale": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "years_of_exp": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "zip": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "mediumint(5) unsigned"
    },
    "city": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(60)"
    },
    "state_abbr": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(2)"
    },
    "zipcode": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(10)"
    },
    "additionalInfo": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "json",
        "dbType": "json"
     },
     "businessDataJSON": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "json",
        "dbType": "json"
     },
    "created": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "timestamp"
    },
    "created_by": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "modified": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "timestamp"
    },
    "modified_by": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "deleted": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "deleted_by": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "checked_out": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "checked_out_time": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "datetime"
    }
}


class ApplicationOrm extends DatabaseObject {

    constructor() {
        super('clw_talage_applications', properties);
    }
    // handle search strings here.......
    // /**
    //  * Save this agency in the database
    //  *
    //  * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
    //  */
    // save(){
    // 	return new Promise(async(fulfill, reject) => {
    // 		let rejected = false;

    // 		// Save
    // 		await DatabaseObject.prototype.save.call(this).catch(function(err){
    // 			rejected = true;
    // 			reject(err);
    // 		});
    // 		if(rejected){
    // 			return;
    // 		}

    // 		fulfill(true);
    // 	});
    // }
}