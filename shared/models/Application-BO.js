/* eslint-disable object-property-newline */
/* eslint-disable prefer-const */
/* eslint-disable dot-notation */
/* eslint-disable radix */
/* eslint-disable guard-for-in */
/* eslint-disable lines-between-class-members */

const moment = require('moment');
const clonedeep = require('lodash.clonedeep');
const _ = require('lodash');
var FastJsonParse = require('fast-json-parse')

const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const QuestionBO = global.requireShared('./models/Question-BO.js');

const QuoteBO = global.requireShared('./models/Quote-BO.js');
const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const taskWholesaleAppEmail = global.requireRootPath('tasksystem/task-wholesaleapplicationemail.js');
const taskSoleProAppEmail = global.requireRootPath('tasksystem/task-soleproapplicationemail.js');
const taskEmailBindAgency = global.requireRootPath('tasksystem/task-emailbindagency.js');
const QuoteBind = global.requireRootPath('quotesystem/models/QuoteBind.js');
const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const utility = global.requireShared('./helpers/utility.js');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
// Mongo Models
const ApplicationMongooseModel = require('mongoose').model('Application');
const QuoteMongooseModel = require('mongoose').model('Quote');
const mongoUtils = global.requireShared('./helpers/mongoutils.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

//const moment = require('moment');
const {'v4': uuidv4} = require('uuid');
const log = global.log;

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

//const convertToIntFields = [];


//businessDataJSON
const QUOTE_STEP_NUMBER = 9;
const QUOTING_STATUS = 15;
const QUOTE_MIN_TIMEOUT = 5;


const REDIS_AGENCY_APPLIST_PREFIX = 'applist-agency-';
const REDIS_AGENCYNETWORK_APPLIST_PREFIX = 'applist-agencynetwork-';
const REDIS_AGENCY_APPCOUNT_PREFIX = 'appcount-agency-';
const REDIS_AGENCYNETWORK_APPCOUNT_PREFIX = 'appcount-agencynetwork-';


module.exports = class ApplicationModel {

    #applicationMongooseDB = null;
    #applicationMongooseJSON = {};

    constructor() {
        this.id = 0;
        this.applicationId = null;
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
        this.applicationDoc = null;

    }


    /**
    *  For Quote App V1 - saved app based on workflow step.
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
            // eslint-disable-next-line no-unused-vars
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
            log.debug('workflowStep: ' + workflowStep + ' stepNumber: ' + stepNumber + __location);

            if (!applicationJSON.id && applicationJSON.step !== "contact") {
                log.error('saveApplicationStep missing application id ' + __location)
                reject(new Error("missing application id"));
                return;
            }
            if (applicationJSON.id) {

                log.debug(`saveApplicationStep Loading by app uuid ${applicationJSON.id} ` + __location)
                const getModelDoc = true;
                this.applicationDoc = await this.loadDocfromMongoByAppId(applicationJSON.id, getModelDoc).catch(function(err) {
                    log.error("Error getting application from Database " + err + __location);
                    reject(err);
                    return;
                });

                if(!this.applicationDoc){
                    log.error(`saveApplicationStep cound not find appId ${applicationJSON.id}` + __location);
                    reject(new Error("Data Error: Application may not be updated."));
                    return;

                }
                if(this.applicationDoc.agencyNetworkId !== 2){
                    log.error(`saveApplicationStep for non Digalent Application ${applicationJSON.id}` + __location);
                    reject(new Error("Data Error: Application may not be updated with this request"));
                    return;
                }


                this.id = this.applicationDoc.applicationId;
                this.#applicationMongooseDB = this.applicationDoc;
                this.updateProperty();
                applicationJSON.applicationId = this.applicationDoc.applicationId
                applicationJSON.uuid = this.applicationDoc.applicationId
                applicationJSON.agencyNetworkId = this.applicationDoc.agencyNetworkId;
                this.agencyNetworkId = this.applicationDoc.agencyNetworkId;
                //Check that is still updateable. less than request to bind and not deleted.
                if (this.applicationDoc.appStatusId >= 70 || this.applicationDoc.active === false) {
                    log.warn(`Attempt to update a finished or deleted application. appid ${this.applicationDoc.applicationId}` + __location);
                    reject(new Error("Data Error:Application may not be updated."));
                    return;
                }
                // //Check that it is too old (1 hours) from creation
                const bypassAgeCheck = global.settings.ENV === 'development' && global.settings.APPLICATION_AGE_CHECK_BYPASS === 'YES';
                if (this.applicationDoc.createdAt && bypassAgeCheck === false) {
                    const dbCreated = moment(this.applicationDoc.createdAt);
                    const nowTime = moment().utc();
                    const ageInMinutes = nowTime.diff(dbCreated, 'minutes');
                    log.debug('Application age in minutes ' + ageInMinutes);
                    if (ageInMinutes > 60) {
                        log.warn(`Attempt to update an old application. appid ${applicationJSON.id}` + __location);
                        reject(new Error("Data Error:Application may not be updated."));
                        return;
                    }
                }
                else if(bypassAgeCheck === false){
                    log.warn(`Application missing created value. appid ${applicationJSON.id}` + __location);
                }

                // Quote V1 only - if Application has been Quoted and this is an earlier step -- If we allows fixing the app to requote
                if (this.applicationDoc.lastStep >= QUOTE_STEP_NUMBER && stepNumber < QUOTE_STEP_NUMBER) {
                    log.warn(`Attempt to update a Quoted application. appid ${applicationJSON.id}` + __location);
                    reject(new Error("Data Error:Application may not be updated."));
                    return;
                }
            }
            else {

                //set uuid on new application
                applicationJSON.applicationId = uuidv4().toString();
                applicationJSON.uuid = applicationJSON.applicationId;
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
                    if (locationPrimaryJSON && locationPrimaryJSON.systemId) {
                        applicationJSON.agency_location = locationPrimaryJSON.systemId
                        log.info(`Set App agency location to primary for ${applicationJSON.uuid} agency ${applicationJSON.agencyId} Location ${applicationJSON.agencyLocationId}` + __location)
                    }
                    else {
                        log.warn(`Data problem prevented setting App agency location to primary for ${applicationJSON.uuid} agency ${applicationJSON.agencyId} Location ${applicationJSON.agencyLocationId}` + __location)
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
                if (agency) {
                    applicationJSON.agencyNetworkId = agency.agencyNetworkId;
                    applicationJSON.agency_network = agency.agencyNetworkId;
                }
                else {
                    log.error(`no agency record for id ${applicationJSON.agency} ` + __location);
                }
                //minium validation

                const appUuid = applicationJSON.uuid;
                this.id = appUuid;
                applicationJSON.id = appUuid;


            }

            //log.debug("applicationJSON: " + JSON.stringify(applicationJSON));
            error = null;
            let updateBusiness = false;
            const appId = applicationJSON.applicationId
            switch (workflowStep) {
                case "contact":
                    applicationJSON.progress = 'incomplete';
                    applicationJSON.status = 'incomplete';
                    applicationJSON.appStatusId = 0;
                    //setup business special case need new business ID back.
                    if (applicationJSON.businessInfo) {
                        await this.processMongooseBusiness(applicationJSON.businessInfo)
                    }
                    else {
                        log.error(`No Business for Application ${appId} ` + __location)
                        reject(new Error("No Business Information supplied"));
                        return;
                    }


                    break;
                case 'locations':
                    if (applicationJSON.locations) {
                        await this.processLocationsMongo(applicationJSON.locations);
                    }
                    updateBusiness = true;
                    break;
                case 'coverage':
                    //processPolicyTypes
                    if (applicationJSON.policy_types) {
                        await this.processPolicyTypes(applicationJSON.policy_types, applicationJSON).catch(function(err) {
                            log.error(`Adding coverage to appId ${appId} error:` + err + __location);
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
                    let updatePolicies = false;
                    //defaults
                    this.#applicationMongooseJSON.ein = applicationJSON.ein
                    applicationJSON.coverageLapseWC = false;
                    applicationJSON.coverageLapseNonPayment = false;
                    if (applicationJSON.coverage_lapse === 1) {
                        applicationJSON.coverageLapseWC = true;
                        updatePolicies = true;
                    }
                    if (applicationJSON.coverage_lapse_non_payment === 1) {
                        applicationJSON.coverageLapseNonPayment = true;
                        updatePolicies = true;
                    }
                    // add terrorism coverage defaults to false. If true, it changed and we should update
                    if (applicationJSON.add_terrorism_coverage) {
                        applicationJSON.addTerrorismCoverage = true;
                        updatePolicies = true;
                    }
                    if(updatePolicies){
                        if(this.#applicationMongooseDB.policies && this.#applicationMongooseDB.policies.length > 0){
                            for(let i = 0; i < this.#applicationMongooseDB.policies.length; i++){
                                let policy = this.#applicationMongooseDB.policies[i];
                                //if(policy.policyType === "WC"){
                                policy.coverageLapse = applicationJSON.coverageLapseWC;
                                policy.coverageLapseNonPayment = applicationJSON.coverageLapseNonPayment;
                                //}
                                if (policy.policyType !== "WC") {
                                    policy.addTerrorismCoverage = applicationJSON.addTerrorismCoverage;
                                }
                            }
                            //update working/request applicationMongooseJSON so it saves.
                            this.#applicationMongooseJSON.policies = this.#applicationMongooseDB.policies
                        }
                    }
                    break;
                case 'claims':
                    if (applicationJSON.claims) {
                        await this.processClaimsWF(applicationJSON.claims).catch(function(err) {
                            log.error(`Adding claims to appId ${appId} error:` + err + __location);
                            reject(err);
                        });
                    }
                    break;
                case 'questions':
                    if (applicationJSON.questions) {
                        this.#applicationMongooseJSON.questions = await this.processQuestionsMongo(applicationJSON.questions).catch(function(err) {
                            log.error(`Adding Questions to appId ${appId}  error:` + err + __location);
                        });
                    }
                    await this.processLegalAcceptance(applicationJSON).catch(function(err) {
                        log.error(`Adding Legal Acceptance to appId ${appId} error:` + err + __location);
                        reject(err);
                    });
                    applicationJSON.status = 'questions_done';
                    applicationJSON.appStatusId = 10;
                    if (applicationJSON.wholesale === 1 || applicationJSON.solepro === 1) {
                        this.mapToMongooseJSON(applicationJSON)
                        if (this.#applicationMongooseDB) {
                            //update
                            await this.updateMongo(this.#applicationMongooseDB.applicationId, this.#applicationMongooseJSON)
                        }
                        else {
                            //insert
                            await this.insertMongo(this.#applicationMongooseJSON)
                        }

                        // save mongo before calls.
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
                    log.debug(`bindRequest json ${JSON.stringify(applicationJSON)}` + __location)
                    let updateDdDoc = false;
                    const newappJson = {};
                    if(applicationJSON.waiverSubrogation){
                        //since only AF which is only WC - 1 policy.
                        if(this.applicationDoc.policies[0]){
                            //waiverSubrogation defaults false
                            this.applicationDoc.policies[0].waiverSubrogation = true
                            updateDdDoc = true;
                        }
                    }

                    if(applicationJSON.additionalInsured === true){
                        this.applicationDoc.additionalInsuredList = [];
                        const additionalInsuredJSON = {
                            namedInsured: applicationJSON.additionalNamedInsuredName,
                            dba: applicationJSON.additionalDBA,
                            entityType: applicationJSON.additionalEntityType,
                            ein: applicationJSON.additionalEIN
                        }
                        this.applicationDoc.additionalInsuredList.push(additionalInsuredJSON)
                        updateDdDoc = true;
                    }
                    if(updateDdDoc){
                        log.debug(`App BO bindRequest updating appId ${this.applicationDoc.applicationId} with ${JSON.stringify(newappJson)} ` + __location)
                        await this.applicationDoc.save();
                    }

                    if (applicationJSON.quotes) {
                        applicationJSON.progress = 'complete';
                        applicationJSON.appStatusId = this.applicationDoc.appStatusId;

                        await this.processQuotes(applicationJSON).catch(function(err) {
                            log.error(`Processing Quotes for appId ${appId}  error:` + err + __location);
                            reject(err);
                            return;
                        });
                        //save take place in processQuotes.  return from here.
                        resolve(true);
                        return;
                    }
                    else {
                        log.error(`AF Bindrequest no quotes appId ${this.applicationDoc.applicationId} ` + __location);
                        resolve(true);
                        return;
                    }
                default:
                    // not from old Web application application flow.
                    reject(new Error(`Unknown Application for appId ${appId} Workflow Step`))
                    return;
            }
            if (updateBusiness === true) {
                if (applicationJSON.businessInfo) {
                    await this.processMongooseBusiness(applicationJSON.businessInfo);
                    delete applicationJSON.businessInfo
                }
            }
            //switch to applicationDoc
            if (!this.applicationDoc || this.applicationDoc && !this.applicationDoc.lastStep) {
                applicationJSON.lastStep = stepNumber;
            }
            else if (stepNumber > this.applicationDoc.lastStep) {
                applicationJSON.lastStep = stepNumber;
            }


            //save
            // mongoose model save.
            this.mapToMongooseJSON(applicationJSON)
            if (this.#applicationMongooseDB) {
                //update
                await this.updateMongo(this.#applicationMongooseDB.applicationId, this.#applicationMongooseJSON)
            }
            else {
                //insert
                await this.insertMongo(this.#applicationMongooseJSON)
            }


            // Re-calculate our quote premium metrics whenever we bind.
            // if (workflowStep === 'bindRequest') {
            //     await this.recalculateQuoteMetrics(applicationJSON.uuid);
            // }

            resolve(true);


        });
    }

    mapToMongooseJSON(sourceJSON) {
        const propMappings = {
            agency_location: "agencyLocationId",
            agency_network: "agencyNetworkId",
            agency: "agencyId",
            name: "businessName",
            "id": "mysqlId",
            "state": "processStateOld",
            "coverage_lapse": "coverageLapseWC",
            coverage_lapse_non_payment: "coverageLapseNonPayment",
            "primary_territory": "primaryState"
        }

        for (const sourceProp in sourceJSON) {
            if (typeof sourceJSON[sourceProp] !== "object") {
                if (propMappings[sourceProp]) {
                    const appProp = propMappings[sourceProp]
                    this.#applicationMongooseJSON[appProp] = sourceJSON[sourceProp];
                }
                else {
                    //check if snake_case
                    // eslint-disable-next-line no-lonely-if
                    if (sourceProp.isSnakeCase()) {
                        this.#applicationMongooseJSON[sourceProp.toCamelCase()] = sourceJSON[sourceProp];
                    }
                    else {
                        this.#applicationMongooseJSON[sourceProp] = sourceJSON[sourceProp];
                    }
                }

            }
        }
    }


    async processMongooseBusiness(businessInfo) {
        //Process Mongoose Model
        //this.#applicationMongooseJSON
        // BusinessInfo to mongoose model
        const businessInfoMapping = {
            entity_type: "entityType",
            "mailing_state_abbr": "mailingState"
        }
        //owners if present needs to be removed.
        if (businessInfo.owners) {
            delete businessInfo.owners;
        }

        for (const businessProp in businessInfo) {
            if (typeof businessInfo[businessProp] !== "object") {
                if (businessInfoMapping[businessProp]) {
                    const appProp = businessInfoMapping[businessProp]
                    this.#applicationMongooseJSON[appProp] = businessInfo[businessProp];
                }
                else if (businessProp.isSnakeCase()) {
                    this.#applicationMongooseJSON[businessProp.toCamelCase()] = businessInfo[businessProp];
                }
                else {
                    this.#applicationMongooseJSON[businessProp] = businessInfo[businessProp];
                }
            }
        }

        if (businessInfo.contacts) {
            //setup mongoose contanct
            this.#applicationMongooseJSON.contacts = [];

            for (var i = 0; i < businessInfo.contacts.length; i++) {
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
        if (this.#applicationMongooseDB) {
            //save....
            this.updateMongo(this.#applicationMongooseDB.applicationId, this.#applicationMongooseJSON)
        }

        return;
    }


    /**
    * update business object
    *
    * @param {object} claims - claims JSON
    * @returns {Promise.<JSON, Error>} A promise that returns true/false , or an Error if rejected
    */
    processClaimsWF(claims) {
        return new Promise(async(resolve) => {
            //copy to mongoose json
            //clonedeep
            this.#applicationMongooseJSON.claims = clonedeep(claims);
            for (let i = 0; i < this.#applicationMongooseJSON.claims.length; i++) {
                const claim = this.#applicationMongooseJSON.claims[i];
                for (const prop in claim) {
                    //check if snake_case
                    if (prop.isSnakeCase()) {
                        claim[prop.toCamelCase()] = claim[prop];
                        delete claim[prop];
                    }
                }
            }
            resolve(true);

        });
    }

    processPolicyTypes(policyTypeArray, applicationJSON) {

        return new Promise(async(resolve) => {

            //this.#applicationMongooseJSON.policies = clonedeep(policyTypeArray);

            const policyList = [];
            for (let i = 0; i < policyTypeArray.length; i++) {
                const policyType = policyTypeArray[i];
                const policyTypeJSON = {"policyType": policyType}

                if (policyType === "GL") {
                    //GL limit and date fields.
                    policyTypeJSON.effectiveDate = applicationJSON.gl_effective_date
                    policyTypeJSON.expirationDate = applicationJSON.gl_expiration_date
                    policyTypeJSON.limits = applicationJSON.limits
                    policyTypeJSON.deductible = applicationJSON.deductible
                    policyTypeJSON.addTerrorismCoverage = applicationJSON.add_terrorism_coverage
                }
                else if (policyType === "WC") {
                    policyTypeJSON.effectiveDate = applicationJSON.wc_effective_date
                    policyTypeJSON.expirationDate = applicationJSON.wc_expiration_date
                    policyTypeJSON.limits = applicationJSON.wc_limits
                    if(applicationJSON.coverageLapse || applicationJSON.coverageLapse === false){
                        policyTypeJSON.coverageLapse = applicationJSON.coverageLapse
                    }
                    if(applicationJSON.coverage_lapse_non_payment || applicationJSON.coverage_lapse_non_payment === false){
                        policyTypeJSON.coverageLapseNonPayment = applicationJSON.coverage_lapse_non_payment
                    }
                }
                else if (policyType === "BOP") {
                    policyTypeJSON.effectiveDate = applicationJSON.bop_effective_date
                    policyTypeJSON.expirationDate = applicationJSON.bop_expiration_date
                    policyTypeJSON.limits = applicationJSON.limits
                    policyTypeJSON.coverage = applicationJSON.coverage
                    policyTypeJSON.deductible = applicationJSON.deductible
                    policyTypeJSON.addTerrorismCoverage = applicationJSON.add_terrorism_coverage
                }
                policyList.push(policyTypeJSON);
            }
            this.#applicationMongooseJSON.policies = policyList
            resolve(true);

        });

    }
    async processLocationsMongo(locations) {
        this.#applicationMongooseJSON.locations = locations
        const businessInfoMapping = {"state_abbr": "state"};
        // Note: square_footage full_time_employees part_time_employees are part of the model.
        for (let i = 0; i < this.#applicationMongooseJSON.locations.length; i++) {
            const location = this.#applicationMongooseJSON.locations[i];
            for (const locationProp in location) {
                //not in map check....
                if (businessInfoMapping[locationProp]) {
                    location[businessInfoMapping[locationProp]] = location[locationProp];
                }
                else {
                    if (locationProp.isSnakeCase()) {
                        location[locationProp.toCamelCase()] = location[locationProp];
                    }
                    //some condition where client sends null;
                    if (!location.billing || location.billing === false || location.billing === 0) {
                        location.billing = false;
                    }
                }
            }
            location.activityPayrollList = [];

            if (location.activity_codes && location.activity_codes.length > 0) {
                for (const activity_code of location.activity_codes) {
                    // Convert props in the employee list to camel case
                    if (activity_code.employeeTypeList) {
                        for (const employeeType of activity_code.employeeTypeList) {
                            for (const employeeProp in employeeType) {
                                if (employeeProp.isSnakeCase()) {
                                    employeeType[employeeProp.toCamelCase()] = employeeType[employeeProp];
                                }
                            }
                        }
                    }
                    const activityPayrollJSON = {};
                    activityPayrollJSON.ncciCode = activity_code.id;
                    activityPayrollJSON.activityCodeId = activity_code.id;
                    activityPayrollJSON.payroll = activity_code.payroll;
                    activityPayrollJSON.employeeTypeList = activity_code.employeeTypeList;
                    location.activityPayrollList.push(activityPayrollJSON)
                }
            }
            // Process location questions if they exist
            if (location.questions && location.questions.length > 0) {
                // Replace the location questions with the processed ones
                location.questions = await this.processQuestionsMongo(location.questions).catch((err) => {
                    log.error(`Adding Location Questions to appId ${this.applicationDoc.applicationId}  error:` + err + __location);
                });
            }
        }

    }


    processOwnersMongo(applicationJSON) {
        if (applicationJSON.owners_covered) {
            try {
                const tempInt = parseInt(applicationJSON.owners_covered, 10);
                this.#applicationMongooseJSON.ownersCovered = tempInt === 1;
                if (this.#applicationMongooseJSON.ownersCovered > 0 && applicationJSON.owner_payroll) {

                    if (this.#applicationMongooseDB && this.#applicationMongooseDB.locations) {
                        //Find primary location and update payroll - ownerPayroll field.
                        for (let i = 0; i < this.#applicationMongooseDB.locations.length; i++) {
                            const location = this.#applicationMongooseDB.locations[i];
                            if (!location.activityPayrollList) {
                                location.activityPayrollList = [];
                            }
                            // eslint-disable-next-line no-shadow
                            const activityPayroll = location.activityPayrollList.find(activityPayroll => activityPayroll.ncciCode === applicationJSON.owner_payroll.activity_code);
                            if (activityPayroll) {
                                activityPayroll.ownerPayRoll = applicationJSON.owner_payroll.payroll
                            }
                            else {
                                const activityPayrollJSON = {
                                    activityCodeId: applicationJSON.owner_payroll.activity_code,
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
            catch (err) {
                log.error(`Error Parsing appID: ${applicationJSON.id} applicationJSON.owners_covered ${applicationJSON.owners_covered}: ` + err + __location)
            }
        }

        if (applicationJSON.businessInfo && applicationJSON.businessInfo.num_owners) {
            try {
                this.#applicationMongooseJSON.numOwners = parseInt(applicationJSON.businessInfo.num_owners, 10);
            }
            catch (err) {
                log.error(`Error Parsing appID: ${applicationJSON.id} applicationJSON.owners_covered ${applicationJSON.businessInfo.num_owners}: ` + err + __location)
            }
        }


        if (applicationJSON.businessInfo && applicationJSON.businessInfo.ownersJSON) {
            try {
                if (!this.#applicationMongooseJSON.owners) {
                    this.#applicationMongooseJSON.owners = [];
                }
                for (let i = 0; i < applicationJSON.businessInfo.ownersJSON.length; i++) {
                    const sourceJSON = applicationJSON.businessInfo.ownersJSON[i];
                    const ownerJSON = {};
                    for (const sourceProp in sourceJSON) {
                        if (typeof sourceJSON[sourceProp] !== "object") {
                            //check if snake_case
                            if (sourceProp.isSnakeCase()) {
                                ownerJSON[sourceProp.toCamelCase()] = sourceJSON[sourceProp];
                            }
                            else {
                                ownerJSON[sourceProp] = sourceJSON[sourceProp];
                            }
                            if (sourceProp === "ownership") {
                                try {
                                    ownerJSON[sourceProp] = parseInt(ownerJSON[sourceProp], 10);
                                }
                                catch (err) {
                                    log.error(`unable to convert ownership appId: ${applicationJSON.id} value: ${ownerJSON[sourceProp]} ` + err + __location);
                                }
                            }
                        }
                    }
                    this.#applicationMongooseJSON.owners.push(ownerJSON);
                }
            }
            catch (err) {
                log.error(`Error Parsing  owner for appID: ${applicationJSON.id} applicationJSON.owners_covered ${JSON.stringify(applicationJSON.owners)}: ` + err + __location)
            }
        }
    }

    processQuestionsMongo(questionsRequest) {

        return new Promise(async(resolve) => {
            ///delete existing ?? old system did not.

            const QuestionTypeSvc = global.requireShared('./services/questiontypesvc.js');
            // Load the request data into it
            const questionTypeList = QuestionTypeSvc.getList()

            const processedQuestionList = []
            //get text and turn into list of question objects.

            for (var i = 0; i < questionsRequest.length; i++) {
                const questionRequest = questionsRequest[i];
                const questionJSON = {};
                questionJSON.questionId = questionRequest.id
                questionJSON.questionType = questionRequest.type;

                //get Question def for Question Text and Yes
                const questionBO = new QuestionBO();
                // Load the request data into it
                const questionDB = await questionBO.getById(questionJSON.questionId).catch(function(err) {
                    log.error("questionBO load error " + err + __location);
                });
                if (questionDB) {
                    questionJSON.questionText = questionDB.text;
                    questionJSON.hint = questionDB.hint;
                    questionJSON.hidden = questionDB.hidden;
                    questionJSON.questionType = questionDB.typeId;
                    if (questionTypeList) {
                        const questionType = questionTypeList.find(questionTypeTest => questionTypeTest.id === questionDB.typeId);
                        if (questionType) {
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
                    questionJSON.answerList = [];
                    questionRequest.answer.forEach((requestAnswer) => {
                        const answerValue = questionDB.answers.find(dbAnswer => dbAnswer.answerId = requestAnswer)
                        if(answerValue){
                            questionJSON.answerList.push(answerValue.answer);
                        }

                    });
                }
                else {
                    questionJSON.answerId = questionRequest.answer;
                    const answerValue = questionDB.answers.find(dbAnswer => dbAnswer.answerId = questionJSON.answerId)
                    if(answerValue){
                        questionJSON.answerValue = answerValue.answer;
                    }
                }
                processedQuestionList.push(questionJSON);
            }
            resolve(processedQuestionList);

        });

    }

    processLegalAcceptance(applicationJSON) {

        return new Promise(async(resolve) => {
            //delete existing ?? old system did not.

            //agreement version
            const version = 3;
            const legalAcceptanceJSON = {
                'ip': applicationJSON.remoteAddress,
                'version': version
            }
            this.#applicationMongooseJSON.legalAcceptance = legalAcceptanceJSON;

            resolve(true);

        });

    }


    /**
    * porcess Request to Bind
    *
    * @param {object} applicationId - claims JSON
    * @param {object} quoteJSON - claims JSON
    * @returns {boolean} true if processed
    */
    async processRequestToBind(applicationId, quoteJSON){
        if(!applicationId || !quoteJSON){
            log.error("processRequestToBind missing inputs" + __location)
            return;
        }
        const quote = quoteJSON;
        //log.debug("quote: " + JSON.stringify(quote) + __location)
        log.debug("Sending Bind Agency email for AppId " + applicationId + " quote " + quote.quoteId + __location);
        log.debug(`processRequestToBind quoteJSON ${JSON.stringify(quoteJSON)} ` + __location);

        let noCustomerEmail = false;
        if(quoteJSON.noCustomerEmail){
            noCustomerEmail = true;
        }

        //Load application
        let applicationMongoDoc = null;
        try{
            applicationMongoDoc = await this.loadDocfromMongoByAppId(applicationId)
        }
        catch(err){
            log.error(`Application processRequestToBind error ${err}` + __location);
        }

        if(applicationMongoDoc){
            //no need to await.
            taskEmailBindAgency.emailbindagency(applicationMongoDoc.applicationId, quote.quoteId, noCustomerEmail);

            //load quote from database.
            const quoteModel = new QuoteBO();
            //update quote record.
            const quoteDBJSON = await quoteModel.getById(quote.quoteId).catch(function(err) {
                log.error(`Loading quote for status and payment plan update quote ${quote.quoteId} error:` + err + __location);
                //reject(err);
                return;
            });
            const status = quoteStatus.bind_requested;
            const quoteUpdate = {
                "status": "bind_requested",
                "paymentPlanId": quote.paymentPlanId,
                "insurerPaymentPlanId": quote.insurerPaymentPlanId,
                "quoteStatusId": status.id,
                "quoteStatusDescription": status.description
            }
            await quoteModel.updateMongo(quoteDBJSON.quoteId, quoteUpdate).catch(function(err) {
                log.error(`Updating  quote with status and payment plan quote ${quote.quoteId} error:` + err + __location);
                // reject(err);
                //return;

            });
            // note: recalculating metric is call in saveApplicationStep
            try{
                // This is just used to send slack message.
                const quoteBind = new QuoteBind();
                await quoteBind.load(quoteDBJSON.quoteId, quote.paymentPlanId, null, quote.insurerPaymentPlanId);
                //isolate to not prevent Digalent bind request to update submission.
                try{
                    await quoteBind.send_slack_notification("requested");
                }
                catch(err){
                    log.error(`appid ${this.id} quote ${quote.quoteId}  had Slack Bind Request error ${err}` + __location);
                }

                //AF special processing of Bind to Send DBA and additionalInsurered
                let afInsurerList = [12,15];
                if(applicationMongoDoc.agencyNetworkId === 2 && afInsurerList.indexOf(quoteDBJSON.insurerId) > -1){
                    log.debug("Process Digalent request to bind POST AppId " + applicationId + " quote " + quote.quoteId + __location);
                    //need to check policy effective inside of the bind
                    // NOT a true bind, just a submission update.
                    try{
                        await quoteBind.bindPolicy();
                    }
                    catch(err){
                        log.error(`appid ${this.id} Bind Request Digalent bindPolicy error ${err}` + __location);
                    }
                }
                else {
                    log.debug(`applicationMongoDoc.agencyNetworkId ${applicationMongoDoc.agencyNetworkId}` + __location)
                    log.debug(`quoteDBJSON.insurerId ${quoteDBJSON.insurerId}` + __location)
                }
            }
            catch(err){
                log.error(`appid ${this.id} Bind Request error ${err}` + __location);
            }

            let updateAppJSON = {};
            //updateAppJSON.processStateOld = quote.api_result === 'referred_with_price' ? 12 : 16;
            if (applicationMongoDoc.appStatusId < 80) {
                updateAppJSON.status = 'request_to_bind_referred';
                updateAppJSON.appStatusId = 80;
            }
            else if (applicationMongoDoc.appStatusId < 70) {
                updateAppJSON.status = 'request_to_bind';
                updateAppJSON.appStatusId = 70;
            }
            await this.updateMongo(applicationId, updateAppJSON);

            //updatemetrics
            await this.recalculateQuoteMetrics(applicationId);

            return true;
        }
        else {
            return false;
        }


    }

    processQuotes(applicationJSON) {

        return new Promise(async(resolve) => {
            if (applicationJSON.quotes) {
                for (var i = 0; i < applicationJSON.quotes.length; i++) {
                    let quote = applicationJSON.quotes[i];
                    if(!quote.quoteId){
                        quote.quoteId = quote.quote;
                    }
                    if(!quote.paymentPlanId){
                        quote.paymentPlanId = quote.payment;
                    }
                    try{
                        await this.processRequestToBind(this.#applicationMongooseDB.applicationId,quote)
                    }
                    catch(err){
                        log.error(`ApplicationBO processQuotes appid ${this.#applicationMongooseDB.applicationId} error ${err} ` + __location)
                    }
                }
            }
            else {
                log.error("in AppBO Process quote, but no quotes included in JSON " + JSON.stringify(applicationJSON) + __location)
            }
            resolve(true);

        });

    }

    async updateStatus(id, appStatusDesc, appStatusid) {

        if (id) {
            //mongo update.....
            try {
                const updateStatusJson = {
                    status: appStatusDesc,
                    "appStatusId": appStatusid
                }

                updateStatusJson.updatedAt = new Date();
                let query = {};
                if(validator.isUuid(id)){
                    query = {"applicationId": id};
                }
                else {
                    query = {"mysqlId": id};
                }
                await ApplicationMongooseModel.updateOne(query, updateStatusJson);
                if(global.settings.USE_REDIS_APP_LIST_CACHE === "YES"){
                    await this.updateRedisForAppUpdatebyAppId(id);
                }
            }
            catch (error) {
                log.error(`Could not update application status mongo appId: ${id}  ${error} ${__location}`);
            }
            return true;
        }
        else {
            log.error(`updateStatus missing id ` + __location);
        }
    }

    async updateProgress(id, progress) {

        try {
            const updateStatusJson = {progress: progress}
            updateStatusJson.updatedAt = new Date();
            let query = {};
            if(validator.isUuid(id)){
                query = {"applicationId": id};
            }
            else {
                query = {"mysqlId": id};
            }
            await ApplicationMongooseModel.updateOne(query, updateStatusJson);
            if(global.settings.USE_REDIS_APP_LIST_CACHE === "YES"){
                await this.updateRedisForAppUpdatebyAppId(id);
            }
        }
        catch (error) {
            log.error(`Could not update application progress mongo appId: ${id}  ${error} ${__location}`);
        }
        return true;
    }

    async getProgress(id) {
        let appDoc = null;
        try {
            appDoc = await this.getById(id)
        }
        catch (error) {
            log.error(`Could not get the quoting progress for application ${id}: ${error} ${__location}`);
        }
        if (appDoc) {
            return appDoc.progress;
        }
        else {
            log.error(`Could not get the quote progress for application ${id}: ${__location}`);
            return "unknown";
        }
    }

    async checkExpiration(newObjectJSON){
        if(newObjectJSON.policies && newObjectJSON.policies.length > 0){
            for(let policy of newObjectJSON.policies){
                log.debug("policy " + JSON.stringify(policy))
                if(policy.effectiveDate && !policy.expirationDate){
                    try{
                        const startDateMomemt = moment(policy.effectiveDate);
                        policy.expirationDate = startDateMomemt.clone().add(1,"y");
                        log.debug("updated expirationDate")
                    }
                    catch(err){
                        log.error(`Error process policy dates ${err} policy: ${JSON.stringify(policy)}` + __location)
                    }
                }
            }
        }
        return true;

    }
    //Note this working on the newObjectJSON.
    // which might not be the full ApplicationDoc.
    async checkLocations(newObjectJSON){
        if(newObjectJSON.locations && newObjectJSON.locations.length > 0){
            let hasBillingLocation = false;
            let hasPrimaryLocation = false;
            for(let location of newObjectJSON.locations){
                if(hasBillingLocation === true && location.billing === true){
                    log.warn(`Application will multiple billing received AppId ${newObjectJSON.applicationId} fixing location ${JSON.stringify(location)} to billing = false` + __location)
                    location.billing = false;
                }
                else if(location.billing === true){
                    hasBillingLocation = true;
                }
                if(location.primary === true && hasPrimaryLocation === false){
                    hasPrimaryLocation = true;
                    newObjectJSON.primaryState = location.state
                }
                else {
                    location.primary = false;
                }
            }
        }
        return true;
    }

    async updateMongo(uuid, newObjectJSON) {
        if (uuid) {
            if (typeof newObjectJSON === "object") {

                const query = {"applicationId": uuid};
                let newApplicationJSON = null;
                try {
                    //because Virtual Sets.  new need to get the model and save.
                    await this.checkExpiration(newObjectJSON);
                    await this.setupDocEinEncrypt(newObjectJSON);
                    await this.checkLocations(newObjectJSON);
                    //virtuals' set are not processed in the updateOne call.
                    this.processVirtualsSave(newObjectJSON);

                    if(newObjectJSON.ein){
                        delete newObjectJSON.ein
                    }
                    const changeNotUpdateList = ["active",
                        "id",
                        "mysqlId",
                        "applicationId",
                        "uuid"]
                    for (let i = 0; i < changeNotUpdateList.length; i++) {
                        if (newObjectJSON[changeNotUpdateList[i]]) {
                            delete newObjectJSON[changeNotUpdateList[i]];
                        }
                    }
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();

                    await ApplicationMongooseModel.updateOne(query, newObjectJSON);
                    log.debug("Mongo Application updated " + JSON.stringify(query) + __location)
                    log.debug("updated to " + JSON.stringify(newObjectJSON) + __location);
                    const newApplicationdoc = await ApplicationMongooseModel.findOne(query);
                    this.#applicationMongooseDB = newApplicationdoc
                    if(global.settings.USE_REDIS_APP_LIST_CACHE === "YES"){
                        await this.updateRedisForAppUpdate(newApplicationdoc)
                    }


                    newApplicationJSON = mongoUtils.objCleanup(newApplicationdoc);
                }
                catch (err) {
                    log.error(`Updating Application error appId: ${uuid}` + err + __location);
                    throw err;
                }
                //


                return newApplicationJSON;
            }
            else {
                throw new Error(`no newObjectJSON supplied appId: ${uuid}`)
            }

        }
        else {
            throw new Error('no id supplied')
        }
        // return true;

    }

    async insertMongo(newObjectJSON) {
        if (!newObjectJSON) {
            throw new Error("no data supplied");
        }
        //force mongo/mongoose insert
        if(newObjectJSON._id) {
            delete newObjectJSON._id
        }
        if(newObjectJSON.id) {
            delete newObjectJSON.id
        }


        //covers quote app WF where mysql saves first.
        if (!newObjectJSON.applicationId && newObjectJSON.uuid) {
            newObjectJSON.applicationId = newObjectJSON.uuid;
        }

        await this.checkExpiration(newObjectJSON);
        await this.setupDocEinEncrypt(newObjectJSON);
        await this.checkLocations(newObjectJSON);

        if(newObjectJSON.ein){
            delete newObjectJSON.ein
        }

        if(newObjectJSON.mysqlId){
            delete newObjectJSON.mysqlId
        }

        const application = new ApplicationMongooseModel(newObjectJSON);
        //log.debug("insert application: " + JSON.stringify(application))
        //Insert a doc
        await application.save().catch(function(err) {
            log.error('Mongo Application Save err ' + err + __location);
            throw err;
        });
        log.debug("Mongo Application inserted " + application.applicationId + __location)
        //add calculated fields EIN
        await this.setDocEinClear(application);
        if (application && application.appStatusId === QUOTING_STATUS) {
            await this.checkAndFixAppStatus(application);
        }
        this.#applicationMongooseDB = application;
        if(global.settings.USE_REDIS_APP_LIST_CACHE === "YES"){
            await this.updateRedisForAppUpdate(application)
            await this.updateRedisForAppAddDelete(application.applicationId, application, 1);
        }

        return mongoUtils.objCleanup(application);
    }

    //only top level
    jsonToSnakeCase(sourceJSON,propMappings) {
        for (const sourceProp in sourceJSON) {
            if (typeof sourceJSON[sourceProp] !== "object") {
                if (propMappings[sourceProp]) {
                    const appProp = propMappings[sourceProp]
                    sourceJSON[appProp] = sourceJSON[sourceProp];
                }
                else {
                    sourceJSON[sourceProp.toSnakeCase()] = sourceJSON[sourceProp];
                }
            }
        }

    }

    // checks the status of the app and fixes it if its timed out
    async checkAndFixAppStatus(applicationDoc){
        // only check and fix quoting apps
        if(applicationDoc && applicationDoc.appStatusId === QUOTING_STATUS){
            try{
                const now = moment.utc();
                // if the quotingStartedDate doesnt exist, just set it and return
                if(!applicationDoc.quotingStartedDate){
                    applicationDoc.quotingStartedDate = now;
                    log.error(`Application: ${applicationDoc.applicationId} setting quotingStartedDate` + __location);
                    await this.updateMongo(applicationDoc.applicationId, {quotingStartedDate: now});
                    return;
                }

                const duration = moment.duration(now.diff(moment(applicationDoc.quotingStartedDate)));
                if(duration.minutes() >= QUOTE_MIN_TIMEOUT){
                    log.error(`Application: ${applicationDoc.applicationId} timed out ${QUOTE_MIN_TIMEOUT} minutes after quoting started` + __location);
                    const applicationStatus = global.requireShared('./models/status/applicationStatus.js');
                    const appStatus = await applicationStatus.updateApplicationStatus(applicationDoc, true);
                    // eslint-disable-next-line object-curly-newline
                    //await this.updateMongo(applicationDoc.applicationId, {appStatusId: 20, appStatusDesc: 'error', status: 'error', progress: "complete"});
                    if(appStatus && appStatus.appStatusId > -1){
                        applicationDoc.status = appStatus.appStatusDesc;
                        applicationDoc.appStatusId = appStatus.appStatusId;
                    }
                    else {
                        applicationDoc.status = applicationStatus.applicationStatus.error.appStatusDesc;
                        applicationDoc.appStatusId = applicationStatus.applicationStatus.error.appStatusId;
                    }

                }
            }
            catch(err){
                log.error('AppBO checkAndFixAppStatus  ' + err + __location);
            }
        }
        return;
    }

    async setDocEinClear(applicationDoc){
        if(applicationDoc){
            if(applicationDoc.einEncryptedT2 && applicationDoc.einEncryptedT2.length > 0){
                try{
                    applicationDoc.einClear = await crypt.decrypt(applicationDoc.einEncryptedT2);
                    applicationDoc.ein = applicationDoc.einClear;
                }
                catch(err){
                    log.error(`ApplicationBO error decrypting ein ${this.applicationId} ` + err + __location);
                }
            }
            else {
                applicationDoc.ein = "";
                applicationDoc.einClear = "";
            }
        }
    }

    async setupDocEinEncrypt(applicationDoc){
        //Only modified if EIN has been given.
        if(applicationDoc && applicationDoc.ein && applicationDoc.ein.length > 1){
            try{
                applicationDoc.einEncryptedT2 = await crypt.encrypt(applicationDoc.ein);
                applicationDoc.einHash = await crypt.hash(applicationDoc.ein);
            }
            catch(err){
                log.error(`ApplicationBO error encrypting ein ${this.applicationId} ` + err + __location);
            }
            delete applicationDoc.ein;
        }

    }

    processVirtualsSave(sourceJSON){
        const propMappings = {"managementStructure": "management_structure"};
        if(sourceJSON){
            // With next virtual make Virtual to Real map
            for (const mapProp in propMappings) {
                if (sourceJSON[mapProp] !== null && typeof sourceJSON[mapProp] !== 'undefined' && typeof sourceJSON[mapProp] !== "object") {
                    sourceJSON[propMappings[mapProp]] = sourceJSON[mapProp];
                    delete sourceJSON[mapProp];
                }
            }
        }
    }


    loadById(id) {
        log.debug(`appBO id ${id} ` + __location)
        if(validator.isUuid(id)){
            return this.loadDocfromMongoByAppId(id)
        }
        else {
            // nodoc, force mongo query.
            return this.loadfromMongoBymysqlId(id, false, true);
        }
    }


    loadDocfromMongoByAppId(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id) {
                const query = {
                    "applicationId": id,
                    active: true
                };
                let applicationDoc = null;
                try {
                    applicationDoc = await ApplicationMongooseModel.findOne(query, '-__v');
                    if(applicationDoc){
                        await this.setDocEinClear(applicationDoc);
                        if(applicationDoc.einEncrypted){
                            delete applicationDoc.einEncrypted
                        }
                        if(applicationDoc.einEncryptedT2){
                            delete applicationDoc.einEncryptedT2
                        }
                        if(applicationDoc.einHash){
                            delete applicationDoc.einHash
                        }
                        if (applicationDoc && applicationDoc.appStatusId === QUOTING_STATUS) {
                            await this.checkAndFixAppStatus(applicationDoc);
                        }
                    }
                }
                catch (err) {
                    log.error(`Getting Application ${id} error ` + err + __location);
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
            if (id && id > 0) {
                const query = {
                    "mysqlId": id,
                    active: true
                };
                let applicationDoc = null;
                try {
                    applicationDoc = await ApplicationMongooseModel.findOne(query, '-__v');
                    await this.setDocEinClear(applicationDoc);
                    if(applicationDoc.einEncrypted){
                        delete applicationDoc.einEncrypted
                    }
                    if(applicationDoc.einEncryptedT2){
                        delete applicationDoc.einEncryptedT2
                    }
                    if(applicationDoc.einHash){
                        delete applicationDoc.einHash
                    }
                    if (applicationDoc && applicationDoc.appStatusId === QUOTING_STATUS) {
                        await this.checkAndFixAppStatus(applicationDoc);
                    }
                }
                catch (err) {
                    log.error(`Getting Application ${id} error ` + err + __location);
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
            if (id) {
                const query = {
                    "applicationId": id,
                    active: true
                };
                let applicationDoc = null;
                try {
                    const docDB = await ApplicationMongooseModel.findOne(query, '-__v')
                    if (docDB) {
                        await this.setDocEinClear(docDB);
                        if (applicationDoc && applicationDoc.appStatusId === QUOTING_STATUS) {
                            await this.checkAndFixAppStatus(applicationDoc);
                        }
                        applicationDoc = mongoUtils.objCleanup(docDB);
                        if(applicationDoc.einEncrypted){
                            delete applicationDoc.einEncrypted
                        }
                        if(applicationDoc.einEncryptedT2){
                            delete applicationDoc.einEncryptedT2
                        }
                        if(applicationDoc.einHash){
                            delete applicationDoc.einHash
                        }
                    }
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                resolve(applicationDoc);
            }
            else {
                log.error("getfromMongoByAppId no id supplied");
                reject(new Error('no id supplied'))
            }
        });
    }

    getList(requestQueryJSON, getOptions = null) {
        return new Promise(async(resolve, reject) => {
            //
            if(!requestQueryJSON){
                requestQueryJSON = {};
            }
            let queryJSON = JSON.parse(JSON.stringify(requestQueryJSON));

            let getListOptions = {
                getQuestions: false,
                getAgencyName: false,
                getEin: false
            }

            if(getOptions){
                for(const prop in getOptions){
                    getListOptions[prop] = getOptions[prop];
                }
            }
            let queryProjection = {"__v": 0}
            if(getListOptions.getQuestions === false){
                queryProjection.questions = 0;
            }
            let findCount = false;

            let rejected = false;
            let query = {active: true};
            let error = null;

            var queryOptions = {};
            queryOptions.sort = {};
            if (queryJSON.sort) {
                var acs = 1;
                if (queryJSON.desc) {
                    acs = -1;
                    delete queryJSON.desc
                }
                queryOptions.sort[queryJSON.sort] = acs;
                delete queryJSON.sort
            }
            else {
                // default to DESC on sent
                queryOptions.sort.createdAt = -1;

            }
            const queryLimit = 500;
            if (queryJSON.limit) {
                var limitNum = parseInt(queryJSON.limit, 10);
                delete queryJSON.limit
                if (limitNum < queryLimit) {
                    queryOptions.limit = limitNum;
                }
                else {
                    queryOptions.limit = queryLimit;
                }
            }
            else {
                queryOptions.limit = queryLimit;
            }
            if(queryJSON.page){
                const page = queryJSON.page ? stringFunctions.santizeNumber(queryJSON.page, true) : 1;
                // offset by page number * max rows, so we go that many rows
                queryOptions.skip = (page - 1) * queryOptions.limit;
                delete queryJSON.page;
            }

            if (queryJSON.count) {
                if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
                    findCount = true;
                }
                delete queryJSON.count;
            }
            if (queryJSON.ltAppStatusId && queryJSON.gtAppStatusId) {
                query.appStatusId = {
                    $lt: parseInt(queryJSON.ltAppStatusId, 10),
                    $gt: parseInt(queryJSON.gtAppStatusId, 10)
                };
                delete queryJSON.ltAppStatusId;
                delete queryJSON.gtAppStatusId;
            }
            else if (queryJSON.ltAppStatusId) {
                query.appStatusId = {$lt: parseInt(queryJSON.ltAppStatusId, 10)};
                delete queryJSON.ltAppStatusId;
            }
            else if (queryJSON.gtAppStatusId) {
                query.appStatusId = {$gt: parseInt(queryJSON.gtAppStatusId, 10)};
                delete queryJSON.gtAppStatusId;
            }

            if (queryJSON.searchbegindate && queryJSON.searchenddate) {
                let fromDate = moment(queryJSON.searchbegindate);
                let toDate = moment(queryJSON.searchenddate);
                if (fromDate.isValid() && toDate.isValid()) {
                    query.createdAt = {
                        $lte: toDate,
                        $gte: fromDate
                    };
                    delete queryJSON.searchbegindate;
                    delete queryJSON.searchenddate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }
            else if (queryJSON.searchbegindate) {
                // eslint-disable-next-line no-redeclare
                let fromDate = moment(queryJSON.searchbegindate);
                if (fromDate.isValid()) {
                    query.createdAt = {$gte: fromDate};
                    delete queryJSON.searchbegindate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }
            else if (queryJSON.searchenddate) {
                // eslint-disable-next-line no-redeclare
                let toDate = moment(queryJSON.searchenddate);
                if (toDate.isValid()) {
                    query.createdAt = {$lte: toDate};
                    delete queryJSON.searchenddate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }

            if(queryJSON.agencyId && Array.isArray(queryJSON.agencyId)){
                query.agencyId = {$in: queryJSON.agencyId};
                delete queryJSON.agencyId;
            }
            else if(queryJSON.agencyId){
                query.agencyId = queryJSON.agencyId;
                delete queryJSON.agencyId;
            }

            if (queryJSON) {
                for (var key in queryJSON) {
                    if (typeof queryJSON[key] === 'string' && queryJSON[key].includes('%')) {
                        let clearString = queryJSON[key].replace("%", "");
                        clearString = clearString.replace("%", "");
                        query[key] = {
                            "$regex": clearString,
                            "$options": "i"
                        };
                    }
                    else {
                        query[key] = queryJSON[key];
                    }
                }
            }


            if (findCount === false) {
                let docList = null;
                try {
                    //log.debug("ApplicationList query " + JSON.stringify(query))
                    // log.debug("ApplicationList options " + JSON.stringify(queryOptions))
                    // log.debug("queryProjection: " + JSON.stringify(queryProjection))
                    docList = await ApplicationMongooseModel.find(query, queryProjection, queryOptions);
                    // log.debug("docList.length: " + docList.length);
                    // log.debug("docList: " + JSON.stringify(docList));
                    for (const application of docList) {
                        if(getListOptions.getEin){
                            await this.setDocEinClear(application);
                        }
                        if(application.einEncrypted){
                            delete application.einEncrypted
                        }
                        if(application.einEncryptedT2){
                            delete application.einEncryptedT2
                        }
                        if(application.einHash){
                            delete application.einHash
                        }
                        if (application && application.appStatusId === QUOTING_STATUS) {
                            await this.checkAndFixAppStatus(application);
                        }
                    }
                    if(getListOptions.getAgencyName === true && docList.length > 0){
                        //loop doclist adding agencyName

                    }
                }
                catch (err) {
                    log.error(`AppBO GetList ${JSON.stringify(query)} ` + err + __location);
                    error = null;
                    rejected = true;
                }
                if(rejected){
                    reject(error);
                    return;
                }

                resolve(mongoUtils.objListCleanup(docList));
                return;
            }
            else {
                const docCount = await ApplicationMongooseModel.countDocuments(query).catch(err => {
                    log.error(`Application.countDocuments ${JSON.stringify(query)} error ` + err + __location);
                    error = null;
                    rejected = true;
                })
                if(rejected){
                    reject(error);
                    return;
                }
                resolve({count: docCount});
                return;
            }
        });
    }

    async updateRedisForAppUpdatebyAppId(appId){
        if(global.settings.USE_REDIS_APP_LIST_CACHE === "YES"){
            const query = {"applicationId": appId};
            const newApplicationdoc = await ApplicationMongooseModel.findOne(query);
            await this.updateRedisForAppUpdate(newApplicationdoc)
        }
        return;
    }
    async updateRedisForAppUpdate(applicationJSON){

        //Delete keys get next AP Applist request refresh it.
        if(applicationJSON && typeof applicationJSON === 'object' && global.settings.USE_REDIS_APP_LIST_CACHE === "YES"){
            let redisKey = REDIS_AGENCYNETWORK_APPLIST_PREFIX + applicationJSON.agencyNetworkId;
            try{
                const redisResponse = await global.redisSvc.deleteKey(redisKey)
                if(redisResponse){
                    log.debug(`REDIS: Removed ${redisKey} in Redis ` + __location);
                }
            }
            catch(err){
                log.error(`Error removing ${redisKey} to Redis cache ` + err + __location);
            }
            redisKey = REDIS_AGENCY_APPLIST_PREFIX + applicationJSON.agencyId;
            try{
                const redisResponse = await global.redisSvc.deleteKey(redisKey)
                if(redisResponse){
                    log.debug(`REDIS: Removed ${redisKey} in Redis ` + __location);
                }
            }
            catch(err){
                log.error(`REDIS: Error removing ${redisKey} to Redis cache ` + err + __location);
            }
            return true;

        }
        else {
            log.warn(`REDIS: updateRedisCache bad applicationJSON ${typeof applicationJSON} ` + __location);
        }
        return false;
    }

    async updateRedisForAppAddDelete(appId,applicationJSON, countChange = 1){
        if(!applicationJSON){
            const query = {"applicationId": appId};
            applicationJSON = await ApplicationMongooseModel.findOne(query);
        }
        //Delete keys get next AP Applist request refresh it.
        if(applicationJSON && typeof applicationJSON === 'object' && global.settings.USE_REDIS_APP_LIST_CACHE === "YES"){
            let redisKey = REDIS_AGENCYNETWORK_APPCOUNT_PREFIX + applicationJSON.agencyNetworkId;
            try{
                const resp = await global.redisSvc.getKeyValue(redisKey);
                if(resp.found){
                    try{
                        const parsedJSON = new FastJsonParse(resp.value)
                        if(parsedJSON.err){
                            throw parsedJSON.err
                        }
                        let appCount = parseInt(parsedJSON.value,10);
                        appCount += countChange
                        let ttlSeconds = 86400; //1 display
                        if(appCount > 1000){
                            //make permanent key.
                            ttlSeconds = null;
                        }
                        const redisResponse = await global.redisSvc.storeKeyValue(redisKey, appCount,ttlSeconds)
                        if(redisResponse && redisResponse.saved){
                            log.debug(`REDIS: saved ${redisKey} to Redis ` + __location);
                        }
                    }
                    catch(err){
                        log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
                    }
                }
            }
            catch(err){
                log.error(`Error removing ${redisKey} to Redis cache ` + err + __location);
            }
            redisKey = REDIS_AGENCY_APPCOUNT_PREFIX + applicationJSON.agencyId;
            try{
                const resp = await global.redisSvc.getKeyValue(redisKey);
                if(resp.found){
                    try{
                        const parsedJSON = new FastJsonParse(resp.value)
                        if(parsedJSON.err){
                            throw parsedJSON.err
                        }
                        let appCount = parseInt(parsedJSON.value,10);
                        appCount += countChange
                        let ttlSeconds = 86400; //1 display
                        if(appCount > 1000){
                            //make permanent key.
                            ttlSeconds = null;
                        }
                        const redisResponse = await global.redisSvc.storeKeyValue(redisKey, appCount,ttlSeconds)
                        if(redisResponse && redisResponse.saved){
                            log.debug(`REDIS: saved ${redisKey} to Redis ` + __location);
                        }
                    }
                    catch(err){
                        log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
                    }
                }
            }
            catch(err){
                log.error(`REDIS: Error removing ${redisKey} to Redis cache ` + err + __location);
            }

            return true;


        }
        else {
            log.warn(`REDIS: updateRedisCache bad applicationJSON ${typeof applicationJSON} ` + __location);
        }
        return false;
    }

    getAppListForAgencyPortalSearch(queryJSON, orParamList, requestParms, applicationsTotalCount = 0, noCacheUse = false, forceRedisUpdate = false){
        return new Promise(async(resolve, reject) => {
            log.debug(`getAppListForAgencyPortalSearch queryJSON ${JSON.stringify(queryJSON)}` + __location)
            let useRedisCache = true;
            let pageSize = 10;
            if(global.settings.USE_REDIS_APP_LIST_CACHE !== "YES"){
                useRedisCache = false;
            }
            if(noCacheUse){
                useRedisCache = false;
            }
            if(!requestParms){
                requestParms = {}
            }

            if(!orParamList){
                orParamList = [];
            }
            let findCount = false;

            let rejected = false;
            let query = {};
            let error = null;

            var queryOptions = {};
            queryOptions.sort = {};
            if(requestParms && requestParms.sort === 'date') {
                requestParms.sort = 'createdAt';
            }
            if (requestParms.sort) {
                let acs = 1;
                if(requestParms.sortDescending === true){
                    acs = -1;
                }
                queryOptions.sort[requestParms.sort] = acs;
            }
            else {
                // default to DESC on sent
                queryOptions.sort.createdAt = -1;
            }
            if(queryOptions.sort.createdAt !== -1){
                useRedisCache = false;
            }
            if(requestParms.format === 'csv'){
                useRedisCache = false;
                //CSV max pull of 10,000 docs
                queryOptions.limit = 10000;
            }
            else {
                const queryLimit = 100;
                if (requestParms.limit) {
                    var limitNum = parseInt(requestParms.limit, 10);
                    if (limitNum < queryLimit) {
                        queryOptions.limit = limitNum;
                        pageSize = limitNum;
                    }
                    else {
                        queryOptions.limit = queryLimit;
                        pageSize = queryLimit;
                    }

                    if(requestParms.page && requestParms.page > 0){
                        useRedisCache = false;
                        const skipCount = limitNum * requestParms.page;
                        queryOptions.skip = skipCount;
                    }
                }
                else {
                    queryOptions.limit = queryLimit;
                }
            }


            if (requestParms.count) {
                if (requestParms.count === "1" || requestParms.count === 1 || requestParms.count === true) {
                    findCount = true;
                }
            }
            if(queryJSON.policies && queryJSON.policies.policyType){
                //query.policies = {};
                useRedisCache = false;
                query["policies.policyType"] = queryJSON.policies.policyType;
                delete queryJSON.policies
            }
            if(queryJSON.applicationId){
                //query.policies = {};
                useRedisCache = false;
                query.applicationId = queryJSON.applicationId;
                delete queryJSON.applicationId
            }


            if (queryJSON) {
                for (var key in queryJSON) {
                    if(key !== 'searchbegindate' && key !== 'searchenddate'){
                        if (typeof queryJSON[key] === 'string' && queryJSON[key].includes('%')) {
                            let clearString = queryJSON[key].replace("%", "");
                            clearString = clearString.replace("%", "");
                            useRedisCache = false;
                            query[key] = {
                                "$regex": clearString,
                                "$options": "i"
                            };
                        }
                        else {
                            query[key] = queryJSON[key];
                        }
                    }
                }
            }

            if(orParamList && orParamList.length > 0){
                for (let i = 0; i < orParamList.length; i++){
                    let orItem = orParamList[i];
                    if(orItem.policies && queryJSON.orItem.policyType){
                        //query.policies = {};
                        useRedisCache = false;
                        orItem["policies.policyType"] = queryJSON.policies.policyType;
                    }
                    else {
                        // eslint-disable-next-line no-redeclare
                        for (var key2 in orItem) {
                            if (typeof orItem[key2] === 'string' && orItem[key2].includes('%')) {
                                useRedisCache = false;
                                let clearString = orItem[key2].replace("%", "");
                                clearString = clearString.replace("%", "");
                                orItem[key2] = {
                                    "$regex": clearString,
                                    "$options": "i"
                                };
                            }
                        }
                    }
                }
                query.$or = orParamList
            }
            //

            if (queryJSON.searchbegindate && queryJSON.searchenddate) {
                const fromDate = moment(queryJSON.searchbegindate);
                const toDate = moment(queryJSON.searchenddate);
                if (fromDate.isValid() && toDate.isValid()) {
                    useRedisCache = false;
                    query.createdAt = {
                        $lte: toDate.clone(),
                        $gte: fromDate.clone()
                    };
                    delete queryJSON.searchbegindate;
                    delete queryJSON.searchenddate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }
            else if (queryJSON.searchbegindate) {
                // eslint-disable-next-line no-redeclare
                let fromDate = moment(queryJSON.searchbegindate);
                if (fromDate.isValid()) {
                    //we only have begin  if it is over a year and page = 1 use the cache
                    // count might be wrong but we do not display the number
                    // hit to any other page will fix the paging setup...
                    let addDateFilter = false;
                    if(forceRedisUpdate){
                        addDateFilter = true
                    }
                    else if(useRedisCache){
                        //useRedisCache at this point means there is not filter, only date range.
                        const now = moment().utc();
                        if(findCount && now.diff(fromDate, 'months') < 16 || requestParms.page > 0 || applicationsTotalCount < pageSize){
                            addDateFilter = true
                        }
                        else if(requestParms.page > 0 || applicationsTotalCount < pageSize){
                            addDateFilter = true
                        }
                    }
                    else {
                        addDateFilter = true
                    }

                    if(addDateFilter){
                        useRedisCache = false;
                        query.createdAt = {$gte: fromDate};
                    }
                    delete queryJSON.searchbegindate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }
            else if (queryJSON.searchenddate) {
                // eslint-disable-next-line no-redeclare
                let toDate = moment(queryJSON.searchenddate);
                if (toDate.isValid()) {
                    useRedisCache = false;
                    query.createdAt = {$lte: toDate};
                    delete queryJSON.searchenddate;
                }
                else {
                    reject(new Error("Date format"));
                    return;
                }
            }

            if (findCount === false) {
                let docList = null;
                let redisKey = null
                try {
                    if(useRedisCache === true){
                        //networkAgency pull?
                        if(query.agencyNetworkId){
                            redisKey = REDIS_AGENCYNETWORK_APPLIST_PREFIX + query.agencyNetworkId
                        }
                        else if(query.agencyId){
                            //Agency Pull?
                            redisKey = REDIS_AGENCY_APPLIST_PREFIX + query.agencyId
                        }

                        if(forceRedisUpdate === false && redisKey){
                            let appList = null;
                            const resp = await global.redisSvc.getKeyValue(redisKey);
                            if(resp.found){
                                log.debug(`REDIS: getAppListForAgencyPortalSearch got rediskey ${redisKey}`)
                                try{
                                    const parsedJSON = new FastJsonParse(resp.value)
                                    if(parsedJSON.err){
                                        throw parsedJSON.err
                                    }
                                    appList = parsedJSON.value;
                                }
                                catch(err){
                                    log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
                                }
                                if(appList){
                                    resolve(appList);
                                    return;
                                }
                            }


                        }
                    }

                    //let queryProjection = {"__v": 0, questions:0};
                    let queryProjection = {
                        uuid: 1,
                        applicationId: 1,
                        mysqlId:1,
                        status: 1,
                        appStatusId:1,
                        agencyId:1,
                        agencyNetworkId:1,
                        createdAt: 1,
                        solepro: 1,
                        wholesale: 1,
                        businessName: 1,
                        industryCode: 1,
                        mailingAddress: 1,
                        mailingCity: 1,
                        mailingState: 1,
                        mailingZipcode: 1,
                        handledByTalage: 1,
                        policies: 1,
                        quotingStartedDate: 1

                    };
                    if(requestParms.format === 'csv'){
                        //get full document
                        queryProjection = {};
                    }
                    log.debug("ApplicationList query " + JSON.stringify(query) + __location)
                    //log.debug("ApplicationList options " + JSON.stringify(queryOptions) + __location)
                    //log.debug("queryProjection: " + JSON.stringify(queryProjection) + __location)
                    docList = await ApplicationMongooseModel.find(query, queryProjection, queryOptions).lean();
                    if(docList.length > 0){
                        //loop doclist adding agencyName
                        const agencyBO = new AgencyBO();
                        let agencyMap = {};
                        for (const application of docList) {
                            application.id = application.applicationId;
                            await this.setDocEinClear(application);
                            if (application && application.appStatusId === QUOTING_STATUS) {
                                await this.checkAndFixAppStatus(application);
                            }
                            delete application._id;

                            // Load the request data into it
                            if(agencyMap[application.agencyId]){
                                application.agencyName = agencyMap[application.agencyId];
                            }
                            else {
                                const returnDoc = false;
                                const returnDeleted = true
                                const agency = await agencyBO.getById(application.agencyId, returnDoc, returnDeleted).catch(function(err) {
                                    log.error(`Agency load error appId ${application.applicationId} ` + err + __location);
                                });
                                if (agency) {
                                    application.agencyName = agency.name;
                                    agencyMap[application.agencyId] = agency.name;

                                }
                            }
                            //industry desc
                            const industryCodeBO = new IndustryCodeBO();
                            // Load the request data into it
                            if(application.industryCode){
                                const industryCodeJson = await industryCodeBO.getById(application.industryCode).catch(function(err) {
                                    log.error(`Industry code load error appId ${application.applicationId} ` + err + __location);
                                });
                                if(industryCodeJson){
                                    application.industry = industryCodeJson.description;
                                }
                            }
                            //bring policyType to property on top level.
                            if(application.policies.length > 0){
                                let policyTypesString = "";
                                application.policies.forEach((policy) => {
                                    if(policyTypesString.length > 0){
                                        policyTypesString += ","
                                    }
                                    policyTypesString += policy.policyType;
                                });
                                application.policyTypes = policyTypesString;
                            }
                        }
                        //update redis
                        if(useRedisCache === true && redisKey){
                            try{
                                const ttlSeconds = 900; //15 minutes
                                const redisResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(docList),ttlSeconds)
                                if(redisResponse && redisResponse.saved){
                                    log.debug(`REDIS: saved ${redisKey} to Redis ` + __location);
                                }
                            }
                            catch(err){
                                log.error(`Error save ${redisKey} to Redis cache ` + err + __location);
                            }
                        }
                    }
                }
                catch (err) {
                    log.error(err + __location);
                    error = null;
                    rejected = true;
                }
                if(rejected){
                    reject(error);
                    return;
                }
                resolve(docList);
                return;
            }
            else {
                let redisKey = null;
                if(useRedisCache === true){
                    //networkAgency pull?
                    if(query.agencyNetworkId){
                        redisKey = REDIS_AGENCYNETWORK_APPCOUNT_PREFIX + query.agencyNetworkId
                    }
                    else if(query.agencyId){
                        //Agency Pull?
                        redisKey = REDIS_AGENCY_APPCOUNT_PREFIX + query.agencyId
                    }

                    if(forceRedisUpdate === false && redisKey){
                        let appCount = null;
                        const resp = await global.redisSvc.getKeyValue(redisKey);
                        if(resp.found){
                            log.debug(`REDIS: getAppListForAgencyPortalSearch Count got rediskey ${redisKey}`)
                            try{
                                const parsedJSON = new FastJsonParse(resp.value)
                                if(parsedJSON.err){
                                    throw parsedJSON.err
                                }
                                appCount = parseInt(parsedJSON.value,10);
                            }
                            catch(err){
                                log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
                            }
                            if(appCount || appCount === 0){
                                resolve({count: appCount});
                                return;
                            }
                        }


                    }
                }
                log.debug(`getAppListForAgencyPortalSearch Count use Mongo `)
                const docCount = await ApplicationMongooseModel.countDocuments(query).catch(err => {
                    log.error("Application.countDocuments error " + err + __location);
                    error = null;
                    rejected = true;
                })
                if(rejected){
                    reject(error);
                    return;
                }
                if(useRedisCache === true && redisKey && docCount){
                    try{
                        const ttlSeconds = 86400; //1 day
                        const redisResponse = await global.redisSvc.storeKeyValue(redisKey, docCount,ttlSeconds)
                        if(redisResponse && redisResponse.saved){
                            log.debug(`REDIS: saved ${redisKey} to Redis ` + __location);
                        }
                    }
                    catch(err){
                        log.error(`Error save ${redisKey} to Redis cache ` + err + __location);
                    }
                }
                resolve({count: docCount});
                return;
            }
        });

    }

    getById(id) {
        log.debug(`appBO id ${id} ` + __location)
        if(validator.isUuid(id)){
            return this.getfromMongoByAppId(id)
        }
        else {
            // nodoc, force mongo query.
            return this.getMongoDocbyMysqlId(id, false, true);
        }
    }

    deleteSoftById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if (id) {
                try {
                    const query = {"applicationId": id};
                    const newObjectJSON = {active: false}
                    // Add updatedAt
                    newObjectJSON.updatedAt = new Date();
                    await ApplicationMongooseModel.updateOne(query, newObjectJSON);
                    if(global.settings.USE_REDIS_APP_LIST_CACHE === "YES"){
                        await this.updateRedisForAppUpdatebyAppId(id);
                        await this.updateRedisForAppAddDelete(id,null , -1);
                    }

                }
                catch (err) {
                    log.error(`Error marking Application from uuid ${id} ` + err + __location);
                    reject(err);
                }
                resolve(true);

            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    getAgencyNewtorkIdById(id) {
        return new Promise(async(resolve, reject) => {
            if(id){
                let agencyNetworkId = 0;
                try{
                    const appDoc = await this.loadById(id)
                    agencyNetworkId = appDoc.agencyNetworkId;
                }
                catch(err){
                    log.error(`this.loadById ${id} error ` + err + __location)
                }
                if (agencyNetworkId > 0) {
                    resolve(agencyNetworkId)
                }
                else {
                    log.error(`this.loadById App Not Found mysqlId ${id} ${agencyNetworkId} ` + __location)
                    reject(new Error(`App Not Found mysqlId ${id} ${agencyNetworkId}`));
                }
            }
            else {
                log.error(`getAgencyNewtorkIdById no ID supplied  ${id}` + __location);
                reject(new Error(`App Not Found applicationId ${id}`));
            }
        });
    }
    getLoadedMongoDoc() {
        if (this.#applicationMongooseDB && this.#applicationMongooseDB.applicationId) {
            return this.#applicationMongooseDB;
        }
        else {
            return null;
        }
    }

    // let user retreive old application by mysqlId.
    async getMongoDocbyMysqlId(mysqlId, returnMongooseModel = false, forceDBQuery = false) {
        return new Promise(async(resolve, reject) => {
            if (this.#applicationMongooseDB && this.#applicationMongooseDB.applicationId && forceDBQuery === false) {
                resolve(this.#applicationMongooseDB);
            }
            else if (mysqlId > 0) {
                const query = {
                    "mysqlId": mysqlId,
                    active: true
                };
                let appllicationDoc = null;
                let docDB = null;
                try {
                    docDB = await ApplicationMongooseModel.findOne(query, '-__v');
                    if (docDB) {
                        await this.setDocEinClear(docDB);
                        if (docDB && docDB.appStatusId === QUOTING_STATUS) {
                            await this.checkAndFixAppStatus(docDB);
                        }
                        this.#applicationMongooseDB = docDB
                        appllicationDoc = mongoUtils.objCleanup(docDB);
                    }
                }
                catch (err) {
                    log.error("Getting Application error " + err + __location);
                    reject(err);
                }
                if(returnMongooseModel){
                    resolve(docDB);
                }
                else {
                    resolve(appllicationDoc);
                }

            }
            else {
                reject(new Error('no id supplied ' + mysqlId))
            }
        });
    }


    updateProperty() {
        if(this.applicationDoc){
            //main ids only
            this.id = this.applicationDoc.applicationId;
            this.agencyNetworkId = this.applicationDoc.agencyNetworkId;
            this.applicationId = this.applicationDoc.applicationId;
            this.agencyId = this.applicationDoc.agencyid;
        }

    }


    // *********************************
    //    Question processing
    //
    //
    // *********************************
    //For AgencyPortal and Quote V2 - skipAgencyCheck === true if caller has already check
    // user rights to application

    async GetQuestions(appId, userAgencyList, questionSubjectArea, locationId, requestStateList, skipAgencyCheck = false, requestActivityCodeList = [], policyTypeRequested = null, returnHidden = false){
        log.debug(`App Doc GetQuestions appId: ${appId}, userAgencyList: ${userAgencyList}, questionSubjectArea: ${questionSubjectArea}, locationId: ${locationId}, requestStateList: ${requestStateList}, skipAgencyCheck: ${skipAgencyCheck}, requestActivityCodeList: ${requestActivityCodeList}, policyType ${policyTypeRequested}, returnHidden ${returnHidden}  `)
        let passedAgencyCheck = false;
        let applicationDocDB = null;
        let questionsObject = {};
        try{
            applicationDocDB = await this.loadDocfromMongoByAppId(appId);
            if(skipAgencyCheck === true){
                passedAgencyCheck = true;
            }
            else if(applicationDocDB && userAgencyList.includes(applicationDocDB.agencyId)){
                passedAgencyCheck = true;
            }
        }
        catch(err){
            log.error("Error checking application doc " + err + __location)
            throw new Error("Error checking application doc ");
        }
        if(passedAgencyCheck === false){
            throw new Error("permission denied");
        }
        if(!applicationDocDB){
            throw new Error("not found");
        }

        // check SAQ to populate the answeredList with location answers if they are there
        // This will need to up to switch as we add more subject areas
        if(questionSubjectArea === "location") {
            if(locationId){
                const location = applicationDocDB.locations.find(_location => _location.locationId === locationId);
                // if we found the location and there are questions populated on it, otherwise set to empty
                if(location && location.questions){
                    questionsObject.answeredList = location.questions;
                }
                else{
                    questionsObject.answeredList = [];
                }
            }
            else {
                // set the list to empty if we are location SAQ but no locationId is provided
                questionsObject.answeredList = [];
            }
        }
        else if(applicationDocDB.questions && applicationDocDB.questions.length > 0){
            questionsObject.answeredList = applicationDocDB.questions;
        }

        //industrycode
        let industryCodeStringArray = [];
        if(applicationDocDB.industryCode){
            industryCodeStringArray.push(applicationDocDB.industryCode);
        }
        else {
            log.error(`Data problem prevented getting Application Industry Code for ${applicationDocDB.uuid} . throwing error` + __location)
            throw new Error("Incomplete Application: Application Industry Code")
        }
        const bopPolicy = applicationDocDB.policies.find((p) => p.policyType === "BOP")
        if(bopPolicy && bopPolicy.bopIndustryCodeId){
            industryCodeStringArray.push(bopPolicy.bopIndustryCodeId.toString());
        }

        //policyType.
        let policyTypeArray = [];
        if(applicationDocDB.policies && applicationDocDB.policies.length > 0){
            for(let i = 0; i < applicationDocDB.policies.length; i++){
                if(!policyTypeRequested){
                    policyTypeArray.push({
                        type: applicationDocDB.policies[i].policyType,
                        effectiveDate: applicationDocDB.policies[i].effectiveDate
                    });
                }
                else if(policyTypeRequested === applicationDocDB.policies[i].policyType){
                    policyTypeArray.push({
                        type: applicationDocDB.policies[i].policyType,
                        effectiveDate: applicationDocDB.policies[i].effectiveDate
                    });
                }
            }
            //not policy hit
            if(policyTypeRequested && policyTypeArray.length === 0){
                policyTypeArray.push({
                    type: policyTypeRequested,
                    effectiveDate: moment()
                });
            }
        }
        else {
            log.error(`Data problem prevented getting Application Policy Types for ${applicationDocDB.uuid} . throwing error` + __location)
            throw new Error("Incomplete Application: Application Policy Types")
        }
        // get activitycodes.
        // activity codes are not required for For most GL or BOP. only WC.
        // Future Enhance is to take insurers into account. For Example: Acuity mixes GL and WC concepts.
        // This check may need to become insurer aware.
        const requireActivityCodes = Boolean(policyTypeArray.filter(policy => policy === "WC").length);
        // for questionSubjectArea: general, always get the activity codes from the application.
        // if it a location subject area should we be getting the activity codes from the location
        //    not application wide.
        // special overrides allowed.
        const subjectAreaRequestOverrideAllowed = ["location"];
        let activityCodeList = [];
        // if locationId is sent the activity codes in the location should be used.
        if(questionSubjectArea === "location" && locationId){
            //Get question just that location's activity codes which may be a subset of appDoc.activityCodes
            const location = applicationDocDB.locations.find(_location => _location.locationId === locationId);
            // if we found the location and there are questions populated on it, otherwise set to empty
            for (const ActivtyCodeEmployeeType of location.activityPayrollList) {
                if(activityCodeList.indexOf(ActivtyCodeEmployeeType.activityCodeId) === -1){
                    activityCodeList.push(ActivtyCodeEmployeeType.activityCodeId);
                }
            }
        }
        // Specials case we allows the clients to get the questions before save the relate item
        // as of 2021/05/08 this is only for location.
        else if(requestActivityCodeList && requestActivityCodeList.length > 0 && !locationId
                && subjectAreaRequestOverrideAllowed.indexOf(questionSubjectArea) > -1){
            utility.addArrayToArray(activityCodeList,requestActivityCodeList)
        }
        // clean out activity codes in case they are there but we are general questionSubjectArea
        else if(applicationDocDB.activityCodes && applicationDocDB.activityCodes.length > 0){
            for(let i = 0; i < applicationDocDB.activityCodes.length; i++){
                if(applicationDocDB.activityCodes[i].activityCodeId){
                    activityCodeList.push(applicationDocDB.activityCodes[i].activityCodeId);
                }
                else {
                    activityCodeList.push(applicationDocDB.activityCodes[i].ncciCode);
                }
            }
        }
        else if(applicationDocDB.locations && applicationDocDB.locations.length > 0) {
            applicationDocDB.locations.forEach((location) => {
                location.activityPayrollList.forEach((activityCode) => {
                    if(activityCodeList.indexOf(activityCode.activityCodeId) === -1){
                        activityCodeList.push(activityCode.activityCodeId);
                    }
                });
            });
        }
        else if(requireActivityCodes) {
            if(questionSubjectArea === 'general'){
                log.error(`Data problem prevented getting App Activity Codes for ${applicationDocDB.uuid} locationId ${locationId}. throwing error` + __location)
                throw new Error("Incomplete WC Application: Missing Application Activity Codes");
            }
        }
        //zipCodes
        let zipCodeArray = [];
        let stateList = [];
        // Do not modify stateList if it is already populated. We do not need to populate zipCodeArray since it is ignored if stateList is valid. -SF
        // Note: this can be changed to populate zipCodeArray with only zip codes associated with the populated stateList
        // need to trace calls.
        // We probably should not be allow in the client to override the Application Data here.  At least, not in
        // all requests.   "location" pre save override is probably OK.
        if(questionSubjectArea === "location" && locationId){
            //Get question just that location's activity codes which may be a subset of appDoc.activityCodes
            const location = applicationDocDB.locations.find(_location => _location.locationId === locationId);
            if(location){
                zipCodeArray.push(location.zipcode);
                stateList.push(location.state)
            }
            else {
                log.error(`Data problem prevented getting App location for ${applicationDocDB.uuid} locationId ${locationId}. using mailing` + __location)
                zipCodeArray.push(applicationDocDB.mailingZipcode);
                stateList.push(applicationDocDB.mailingState)
            }
        }
        else if (requestStateList && requestStateList.length > 0 && subjectAreaRequestOverrideAllowed.indexOf(questionSubjectArea) > -1) {
            //do nothing. do not need zip
            utility.addArrayToArray(stateList,requestStateList)
        }
        else if (applicationDocDB.locations && applicationDocDB.locations.length > 0) {
            for (let i = 0; i < applicationDocDB.locations.length; i++) {
                zipCodeArray.push(applicationDocDB.locations[i].zipcode);
                if (stateList.indexOf(applicationDocDB.locations[i].state) === -1) {
                    stateList.push(applicationDocDB.locations[i].state)
                }
            }
        }
        // should not be here. Must be getting questions before saving locations.
        // use app mailing.
        else if (applicationDocDB.mailingZipcode) {
            zipCodeArray.push(applicationDocDB.mailingZipcode);
            if (applicationDocDB.mailingState) {
                stateList.push(applicationDocDB.mailingState)
            }
        }
        else if(questionSubjectArea === "claim"){
            //AP might not have location information yet.
            // at of 2021-07-09 all claim questions are universal
            // do nothing.
        }
        else {
            log.error(`Data problem prevented getting App location for ${applicationDocDB.uuid} locationId ${locationId}. throwing error` + __location)
            throw new Error("Incomplete Application: Application locations")
        }

        log.debug("stateList: " + JSON.stringify(stateList));
        //Agency Location insurer list.
        let insurerArray = [];
        if(applicationDocDB.agencyLocationId && applicationDocDB.agencyLocationId > 0){
            log.debug(`Getting  Primary Agency insurers ` + __location);
            //TODO Agency Prime
            const agencyLocationBO = new AgencyLocationBO();
            const getChildren = true;
            const addAgencyPrimaryLocation = true;
            let agencylocationJSON = await agencyLocationBO.getById(applicationDocDB.agencyLocationId, getChildren, addAgencyPrimaryLocation).catch(function(err) {
                log.error(`Error getting Agency Primary Location ${applicationDocDB.uuid} ` + err + __location);
            });
            if(agencylocationJSON && agencylocationJSON.useAgencyPrime){
                try{
                    const insurerObjList = await agencyLocationBO.getAgencyPrimeInsurers(applicationDocDB.agencyId, applicationDocDB.agencyNetworkId);
                    if(!insurerObjList && insurerObjList.length === 0){
                        log.error(`AppBO GetQuestions Unable got get primary agency's insurers ` + __location);
                    }
                    for (const policyType of policyTypeArray){
                        for(let i = 0; i < insurerObjList.length; i++){
                            if(insurerObjList[i].policyTypeInfo[policyType.type]?.enabled === true && insurerArray.indexOf(insurerObjList[i].insurerId) === -1){
                                insurerArray.push(insurerObjList[i].insurerId)
                            }
                        }
                    }
                    log.debug(`Set  Primary Agency insurers ${insurerArray} ` + __location);
                }
                catch(err){
                    log.error(`Data problem prevented getting App agency location for ${applicationDocDB.uuid} agency ${applicationDocDB.agencyId} Location ${applicationDocDB.agencyLocationId}` + __location)
                    throw new Error("Agency Network Error no Primary Agency Insurers")
                }
            }
            else if (agencylocationJSON && agencylocationJSON.insurers && agencylocationJSON.insurers.length > 0) {
                for (const policyType of policyTypeArray){
                    for(let i = 0; i < agencylocationJSON.insurers.length; i++){
                        if(agencylocationJSON.insurers[i].policyTypeInfo[policyType.type]?.enabled === true && insurerArray.indexOf(agencylocationJSON.insurers[i].insurerId) === -1){
                            insurerArray.push(agencylocationJSON.insurers[i].insurerId)
                        }
                    }
                }
            }
            else {
                log.error(`Data problem prevented getting App agency location insurers for ${applicationDocDB.uuid} agency ${applicationDocDB.agencyId} Location ${applicationDocDB.agencyLocationId}` + __location)
                throw new Error(`Agency setup error Agency Location ${applicationDocDB.agencyLocationId} Not Found in database or does not have Insurers setup`)
            }
        }
        else {
            log.error(`Incomplete Application: Missing AgencyLocation for ${applicationDocDB.uuid} . throwing error` + __location)
            throw new Error("Incomplete Application: Missing AgencyLocation")
        }


        const questionSvc = global.requireShared('./services/questionsvc.js');
        let getQuestionsResult = null;

        try {
            //log.debug("insurerArray: " + insurerArray);
            getQuestionsResult = await questionSvc.GetQuestionsForAppBO(activityCodeList, industryCodeStringArray, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, returnHidden, stateList);
            if(getQuestionsResult && getQuestionsResult.length === 0 || getQuestionsResult === false){
                //no questions returned.
                log.warn(`No questions returned for AppId ${appId} parameter activityCodeList: ${activityCodeList}  industryCodeString: ${industryCodeStringArray}  zipCodeArray: ${zipCodeArray} policyTypeArray: ${JSON.stringify(policyTypeArray)} insurerArray: ${insurerArray} + __location`)
            }
        }
        catch (err) {
            log.error("Error call in question service " + err + __location);
            throw new Error('An error occured while retrieving application questions. ' + err);
        }
        questionsObject.questionList = getQuestionsResult

        return questionsObject;


    }

    // for Quote App
    async GetQuestionsForFrontend(appId, activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, questionSubjectArea, return_hidden = false) {

        let applicationDoc = null;
        try {
            applicationDoc = await this.loadById(appId);
        }
        catch (err) {
            log.error("error calling loadById " + err + __location);
        }

        // Override the policyTypeArray from the application doc to get the policy type and effective dates (not passed in by the old quote app)
        policyTypeArray = [];
        if(applicationDoc.policies && applicationDoc.policies.length > 0){
            for(let i = 0; i < applicationDoc.policies.length; i++){
                policyTypeArray.push({
                    type: applicationDoc.policies[i].policyType,
                    effectiveDate: applicationDoc.policies[i].effectiveDate
                });
            }
        }

        const insurerArray = [];
        if (applicationDoc && applicationDoc.agencyLocationId > 0) {
            const agencyLocationBO = new AgencyLocationBO();
            const agencyLocation = await agencyLocationBO.getById(applicationDoc.agencyLocationId);
            if (agencyLocation && agencyLocation.insurers && agencyLocation.insurers.length > 0) {
                for (const insurer of agencyLocation.insurers) {
                    if (insurer && insurer.insurerId) {
                        insurerArray.push(insurer.insurerId);
                    }
                    else {
                        log.error(`Data problem prevented getting insurer ID for ${applicationDoc.uuid} agency ${applicationDoc.agencyId} Location ${applicationDoc.agencyLocationId}` + __location)
                    }
                }
            }
            else {
                log.error(`Data problem prevented getting agency location for ${applicationDoc.uuid} agency ${applicationDoc.agencyId} Location ${applicationDoc.agencyLocationId}` + __location)
            }
        }
        else {
            log.error(`Received an invalid agency location ID for ${applicationDoc.uuid} Location '${applicationDoc.agencyLocationId}'` + __location);
            throw new Error('An error occured while retrieving application questions' + __location);
        }

        log.debug("in AppBO.GetQuestionsForFrontend")
        //Call questions.......
        const questionSvc = global.requireShared('./services/questionsvc.js');
        let getQuestionsResult = null;
        try {
            getQuestionsResult = await questionSvc.GetQuestionsForFrontend(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden);
        }
        catch (err) {
            log.error("Error call in question service " + err + __location);
            throw new Error('An error occured while retrieving application questions. ' + err);
        }
        if (!getQuestionsResult || getQuestionsResult === false) {
            log.error("No questions returned from question service " + __location);
            throw new Error('An error occured while retrieving application questions.');
        }

        return getQuestionsResult;
    }

    // eslint-disable-next-line valid-jsdoc
    /**
     * Recalculates all quote-related metrics stored in the Application collection.
     *
     * @param {number} applicationId The application UUID.
     */
    async recalculateQuoteMetrics(applicationId) {
        try{

            const quoteList = await QuoteMongooseModel.find({applicationId: applicationId});
            //not all applications have quotes.
            if(quoteList && quoteList.length > 0){
                let lowestBoundQuote = (product) => _.min(quoteList.
                    filter(t => t.policyType === product && (
                        t.bound ||
                        t.status === 'bind_requested')).
                    map(t => t.amount));

                let lowestQuote = (product) => _.min(quoteList.
                    filter(t => t.policyType === product && (
                        t.bound ||
                        t.status === 'bind_requested' ||
                        t.apiResult === 'quoted' ||
                        t.apiResult === 'referred_with_price')).
                    map(t => t.amount));

                const metrics = {
                    lowestBoundQuoteAmount: {
                        GL: lowestBoundQuote('GL'),
                        WC: lowestBoundQuote('WC'),
                        BOP: lowestBoundQuote('BOP')
                    },
                    lowestQuoteAmount: {
                        GL: lowestQuote('GL'),
                        WC: lowestQuote('WC'),
                        BOP: lowestQuote('BOP')
                    }
                };

                // updateMongo does lots of checking and potential resettings.
                // await this.updateMongo(applicationId, {metrics: metrics});
                // Add updatedAt
                let updateJSON = {metrics: metrics};
                updateJSON.updatedAt = new Date();

                await ApplicationMongooseModel.updateOne({applicationId: applicationId}, updateJSON);
                //NOTE if metric are displayed in AP applist Redis cache will have to update.

            }
            else {
                //should never happen.
                log.error(`recalculateQuoteMetrics Application ${applicationId} had no quotes to calculate premium. ` + __location)
            }
        }
        catch(err){
            log.error(`recalculateQuoteMetrics  Error Application ${applicationId} - ${err}. ` + __location)
        }
    }

    // *********************************
    //    AgencyLocation processing
    // *********************************
    // eslint-disable-next-line valid-jsdoc
    /**
     * Check and potentially resets agency location
     *
     * @param {number} applicationId The application UUID.
     */
    async setAgencyLocation(applicationId) {
        log.debug(`Processing SetAgencyLocation ${applicationId} ` + __location)
        let errorMessage = null;
        let missingTerritory = '';
        try{
            const status = global.requireShared('./models/status/applicationStatus.js');
            const agencyLocationBO = new AgencyLocationBO();
            const appDoc = await ApplicationMongooseModel.findOne({applicationId: applicationId});
            if(appDoc && appDoc.locations){
                let needsUpdate = false;
                if(appDoc.agencyLocationId){
                    const agencylocationJSON = await agencyLocationBO.getById(appDoc.agencyLocationId).catch(function(err) {
                        log.error(`Error getting Agency Location ${appDoc.applicationId} ` + err + __location);
                    });
                    if(agencylocationJSON){
                        if(agencylocationJSON.territories && agencylocationJSON.territories.length > 0){
                            appDoc.locations.forEach((location) => {
                                log.debug(`SetAgencyLocation checking ${location.state}  against ${agencylocationJSON.territories} ${applicationId} ${appDoc.agencyLocationId}` + __location)
                                if(agencylocationJSON.territories.indexOf(location.state) === -1){
                                    missingTerritory = location.state;
                                    needsUpdate = true;
                                }
                            });
                        }
                        else{
                            log.error(`Application ${appDoc.applicationId} Agency Location ${appDoc.agencyLocationId} is not configured for any territories. ` + __location)
                            needsUpdate = true;
                        }

                    }
                    else {
                        needsUpdate = true;
                    }

                }
                else {
                    needsUpdate = true;
                }
                if(needsUpdate && appDoc.lockAgencyLocationId !== true){
                    //get agency's locations.
                    const query = {agencyId: appDoc.agencyId};
                    const agenyLocationList = await agencyLocationBO.getList(query).catch(function(err) {
                        log.error(`Error getting Agency Location List ${appDoc.applicationId} ` + err + __location);
                    });
                    //loop through locaitons check application terrtories vs agency location territories.
                    if(agenyLocationList && agenyLocationList.length > 1){
                        for(let i = 0; i < agenyLocationList.length; i++){
                            const agLoc = agenyLocationList[i];
                            let newLocationId = agLoc.systemId;
                            if(agLoc.territories && agLoc.territories.length > 0){
                                appDoc.locations.forEach((location) => {
                                    if(agLoc.territories.indexOf(location.state) === -1){
                                        newLocationId = 0;
                                    }
                                });
                            }
                            if(newLocationId){
                                needsUpdate = false;
                                if(appDoc.agencyLocationId !== newLocationId){
                                    log.info(`setAgencyLocation ${applicationId} switching locations ${appDoc.agencyLocationId} to ${newLocationId} ` + __location)
                                    appDoc.agencyLocationId = newLocationId
                                    await appDoc.save();
                                }
                                break;
                            }
                        }
                        if(needsUpdate){
                            // check if wholesale agency
                            //state.agency.wholesale
                            const agencyBO = new AgencyBO();
                            // Load the request data into it
                            const agencyJSON = await agencyBO.getById(appDoc.agencyId).catch(function(err) {
                                log.error("Agency load error " + err + __location);
                            });
                            if (agencyJSON && agencyJSON.wholesale){
                                log.info(`setAgencyLocation ${applicationId} setting to wholesale ` + __location);
                                appDoc.wholesale = true;
                                await appDoc.save();
                            }
                            else {
                                // we dont cover the territory of this location, the application is out of market now.
                                appDoc.appStatusId = status.applicationStatus.outOfMarket.appStatusId;
                                appDoc.status = status.applicationStatus.outOfMarket.appStatusDesc;
                                await appDoc.save();
                                errorMessage = `AppId ${appDoc.applicationId} Agency does not cover application territory ${missingTerritory}`;
                            }
                        }
                    }
                    else if(agenyLocationList && agenyLocationList.length === 1){
                        // we dont cover the territory of this location, the application is out of market now.
                        appDoc.appStatusId = status.applicationStatus.outOfMarket.appStatusId;
                        appDoc.status = status.applicationStatus.outOfMarket.appStatusDesc;
                        await appDoc.save();
                        errorMessage = `AppId ${appDoc.applicationId} Agency does not cover application territory ${missingTerritory}`;
                    }
                    else {
                        log.error(`Could not set agencylocation on ${applicationId} no agency locations for ${appDoc.agencyId} ` + __location);
                        errorMessage = `Could not set agencylocation on ${applicationId}`;
                    }
                }
                else if(needsUpdate && appDoc.lockAgencyLocationId === true){
                    //no update app
                    log.info(`setAgencyLocation  locked Agencylocation does not cover application territories ${applicationId} ` + __location);
                    errorMessage = `Agency Location does not cover application territory ${missingTerritory}`;
                }
            }
            else {
                if(appDoc){
                    log.error(`setAgencyLocation  Missing Application ${applicationId} locations ` + __location);
                }
                else {
                    log.error(`setAgencyLocation  Missing Application ${applicationId} ` + __location);
                }
                errorMessage = `Could not set agencylocation on ${applicationId}`;
            }
            if(!errorMessage && appDoc && appDoc.appStatusId === 4){
                // we're no longer out of market, set back to incomplete
                appDoc.appStatusId = status.applicationStatus.incomplete.appStatusId;
                appDoc.status = status.applicationStatus.incomplete.appStatusDesc;
                await appDoc.save();
            }
        }
        catch(err){
            log.error(`setAgencyLocation  Error Application ${applicationId} - ${err}. ` + __location);
            errorMessage(`Could not set agencylocation on ${applicationId}`);
        }

        return errorMessage ? errorMessage : true;

    }

    async getAppBopCodes(applicationId){
        const IndustryCodeSvc = global.requireShared('services/industrycodesvc.js');
        let applicationJsonDB = null;
        try{
            applicationJsonDB = await this.getById(applicationId);
        }
        catch(err){
            log.error("getAppBopCodes: Error getting application doc " + err + __location)
        }
        if(!applicationJsonDB){
            log.error("getAppBopCodes: application not found" + __location)
            return [];
        }
        let insurerArray = [];
        if(applicationJsonDB.agencyLocationId){
            const agencyLocationBO = new AgencyLocationBO();
            const getChildren = false;
            const addAgencyPrimaryLocation = true;
            let agencylocationJSON = await agencyLocationBO.getById(applicationJsonDB.agencyLocationId, getChildren, addAgencyPrimaryLocation).catch(function(err) {
                log.error(`Error getting Agency Location ${applicationJsonDB.uuid} ` + err + __location);
            });
            if (agencylocationJSON && agencylocationJSON.insurers && agencylocationJSON.insurers.length > 0) {
                for(let i = 0; i < agencylocationJSON.insurers.length; i++){
                    if(agencylocationJSON.insurers[i].policyTypeInfo["BOP"]?.enabled === true && insurerArray.indexOf(agencylocationJSON.insurers[i].insurerId) === -1){
                        insurerArray.push(agencylocationJSON.insurers[i].insurerId)
                    }
                }
            }
            else {
                log.debug(`getAppBopCodes no location insurers for appId ${applicationId} in \n ${JSON.stringify(agencylocationJSON)}` + __location);
            }
        }
        if(insurerArray.length === 0){
            log.debug(`getAppBopCodes no location insurers appId ${applicationId} appLocId ${applicationJsonDB.agencyLocationId}` + __location);
            insurerArray = null;
        }

        let iicList = [];
        try{
            iicList = await IndustryCodeSvc.GetBopIndustryCodes(applicationJsonDB.industryCode, insurerArray)
        }
        catch(err){
            log.error(`getAppBopCodes:  Error get BOP industrycodes ${applicationId} - ${err}. ` + __location);
        }

        return iicList;
    }

}