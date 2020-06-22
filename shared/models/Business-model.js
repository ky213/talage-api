'use strict';
const DatabaseObject = require('./DatabaseObject.js');
const BusinessContactModel = require('./BusinessContact-model.js');
const BusinessAddressModel = require('./BusinessAddress-model.js');
const BusinessAddressActivityCodeModel = require('./BusinessAddressActivityCode-model.js');
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
const skipCheckRequired = false;
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
    saveBusiness(businessJSON){
        return new Promise(async(resolve, reject) => {
            if(!businessJSON){
                reject(new Error("empty business object given"));
            }
            await this.cleanupInput(businessJSON);
            log.debug("businessJSON: " + JSON.stringify(businessJSON));

            //have id load business data.
            if(businessJSON.id){
                await this.#businessORM.getById(businessJSON.id).catch(function (err) {
                    log.error("Error getting business from Database " + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                this.#businessORM.load(businessJSON, skipCheckRequired);
            }
            else {
                this.#businessORM.load(businessJSON, skipCheckRequired);
            }
           
           
            //save
            await this.#businessORM.save().then(function(resp){
                
            }).catch(function(err){
                reject(err);
                return;
            });
            this.updateProperty();
            this.id = this.#businessORM['id'];
            await this.updateSearchStrings();

            // //Create Contact records....
            if(businessJSON.contacts){
                await this.processContacts(businessJSON, true).catch(function(err){
                    log.error("business contact error: " + err + __location)
                })
            }
            
            // process addresses
            if(businessJSON.locations){
                await this.processAddresses(businessJSON, true).catch(function(err){
                    log.error("business location error: " + err + __location)
                })
            }
            if(businessJSON.owner_payroll){
                //TODO Current system (PHP) has bug.  
                // no check to prevent double addition if user loops back
                await this.processOwnerPayroll(businessJSON.owner_payroll).catch(function(err){
                    log.error("business address acivity error: " + err + __location)
                })
            }
            resolve(true);
            
        });
    }

    /**
	 *  process contacts
     *
	 * @returns {void} 
	 */
    async processContacts(businessJSON, fromWF = false){
        if(businessJSON.contacts && businessJSON.contacts[0]){
            const businessContactModel = new BusinessContactModel();
            if(fromWF === true){
                //remove existing addresss. we do not get ids from UI.
                await businessContactModel.DeleteBusinessContacts( this.id).catch(function(err){

                });
            }

            for(var i = 0 ; i < businessJSON.contacts.length; i++){
                let businessContact  = businessJSON.contacts[i]
                businessContact.business = this.id;
                
                if(businessContact.id){
                    await businessContactModel.updateBusinessContact(businessContact).catch(function(err){
                        log.error("Error updating business contact error: " + err + __location);
                    })
                }
                else{
                    await businessContactModel.saveBusinessContact(businessContact).catch(function(err){
                        log.error("Error creating business contact error: " + err + __location);
                    })
                }
            }
        }
        return;

    }

    /**
	 *  process locations.
     *
	 * @returns {void} 
	 */
    async processAddresses(businessJSON, fromWF = false){
        if(businessJSON.locations && businessJSON.locations[0]){
            const businessAddressModel = new BusinessAddressModel();
            if(fromWF === true){
                //remove existing addresss. we do not get ids from UI.
                await businessAddressModel.DeleteBusinessAddresses( this.id).catch(function(err){
                    
                });
            }
            

            for(var i = 0 ; i < businessJSON.locations.length; i++){
                let businessLocation  = businessJSON.locations[i]
                businessLocation.business = this.id;
                const businessAddressModel = new BusinessAddressModel();
                
                await businessAddressModel.saveModel(businessLocation).catch(function(err){
                    log.error("Error updating business address error: " + err + __location);
                })
            }
            
        }
        return;
    }
    // TODO BUG No check for double additional (Same Issue as PHP code)
    async processOwnerPayroll(owner_payrollJSON){

        if(owner_payrollJSON){
            //Get current list of businsesaddress IDs from db
            const sql =` SELECT * FROM clw_talage_address_activity_codes
                   WHERE address in (SELECT id FROM clw_talage_addresses WHERE business = ${this.id})
                    AND ncci_code = ${owner_payrollJSON.activity_code}
            `;
            let rejected = false;
			const result = await db.query(sql).catch(function (error) {
				// Check if this was
				log.error("Database Object clw_talage_address_activity_codes select error :" + error + __location);
				rejected = true;
				reject(error);
			});
			if (rejected) {
				return false;
            }
            // update result set
            for(var i = 0 ; i < result.length; i++){
                // check for same activity_code
                const addressActvityRow = result[i];
                const newPayroll = addressActvityRow.payroll + owner_payrollJSON.payroll;
                //FK issue ORM save causes problem.
                const sqlUpdate = `
                UPDATE 
                    clw_talage_address_activity_codes
                SET
                    payroll = ${newPayroll}
                WHERE
                    id = ${addressActvityRow.id}
                LIMIT 1;
                `;
                const result2 = await db.query(sqlUpdate).catch(function (error) {
                    // Check if this was
                    log.error("Database Object clw_talage_address_activity_codes update error :" + error + __location);
                    rejected = true;
                    reject(error);
                });
            }
        }
        return;
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
                await this.#businessORM.getById(id).catch(function (err) {
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
        //owners
        if(inputJSON.ownersJSON){
            inputJSON.owners = JSON.stringify(inputJSON.ownersJSON);
        }
        //convert to ints
        for (const property in properties) {
            if(inputJSON[property]){
                // Convert to number
                try{
                    if (properties[property].type === "number" && "string " === typeof inputJSON[property]){
                        if (properties[property].dbType.indexOf("int")  > -1){
                            inputJSON[property] = parseInt(inputJSON[property], 10);
                        }
                        else if (properties[property].dbType.indexOf("float")  > -1){
                            inputJSON[property] = parseFloat(inputJSON[property]);
                        }
                    }
                }
                catch(e){
                    log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location)
                    inputJSON[convertToIntFields[i]]
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
    "affiliate": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "agent_name": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(100)"
    },
    "association": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "association_id": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "varchar(20)"
    },
    "dba": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "ein": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "ein_hash": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "varchar(40)"
    },
    "entity_type": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(40)"
    },
    "file_num": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "mediumint(7) unsigned"
    },
    "founded": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "date",
      "dbType": "date"
    },
    "industry_code": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "landing_page": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "mailing_address": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "mailing_address2": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "mailing_zip": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "mediumint(5) unsigned"
    },
    "name": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "ncci_number": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "num_owners": {
      "default": "1",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(2) unsigned"
    },
    "owners": {
      "default": null,
      "encrypted": true,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "website": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "zip": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "mediumint(5) unsigned"
    },
    "created": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "timestamp",
      "dbType": "timestamp"
    },
    "created_by": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "modified": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "timestamp",
      "dbType": "timestamp"
    },
    "modified_by": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "deleted": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "timestamp",
      "dbType": "timestamp"
    },
    "deleted_by": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "checked_out": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "int(11)"
    },
    "checked_out_time": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "datetime",
      "dbType": "datetime"
    }
}

class BusinessOrm extends DatabaseObject {

	constructor(){
		super('clw_talage_businesses', properties);
	}

}