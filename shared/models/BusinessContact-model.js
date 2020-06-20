'use strict';

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const crypt = global.requireShared('./services/crypt.js');


// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

//const validator = global.requireShared('./helpers/validator.js');

//const convertToIntFields = [];

module.exports = class BusinessContactModel{

    #businessContactORM = null;

	constructor(){
        this.id = 0;
        this.#businessContactORM = new BusinessContactOrm();
    }


    /**
	 * Load new businessContact JSON with optional save.
     *
	 * @param {object} businessContactJSON - businessContact JSON
     * @param {boolean} save - Saves businessContact if true
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    newBusinessContact(businessContactJSON, save = false){
        return new Promise(async(resolve, reject) => {
            if(!businessContactJSON){
                reject(new Error("empty businessContact object given"));
            }
            await this.cleanupInput(businessContactJSON);
            //have id load businessContact data.
            //let businessContactDBJSON = {};
            if(businessContactJSON.id){
                await this.updateBusinessContact(businessContactJSON, save).then(resolve(true)).catch(function(err){
                    reject(err);
                })
            }
            else {
                 //validate
                 this.#businessContactORM.load(businessContactJSON);
                //setup businessContact

                //save
                await this.#businessContactORM.save().catch(function(err){
                    reject(err);
                });
                this.updateProperty();
                this.id = this.#businessContactORM.id;
                resolve(true);
            }
        });
    }


    updateBusinessContact(businessContactJSON, save = false){
        return new Promise(async(resolve, reject) => {
            if(businessContactJSON.id){
                //validate
                this.cleanupInput(businessContactJSON);
                //validate
                this.#businessContactORM.load(businessContactJSON);

                //save
                await this.#businessContactORM.save().catch(function(err){
                    reject(err);
                });
                this.id = this.#businessContactORM.id;
                resolve(true);

            }
            else {
                reject(new Error("Missing Contact Id"));
            }

        });
    }

    /**
	 * saves businessContact.
     *
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */

    save(asNew = false){
        return new Promise(async(resolve, reject) => {
        //validate

            resolve(true);
        });
    }

    async cleanupInput(inputJSON){

        // cleanup phone number and email
        inputJSON.email = inputJSON.email.replace(' ', '');
        inputJSON.phone = inputJSON.phone.replace("/[^0-9]/", '');

        // Hash email.
        if(inputJSON.email){
            inputJSON.email_hash = await crypt.hash(inputJSON.email);
            log.debug('email hash: ' + inputJSON.email_hash);
        }


        // //convert to int
        // for(var i = 0; i < convertToIntFields.length; i++){
        //     if(inputJSON[convertToIntFields[i]]){
        //         try{
        //             inputJSON[convertToIntFields[i]] = parseInt(inputJSON[convertToIntFields[i]], 10);
        //         }
        //         catch(e){
        //             log.warn("BuinsessModel bad input JSON field: " + convertToIntFields[i] + " cannot convert to Int")
        //             delete inputJSON[convertToIntFields[i]]
        //         }
        //     }
        // }
    }

    updateProperty(){
        const dbJSON = this.#businessContactORM.cleanJSON()
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
    "business": {
      "default": 0,
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
    },
    "email": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "email_hash": {
      "default": "",
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "fname": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "lname": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "phone": {
      "default": "",
      "encrypted": true,
      "required": false,
      "rules": null,
      "type": "string"
    },
    "primary": {
      "default": "1",
      "encrypted": false,
      "required": false,
      "rules": null,
      "type": "number"
    }
  }

class BusinessContactOrm extends DatabaseObject {

	constructor(){
		super('clw_talage_contacts', properties);
	}

}