'use strict';
const moment = require('moment');
const clonedeep = require('lodash.clonedeep');

const DatabaseObject = require('./DatabaseObject.js');
const BusinessModel = require('./Business-model.js');
const ApplicationActivityCodesModel = require('./ApplicationActivityCodes-model.js');
const ApplicationPolicyTypeBO = require('./ApplicationPolicyType-BO.js');
const LegalAcceptanceModel = require('./LegalAcceptance-model.js');
const ApplicationClaimBO = require('./ApplicationClaim-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const status = global.requireShared('./models/application-businesslogic/status.js');
const afBusinessdataSvc = global.requireShared('services/af-businessdata-svc.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

const QuoteModel = require('./Quote-model.js');
const taskWholesaleAppEmail = global.requireRootPath('tasksystem/task-wholesaleapplicationemail.js');
const taskSoleProAppEmail = global.requireRootPath('tasksystem/task-soleproapplicationemail.js');
const taskEmailBindAgency = global.requireRootPath('tasksystem/task-emailbindagency.js');


// Mongo mOdels
var Application = require('mongoose').model('Application');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

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

    #applicationMongooseModel = null;
    #applicationMongooseJSON = {};

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




        this.#applicationMongooseModel = null;
        this.#applicationMongooseJSON = {};
    

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
            let error = null;
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
                // TODO Load Mongoose Model

                //Agency Network check.....
                const agencyBO = new AgencyBO();
                // Load the request data into it
                let agency = await agencyBO.getById(this.#dbTableORM.agency).catch(function(err) {
                    log.error("Agency load error " + err + __location);
                    error = err;
                });
                if(agency){
                    applicationJSON.agencyNetworkId = agency.agency_network;
                } else {
                    log.error(`no agency record for id ${applicationJSON.agency} ` + __location);
                }
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
                //Agency Network check.....
                error = null;
                const agencyBO = new AgencyBO();
                // Load the request data into it
                let agency = await agencyBO.getById(applicationJSON.agency).catch(function(err) {
                    log.error("Agency load error " + err + __location);
                    error = err;
                });
                if(agency){
                    applicationJSON.agencyNetworkId = agency.agency_network;
                } else {
                    log.error(`no agency record for id ${applicationJSON.agency} ` + __location);
                }

            }

            //log.debug("applicationJSON: " + JSON.stringify(applicationJSON));
            error = null;
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
                        await this.processMongooseBusiness(applicationJSON.businessInfo)
                    }
                    else {
                        log.info('No Business for Application ' + __location)
                        reject(new Error("No Business Information supplied"));
                        return;
                    }


                    break;
                case 'locations':
                    if (applicationJSON.locations) {
                        this.#applicationMongooseJSON.locations = applicationJSON.locations
                        for(let i =0 ;i <  this.#applicationMongooseJSON.locations.length; i++){
                            let location = this.#applicationMongooseJSON.locations[i];
                            for (const locationProp in location) {            
                                //not in map check....
                                if(!businessInfoMapping[locationProp]){
                                    if(locationProp.isSnakeCase()){
                                        this.#applicationMongooseJSON[locationProp.toCamelCase()] =  location[locationProp];
                                    }
                                    else {
                                        this.#applicationMongooseJSON[locationProp] = location[locationProp];
                                    }
                                    
                                }
                            }
                        }
                    }
                    // update business data
                    if (applicationJSON.total_payroll) {
                        await this.processActivityCodes(applicationJSON.total_payroll).catch(function (err) {
                            log.error('Adding activity codes error:' + err + __location);
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
                    if (applicationJSON.policy_types, applicationJSON) {
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
                    //TODO owners setup Mapping to Mongoose Model not we already have one loaded.
                    break;
                case 'details':
                    updateBusiness = true;
                    //TODO details setup Mapping to Mongoose Model not we already have one loaded.
                    break;
                case 'claims':
                    if (applicationJSON.claims) {
                        await this.processClaimsWF(applicationJSON.claims).catch(function (err) {
                            log.error('Adding claims error:' + err + __location);
                            reject(err);
                        });
                    }
                    //TODO details setup Mapping to Mongoose Model not we already have one loaded.
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
                    //TODO questions setup Mapping to Mongoose Model not we already have one loaded.
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

                    //TODO quotes (Status) setup Mapping to Mongoose Model not we already have one loaded.
                    break;
                case 'bindRequest':
                    if (applicationJSON.quotes) {
                        applicationJSON.appStatusId = this.appStatusId;
                        await this.processQuotes(applicationJSON).catch(function (err) {
                            log.error('Processing Quotes error:' + err + __location);
                            reject(err);
                        });
                    }
                    //TODO bindRequest setup Mapping to Mongoose Model not we already have one loaded.
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
            applicationJSON.id = this.id;
            // TODO mongoose model save.
            // maybe this.#dbTableORM
            this.mapToMongooseJSON(applicationJSON)
            log.debug("mongooseJSON: " + JSON.stringify( this.#applicationMongooseJSON))
            if(this.#applicationMongooseModel){
                //update
                this.updateMongo(this.#applicationMongooseJSON.uuid, this.#applicationMongooseJSON)
            } else {
                //insert 
                this.insertMongo(this.#applicationMongooseJSON)
            }

            if(workflowStep === "contact"){
                //async call do not await processing.
                this.getBusinessInfo(applicationJSON);
            }

            resolve(true);


        });
    }

    mapToMongooseJSON(sourceJSON){
        const propMappings = { 
            agency_location: "agencyLocationId",
            agency: "agencyId",
            name: "businessName",
            "id": "mysqlId"
        }
        for(const sourceProp in sourceJSON){
            if(typeof sourceJSON[sourceProp] !== "object" ){
                if(propMappings[sourceProp]){
                    const appProp = propMappings[sourceProp]
                    this.#applicationMongooseJSON[appProp] = sourceJSON[sourceProp];
                }
                else {
                    //check if snake_case
                    if(sourceProp.isSnakeCase()){
                        this.#applicationMongooseJSON[sourceProp.toCamelCase()] =  sourceJSON[sourceProp];
                    }
                    else {
                        this.#applicationMongooseJSON[sourceProp] = sourceJSON[sourceProp];
                    }
                }
                
            }
        }
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
            log.debug("businessInfo " + JSON.stringify(businessInfo));
            const businessModel = new BusinessModel();
            await businessModel.saveBusiness(businessInfo).catch(function (err) {
                log.error("Updating new business error:" + err + __location);
                reject(err);
                return;
            });
            await this.processMongooseBusiness(businessInfo)
            


            resolve(businessModel);
        });
    }

    async processMongooseBusiness(businessInfo){
        //Process Mongoose Model
            //this.#applicationMongooseJSON
            // BusinessInfo to mongoose model
            const businessInfoMapping = {
                entity_type: "entityType",
                "mailing_state_abbr": "mailingState"
            } 
        //
        log.debug("businessInfo " + JSON.stringify(businessInfo));
        for (const businessProp in businessInfo) {       
            if(typeof businessInfo[businessProp] !== "object" ){
                log.debug("businsess mapping " + businessProp )     
                if(businessInfoMapping[businessProp]){
                    const appProp = businessInfoMapping[businessProp]
                    this.#applicationMongooseJSON[appProp] = businessInfo[businessProp];
                }
                else {
                    if(businessProp.isSnakeCase()){
                        this.#applicationMongooseJSON[businessProp.toCamelCase()] =  businessInfo[businessProp];
                    }
                    else {
                        this.#applicationMongooseJSON[businessProp] = businessInfo[businessProp];
                    }
                }
            }
        }

        if(businessInfo.contacts){
            //setup mongoose contanct
            log.debug("Setting up mongose contacts")
            this.#applicationMongooseJSON.contacts = [];
            
            for(var i = 0 ; i < businessInfo.contacts.length; i++){
                let businessContact  = businessInfo.contacts[i]
                let contactJSON = {};
                contactJSON.email = businessContact.email;
                contactJSON.fristName = businessContact.fname;
                contactJSON.lastName = businessContact.lname;
                contactJSON.phone = businessContact.phone;
                contactJSON.primary = businessContact.primary;
                this.#applicationMongooseJSON.contacts.push(contactJSON);                    
            }

        }
        //save model if we have a model 
        if(this.#applicationMongooseModel){
            //save....

        }

        return;
    }


    /**
    * update business object
    *
    * @param {object} businessInfo - businessInfo JSON
    * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessModel , or an Error if rejected
    */
    processClaimsWF(claims) {
        return new Promise(async (resolve, reject) => {
                //copy to mongoose json
                //clonedeep
                this.#applicationMongooseJSON.claims = clonedeep(claims);
                for(let i = 0; i <  this.#applicationMongooseJSON.claims.length; i++ ){
                    let claim = this.#applicationMongooseJSON.claims[i];
                    for (const prop in claim) {            
                        //check if snake_case
                        if(prop.isSnakeCase()){
                            claim[prop.toCamelCase()] = claim[prop];
                            delete  claim[prop];
                        }
                    }
                }
      
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

            this.#applicationMongooseJSON.activityCodes = clonedeep(activtyListJSON);
            for(let i = 0; i <  this.#applicationMongooseJSON.activityCodes.length; i++ ){
                let activityCodeJson = this.#applicationMongooseJSON.activityCodes[i];
                activityCodeJson.ncciCode = activityCodeJson.ncci_code;
                delete activityCodeJson.ncci_code;
            }

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


    processPolicyTypes(policyTypeArray,applicationJSON) {

        return new Promise(async (resolve, reject) => {
            
            this.#applicationMongooseJSON.policies = clonedeep(policyTypeArray);
            for(let i = 0; i <  this.#applicationMongooseJSON.policies.length; i++ ){
                let activityCodeJson = this.#applicationMongooseJSON.activityCodes[i];
                activityCodeJson.ncciCode = activityCodeJson.ncci_code;
                delete activityCodeJson.ncci_code;
            }

            let policyList = [];
            for (var i = 0; i < policyTypeArray.length; i++) {
                const policyType = policyTypeArray[i];
                const policyTypeJSON = {
                    "policyType": policyType
                }
                if(policyType === "GL"){
                    //GL limit and date fields.
                    policyType.effectiveDate = applicationJSON.gl_effective_date
                    policyType.expirationDate = applicationJSON.gl_expiration_date
                    policyType.limits = applicationJSON.limits


                } else if(policyType === "WC"){
                    policyType.effectiveDate = applicationJSON.wc_effective_date
                    policyType.expirationDate = applicationJSON.wc_expiration_date
                    policyType.limits = applicationJSON.wc_limits
                    policyType.coverageLapse = applicationJSON.coverageLapse
                
                } else if(policyType === "BOP"){
                    policyType.effectiveDate = applicationJSON.bop_effective_date
                    policyType.expirationDate = applicationJSON.bop_expiration_date
                    policyType.limits = applicationJSON.limits
                    policyType.coverage = applicationJSON.coverage

                }
                
            }
            this.#applicationMongooseJSON.policies = policyList
            
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

            this.#applicationMongooseJSON.questions = questions;
            //TODO get text and turn into list of question objects.


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
            this.#applicationMongooseJSON.legalAcceptance = legalAcceptanceJSON;

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
    async getBusinessInfo(requestApplicationJSON) {
        let error = null;
        //Information will be in the applicationJSON.businessInfo
        // Only process if we have a google_place hit.
        if(requestApplicationJSON.google_place && requestApplicationJSON.businessInfo && requestApplicationJSON.businessInfo.name && this.id){
            let currentAppDBJSON = await this.getById(this.id).catch(function(err){
                log.error(`error getBusinessInfo getting application record, appid ${this.id} error:` + e + __location)
            });
            if(typeof currentAppDBJSON !== 'object'){
                return false;
            }
            //Setup goodplace 
            let saveBusinessData = false;
            let afBusinessDataJSON = null;
            let newBusinessDataJSON  = currentAppDBJSON.businessDataJSON;
            if(!newBusinessDataJSON){
                newBusinessDataJSON = {};
            }
            if(requestApplicationJSON.google_place){
                if(requestApplicationJSON.address){
                    requestApplicationJSON.google_place.address = requestApplicationJSON.address;
                }
                newBusinessDataJSON.googleBusinessData = requestApplicationJSON.google_place;
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
                    "company_name": requestApplicationJSON.businessInfo.name
                };
                // if(applicationJSON.businessInfo.address && applicationJSON.businessInfo.address.state_abbr){
                //     businessInfo.state = applicationJSON.businessInfo.address.state_abbr
                // } else if(applicationJSON.address.state_abbr){
                //     businessInfo.state = applicationJSON.address.state_abbr
                // }
                const addressFieldList = ["address","address2","city","state_abbr","zip"];
                const address2AFRequestMap = {
                        "address" : "street_address1",
                        "address2" : "street_address2",
                        "state_abbr": "state"
                        };
                for(let i=0; i < addressFieldList.length; i++){
                    if(requestApplicationJSON.address[addressFieldList[i]]){
                        let propertyName = addressFieldList[i];
                        if(address2AFRequestMap[addressFieldList[i]]){
                            propertyName = address2AFRequestMap[addressFieldList[i]]
                        }
                        businessInfoRequestJSON[propertyName] = requestApplicationJSON.address[addressFieldList[i]];
                    }
                }
                try {
                    afBusinessDataJSON = await afBusinessdataSvc.getBusinessData(businessInfoRequestJSON);
                }
                catch (e) {
                    log.error(`error call AF Business Data API, appid ${this.id} error:` + e + __location)
                    afBusinessDataJSON = {};
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
                 //TODO monogoose model save
                log.info(`Application ${this.id} update BusinessDataJSON`);
                currentAppDBJSON.businessDataJSON = newBusinessDataJSON;
                if(afBusinessDataJSON && afBusinessDataJSON.Status === "SUCCESS"){
                    //update application Business and address.
                    log.debug("updating application records from afBusinessDataJSON " + __location)
                    await this.updateFromAfBusinessData(currentAppDBJSON, afBusinessDataJSON)
                } else if(requestApplicationJSON.google_place){
                    requestApplicationJSON.google_place.address = requestApplicationJSON.address;
                    await this.updatefromGooglePlaceData(currentAppDBJSON, requestApplicationJSON.google_place)
                } else {
                    log.debug("No valid Business Data to update records " + __location)
                }         
            }
            // update application.businessDataJSON
        }// if applicationJSON.businessInfo
        //no errors....
       return false;
    }
    async updateFromAfBusinessData(applicationJSON, afBusinessDataJSON){
        if(this.id &&  afBusinessDataJSON && applicationJSON){
            if(afBusinessDataJSON.afgCompany){
                try{
                    
                    //afgCompany -> website, street_addr1, state, city, zip,number_of 
                    if(afBusinessDataJSON.afgCompany.state && afBusinessDataJSON.afgCompany.city){
                        applicationJSON.state_abbr = afBusinessDataJSON.afgCompany.state;
                        applicationJSON.city = afBusinessDataJSON.afgCompany.city;
                    }
                    if(afBusinessDataJSON.afgCompany.zip){
                        applicationJSON.zipcode = afBusinessDataJSON.afgCompany.zip.toString();
                        applicationJSON.zip = parseInt(afBusinessDataJSON.afgCompany.zip);
                    }

                    this.#dbTableORM.load(applicationJSON, false).catch(function (err) {
                        log.error("Error loading application orm " + err + __location);
                        throw err;
                    });
                   
                    //save
                    log.debug("saving application records from afBusinessDataJSON " + __location)
                    await this.#dbTableORM.save().catch(function (err) {
                        log.error("Error Saving application orm " + err + __location);
                        throw err;
                    });
                    log.debug(`App ${this.id} updated from afBusinessDataJSON ` + __location);
                    //TODO monogoose model save
                }
                catch(err){
                    log.error("Error update App from AFBusinessData " + err + __location);
                }
               
                
            }
            if(applicationJSON.business){
                //have businessId
                let businessJSON = {"id": applicationJSON.business};
                let locationJSON = {"business": applicationJSON.business}
                if(afBusinessDataJSON.afgCompany){
                    const companyFieldList = ["street_addr1","street_addr2","city","state","zip", "website"];
                    const company2BOMap = {
                                "street_addr1" : "mailing_address",
                                "street_addr2" : "mailing_address2",
                                "city": "mailing_city",
                                "state": "mailing_state_abbr",
                                "zip": "mailing_zipcode"
                            };
                    const company2LocationBOMap = {
                        "street_addr1" : "address",
                        "street_addr2" : "address2",
                        "city": "city",
                        "state": "state_abbr",
                        "zip": "zipcode"
                    };
                    try{
                        for(let i = 0 ; i < companyFieldList.length; i++ ){
                            if(afBusinessDataJSON.afgCompany[companyFieldList[i]]){
                                let propertyName = companyFieldList[i];
                                if(company2BOMap[companyFieldList[i]]){
                                    propertyName = company2BOMap[companyFieldList[i]]
                                }
                                businessJSON[propertyName] = afBusinessDataJSON.afgCompany[companyFieldList[i]];
                                //location 
                                propertyName = companyFieldList[i];
                                if(company2LocationBOMap[companyFieldList[i]]){
                                    propertyName = company2LocationBOMap[companyFieldList[i]]
                                }
                                locationJSON[propertyName] = afBusinessDataJSON.afgCompany[companyFieldList[i]];
                            }

                        }
                        // log.debug("afBusinessDataJSON.afgCompany " + JSON.stringify(afBusinessDataJSON.afgCompany));
                        // log.debug("businessJSON " + JSON.stringify(businessJSON));
                        if(businessJSON.mailing_zipcode){
                            businessJSON.mailing_zipcode = businessJSON.mailing_zipcode.toString();
                        }
                        if(locationJSON.zipcode){
                            locationJSON.zipcode = locationJSON.zipcode.toString();
                        }

                        if(afBusinessDataJSON.afgCompany.employee_count){
                            locationJSON.full_time_employees = afBusinessDataJSON.afgCompany.employee_count;
                        }
                    }
                    catch(err){
                        log.error("error mapping AF Company data to BO " + err + __location);
                    }
                    
                }
            
                if(afBusinessDataJSON.afgPreFill){
                    if(afBusinessDataJSON.afgPreFill.legal_entity){
                        businessJSON.entity_type = afBusinessDataJSON.afgPreFill.legal_entity;
                    }


                }

                businessJSON.locations = [];
                businessJSON.locations.push(locationJSON)


                try{
                    log.debug("updating  application business records from afBusinessDataJSON " + + __location)
                    await this.processBusiness(businessJSON);
                     //TODO monogoose model save
                }
                catch(err){
                    log.error("Error Mapping AF Business Data to BO Saving " + err + __location);
                }




            }
            else {
                log.error(`No business id for application ${this.id}`)
            }
            //clw_talage_application_activity_codes - default from industry_code???
        }
        else {
            log.warn("updateFromAfBusinessData missing parameters " +  __location)
        }
        return true;
    }

    async updatefromGooglePlaceData(applicationJSON, googlePlaceJSON){
        if(this.id && applicationJSON && googlePlaceJSON){
            if(googlePlaceJSON.address){
                try{
                    
                    //afgCompany -> website, street_addr1, state, city, zip,number_of 
                    if(googlePlaceJSON.address.state_abbr && googlePlaceJSON.address.city){
                        applicationJSON.state_abbr = googlePlaceJSON.address.state_abbr;
                        applicationJSON.city = googlePlaceJSON.address.city;
                    }
                    if(googlePlaceJSON.address.zip){
                        applicationJSON.zipcode = googlePlaceJSON.address.zip.toString();
                        applicationJSON.zip = parseInt(googlePlaceJSON.address.zip);
                    }

                    this.#dbTableORM.load(applicationJSON, false).catch(function (err) {
                        log.error("Error loading application orm " + err + __location);
                        throw err;
                    });
                   
                    //save
                    log.debug("saving application records from afBusinessDataJSON " + __location)
                    await this.#dbTableORM.save().catch(function (err) {
                        log.error("Error Saving application orm " + err + __location);
                        throw err;
                    });
                     //TODO monogoose model save
                    log.debug(`App ${this.id} updated from afBusinessDataJSON ` + __location);
                }
                catch(err){
                    log.error("Error update App from AFBusinessData " + err + __location);
                }
               
                
            }
            if(applicationJSON.business){
                //have businessId
                let businessJSON = {"id": applicationJSON.business};
                let locationJSON = {"business": applicationJSON.business}
                if(googlePlaceJSON.address){
                    const companyFieldList = ["address","address2","city","state_abbr","zip"];
                    const company2BOMap = {
                                "address" : "mailing_address",
                                "address2" : "mailing_address2",
                                "city": "mailing_city",
                                "state_abbr": "mailing_state_abbr",
                                "zip": "mailing_zipcode"
                            };
                    const company2LocationBOMap = {
                        "zip": "zipcode"
                    };
                    try{
                        for(let i = 0 ; i < companyFieldList.length; i++ ){
                            if(googlePlaceJSON.address[companyFieldList[i]]){
                                let propertyName = companyFieldList[i];
                                if(company2BOMap[companyFieldList[i]]){
                                    propertyName = company2BOMap[companyFieldList[i]]
                                }
                                businessJSON[propertyName] = googlePlaceJSON.address[companyFieldList[i]];
                                //location 
                                propertyName = companyFieldList[i];
                                if(company2LocationBOMap[companyFieldList[i]]){
                                    propertyName = company2LocationBOMap[companyFieldList[i]]
                                }
                                locationJSON[propertyName] = googlePlaceJSON.address[companyFieldList[i]];
                            }

                        }
                        // log.debug("googlePlaceJSON.address " + JSON.stringify(googlePlaceJSON.address));
                        // log.debug("businessJSON " + JSON.stringify(businessJSON));
                        if(businessJSON.mailing_zipcode){
                            businessJSON.mailing_zipcode = businessJSON.mailing_zipcode.toString();
                        }
                        if(locationJSON.zipcode){
                            locationJSON.zipcode = locationJSON.zipcode.toString();
                        }

                        if(googlePlaceJSON.address.employee_count){
                            locationJSON.full_time_employees = googlePlaceJSON.address.employee_count;
                        }
                    }
                    catch(err){
                        log.error("error mapping Google Place  Company data to BO " + err + __location);
                    }
                    
                }
            
                if(googlePlaceJSON.afgPreFill){
                    if(googlePlaceJSON.afgPreFill.legal_entity){
                        businessJSON.entity_type = googlePlaceJSON.afgPreFill.legal_entity;
                    }


                }

                businessJSON.locations = [];
                businessJSON.locations.push(locationJSON)
                try{
                    log.debug("updating  application business records from afBusinessDataJSON " + + __location)
                    await this.processBusiness(businessJSON);

                     //TODO monogoose model save
                }
                catch(err){
                    log.error("Error Mapping AF Business Data to BO Saving " + err + __location);
                }
            }
            else {
                log.error(`No business id for application ${this.id}`)
            }
        }
        else {
            log.warn("updateFromAfBusinessData missing parameters " +  __location)
        }
        return true;
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


    async updateMongo(uuid, newObjectJSON){
        if(uuid && uuid >0 ){
            if(typeof newObjectJSON === "object"){
                const changeNotUpdateList = ["active", "id","mysqlId", "applicationId", "uuid"]
                for(let i = 0;i < changeNotUpdateList.length; i++ ){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                log.debug("application newObjectJSON: " + JSON.stringify(newObjectJSON))
                const query = {"applicationId": uuid};
                let newApplicationJSON = null;
                try {
                    await Application.updateOne(query, newObjectJSON);

                    const newApplicationdoc = await Application.findOne(query);
                    newApplicationJSON = mongoUtils.objCleanup(newApplicationdoc);
                }
                catch (err) {
                    log.error("Updating Application error " + err + __location);
                    throw err;
                }
                return newApplicationJSON;
            }
            else {
                throw new Error('no newObjectJSON supplied')
            }
          
        }
        else {
            throw new Error('no id supplied')
        }
        return true;

    }

    async insertMongo(newObjectJSON){
            newObjectJSON.applicationId = newObjectJSON.uuid;
            let application = new Application(newObjectJSON);
            log.debug("insert application: " + JSON.stringify(application))
            //Insert a doc
            await application.save().catch(function(err){
                log.error('Mongo Application Save err ' + err + __location);
                throw err;
            });
            let userGroup = mongoUtils.objCleanup(application);
            userGroup.id = userGroup.systemId;
            return userGroup;
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
    copyToMongo(id){









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