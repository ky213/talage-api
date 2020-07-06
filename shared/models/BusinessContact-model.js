'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const SearchStringModel = require('./SearchStrings-model.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const crypt = global.requireShared('./services/crypt.js');


// const util = require('util');
// const email = global.requireShared('./services/emailsvc.js');
// const slack = global.requireShared('./services/slacksvc.js');
// const formatPhone = global.requireShared('./helpers/formatPhone.js');
// const get_questions = global.requireShared('./helpers/getQuestions.js');

//const validator = global.requireShared('./helpers/validator.js');

const hashFields = ["email"];
const skipCheckRequired = false;

module.exports = class BusinessContactModel{

    #dbTableORM = null;

	constructor(){
        this.id = 0;
        this.#dbTableORM = new BusinessContactOrm();
    }


    /**
	 * Save businessContact JSON
     *
	 * @param {object} businessContactJSON - businessContact JSON
     * @param {boolean} save - Saves businessContact if true
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    saveBusinessContact(businessContactJSON){
        return new Promise(async(resolve, reject) => {
            if(!businessContactJSON){
                reject(new Error("empty businessContact object given"));
            }
            await this.cleanupInput(businessContactJSON);
            //have id load businessContact data.
            //let businessContactDBJSON = {};
            
            if(businessContactJSON.id){
                await this.#dbTableORM.getById(businessContactJSON.id).catch(function (err) {
                    log.error("Error getting businessContact from Database " + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                this.#dbTableORM.load(businessContactJSON, false);
            }
            else {
                this.#dbTableORM.load(businessContactJSON);
            }

            //save
            await this.#dbTableORM.save().catch(function(err){
                reject(err);
            });
            this.updateProperty();
            this.id = this.#dbTableORM.id;
            await this.updateSearchStrings();
            resolve(true);
            
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

    loadFromId(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(id && id >0 ){
                await this.#dbTableORM.getById(id).catch(function (err) {
                    log.error("Error getting businessContact from Database " + err + __location);
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

    DeleteBusinessContacts(businessId) {
        return new Promise(async(resolve, reject) => {
            //Remove old records.
            const sql =`DELETE FROM clw_talage_contacts
                   WHERE business = ${businessId}
            `;
            let rejected = false;
			const result = await db.query(sql).catch(function (error) {
				// Check if this was
				log.error("Database Object clw_talage_contacts DELETE error :" + error + __location);
				rejected = true;
				reject(error);
			});
			if (rejected) {
				return false;
			}
            resolve(true);
       })
    }

    updateSearchStrings(){
        return new Promise(async(resolve) => {
            //validate
            log.debug('setup search string ' + __location)
            if(hashFields && hashFields.length > 0){
                log.debug('setup search string hashfields' + __location)
                let searchStringJson = {"table" : "contacts", "item_id": this.id};
                searchStringJson.fields = [];
                for(var i=0;i < hashFields.length; i++){
                    if(this[hashFields[i]]){
                        const fieldJson = {field: hashFields[i], value: this[hashFields[i]]}
                        searchStringJson.fields.push(fieldJson)
                    }
                }
                log.debug('setup search  ' + JSON.stringify(searchStringJson));
                if(searchStringJson.fields.length > 0){
                    const searchStringModel = new SearchStringModel();
                    searchStringModel.AddStrings(searchStringJson).catch(function(err){
                        log.error(`Error creating search for ${searchStringJson.table} id ${searchStringJson.item_id} error: ` + err + __location)
                    })
                }
            }
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
        }
    }

    updateProperty(noNulls = false){
        const dbJSON = this.#dbTableORM.cleanJSON(noNulls)
        // eslint-disable-next-line guard-for-in
        for (const property in properties) {
            if(noNulls === true){
                if(dbJSON[property]){
                  this[property] = dbJSON[property];
                } else if(this[property]){
                    delete this[property];
                }
            }
            else {
                this[property] = dbJSON[property];
              }
        }
      }

    /**
	 * Load new object JSON into ORM. can be used to filter JSON to object properties
     *
	 * @param {object} inputJSON - input JSON
	 * @returns {void} 
	 */
    async loadORM(inputJSON){
        await this.#dbTableORM.load(inputJSON, skipCheckRequired);
        return true;
    }

}

const properties ={
    "id": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "state": {
      "default": "1",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "business": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "email": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "email_hash": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(40)"
    },
    "fname": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "lname": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "phone": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "primary": {
      "default": "1",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    }
  }

class BusinessContactOrm extends DatabaseObject {

	constructor(){
		super('clw_talage_contacts', properties);
	}

}