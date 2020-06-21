'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const BusinessModel = require('./Business-model.js');
const moment = require('moment');
const { 'v4': uuidv4 } = require('uuid');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

//const validator = global.requireShared('./helpers/validator.js');

const convertToIntFields = ["industry_code", "deductible", "coverage"]

module.exports = class ApplicationModel {

    #applicationORM = null;

    constructor() {
        this.agencyLocation = null;
        this.business = null;
        this.id = 0;
        this.insurers = [];
        this.policies = [];
        this.questions = {};
        this.test = false;
        this.#applicationORM = new ApplicationOrm();
    }


    /**
   * Load new application JSON with optional save.
     *
   * @param {object} applicationJSON - application JSON
     * @param {boolean} save - Saves application if true
   * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved application , or an Error if rejected
   */
    newApplicationStep(applicationJSON, worflowStep) {
        return new Promise(async (resolve, reject) => {
            if (!applicationJSON) {
                reject(new Error("empty application object given"));
            }
            if(!applicationJSON.id && applicationJSON.step !== "contact"){
                reject(new Error("missing application id"));
            }
            if(applicationJSON.id && applicationJSON.step !== "contact"){
               //load application from database.
               await this.#applicationORM.getById(applicationJSON.id).catch(function (err) {
                    log.error("Error getting application from Database " + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();

            }

            


            log.debug("applicationJSON: " + JSON.stringify(applicationJSON));
            let error = null;
            switch (worflowStep) {
                case "contact":
                    // 1st step might have a business ID or appID
                    //validate
                    //setup business
                    if (!applicationJSON.business) {
                        if (applicationJSON.businessInfo) {
                            //load business
                            const businessModel = new BusinessModel();
                            await businessModel.newBusiness(applicationJSON.businessInfo).catch(function (err) {
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
                    }
                    if (!applicationJSON.uuid) {
                        applicationJSON.uuid = uuidv4().toString();
                    }
                    break;
                case 'locations':
                    // Get parser for locations page
                    

                    break;
                case 'coverage':
                    // Get parser for coverage page
                    // update business data
                    if(applicationJSON.businessInfo){
                        const businessModel = new BusinessModel();
                    
                        await businessModel.loadFromId(this.business).catch(function(err){
                            error = err;
                        })
                        if(error){
                            const errMessage = `Application WF error loading Business ${this.business} error ` + error; 
                            log.error(errMessage + __location)
                            reject(errMessage);
                            return;
                        }
                        applicationJSON.businessInfo.id = this.business;
                        await businessModel.updateBusiness(applicationJSON.businessInfo).catch(function (err) {
                            log.error("Creating new business error:" + err + __location);
                            reject(err);
                        })
    
    
                        delete applicationJSON.businessInfo
                    }
                   
                    
                    break;
                case 'owners':
                    // Get parser for owners page
                    // require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/OwnersParser.php';
                    // $parser = new OwnersParser();
                    break;
                case 'details':
                    // Get parser for details page
                    // require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/DetailsParser.php';
                    // $parser = new DetailsParser();
                    break;
                case 'claims':
                    // Get parser for claims page
                    // require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/ClaimsParser.php';
                    // $parser = new ClaimsParser();
                    break;
                case 'questions':
                    // Get parser for questions page
                    // require_once JPATH_COMPONENT_ADMINISTRATOR . '/lib/QuoteEngine/parsers/QuestionsParser.php';
                    // $parser = new QuestionsParser();
                    break;
                case 'quotes':
                    // Do nothing - we only save here to update the last step
                    break;
                default:
                    // not from old Web application application flow.
                    reject(new Error("Unknown Application Workflow Step"))
                    return;
                    break;
            }

            
            stepMap = {
                'contact' : 2,
                'coverage' : 3,
                'locations' : 4,
                'owners' : 5,
                'details' : 6,
                'claims' : 7,
                'questions' : 8,
                'quotes' : 9,
                'cart' : 10
            };
            const stepNumber = stepMap[worflowStep];
            if(!this.#applicationORM.last_step){
                this.#applicationORM.last_step = stepNumber;
            }
            else if(stepNumber > this.#applicationORM.last_step){
                this.#applicationORM.last_step = stepNumber;
            }

            await this.cleanupInput(applicationJSON);

            //$app->created_by = $user->id;
            this.#applicationORM.load(applicationJSON, false).catch(function (err) {
                log.error("Error loading application orm " + err + __location);
            });
            if( this.#applicationORM.uuid){
                this.#applicationORM.uuid = applicationJSON.uuid;
            }
            //save
            await this.#applicationORM.save().catch(function (err) {
                reject(err);
            });
            this.updateProperty();
            this.id = this.#applicationORM.id;

            resolve(true);

            
        });
    }


    updateApplication(applicationJSON) {
        return new Promise(async (resolve, reject) => {
            if (applicationJSON.id) {
                //validate
                //setup business
                //get application from database & load it
                await this.#applicationORM.getById(applicationJSON.id).catch(function (err) {
                    log.error("Error getting application from Database " + err + __location);
                    reject(err);
                });
                this.updateProperty();
                
                // update with new data.
                this.#applicationORM.load(applicationJSON).catch(function (err) {
                    log.error("Error loading application orm " + err + __location);
                });
                //save
                await this.#applicationORM.save().catch(function (err) {
                    reject(err);
                });
                this.updateProperty();
                resolve(true);

            }
            else {
                reject(new Error("Missing Appiclcation Id"));
            }

        });
    }

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
            if(id && id >0 ){
                await this.#applicationORM.getById(applicationJSON.id).catch(function (err) {
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
        for (var i = 0; i < convertToIntFields.length; i++) {
            if (inputJSON[convertToIntFields[i]]) {
                try {
                    inputJSON[convertToIntFields[i]] = parseInt(inputJSON[convertToIntFields[i]], 10);
                }
                catch (e) {
                    log.warn("BuinsessModel bad input JSON field: " + convertToIntFields[i] + " cannot convert to Int")
                    delete inputJSON[convertToIntFields[i]]
                }
            }
        }
    }

    updateProperty() {
        const dbJSON = this.#applicationORM.cleanJSON()
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
        "type": "number"
    },
    "state": {
        "default": "1",
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "status": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "abandoned_email": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "abandoned_app_email": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "opted_out_online_emailsent": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "opted_out_online": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "additional_insured": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "agency": {
        "default": 1,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "agency_location": {
        "default": 1,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "bop_effective_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },
    "bop_expiration_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },
    "business": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "completion_time": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
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
        "type": "number"
    },
    "coverage_lapse": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "coverage_lapse_non_payment": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "deductible": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "dq1": {
        "default": 0,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "eo_effective_date": {
        "default": "0000-00-00",
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "string"
    },
    "eo_effective_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },
    "eo_expiration_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },
    "experience_modifier": {
        "default": 1.0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number"
    },
    "family_covered": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
    },
    "gl_effective_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
    },
    "gl_expiration_date": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "date"
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
        "type": "number"
    },
    "industry_code": {
        "default": null,
        "encrypted": false,
        "required": false,
        "rules": null,
        "type": "number"
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
        "type": "number"
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