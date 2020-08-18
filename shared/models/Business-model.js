'use strict';
const DatabaseObject = require('./DatabaseObject.js');
const BusinessContactModel = require('./BusinessContact-model.js');
const BusinessAddressModel = require('./BusinessAddress-model.js');
const BusinessAddressActivityCodeModel = require('./BusinessAddressActivityCode-model.js');
const SearchStringModel = require('./SearchStrings-model.js');
const crypt = global.requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const validator = global.requireShared('./helpers/validator.js');

const hashFields = ["name", "dba"]
const skipCheckRequired = false;
const tableName = 'clw_talage_businesses';
module.exports = class BusinessBO{

   #dbTableORM = null;

	constructor(){
		this.id = 0;
        this.#dbTableORM = new BusinessOrm();
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

             //Populate Clear version of encrypted fields.
             for(var i=0;i < hashFields.length; i++){
                if(businessJSON[hashFields[i]]){
                    businessJSON[hashFields[i] + "_clear"] = businessJSON[hashFields[i]]
                }
            }

            //have id load business data.
            if(businessJSON.id){
                await this.#dbTableORM.getById(businessJSON.id).catch(function (err) {
                    log.error("Error getting business from Database " + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                this.#dbTableORM.load(businessJSON, skipCheckRequired);
            }
            else {
                this.#dbTableORM.load(businessJSON, skipCheckRequired);
            }
           

           
            //save
            await this.#dbTableORM.save().then(function(resp){
                
            }).catch(function(err){
                reject(err);
                return;
            });
            this.updateProperty();
            this.id = this.#dbTableORM['id'];
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
				//reject(error);
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
                   // reject(error);
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
                await this.#dbTableORM.getById(id).catch(function (err) {
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
    

    getById(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(id && id >0 ){
                await this.#dbTableORM.getById(id).catch(function (err) {
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



    getList(queryJSON) {
        return new Promise(async (resolve, reject) => {
           
                let rejected = false;
                // Create the update query
                let sql = `
                    select *  from ${tableName}  
                `;
                if(queryJSON){
                    let hasWhere = false;
                    if(queryJSON.name){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` name_clear like ${db.escape(queryJSON.name)} `
                        hasWhere = true;
                    }
                    if(queryJSON.name){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` dba_clear like ${db.escape(queryJSON.name)} `
                        hasWhere = true;
                    }
                }
                // Run the query
                //log.debug("PaymentPlanBO getlist sql: " + sql);
                const result = await db.query(sql).catch(function (error) {
                    // Check if this was
                    
                    rejected = true;
                    log.error(`getList ${tableName} sql: ${sql}  error ` + error + __location)
                    reject(error);
                });
                if (rejected) {
                    return;
                }
                let boList = [];
                if(result && result.length > 0 ){
                    for(let i=0; i < result.length; i++ ){
                        let businessBO = new BusinessBO();
                        await businessBO.#dbTableORM.decryptFields(result[i]);
                        await businessBO.#dbTableORM.convertJSONColumns(result[i]);
                        const resp = await businessBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`getList error loading object: ` + err + __location);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                        boList.push(businessBO);
                    }
                    resolve(boList);
                }
                else {
                    //Search so no hits ok.
                    resolve([]);
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
                    log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location)
                }
            }
        }

        // Hash email.
        if(inputJSON.ein){
            inputJSON.ein_hash = await crypt.hash(inputJSON.ein);
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
	 * Load new business JSON into ORM. can be used to filter JSON to busines properties
     *
	 * @param {object} inputJSON - business JSON
	 * @returns {void} 
	 */
    async loadORM(inputJSON){
        await this.#dbTableORM.load(inputJSON, skipCheckRequired);
        return true;
    }

    cleanJSON(noNulls = true){
		return this.#dbTableORM.cleanJSON(noNulls);
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
    "dba_clear": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(100)"
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
    "name_clear": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(100)"
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