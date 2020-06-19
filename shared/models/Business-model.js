'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const BusinessContactModel = require('./BusinessContact-model.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

const validator = global.requireShared('./helpers/validator.js');

const convertToIntFields = ["industry_code"]

module.exports = class BusinessModel{


	constructor(){
		this.id = 0;
        this.businessORM = new BusinessOrm();
    }


    /**
	 * Load new business JSON with optional save.
     *
	 * @param {object} businessJSON - business JSON
     * @param {boolean} save - Saves business if true
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved business , or an Error if rejected
	 */
    newBusiness(businessJSON, save = false){
        return new Promise(async(resolve, reject) => {
            if(!businessJSON){
                reject(new Error("empty business object given"));
            }
            this.cleanupInput(businessJSON);
            //have id load business data.
            //let businessDBJSON = {};
            if(businessJSON.id){
                this.updatetBusiness(businessJSON, save).then(resolve(true)).catch(function(err){
                    reject(err);
                })
            }
            else {
                 //validate

                 //setup business
                this.businessORM.load(businessJSON);
                //save
                await this.businessORM.save().then(function(resp){
                  log.debug("ORM response " + resp);
                }).catch(function(err){
                    reject(err);
                });
                this.id = this.businessORM['id'];

                // //Create Contact records....
                if(businessJSON.contacts && businessJSON.contacts[0]){
                    businessJSON.contacts[0].business = this.id;
                    const businessContactModel = new BusinessContactModel();
                    await businessContactModel.newBusinessContact(businessJSON.contacts[0]).catch(function(err){
                        log.error("Error creating business contact error: " + err + __location);
                    })
                }
                else {
                    log.info('No contact for Business id ' + this.id + __location)
                }
                resolve(true);
            }
        });
    }


    updatetBusiness(businessJSON, save = false){
        return new Promise(async(resolve, reject) => {
            if(businessJSON.id){
                 //validate
                 this.cleanupInput(businessJSON);
                //setup business
                this.businessORM.load(businessJSON);
                this.businessORM.save().catch(function(err){
                    reject(err);
                });
                // TODO check contacts


                resolve(true);
            }
            else {
                reject(new Error("Missing Business Id " + __location));
            }

        });
    }

    /**
	 * saves business.
     *
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved business , or an Error if rejected
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
    "affiliate": {
      "default": null,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
    },
    "agent_name": {
      "default": "",
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "association": {
      "default": null,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
    },
    "association_id": {
      "default": null,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "dba": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "ein": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "ein_hash": {
      "default": null,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "entity_type": {
      "default": "",
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "file_num": {
      "default": 0,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
    },
    "founded": {
      "default": "0000-00-00",
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "industry_code": {
      "default": 0,
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
    "mailing_address": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "mailing_address2": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "mailing_zip": {
      "default": 0,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
    },
    "name": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "ncci_number": {
      "default": 0,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
    },
    "num_owners": {
      "default": "1",
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
    },
    "owners": {
      "default": null,
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "website": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "zip": {
      "default": null,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
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

class BusinessOrm extends DatabaseObject {

	constructor(){
		super('clw_talage_businesses', properties);
	}

}