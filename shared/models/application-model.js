'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const BusinessModel = require('./Business-model.js');
const moment = require('moment');
const{'v4': uuidv4} = require('uuid');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

//const validator = global.requireShared('./helpers/validator.js');

const convertToIntFields = ["industry_code"]

module.exports = class ApplicationModel{

  #applicationORM = null;

	constructor(){
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
    newApplication(applicationJSON, save = false){
        return new Promise(async(resolve, reject) => {
            if(!applicationJSON){
                reject(new Error("empty application object given"));
            }
            this.cleanupInput(applicationJSON);
            //have id load application data.
            //let applicationDBJSON = {};
            if(applicationJSON.id){
                this.updatetApplication(applicationJSON, save).then(resolve(true)).catch(function(err){
                    reject(err);
                })
            }
            else {
                 //validate


                 //setup business
                 if (!applicationJSON.business){
                     if(applicationJSON.businessInfo){
                        //load business
                        const businessModel = new BusinessModel();
                        await businessModel.newBusiness(applicationJSON.businessInfo).catch(function(err){
                            log.error("Creating new business error:" + err + __location);
                            reject(err);
                        })
                        applicationJSON.business = businessModel.id;
                        if(applicationJSON.business === 0){
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
                 if(!applicationJSON.uuid){
                   applicationJSON.uuid = uuidv4().toString();
                 }
                //$app->created_by = $user->id;
                this.#applicationORM.load(applicationJSON).catch(function(err){
                  log.error("Error loading application orm " + err);
                });
                this.#applicationORM.uuid = applicationJSON.uuid;
                //setup business

                //save
                await this.#applicationORM.save().catch(function(err){
                    reject(err);
                });
                this.updateProperty();
                log.debug(JSON.stringify(this.#applicationORM));
                this.id = this.#applicationORM.id;

                resolve(true);

                }
        });
    }


    updatetApplication(applicationJSON, save = false){
        return new Promise(async(resolve, reject) => {
            if(applicationJSON.id){
                 //validate
                //setup business


                //save
                if(save){
                    resolve(true);
                }
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

    save(asNew = false){
        return new Promise(async(resolve, reject) => {
        //validate

            resolve(true);
        });
    }

    cleanupInput(inputJSON){
        //convert to ints
        for(var i = 0; i < convertToIntFields.length; i++){
            if(inputJSON[convertToIntFields[i]]){
                try{
                    inputJSON[convertToIntFields[i]] = parseInt(inputJSON[convertToIntFields[i]], 10);
                }
                catch(e){
                    log.warn("BuinsessModel bad input JSON field: " + convertToIntFields[i] + " cannot convert to Int")
                    delete inputJSON[convertToIntFields[i]]
                }
            }
        }
    }

    updateProperty(){
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
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
        },
        "bop_expiration_date": {
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
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
        "eo_expiration_date": {
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
        },
        "experience_modifier": {
          "default": 1.00,
          "encrypted": false,
          "required": false,
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
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
        },
        "gl_expiration_date": {
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
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
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
        },
        "umb_expiration_date": {
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
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
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
        },
        "wc_expiration_date": {
          "default": "0000-00-00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
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
          "type": "string"
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
          "type": "string"
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
          "default": "0000-00-00 00:00:00",
          "encrypted": false,
          "required": false,
          "rules": null,
          "type": "string"
        }
      }


class ApplicationOrm extends DatabaseObject {

	constructor(){
		super('clw_talage_applications', properties);
	}

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