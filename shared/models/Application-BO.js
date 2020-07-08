'use strict';
const moment = require('moment');
const DatabaseObject = require('./DatabaseObject.js');
const BusinessModel = require('./Business-model.js');
const ApplicationActivityCodesModel = require('./ApplicationActivityCodes-model.js');
const ApplicationPolicyTypeModel = require('./ApplicationPolicyType-model.js');
const LegalAcceptanceModel = require('./LegalAcceptance-model.js');
const ApplicationClaimModel =  require('./ApplicationClaim-model.js');

const QuoteModel = require('./Quote-model.js');
const taskWholesaleAppEmail = global.requireRootPath('tasksystem/task-wholesaleapplicationemail.js');
const taskSoleProAppEmail = global.requireRootPath('tasksystem/task-soleproapplicationemail.js');
const taskEmailBindAgency = global.requireRootPath('tasksystem/task-emailbindagency.js');

//const moment = require('moment');
const { 'v4': uuidv4 } = require('uuid');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

//const validator = global.requireShared('./helpers/validator.js');

const convertToIntFields = [];

module.exports = class ApplicationModel {

    #dbTableORM = null;

    constructor() {
        this.agencyLocation = null;
        this.business = null;
        this.id = 0;
        this.insurers = [];
        this.policies = [];
        this.questions = {};
        this.test = false;
        this.#dbTableORM = new ApplicationOrm();
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
                if(this.state > 15){
                    log.warn(`Attempt to update a finished application. appid ${applicationJSON.id}`  + __location);
                    reject(new Error("Data Error:Application may not be updated."));
                    return;
                }
                // //Check that it is too old (1 hours) from creation
                if(this.created){
                    const dbCreated = moment.utc(this.created);
                    log.debug('app created at ' + dbCreated.toString())
                    const nowTime = moment().utc();;
                    const ageInMinutes = dbCreated.diff(nowTime, 'minutes');
                    log.debug('Application age in minutes ' + ageInMinutes);
                    // if(ageInMinutes > 60){
                    //     log.warn(`Attempt to update an old application. appid ${applicationJSON.id}`  + __location);
                    //     reject(new Error("Data Error:Application may not be updated."));
                    //     return;
                    // }
                }
                else {
                    log.warn(`Application missing created value. appid ${applicationJSON.id}`  + __location);
                }


            }
            log.debug("applicationJSON: " + JSON.stringify(applicationJSON));
            let error = null;
            let updateBusiness = false;
            switch (workflowStep) {
                case "contact":
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

                    if (!applicationJSON.uuid) {
                        applicationJSON.uuid = uuidv4().toString();
                    }
                    break;
                case 'locations':
                    // update business data
                    if(applicationJSON.total_payroll){
                        await this.processActivityCodes(applicationJSON.total_payroll).catch(function(err){
                            log.error('Adding claims error:' + err + __location);
                            reject(err);
                        });
                    }
                    else {
                        log.warn("Application missing total_payroll appID " + this.id + __location )
                    }
                    updateBusiness = true;
                    break;
                case 'coverage':
                     //processPolicyTypes
                     if(applicationJSON.policy_types){
                        await this.processPolicyTypes(applicationJSON.policy_types).catch(function(err){
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
                    if(applicationJSON.claims){
                        await this.processClaimsWF(applicationJSON.claims).catch(function(err){
                            log.error('Adding claims error:' + err + __location);
                            reject(err);
                        });
                    }
                    break;
                case 'questions':
                    if(applicationJSON.questions){
                        await this.processQuestions(applicationJSON.questions).catch(function(err){
                            log.error('Adding Questions error:' + err + __location);
                            reject(err);
                        });
                    }
                    await this.processLegalAcceptance(applicationJSON).catch(function(err){
                        log.error('Adding Legal Acceptance error:' + err + __location);
                        reject(err);
                    });
                    if(applicationJSON.wholesale === 1 || applicationJSON.solepro === 1 ){
                        //save the app for the email.
                        this.#dbTableORM.load(applicationJSON, false).catch(function (err) {
                            log.error("Error loading application orm " + err + __location);
                        });
                        //save
                        await this.#dbTableORM.save().catch(function (err) {
                            reject(err);
                        });

                        // Email decision.  Where is wholesale or solepro decision made and saved //if wholesale or solepro - launch email tasks
                        if(applicationJSON.wholesale === 1){
                            log.debug("sending wholesale email for AppId " + this.id);
                            //no need to await app save should
                            taskWholesaleAppEmail.wholesaleApplicationEmailTask(this.id);
                        }
                        //if solepro - launch email tasks
                        if(applicationJSON.solepro === 1){
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
                    if(applicationJSON.quotes){
                        await this.processQuotes(applicationJSON).catch(function(err){
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
            if(updateBusiness === true){
                if (applicationJSON.businessInfo) {
                    applicationJSON.businessInfo.id = this.business;
                    await this.processBusiness(applicationJSON.businessInfo).catch(function (err) {
                        log.error("updating business error:" + err + __location);
                        reject(err);
                    });
                    delete applicationJSON.businessInfo
                }
            }

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
            const stepNumber = stepMap[workflowStep];
            log.debug('workflowStep: ' + workflowStep + ' stepNumber: ' +  stepNumber);
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
            if (this.#dbTableORM.uuid) {
                this.#dbTableORM.uuid = applicationJSON.uuid;
            }
            //save
            await this.#dbTableORM.save().catch(function (err) {
                reject(err);
            });
            this.updateProperty();
            this.id = this.#dbTableORM.id;

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
        const applicationClaimModelDelete = new ApplicationClaimModel();
        //remove existing addresss acivity codes. we do not get ids from UI.
        await applicationClaimModelDelete.DeleteClaimsByApplicationId(this.id).catch(function(err){
            log.error("Error deleting ApplicationClaimModel " + err +  __location);
        });
        for(var i = 0; i < claims.length; i++){
            let claim = claims[i];
            claim.application = this.id;
            const applicationClaimModel = new ApplicationClaimModel();
            await applicationClaimModel.saveModel(claim).catch(function (err) {
                log.error("Adding new claim error:" + err + __location);
                reject(err);
                return;
            });
        }
        resolve(true);

    });
}

processActivityCodes(activtyListJSON){

    return new Promise(async (resolve, reject) => {
        //delete existing.
        const applicationActivityCodesModelDelete = new ApplicationActivityCodesModel();
        //remove existing addresss acivity codes. we do not get ids from UI.
        await applicationActivityCodesModelDelete.DeleteByApplicationId(this.id).catch(function(err){
            log.error("Error deleting ApplicationActivityCodesModel " + err +  __location);
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


processPolicyTypes(policyTypeArray){

    return new Promise(async (resolve, reject) => {
        //delete existing.
        const applicationPolicyTypeModelDelete = new ApplicationPolicyTypeModel();
        //remove existing addresss acivity codes. we do not get ids from UI.
        await applicationPolicyTypeModelDelete.DeleteByApplicationId(this.id).catch(function(err){
            log.error("Error deleting ApplicationPolicyTypeModel " + err +  __location);
        });
       
       
        for(var i=0; i < policyTypeArray.length;i++){
            const policyType = policyTypeArray[i];
            const policyTypeJSON = {
                'application': this.id,
				"policy_type": policyType
            }
            const applicationPolicyTypeModel = new ApplicationPolicyTypeModel();
            await applicationPolicyTypeModel.saveModel(policyTypeJSON).catch(function (err) {
                log.error(`Adding new applicationPolicyTypeModel for Appid ${this.id} error:` + err + __location);
                reject(err);
                return;
            });
        }
        
        resolve(true);

    });

}


processQuestions(questions){

    return new Promise(async (resolve, reject) => {
        ///delete existing ?? old system did not.
        let valueList = []
        for(var i = 0; i < questions.length; i++){
            let question = questions[i];
            questions.application = this.id;
            let valueLine = '';
            if(question.type === 'text'){
                const cleanString = question.answer.replace(/\|/g,',')
                valueLine = `(${this.id}, ${question.id}, NULL, '${cleanString}')`

            } else if (question.type === 'array'){
                const arrayString = "|" + question.answer.join('|');
                valueLine = `(${this.id}, ${question.id},NULL, '${arrayString}')`
            }
            else {
                valueLine = `(${this.id}, ${question.id}, ${question.answer}, NULL)`
            }
            valueList.push(valueLine);
        }
        const valueListString =  valueList.join(",\n");
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

processLegalAcceptance(applicationJSON){

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

processQuotes(applicationJSON){

    return new Promise(async (resolve, reject) => {
        if(applicationJSON.quotes){
            for(var i=0;i<applicationJSON.quotes.length; i++){
                const quote = applicationJSON.quotes[i];
                log.debug("quote: " + JSON.stringify(quote))
                log.debug("Sending Bind Agency email for AppId " + this.id + " quote " + quote.quote);
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
                const quoteUpdate = { "status": "bind_requested",
                                    "payment_plan": quote.payment
                                    }
                await quoteModel.saveModel(quoteUpdate).catch(function (err) {
                    log.error(`Updating  quote with status and payment plan quote ${quote.quote} error:` + err + __location);
                    // reject(err);
                    //return;
                    
                });                  

                // TODO order of quotes may reduce the state
                applicationJSON.state = quote['api_result'] === 'referred_with_price' ? 12 : 16;
                // will get saved later afte this returns.
                
               
            }
        }
        resolve(true);

    });

}




    // updateApplication(applicationJSON) {
    //    
    //         if (applicationJSON.id) {
    //             //validate
    //             //setup business
    //             //get application from database & load it
    //             await this.#applicationORM.getById(applicationJSON.id).catch(function (err) {
    //                 log.error("Error getting application from Database " + err + __location);
    //                 reject(err);
    //             });
    //             this.updateProperty();

    //             // update with new data.
    //             this.#applicationORM.load(applicationJSON).catch(function (err) {
    //                 log.error("Error loading application orm " + err + __location);
    //             });
    //             //save
    //             await this.#applicationORM.save().catch(function (err) {
    //                 reject(err);
    //             });
    //             this.updateProperty();
    //             resolve(true);

    //         }
    //         else {
    //             reject(new Error("Missing Appiclcation Id"));
    //         }

    //     });
    // }

    /**
   * saves application.
     *
   * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application , or an Error if rejected
   */

    save(asNew = false) {
        return new Promise(async (resolve, reject) => {
            //validate

            resolve(true);
        });
    }

    loadFromId(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if (id && id > 0) {
                await this.#dbTableORM.getById(applicationJSON.id).catch(function (err) {
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



    async cleanupInput(inputJSON) {
        //convert to ints
        for (const property in properties) {
            if(inputJSON[property]){
                // Convert to number
                try{
                    if (properties[property].type === "number" && "string" === typeof inputJSON[property]){
                        if (properties[property].dbType.indexOf("int")  > -1){
                            inputJSON[property] = parseInt(inputJSON[property], 10);
                        }
                        else if (properties[property].dbType.indexOf("float")  > -1){
                            inputJSON[property] = parseFloat(inputJSON[property]);
                        }
                    }
                }
                catch(e){
                    log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location);
                }
            }
        }
    }

    updateProperty() {
        const dbJSON = this.#dbTableORM.cleanJSON()
        // eslint-disable-next-line guard-for-in
        for (const property in properties) {
            this[property] = dbJSON[property];
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