'use strict';


const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const { debug } = require('request');


const tableName = 'clw_talage_insurers'
const skipCheckRequired = false;
module.exports = class InsurerBO{

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
    // Use SaveMessage
    saveModel(newObjectJSON){
        return new Promise(async(resolve, reject) => {
            if(!newObjectJSON){
                reject(new Error(`empty ${tableName} object given`));
            }
            await this.cleanupInput(newObjectJSON);
            if(newObjectJSON.id){
                await this.#dbTableORM.getById(newObjectJSON.id).catch(function (err) {
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
            //MongoDB


            resolve(true);

        });
    }

    /**
	 * saves this object.
     *
	 * @returns {Promise.<JSON, Error>} save return true , or an Error if rejected
	 */
    save(asNew = false){
        return new Promise(async(resolve, reject) => {
            //validate
            this.#dbTableORM.load(this, skipCheckRequired);
            await this.#dbTableORM.save().catch(function(err){
                reject(err);
            });
            resolve(true);
        });
    }

    loadFromId(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(id && id >0 ){
                await this.#dbTableORM.getById(id).catch(function (err) {
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
                        sql += ` name like ${db.escape(queryJSON.name)} `
                        hasWhere = true;
                    }
                }
                // Run the query
                //log.debug("InsurersBO getlist sql: " + sql);
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
                        let insurerBO = new InsurerBO();
                        await insurerBO.#dbTableORM.decryptFields(result[i]);
                        await insurerBO.#dbTableORM.convertJSONColumns(result[i]);
                        const resp = await insurerBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`getList error loading object: ` + err + __location);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                        boList.push(insurerBO);
                    }
                    resolve(boList);
                }
                else {
                    //Search so no hits ok.
                    resolve([]);
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

    cleanJSON(noNulls = true){
		return this.#dbTableORM.cleanJSON(noNulls);
	}

    async cleanupInput(inputJSON){
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
    }

    updateProperty(){
        const dbJSON = this.#dbTableORM.cleanJSON()
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

    
    /*****************************
     *   For administration site
     * 
     ***************************/
   
    async getSelectionList(){
        
        let rejected = false;
        let responseLandingPageJSON = {};
        let reject  = false;
        const sql = `select id, name, logo  
            from clw_talage_insurers
            where state > 0
            order by name`
        const result = await db.query(sql).catch(function (error) {
            // Check if this was
            rejected = true;
            log.error(`${tableName} error on select ` + error + __location);
        });
        if (!rejected && result && result.length >0) {
            return result;
        }
        else {
            return [];
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
    "ordering": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "int(11)"
    },
    "logo": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(100)"
    },
    "name": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(50)"
    },
    "slug": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "varchar(30)"
    },
    "commission": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "float(4,2) unsigned"
    },
    "website": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(50)"
    },
    "agency_id_label": {
      "default": "Agency ID",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(15)"
    },
    "agent_id_label": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "varchar(15)"
    },
    "agent_login": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(200)"
    },
    "claim_email": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(50)"
    },
    "claim_phone": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(14)"
    },
    "claim_website": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(60)"
    },
    "enable_agent_id": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "featured": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "payment_link": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(200)"
    },
    "payment_mailing_address": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(200)"
    },
    "payment_phone": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(15)"
    },
    "producer_code": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(15)"
    },
    "stock": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(15)"
    },
    "social_fb": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(75)"
    },
    "social_linkedin": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(75)"
    },
    "social_twitter": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(50)"
    },
    "rating": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(15)"
    },
    "description": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(500)"
    },
    "application_emails": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "username": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "password": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "test_username": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "test_password": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
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

class DbTableOrm extends DatabaseObject {

	constructor(tableName){
		super(tableName, properties);
	}

}