'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const BusinessAddressActivityCodeModel = require('./BusinessAddressActivityCode-model.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const crypt = global.requireShared('./services/crypt.js');


//const validator = global.requireShared('./helpers/validator.js');

const hashFields = ["email"];
const tableName = 'clw_talage_addresses'
const skipCheckRequired = false;
module.exports = class BusinessAddressModel{

    #dbTableORM = null;

    constructor(){
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
    }


    /**
	 * Save Model
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    saveModel(newObjectJSON){
        return new Promise(async(resolve, reject) => {
            if(!newObjectJSON){
                reject(new Error(`empty ${tableName} object given`));
            }
            await this.cleanupInput(newObjectJSON);
            if(newObjectJSON.id){
                await this.#dbTableORM.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }
            else{
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }

            //save
            await this.#dbTableORM.save().catch(function(err){
                reject(err);
            });
            this.updateProperty();
            this.id = this.#dbTableORM.id;
            //proces Activity Codes
            if(newObjectJSON.activity_codes){
                await this.processActivityCodes(newObjectJSON.activity_codes).catch(function(err){
                    log.error("process Address ActivityCodes error: " + err + __location)
                })
            }

            resolve(true);

        });
    }

    async processActivityCodes(activityCodesJSON){

        const businessAddressActivityCodeModelDelete = new BusinessAddressActivityCodeModel();
        //remove existing addresss acivity codes. we do not get ids from UI.
        await businessAddressActivityCodeModelDelete.DeleteBusinessAddressesCodes(this.id).catch(function(err){
            log.error("Error deleting activity codes " + err + __location);
        });
        for(var i = 0; i < activityCodesJSON.length; i++){
            const businessAddressActivityCodeModel = new BusinessAddressActivityCodeModel();
            const activityCodeJSON = activityCodesJSON[i];
            const addressActivityCode = {
                "address": this.id,
                "ncci_code": activityCodeJSON.id,
                "payroll": activityCodeJSON.payroll
            };
            await businessAddressActivityCodeModel.saveModel(addressActivityCode).catch(function(err){
                log.error("Error updating business address error: " + err + __location);
            })
        }


        return;
    }

    /**
	 * saves businessContact.
     *
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved object , or an Error if rejected
	 */

    save(asNew = false){
        return new Promise(async(resolve, reject) => {
        //validate

            resolve(true);
        });
    }

    loadFromId(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                await this.#dbTableORM.getById(id).catch(function(err) {
                    log.error(`Error getting  ${tableName} from Database ` + err + __location);
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

    loadFromBusinessId(businessId) {
        return new Promise(async(resolve, reject) => {
            if(businessId && businessId > 0){
                let rejected = false;
                // Create the update query
                const sql = `
                    select *  from clw_talage_addresses where business = ${businessId}
                `;

                // Run the query
                const result = await db.query(sql).catch(function(error) {
                    // Check if this was

                    rejected = true;
                    log.error(`loadFromBusinessId ${tableName} id: ${db.escape(this.id)}  error ` + error + __location)
                    reject(error);
                });
                if (rejected) {
                    return;
                }
                const addressList = [];
                if(result && result.length > 0){
                    for(let i = 0; i < result.length; i++){
                        //Decrypt encrypted fields.
                        const businessAddressModel = new BusinessAddressModel();
                        await businessAddressModel.#dbTableORM.decryptFields(result[i]);
                        await businessAddressModel.#dbTableORM.convertJSONColumns(result[i]);

                        const resp = await businessAddressModel.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`loadFromBusinessId error loading object: ` + err + __location);
                            //not reject on issues from database object.
                            //reject(err);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                        addressList.push(businessAddressModel);
                    }
                    resolve(addressList);
                }
                else {
                    //log.debug("not found loadFromBusinessId: " + sql);
                    reject(new Error("not found"));
                    return
                }

            }
            else {
                reject(new Error('no businessid supplied'))
            }
        });
    }

    async getActivityCode(){
        //santize id.
        let rejected = false;
        //what agencyportal client expects.
        const sql = `select * from clw_talage_address_activity_codes  where address = ${this.id} `

        const result = await db.query(sql).catch(function(error) {
            // Check if this was
            rejected = true;
            log.error(`clw_talage_address_activity_codes error on select ` + error + __location);
        });
        if(result && result.length > 0) {
            if (!rejected && result && result.length > 0) {
                return result;
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }

    }


    DeleteBusinessAddresses(businessId) {
        return new Promise(async(resolve, reject) => {
            //Remove old records.
            const sql = `DELETE FROM clw_talage_addresses
                   WHERE business = ${businessId}
            `;
            let rejected = false;
            const result = await db.query(sql).catch(function(error) {
                // Check if this was
                log.error(`Database Object clw_talage_addresses DELETE business ID ${businessId} error :` + error + __location);
                rejected = true;
                reject(error);
            });
            if (rejected) {
                return false;
            }
            resolve(true);
        });
    }


    async cleanupInput(inputJSON){
        for (const property in properties) {
            if(inputJSON[property]){
                // Convert to number
                try{
                    if (properties[property].type === "number" && typeof inputJSON[property] === "string"){
                        if (properties[property].dbType.indexOf("int") > -1){
                            inputJSON[property] = parseInt(inputJSON[property], 10);
                        }
                        else if (properties[property].dbType.indexOf("float") > -1){
                            inputJSON[property] = parseFloat(inputJSON[property]);
                        }
                    }
                }
                catch(e){
                    log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location)
                }
            }
        }
    }

    updateProperty(noNulls = false){
        const dbJSON = this.#dbTableORM.cleanJSON(noNulls)
        // eslint-disable-next-line guard-for-in
        for (const property in properties) {
            this[property] = dbJSON[property];
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
        this.updateProperty();
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
    "billing": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
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
    "address": {
        "default": "",
        "encrypted": true,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "blob"
    },
    "address2": {
        "default": " ",
        "encrypted": true,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "blob"
    },
    "zip": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "mediumint(5) unsigned"
    },
    "city": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(60)"
    },
    "state_abbr": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(2)"
    },
    "zipcode": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(10)"
    },
    "ein": {
        "default": " ",
        "encrypted": true,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "blob"
    },
    "ein_hash": {
        "default": " ",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(40)"
    },
    "full_time_employees": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(3) unsigned"
    },
    "part_time_employees": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(3) unsigned"
    },
    "square_footage": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "mediumint(5) unsigned"
    },
    "unemployment_num": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(8) unsigned"
    }
}

class DbTableOrm extends DatabaseObject {

    constructor(tableName){
        super(tableName, properties);
    }

}