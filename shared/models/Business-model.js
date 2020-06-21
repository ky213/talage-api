'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const BusinessContactModel = require('./BusinessContact-model.js');
const SearchStringModel = require('./SearchStrings-model.js');
const crypt = global.requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

const validator = global.requireShared('./helpers/validator.js');

const convertToIntFields = ["industry_code"]
const hashFields = ["name", "dba"]

module.exports = class BusinessModel{

  #businessORM = null;

	constructor(){
		this.id = 0;
        this.#businessORM = new BusinessOrm();
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
            await this.cleanupInput(businessJSON);
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
                this.#businessORM.load(businessJSON);
                //save
                let reject = false;
                await this.#businessORM.save().then(function(resp){
                  
                }).catch(function(err){
                    reject(err);
                    return;
                });
                this.updateProperty();
                this.id = this.#businessORM['id'];
                await this.updateSearchStrings();

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


    updateBusiness(businessJSON){
        return new Promise(async(resolve, reject) => {
            if(businessJSON.id){
                 //validate
                 this.cleanupInput(businessJSON);
                //setup business
                this.#businessORM.load(businessJSON);
                this.#businessORM.save().catch(function(err){
                    reject(err);
                });
                // TODO check contacts

                await this.updateSearchStrings();
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

    loadFromId(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(id && id >0 ){
                await this.#businessORM.getById(applicationJSON.id).catch(function (err) {
                    log.error("Error getting business from Database " + err + __location);
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

    updateSearchStrings(){
        return new Promise(async(resolve, reject) => {
            //validate
            if(hashFields && hashFields.length > 0){
                let searchStringJson = {"table" : "businesses", "item_id": this.id};
                searchStringJson.fields = [];
                for(var i=0;i < hashFields.length; i++){
                    if(this[hashFields[i]]){
                        const fieldJson = {field: hashFields[i], value: this[hashFields[i]]}
                        searchStringJson.fields.push(fieldJson)
                    }
                }
                log.debug('setup business search  ' + JSON.stringify(searchStringJson));
                if(searchStringJson.fields.length > 0){
                    const searchStringModel = new SearchStringModel();
                    await searchStringModel.AddStrings(searchStringJson).catch(function(err){
                        log.error(`Error creating search for ${searchStringJson.table} id ${searchStringJson.item_id} error: ` + err + __location)
                    })
                }
            }
            resolve(true);
        });
    }
    async cleanupInput(inputJSON){
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

        // Hash email.
        if(inputJSON.ein){
            inputJSON.ein_hash = await crypt.hash(inputJSON.ein);
        }
    }

    updateProperty(){
      const dbJSON = this.#businessORM.cleanJSON()
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