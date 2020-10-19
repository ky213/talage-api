/* eslint-disable guard-for-in */
/* eslint-disable lines-between-class-members */
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
//const status = global.requireShared('./models/application-businesslogic/status.js');
const afBusinessdataSvc = global.requireShared('services/af-businessdata-svc.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const QuestionBO = global.requireShared('./models/Question-BO.js');
const QuestionAnswerBO = global.requireShared('./models/QuestionAnswer-BO.js');
const QuestionTypeBO = global.requireShared('./models/QuestionType-BO.js');
const MappingBO = global.requireShared('./models/Mapping-BO.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');

const taskWholesaleAppEmail = global.requireRootPath('tasksystem/task-wholesaleapplicationemail.js');
const taskSoleProAppEmail = global.requireRootPath('tasksystem/task-soleproapplicationemail.js');
const taskEmailBindAgency = global.requireRootPath('tasksystem/task-emailbindagency.js');


// Mongo Models
var Application = require('mongoose').model('Application');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');

//const moment = require('moment');
const {'v4': uuidv4} = require('uuid');
// const { debug } = require('request');
// const { loggers } = require('winston');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


//const convertToIntFields = [];

const tableName = 'clw_talage_applications';
//businessDataJSON
const QUOTE_STEP_NUMBER = 9;
module.exports = class ApplicationModel {

    #dbTableORM = null;
    doNotSnakeCase = ['appStatusId',
        'businessDataJSON',
        'additionalInfo'];

    #applicationMongooseDB = null;
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
            'bindRequest': 10
        };

        this.#applicationMongooseDB = null;
        this.#applicationMongooseJSON = {};


        this.#dbTableORM = new ApplicationOrm();
        this.#dbTableORM.doNotSnakeCase = this.doNotSnakeCase;
    }


    /**
    * Load new application JSON with optional save.
    *
    * @param {object} applicationJSON - application JSON
    * @param {string} workflowStep - QuoteApp Workflow step
    * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application , or an Error if rejected
    */
    saveApplicationStep(applicationJSON, workflowStep) {
        return new Promise(async(resolve, reject) => {
            if (!applicationJSON) {
                reject(new Error("empty application object given"));
                return;
            }
            let error = null;
            // log.debug("Beginning applicationJSON: " + JSON.stringify(applicationJSON));

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
                'bindRequest': 10
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
                await this.#dbTableORM.getById(applicationJSON.id).catch(function(err) {
                    log.error("Error getting application from Database " + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                applicationJSON.agency_network = this.agency_network;
                //future mongo...
                applicationJSON.agencyNetworkId = this.agency_network;
                this.agencyNetworkId = this.agency_network;
                //Check that is still updateable.
                if (this.state > 15 && this.state < 1) {
                    log.warn(`Attempt to update a finished or deleted application. appid ${applicationJSON.id}` + __location);
                    reject(new Error("Data Error:Application may not be updated."));
                    return;
                }
                // //Check that it is too old (1 hours) from creation
                if (this.created) {
                    const dbCreated = moment(this.created);
                    const nowTime = moment().utc();
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
                // Load Mongoose Model
                this.#applicationMongooseDB = await this.loadfromMongoByAppId(this.uuid).catch(function(err) {
                    log.error("Mongo application load error " + err + __location);
                    error = err;
                });
                //log.debug("load from mongo " + JSON.stringify(this.#applicationMongooseDB));
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
                    const agencyLocationBO = new AgencyLocationBO();
                    const locationPrimaryJSON = await agencyLocationBO.getByAgencyPrimary(applicationJSON.agency).catch(function(err) {
                        log.error(`Error getting Agency Primary Location ${applicationJSON.uuid} ` + err + __location);
                    });
                    if (locationPrimaryJSON && locationPrimaryJSON.id) {
                        applicationJSON.agency_location = locationPrimaryJSON.id
                        log.info(`Set App agency location to primary for ${applicationJSON.uuid} agency ${applicationJSON.agency} Location ${applicationJSON.agency_location}` + __location)
                    }
                    else {
                        log.warn(`Data problem prevented setting App agency location to primary for ${applicationJSON.uuid} agency ${applicationJSON.agency} Location ${applicationJSON.agency_location}` + __location)
                    }

                }
                //Agency Network check for new application
                error = null;
                const agencyBO = new AgencyBO();
                // Load the request data into it
                const agency = await agencyBO.getById(applicationJSON.agency).catch(function(err) {
                    log.error("Agency load error " + err + __location);
                    error = err;
                });
                if(agency){
                    applicationJSON.agencyNetworkId = agency.agency_network;
                    applicationJSON.agency_network = agency.agency_network;
                }
                else {
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
                        await businessModel.saveBusiness(applicationJSON.businessInfo).catch(function(err) {
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

                        this.processLocationsMongo(applicationJSON.locations);

                    }
                    // update business data
                    if (applicationJSON.total_payroll) {
                        await this.processActivityCodes(applicationJSON.total_payroll).catch(function(err) {
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
                    if (applicationJSON.policy_types) {
                        await this.processPolicyTypes(applicationJSON.policy_types, applicationJSON).catch(function(err) {
                            log.error('Adding claims error:' + err + __location);
                            reject(err);
                        });
                    }
                    // update business data
                    updateBusiness = true;
                    break;
                case 'owners':
                    updateBusiness = true;
                    this.processOwnersMongo(applicationJSON);
                    break;
                case 'details':
                    updateBusiness = true;
                    //TODO details setup Mapping to Mongoose Model not we already have one loaded.
                    if(applicationJSON.coverage_lapse === 1){
                        applicationJSON.coverageLapseWC = true;
                        //TODO update policy info
                    }
                    break;
                case 'claims':
                    if (applicationJSON.claims) {
                        await this.processClaimsWF(applicationJSON.claims).catch(function(err) {
                            log.error('Adding claims error:' + err + __location);
                            reject(err);
                        });
                    }
                    //TODO details setup Mapping to Mongoose Model not we already have one loaded.
                    break;
                case 'questions':
                    if (applicationJSON.questions) {
                        await this.processQuestions(applicationJSON.questions).catch(function(err) {
                            log.error('Adding Questions error:' + err + __location);
                            reject(err);
                        });

                        await this.processQuestionsMongo(applicationJSON.questions).catch(function(err) {
                            log.error('Adding Questions error:' + err + __location);
                            // reject(err);
                        });

                    }
                    await this.processLegalAcceptance(applicationJSON).catch(function(err) {
                        log.error('Adding Legal Acceptance error:' + err + __location);
                        reject(err);
                    });
                    //applicationJSON.status = 'incomplete';
                    //applicationJSON.appStatusId = 10;
                    if (applicationJSON.wholesale === 1 || applicationJSON.solepro === 1) {
                        //save the app for the email.
                        this.#dbTableORM.load(applicationJSON, false).catch(function(err) {
                            log.error("Error loading application orm " + err + __location);
                        });
                        //save
                        await this.#dbTableORM.save().catch(function(err) {
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
                        applicationJSON.progress = 'complete';
                        applicationJSON.appStatusId = this.appStatusId;
                        await this.processQuotes(applicationJSON).catch(function(err) {
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
                    await this.processBusiness(applicationJSON.businessInfo).catch(function(err) {
                        log.error("updating business error:" + err + __location);
                        reject(err);
                    });
                    delete applicationJSON.businessInfo
                }
            }


            if (!this.#dbTableORM.last_step) {
                this.#dbTableORM.last_step = stepNumber;
                applicationJSON.lastStep = stepNumber;
            }
            else if (stepNumber > this.#dbTableORM.last_step) {
                this.#dbTableORM.last_step = stepNumber;
                applicationJSON.lastStep = stepNumber;
            }

            await this.cleanupInput(applicationJSON);

            //$app->created_by = $user->id;
            this.#dbTableORM.load(applicationJSON, false).catch(function(err) {
                log.error("Error loading application orm " + err + __location);
            });
            if (!this.#dbTableORM.uuid) {
                this.#dbTableORM.uuid = applicationJSON.uuid;
            }

            //save
            await this.#dbTableORM.save().catch(function(err) {
                reject(err);
            });
            this.updateProperty();
            this.id = this.#dbTableORM.id;
            applicationJSON.id = this.id;
            // mongoose model save.
            this.mapToMongooseJSON(applicationJSON)
            if(this.#applicationMongooseDB){
                //update
                this.updateMongo(this.#applicationMongooseDB.applicationId, this.#applicationMongooseJSON)
            }
            else {
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
            "id": "mysqlId",
            "state": "processStateOld"
        }
        for(const sourceProp in sourceJSON){
            if(typeof sourceJSON[sourceProp] !== "object"){
                if(propMappings[sourceProp]){
                    const appProp = propMappings[sourceProp]
                    this.#applicationMongooseJSON[appProp] = sourceJSON[sourceProp];
                }
                else {
                    //check if snake_case
                    if(sourceProp.isSnakeCase()){
                        this.#applicationMongooseJSON[sourceProp.toCamelCase()] = sourceJSON[sourceProp];
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
        return new Promise(async(resolve, reject) => {
            if (!businessInfo.id) {
                reject(new Error("no business id"));
                return;
            }
            const businessModel = new BusinessModel();
            await businessModel.saveBusiness(businessInfo).catch(function(err) {
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
        //owners if present needs to be removed.
        if(businessInfo.owners){
            delete businessInfo.owners;
        }

        for (const businessProp in businessInfo) {
            if(typeof businessInfo[businessProp] !== "object"){
                if(businessInfoMapping[businessProp]){
                    const appProp = businessInfoMapping[businessProp]
                    this.#applicationMongooseJSON[appProp] = businessInfo[businessProp];
                }
                else if(businessProp.isSnakeCase()){
                    this.#applicationMongooseJSON[businessProp.toCamelCase()] = businessInfo[businessProp];
                }
                else {
                    this.#applicationMongooseJSON[businessProp] = businessInfo[businessProp];
                }
            }
        }

        if(businessInfo.contacts){
            //setup mongoose contanct
            this.#applicationMongooseJSON.contacts = [];

            for(var i = 0; i < businessInfo.contacts.length; i++){
                const businessContact = businessInfo.contacts[i]
                const contactJSON = {};
                contactJSON.email = businessContact.email;
                contactJSON.firstName = businessContact.fname;
                contactJSON.lastName = businessContact.lname;
                contactJSON.phone = businessContact.phone;
                contactJSON.primary = businessContact.primary;
                this.#applicationMongooseJSON.contacts.push(contactJSON);
            }

        }
        //save model if we have a model
        if(this.#applicationMongooseDB){
            //save....
            this.updateMongo(this.#applicationMongooseDB.applicationId, this.#applicationMongooseJSON)
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
        return new Promise(async(resolve, reject) => {
            //copy to mongoose json
            //clonedeep
            this.#applicationMongooseJSON.claims = clonedeep(claims);
            for(let i = 0; i < this.#applicationMongooseJSON.claims.length; i++){
                const claim = this.#applicationMongooseJSON.claims[i];
                for (const prop in claim) {
                    //check if snake_case
                    if(prop.isSnakeCase()){
                        claim[prop.toCamelCase()] = claim[prop];
                        delete claim[prop];
                    }
                }
            }

            //delete existing.
            const applicationClaimModelDelete = new ApplicationClaimBO();
            //remove existing addresss acivity codes. we do not get ids from UI.
            await applicationClaimModelDelete.DeleteClaimsByApplicationId(this.id).catch(function(err) {
                log.error("Error deleting ApplicationClaimModel " + err + __location);
            });
            for (var i = 0; i < claims.length; i++) {
                const claim = claims[i];
                claim.application = this.id;
                const applicationClaimModel = new ApplicationClaimBO();
                await applicationClaimModel.saveModel(claim).catch(function(err) {
                    log.error("Adding new claim error:" + err + __location);
                    reject(err);
                    return;
                });
            }
            resolve(true);

        });
    }

    processActivityCodes(activtyListJSON) {

        return new Promise(async(resolve, reject) => {

            // this.#applicationMongooseJSON.activityCodes = clonedeep(activtyListJSON);
            this.#applicationMongooseJSON.activityCodes = [];


            // for(let i = 0; i <  activtyListJSON.length; i++ ){
            //     let activityCodeJson = activtyListJSON[i];
            //     activityCodeJson.ncciCode = activityCodeJson.ncci_code;
            //     activityCodeJson.payroll = activityCodeJson.payroll;
            // }

            //delete existing.
            const applicationActivityCodesModelDelete = new ApplicationActivityCodesModel();
            //remove existing addresss acivity codes. we do not get ids from UI.
            await applicationActivityCodesModelDelete.DeleteByApplicationId(this.id).catch(function(err) {
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
                const activityCodeModelJSON = {
                    "ncciCode": activity,
                    "payroll": activtyListJSON[activity]
                }

                this.#applicationMongooseJSON.activityCodes.push(activityCodeModelJSON)
                const applicationActivityCodesModel = new ApplicationActivityCodesModel();
                await applicationActivityCodesModel.saveModel(activityCodeJSON).catch(function(err) {
                    log.error(`Adding new applicationActivityCodesModel for Appid ${this.id} error:` + err + __location);
                    reject(err);
                    return;
                });
            }

            resolve(true);

        });

    }


    processPolicyTypes(policyTypeArray,applicationJSON) {

        return new Promise(async(resolve, reject) => {

            //this.#applicationMongooseJSON.policies = clonedeep(policyTypeArray);

            const policyList = [];
            for (var i = 0; i < policyTypeArray.length; i++) {
                const policyType = policyTypeArray[i];
                const policyTypeJSON = {"policyType": policyType}
                if(policyType === "GL"){
                    //GL limit and date fields.
                    policyTypeJSON.effectiveDate = applicationJSON.gl_effective_date
                    policyTypeJSON.expirationDate = applicationJSON.gl_expiration_date
                    policyTypeJSON.limits = applicationJSON.limits
                    policyTypeJSON.deductible = applicationJSON.deductible


                }
                else if(policyType === "WC"){
                    policyTypeJSON.effectiveDate = applicationJSON.wc_effective_date
                    policyTypeJSON.expirationDate = applicationJSON.wc_expiration_date
                    policyTypeJSON.limits = applicationJSON.wc_limits
                    policyTypeJSON.coverageLapse = applicationJSON.coverageLapse

                }
                else if(policyType === "BOP"){
                    policyTypeJSON.effectiveDate = applicationJSON.bop_effective_date
                    policyTypeJSON.expirationDate = applicationJSON.bop_expiration_date
                    policyTypeJSON.limits = applicationJSON.limits
                    policyTypeJSON.coverage = applicationJSON.coverage
                    policyTypeJSON.deductible = applicationJSON.deductible

                }
                policyList.push(policyTypeJSON);
            }
            this.#applicationMongooseJSON.policies = policyList

            //delete existing.
            const applicationPolicyTypeModelDelete = new ApplicationPolicyTypeBO();
            //remove existing addresss acivity codes. we do not get ids from UI.
            await applicationPolicyTypeModelDelete.DeleteByApplicationId(this.id).catch(function(err) {
                log.error("Error deleting ApplicationPolicyTypeModel " + err + __location);
            });


            for (var i = 0; i < policyTypeArray.length; i++) {
                const policyType = policyTypeArray[i];
                const policyTypeJSON = {
                    'application': this.id,
                    "policy_type": policyType
                }
                const applicationPolicyTypeModel = new ApplicationPolicyTypeBO();
                await applicationPolicyTypeModel.saveModel(policyTypeJSON).catch(function(err) {
                    log.error(`Adding new applicationPolicyTypeModel for Appid ${this.id} error:` + err + __location);
                    reject(err);
                    return;
                });
            }

            resolve(true);

        });

    }
    processLocationsMongo(locations){
        this.#applicationMongooseJSON.locations = locations
        const businessInfoMapping = {};
        for(let i = 0; i < this.#applicationMongooseJSON.locations.length; i++){
            const location = this.#applicationMongooseJSON.locations[i];
            for (const locationProp in location) {
                //not in map check....
                if(!businessInfoMapping[locationProp]){
                    if(locationProp.isSnakeCase()){
                        location[locationProp.toCamelCase()] = location[locationProp];
                    }
                    //some condition where client sends null;
                    if(!location.billing || location.billing === false || location.billing === 0){
                        location.billing = false;
                    }
                }
            }
            location.activityPayrollList = [];

            if(location.activity_codes && location.activity_codes.length > 0) {
                for(let j = 0; j < location.activity_codes.length; j++){
                    const activity_code = location.activity_codes[j];
                    const activityPayrollJSON = {};
                    activityPayrollJSON.ncciCode = activity_code.id;
                    activityPayrollJSON.payroll = activity_code.payroll;
                    location.activityPayrollList.push(activityPayrollJSON)
                }
            }
        }

    }


    processOwnersMongo(applicationJSON){
        if(applicationJSON.owners_covered){
            try{
                const tempInt = parseInt(applicationJSON.owners_covered, 10);
                this.#applicationMongooseJSON.ownersCovered = tempInt === 1;
                if(this.#applicationMongooseJSON.ownersCovered > 0 && applicationJSON.owner_payroll){

                    if(this.#applicationMongooseDB && this.#applicationMongooseDB.locations){
                        //Find primary location and update payroll - ownerPayroll field.
                        // applicationJSON.owner_payroll.activity_code = stringFunctions.santizeNumber(requestJSON.activity_code, makeInt);
                        // applicationJSON.owner_payroll.payroll = stringFunctions.santizeNumber(requestJSON.payroll, makeInt);
                        // applicationJSON.businessInfo.owner_payroll = JSON.parse(JSON.stringify(requestJSON.owner_payroll));
                        // applicationJSON.owner_payroll = JSON.parse(JSON.stringify(requestJSON.owner_payroll));
                        for(let i = 0; i < this.#applicationMongooseDB.locations.length; i++){
                            const location = this.#applicationMongooseDB.locations[i];
                            if(!location.activityPayrollList){
                                location.activityPayrollList = [];
                            }
                            const activityPayroll = location.activityPayrollList.find(activityPayroll => activityPayroll.ncciCode === applicationJSON.owner_payroll.activity_code);
                            if(activityPayroll){
                                activityPayroll.ownerPayRoll = applicationJSON.owner_payroll.payroll
                            }
                            else {
                                const activityPayrollJSON = {
                                    ncciCode: applicationJSON.owner_payroll.activity_code,
                                    ownerPayRoll: applicationJSON.owner_payroll.payroll
                                };
                                location.activityPayrollList.push(activityPayrollJSON);

                            }
                        }
                        this.#applicationMongooseJSON.locations = this.#applicationMongooseDB.locations;
                    }
                    else {
                        log.error(`Missing this.#applicationMongooseJSON.locations for owner payroll appId: ${applicationJSON.id} ` + __location);
                    }

                }
            }
            catch(err){
                log.error(`Error Parsing appID: ${applicationJSON.id} applicationJSON.owners_covered ${applicationJSON.owners_covered}: ` + err + __location)
            }
        }

        if(applicationJSON.businessInfo && applicationJSON.businessInfo.num_owners){
            try{
                this.#applicationMongooseJSON.numOwners = parseInt(applicationJSON.businessInfo.num_owners, 10);
            }
            catch(err){
                log.error(`Error Parsing appID: ${applicationJSON.id} applicationJSON.owners_covered ${applicationJSON.businessInfo.num_owners}: ` + err + __location)
            }
        }


        if(applicationJSON.businessInfo && applicationJSON.businessInfo.ownersJSON){
            try{
                if(!this.#applicationMongooseJSON.owners){
                    this.#applicationMongooseJSON.owners = [];
                }
                for(let i = 0; i < applicationJSON.businessInfo.ownersJSON.length; i++){
                    const sourceJSON = applicationJSON.businessInfo.ownersJSON[i];
                    const ownerJSON = {};
                    for(const sourceProp in sourceJSON){
                        if(typeof sourceJSON[sourceProp] !== "object"){
                            //check if snake_case
                            if(sourceProp.isSnakeCase()){
                                ownerJSON[sourceProp.toCamelCase()] = sourceJSON[sourceProp];
                            }
                            else {
                                ownerJSON[sourceProp] = sourceJSON[sourceProp];
                            }
                            if(sourceProp === "ownership"){
                                try{
                                    ownerJSON[sourceProp] = parseInt(ownerJSON[sourceProp], 10);
                                }
                                catch(err){
                                    log.error(`unable to convert ownership appId: ${applicationJSON.id} value: ${ownerJSON[sourceProp]} ` + err + __location);
                                }
                            }
                        }
                    }
                    this.#applicationMongooseJSON.owners.push(ownerJSON);
                }
            }
            catch(err){
                log.error(`Error Parsing  owner for appID: ${applicationJSON.id} applicationJSON.owners_covered ${JSON.stringify(applicationJSON.owners)}: ` + err + __location)
            }
        }
    }

    processQuestions(questions) {

        return new Promise(async(resolve, reject) => {
            ///delete existing ?? old system did not.

            // this.#applicationMongooseJSON.questions = questions;
            //TODO get text and turn into list of question objects.


            const valueList = []
            for (var i = 0; i < questions.length; i++) {
                const question = questions[i];
                questions.application = this.id;
                let valueLine = '';
                if (question.type === 'text') {
                    const cleanString = question.answer.replace(/\|/g, ',')
                    valueLine = `(${this.id}, ${question.id}, NULL, ${db.escape(cleanString)})`

                }
                else if (question.type === 'array') {
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
            const result = await db.query(insertSQL).catch(function(error) {
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

    processQuestionsMongo(questionsRequest) {

        return new Promise(async(resolve, reject) => {
            ///delete existing ?? old system did not.

            const questionTypeBO = new QuestionTypeBO();
            // Load the request data into it
            const questionTypeListDB = await questionTypeBO.getList().catch(function(err) {
                log.error("questionTypeBO load error " + err + __location);
            });

            this.#applicationMongooseJSON.questions = [];
            //get text and turn into list of question objects.

            for (var i = 0; i < questionsRequest.length; i++) {
                const questionRequest = questionsRequest[i];
                const questionJSON = {};
                questionJSON.questionId = questionRequest.id
                questionsRequest.questionType = questionRequest.type;

                //get Question def for Question Text and Yes
                const questionBO = new QuestionBO();
                // Load the request data into it
                const questionDB = await questionBO.getById(questionJSON.questionId).catch(function(err) {
                    log.error("questionBO load error " + err + __location);
                });
                if(questionDB){
                    questionJSON.questionText = questionDB.question;
                    questionJSON.hint = questionDB.hint;
                    questionJSON.hidden = questionDB.hidden;
                    questionJSON.questionType = questionDB.type;
                    if(questionTypeListDB){
                        const questionType = questionTypeListDB.find(questionType => questionType.id === questionDB.type);
                        if(questionType){
                            questionJSON.questionType = questionType.name;
                        }
                    }
                }
                else {
                    log.error(`no question record for id ${questionJSON.questionId} ` + __location);
                }

                if (questionRequest.type === 'text') {
                    //const cleanString = questionRequest.answer.replace(/\|/g, ',')
                    questionJSON.answerValue = questionRequest.answer;
                }
                else if (questionRequest.type === 'array') {
                    const arrayString = "|" + questionRequest.answer.join('|');
                    questionJSON.answerValue = arrayString;
                    const questionAnswerBO = new QuestionAnswerBO();
                    const questionAnswerListDB = await questionAnswerBO.getListByAnswerIDList(questionRequest.answer).catch(function(err) {
                        log.error("questionBO load error " + err + __location);
                    });
                    if(questionAnswerListDB && questionAnswerListDB.length > 0){
                        questionJSON.answerList = [];
                        for (let j = 0; j < questionAnswerListDB.length; j++){
                            questionJSON.answerList.push(questionAnswerListDB[j].answer);
                        }

                    }
                    else {
                        log.error(`no questionAnswer record for ids ${JSON.stringify(questionRequest.answer)} ` + __location);
                    }
                }
                else {
                    questionJSON.answerId = questionRequest.answer;
                    // Need answer value
                    const questionAnswerBO = new QuestionAnswerBO();
                    // Load the request data into it
                    const questionAnswerDB = await questionAnswerBO.getById(questionJSON.answerId).catch(function(err) {
                        log.error("questionBO load error " + err + __location);
                    });
                    if(questionAnswerDB){
                        questionJSON.answerValue = questionAnswerDB.answer;
                    }
                    else {
                        log.error(`no question record for id ${questionJSON.questionId} ` + __location);
                    }

                }
                this.#applicationMongooseJSON.questions.push(questionJSON);
            }
            resolve(true);

        });

    }

    processLegalAcceptance(applicationJSON) {

        return new Promise(async(resolve, reject) => {
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
            await legalAcceptanceModel.saveModel(legalAcceptanceJSON).catch(function(err) {
                log.error(`Adding new Legal Acceptance for Appid ${this.id} error:` + err + __location);
                reject(err);
                return;
            });
            resolve(true);

        });

    }

    processQuotes(applicationJSON) {

        return new Promise(async(resolve, reject) => {
            if (applicationJSON.quotes) {
                for (var i = 0; i < applicationJSON.quotes.length; i++) {
                    const quote = applicationJSON.quotes[i];
                    log.debug("quote: " + JSON.stringify(quote) + __location)
                    log.debug("Sending Bind Agency email for AppId " + this.id + " quote " + quote.quote + __location);
                    //no need to await.
                    taskEmailBindAgency.emailbindagency(this.id, quote.quote);

                    //load quote from database.
                    const quoteModel = new QuoteBO();
                    //update quote record.
                    await quoteModel.loadFromId(quote.quote).catch(function(err) {
                        log.error(`Loading quote for status and payment plan update quote ${quote.quote} error:` + err + __location);
                        //reject(err);
                        //return;

                    });
                    const quoteUpdate = {
                        "status": "bind_requested",
                        "payment_plan": quote.payment
                    }
                    await quoteModel.saveModel(quoteUpdate).catch(function(err) {
                        log.error(`Updating  quote with status and payment plan quote ${quote.quote} error:` + err + __location);
                        // reject(err);
                        //return;

                    });

                    applicationJSON.state = quote.api_result === 'referred_with_price' ? 12 : 16;
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
            const currentAppDBJSON = await this.getById(this.id).catch(function(err){
                log.error(`error getBusinessInfo getting application record, appid ${this.id} error:` + e + __location)
            });
            if(typeof currentAppDBJSON !== 'object'){
                return false;
            }
            //Setup goodplace
            let saveBusinessData = false;
            let afBusinessDataJSON = null;
            let newBusinessDataJSON = currentAppDBJSON.businessDataJSON;
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
            const agencyNetworkId = requestApplicationJSON.agencyNetworkId;
            // try{
            //     agencyNetworkId = await this.getAgencyNewtorkIdById(this.id);
            // }
            // catch(err){
            //     log.error(`Error getting agencyNetworkId, application - ${this.id} ` + err + __location)
            // }
            //Only process AF call if digalent.
            if(agencyNetworkId === 2 && global.settings.ENV !== 'production'){
                const businessInfoRequestJSON = {"company_name": requestApplicationJSON.businessInfo.name};
                // if(applicationJSON.businessInfo.address && applicationJSON.businessInfo.address.state_abbr){
                //     businessInfo.state = applicationJSON.businessInfo.address.state_abbr
                // } else if(applicationJSON.address.state_abbr){
                //     businessInfo.state = applicationJSON.address.state_abbr
                // }
                const addressFieldList = ["address",
                    "address2",
                    "city",
                    "state_abbr",
                    "zip"];
                const address2AFRequestMap = {
                    "address" : "street_address1",
                    "address2" : "street_address2",
                    "state_abbr": "state"
                };
                for(let i = 0; i < addressFieldList.length; i++){
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
                this.#applicationMongooseJSON.businessDataJSON = newBusinessDataJSON;
                const sql = `Update ${tableName} 
                    SET businessDataJSON = ${db.escape(JSON.stringify(newBusinessDataJSON))}
                    WHERE id = ${db.escape(this.id)}
                `;

                const result = await db.query(sql).catch(function(err) {
                    // Check if this was
                    log.error("Database Object ${tableName} UPDATE businessDataJSON error :" + err + __location);
                    error = err;
                });
                //TODO monogoose model save
                log.info(`Application ${this.id} update BusinessDataJSON`);
                currentAppDBJSON.businessDataJSON = newBusinessDataJSON;
                if(afBusinessDataJSON && afBusinessDataJSON.Status === "SUCCESS"){
                    //update application Business and address.
                    await this.updateFromAfBusinessData(currentAppDBJSON, afBusinessDataJSON)
                }
                else if(requestApplicationJSON.google_place){
                    requestApplicationJSON.google_place.address = requestApplicationJSON.address;
                    await this.updatefromGooglePlaceData(currentAppDBJSON, requestApplicationJSON.google_place)
                }
                else {
                    log.debug("No valid Business Data to update records " + __location)
                }
            }
            // update application.businessDataJSON
        }// if applicationJSON.businessInfo
        //no errors....
        return false;
    }
    async updateFromAfBusinessData(applicationJSON, afBusinessDataJSON){
        if(this.id && afBusinessDataJSON && applicationJSON){
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

                    this.#dbTableORM.load(applicationJSON, false).catch(function(err) {
                        log.error("Error loading application orm " + err + __location);
                        throw err;
                    });

                    //save
                    log.debug("saving application records from afBusinessDataJSON " + __location)
                    await this.#dbTableORM.save().catch(function(err) {
                        log.error("Error Saving application orm " + err + __location);
                        throw err;
                    });
                    log.debug(`App ${this.id} updated from afBusinessDataJSON ` + __location);
                    //TODO monogoose model save
                    //this.#applicationMongooseJSON
                }
                catch(err){
                    log.error("Error update App from AFBusinessData " + err + __location);
                }


            }
            if(applicationJSON.business){
                //have businessId
                const businessJSON = {"id": applicationJSON.business};
                const locationJSON = {"business": applicationJSON.business}


                if(afBusinessDataJSON.afgCompany){

                    //employees.
                    if(afBusinessDataJSON.afgPreFill.number_of_employee){
                        locationJSON.full_time_employees = afBusinessDataJSON.afgPreFill.number_of_employee;
                    }
                    else if(afBusinessDataJSON.afgPreFill.employee_count){
                        locationJSON.full_time_employees = afBusinessDataJSON.afgPreFill.employee_count;
                    }

                    const companyFieldList = ["street_addr1",
                        "street_addr2",
                        "city",
                        "state",
                        "zip",
                        "website"];
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
                        for(let i = 0; i < companyFieldList.length; i++){
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

                if(afBusinessDataJSON.afgPreFill && afBusinessDataJSON.afgPreFill.company){
                    if(afBusinessDataJSON.afgPreFill.company.legal_entity){
                        businessJSON.entity_type = afBusinessDataJSON.afgPreFill.company.legal_entity;
                    }
                    if(afBusinessDataJSON.afgPreFill.company.industry_experience){
                        businessJSON.years_of_exp = afBusinessDataJSON.afgPreFill.company.industry_experience;
                    }

                }
                businessJSON.locations = [];
                businessJSON.locations.push(locationJSON)


                try{
                    log.debug(`updating  application business records from afBusinessDataJSON  appId: ${applicationJSON.id} ` + __location)
                    await this.processBusiness(businessJSON);
                }
                catch(err){
                    log.error("Error Mapping AF Business Data to BO Saving " + err + __location);
                }
                this.processLocationsMongo(businessJSON.locations);
                try{
                    this.updateMongo(this.#applicationMongooseDB.applicationId, this.#applicationMongooseJSON)
                    // if(this.#applicationMongooseDB){
                    //     this.#applicationMongooseDB.locations = this.#applicationMongooseJSON.locations;
                    //     await this.#applicationMongooseDB.save()
                    // }
                }
                catch(err){
                    log.error("Error Mapping AF Business Data to Mongo Saving " + err + __location);
                }

            }
            else {
                log.error(`No business id for application ${this.id}`)
            }
            //clw_talage_application_activity_codes - default from industry_code???
            // payroll ?????
        }
        else {
            log.warn("updateFromAfBusinessData missing parameters " + __location)
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

                    this.#dbTableORM.load(applicationJSON, false).catch(function(err) {
                        log.error("Error loading application orm " + err + __location);
                        throw err;
                    });

                    //save
                    log.debug("saving application records from GooglePlace " + __location)
                    await this.#dbTableORM.save().catch(function(err) {
                        log.error("Error Saving application orm " + err + __location);
                        throw err;
                    });
                    //TODO monogoose model save
                    log.debug(`App ${this.id} updated from GooglePlace ` + __location);
                }
                catch(err){
                    log.error("Error update App from AFBusinessData " + err + __location);
                }


            }
            if(applicationJSON.business){
                //have businessId
                const businessJSON = {"id": applicationJSON.business};
                const locationJSON = {"business": applicationJSON.business}
                if(googlePlaceJSON.address){
                    const companyFieldList = ["address",
                        "address2",
                        "city",
                        "state_abbr",
                        "zip"];
                    const company2BOMap = {
                        "address" : "mailing_address",
                        "address2" : "mailing_address2",
                        "city": "mailing_city",
                        "state_abbr": "mailing_state_abbr",
                        "zip": "mailing_zipcode"
                    };
                    const company2LocationBOMap = {"zip": "zipcode"};
                    try{
                        for(let i = 0; i < companyFieldList.length; i++){
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


                businessJSON.locations = [];
                businessJSON.locations.push(locationJSON)
                try{
                    log.debug(`updating  application business records from Google Place data appId: ${applicationJSON.id} ` + __location)
                    await this.processBusiness(businessJSON);

                }
                catch(err){
                    log.error("Error Mapping AF Business Data to BO Saving " + err + __location);
                }
                this.processLocationsMongo(businessJSON.locations);
            }
            else {
                log.error(`No business id for application ${this.id}`)
            }
        }
        else {
            log.warn("updateFromAfBusinessData missing parameters " + __location)
        }
        return true;
    }


    async updateStatus(id,appStatusDesc, appStatusid){

        if(id && id > 0){
            try {
                const sql = `
                    UPDATE clw_talage_applications
                    SET status = ${db.escape(appStatusDesc)}, appStatusid = ${db.escape(appStatusid)}
                    WHERE id = ${id};
                `;
                const result = await db.query(sql);
            }
            catch (error) {
                log.error(`Could not update application status mySql appId: ${id}  ${error} ${__location}`);
            }
            //mongo update.....
            try{
                const updateStatusJson = {
                    status:  appStatusDesc,
                    "appStatusId": appStatusid
                }
                const query = {"mysqlId": id};
                await Application.updateOne(query, updateStatusJson);
            }
            catch(error){
                log.error(`Could not update application status mongo appId: ${id}  ${error} ${__location}`);
            }
            return true;
        }
        else {
            log.error(`updateStatus missing id ` + __location);
        }
    }

    async updateProgress(id,progress){

        const sql = `
		    UPDATE clw_talage_applications
		    SET progress = ${db.escape(progress)}
		    WHERE id = ${db.escape(id)}
        `;
        let result = null;

        try {
            result = await db.query(sql);
        }
        catch (error) {
            log.error(`Could not update the quote progress to ${progress} for application ${id}: ${error} ${__location}`);
        }
        if (result === null || result.affectedRows !== 1) {
            log.error(`Could not update the quote ${progress} to 'quoting' for application ${id}: ${sql} ${__location}`);
        }
        //mongo update.....
        try{
            const updateStatusJson = {progress:  progress}
            const query = {"mysqlId": id};
            await Application.updateOne(query, updateStatusJson);
        }
        catch(error){
            log.error(`Could not update application status mongo appId: ${id}  ${error} ${__location}`);
        }
        return true;
    }

    async getProgress(id){

        const sql = `
            SELECT progress
            FROM clw_talage_applications
            WHERE id = ${id}
        `;
        let result = null;
        try {
            result = await db.query(sql);
        }
        catch (error) {
            log.error(`Could not get the quote progress for application ${id}: ${error} ${__location}`);
        }
        if(result && result.length > 0){
            return result[0].progress;
        }
        else {
            log.error(`Could not get the quote progress for application ${id}: ${error} ${__location}`);
            return "unknown";
        }
    }

    // save(asNew = false) {
    //     return new Promise(async (resolve, reject) => {
    //         //validate

    //         resolve(true);
    //     });
    // }

    loadFromId(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id && id > 0) {
                await this.#dbTableORM.getById(id).catch(function(err) {
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

    async updateMongoWithMysqlId(mysqlId, newObjectJSON){
        //TODO ----
        //Get applicationId.
        let applicationDoc = null;
        try{
            applicationDoc = await this.loadfromMongoBymysqlId(mysqlId);
        }
        catch(err){
            log.error("Error get applicationId from mysqlId " + err + __location);
            throw err;
        }
        if(applicationDoc && applicationDoc.applicationId){
            return await this.updateMongo(applicationDoc.applicationId, newObjectJSON)
        }
        else {
            log.error(`Error no ApplicationDoc or Application.applicationID. mysqlId ${mysqlId}` + __location)
            throw new Error(`mysqlId ${mysqlId} not found`);
        }
    }

    async updateMongo(uuid, newObjectJSON){
        if(uuid){
            if(typeof newObjectJSON === "object"){
                const changeNotUpdateList = ["active",
                    "id",
                    "mysqlId",
                    "applicationId",
                    "uuid"]
                for(let i = 0; i < changeNotUpdateList.length; i++){
                    if(newObjectJSON[changeNotUpdateList[i]]){
                        delete newObjectJSON[changeNotUpdateList[i]];
                    }
                }
                const query = {"applicationId": uuid};
                let newApplicationJSON = null;
                try {
                    //because Virtual Sets.  new need to get the model and save.

                    await Application.updateOne(query, newObjectJSON);
                    const newApplicationdoc = await Application.findOne(query);
                    this.#applicationMongooseDB = newApplicationdoc
                    //because Virtual Sets. we need to updatemode land save it.
                    // Only EIN is virtual...
                    if(newObjectJSON.ein && newApplicationdoc){
                        newApplicationdoc.ein = newObjectJSON.ein
                        await newApplicationdoc.save().catch(function(err){
                            log.error('Mongo Application Save for Virtuals err ' + err + __location);
                            throw err;
                        });
                    }
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
        if(!newObjectJSON){
            throw new Error("no data supplied");
        }

        //covers quote app WF where mysql saves first.
        if(!newObjectJSON.applicationId && newObjectJSON.uuid){
            newObjectJSON.applicationId = newObjectJSON.uuid;
        }

        const application = new Application(newObjectJSON);
        //log.debug("insert application: " + JSON.stringify(application))
        //Insert a doc
        await application.save().catch(function(err){
            log.error('Mongo Application Save err ' + err + __location);
            throw err;
        });
        this.#applicationMongooseDB = application;

        return mongoUtils.objCleanup(application);
    }

    loadfromMongoByAppId(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id){
                const query = {
                    "applicationId": id,
                    active: true
                };
                let applicationDoc = null;
                try {
                    applicationDoc = await Application.findOne(query, '-__v');
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                resolve(applicationDoc);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    loadfromMongoBymysqlId(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id){
                const query = {
                    "mysqlId": id,
                    active: true
                };
                let applicationDoc = null;
                try {
                    applicationDoc = await Application.findOne(query, '-__v');
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                resolve(applicationDoc);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }


    getfromMongoByAppId(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id){
                const query = {
                    "applicationId": id,
                    active: true
                };
                let applicationDoc = null;
                try {
                    const docDB = await Application.findOne(query, '-__v');
                    if(docDB){
                        applicationDoc = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                resolve(applicationDoc);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }


    getfromMongoBymysqlId(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id){
                const query = {
                    "mysqlId": id,
                    active: true
                };
                let applicationDoc = null;
                try {
                    const docDB = await Application.findOne(query, '-__v');
                    if(docDB){
                        applicationDoc = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                resolve(applicationDoc);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }


    getById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id && id > 0) {
                await this.#dbTableORM.getById(id).catch(function(err) {
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
        return new Promise(async(resolve, reject) => {
            //validate
            if (id && id > 0) {

                //Remove old records.
                const sql = `Update ${tableName} 
                        SET state = -2
                        WHERE id = ${db.escape(id)}
                `;
                let rejected = false;
                const result = await db.query(sql).catch(function(error) {
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
        return new Promise(async(resolve, reject) => {

            let rejected = false;

            const sql = `
            select ag.agency_network from clw_talage_applications a
            inner join clw_talage_agencies ag on ag.id = a.agency
            where a.id = ${db.escape(id)}
            `;
            const result = await db.query(sql).catch(function(error) {
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
    getLoadedMongoDoc(){
        if(this.#applicationMongooseDB && this.#applicationMongooseDB.mysqlId){
            return this.#applicationMongooseDB;
        }
        else {
            return null;
        }
    }

    async getMongoDocbyMysqlId(mysqlId){
        return new Promise(async(resolve, reject) => {
            if(this.#applicationMongooseDB && this.#applicationMongooseDB.mysqlId){
                return this.#applicationMongooseDB;
            }
            else if(mysqlId){
                const query = {
                    "mysqlId": mysqlId,
                    active: true
                };
                let appllicationDoc = null;
                try {
                    const docDB = await Application.findOne(query, '-__v');
                    if(docDB){
                        this.#applicationMongooseDB = docDB
                        appllicationDoc = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                resolve(appllicationDoc);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }


    async cleanupInput(inputJSON) {
        //convert to ints
        for (const property in properties) {
            if (inputJSON[property]) {
                // Convert to number
                try {
                    if (properties[property].type === "number" && typeof inputJSON[property] === "string") {
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
                }
                else if (this[property]) {
                    delete this[property];
                }
            }
            else {
                this[property] = dbJSON[property];
            }
        }
    }
    // copyToMongo(id){

    // }

    // *********************************
    //    Question processing
    //
    //
    // *********************************

    async GetQuestionsForFrontend(appId, activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, return_hidden = false){

        log.debug("in AppBO.GetQuestionsForFrontend")
        //Call questions.......
        const questionSvc = global.requireShared('./services/questionsvc.js');
        let getQuestionsResult = null;
        try{
            getQuestionsResult = await questionSvc.GetQuestionsForFrontend(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, return_hidden);
        }
        catch(err){
            log.error("Error call in question service " + err + __location);
            throw new Error('An error occured while retrieving application questions. ' + err);
        }
        if(!getQuestionsResult){
            log.error("No questions returned from question service " + __location);
            throw new Error('An error occured while retrieving application questions.');

        }

        let applicationDoc = null;
        try{
            applicationDoc = await this.loadfromMongoBymysqlId(appId);
        }
        catch(err){
            log.error("error calling loadfromMongoByAppId " + err + __location);
        }

        //question answers from AF business data.
        if(applicationDoc && applicationDoc.businessDataJSON && applicationDoc.businessDataJSON.afBusinessData
            && applicationDoc.businessDataJSON.afBusinessData.afgPreFill
            && applicationDoc.businessDataJSON.afBusinessData.afgPreFill.company){

            const afBusinessDataCompany = applicationDoc.businessDataJSON.afBusinessData.afgPreFill.company;

            //Get mappings.
            const mappingBO = new MappingBO();
            let mappingJSON = null;
            const mappingName = 'AFConvrDataMapp';
            try{
                const mappingDoc = await mappingBO.getByName(mappingName)
                mappingJSON = mappingDoc.mapping;
            }
            catch(err){
                log.error('Error getting AFConvrDataMapp Mapping ' + err + __location)
            }
            if(mappingJSON){
                //get AF questions
                const compWestId = 12;
                const sql = `select * 
                                from clw_talage_insurer_questions 
                                where insurer = ${compWestId}
                        `;
                let compWestQuestionList = null;
                try{
                    compWestQuestionList = await db.query(sql);
                }
                catch(err){
                    log.error("Error get compWestQuestionList " + err + __location);
                }
                if(compWestQuestionList){
                    let gotHit = false;
                    let madeChange = false;
                    //Limited data returned from AFBusiness Data api.
                    // so only process non null for question lookup.
                    for (const businessDataProp in afBusinessDataCompany){
                        try{
                            if(afBusinessDataCompany[businessDataProp] || afBusinessDataCompany[businessDataProp] === false){
                                //find in mapping
                                const mapping = mappingJSON.find(mapping => mapping.afJsonTag === businessDataProp);
                                if(mapping){
                                    // log.debug(`Mapping for AF tag ${businessDataProp}`)
                                    //find in compWestQuestionList
                                    const compWestQuestion = compWestQuestionList.find(compWestQuestion => mapping.afgIndicator === compWestQuestion.identifier);
                                    if(compWestQuestion){
                                        //find in getQuestionsResult
                                        const question = getQuestionsResult.find(question => compWestQuestion.question === question.id);
                                        if(question && question.type === "Yes/No" && question.answers){
                                            gotHit = true;
                                            log.debug(`Mapped ${mapping.afJsonTag} questionId ${question.id} AF Data value ${afBusinessDataCompany[businessDataProp]}`)
                                            const defaultAnswer = afBusinessDataCompany[businessDataProp] ? "Yes" : "No";
                                            for(let i = 0; i < question.answers.length; i++) {
                                                const answerJSON = question.answers[i];
                                                if(answerJSON.answer === defaultAnswer){
                                                    if(!answerJSON.default){
                                                        madeChange = true;
                                                        answerJSON.default = true;
                                                        log.info(`AF Data: appId ${appId} ${compWestQuestion.identifier} ${mapping.afJsonTag} Change question ${question.id} to ${answerJSON.answer}`)
                                                    }
                                                }
                                                else if(answerJSON.default){
                                                    delete answerJSON.default;
                                                }
                                            }
                                            if(madeChange === false){
                                                log.info(`NO CHANGE - AF Data: appId ${appId} ${compWestQuestion.identifier} ${mapping.afJsonTag} for question ${question.id} default ${defaultAnswer}`)
                                            }
                                        }
                                        else {
                                            // log.debug(`No Talage YES/NO question with answers for ${compWestQuestion.identifier} insurer question ${compWestQuestion.id} talage questionId ${compWestQuestion.question} ${compWestQuestion.text}`)
                                        }
                                    }
                                    else {
                                        log.debug(`No compWestQuestion question with answers for ${businessDataProp} insurer question identifier ${mapping.afgIndicatora}`)
                                    }
                                }
                                // else {
                                //     log.debug(`No Mapping for AF tag ${businessDataProp} `)
                                // }
                            }
                        }
                        catch(err){
                            log.error(`Error mapping AF business data appId ${appId}` + err + __location)
                        }
                    }
                }
                else {
                    log.error(`Error No CompWest Questions ` + __location)
                }
            }
            else{
                log.error(`Error mapping AF business data Mapping ` + __location)
            }
        }
        else {
            //non-AF applications will not have data.
            log.debug(`No AF business data for appId ${appId}` + __location)
        }

        return getQuestionsResult;

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
    "agency_network": {
        "default": 1,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
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