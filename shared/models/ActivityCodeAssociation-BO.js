'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const { debug } = require('request');

const tableName = 'clw_talage_activity_code_associations'
const skipCheckRequired = false;
module.exports = class ActivityCodeAssociationBO{
    // doNotSnakeCase = ['industryCodeId', 'activityCodeId'];
    #dbTableORM = null;

    // allowNulls = ["default"];

	constructor(){
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
        // this.#dbTableORM.doNotSnakeCase = this.doNotSnakeCase;
        // this.#dbTableORM.allowNulls = this.allowNulls;
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
                    select * from ${tableName}  
                `;
                let hasWhere = false;
                if(queryJSON){
                    
                    if(queryJSON.state){
                        // TODO: allow search on state
                    }
                }
                sql += hasWhere ? " AND " : " WHERE ";
                sql += ` state > 0 `
                hasWhere = true;
                // Run the query
                log.debug("ActivityCodeAssociationBO getlist sql: " + sql);
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
                        let activityCodeAssociationBO = new ActivityCodeAssociationBO();
                        await activityCodeAssociationBO.#dbTableORM.decryptFields(result[i]);
                        await activityCodeAssociationBO.#dbTableORM.convertJSONColumns(result[i]);
                        const resp = await activityCodeAssociationBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`getList error loading object: ` + err + __location);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                        boList.push(activityCodeAssociationBO);
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

    delete(ncciCodeId, activityCodeId) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(ncciCodeId > 0 && activityCodeId > 0){
                //Remove old records.
                // TODO: no state on this table?
                const sql =`DELETE FROM ${tableName} 
                        WHERE insurer_code = ${db.escape(ncciCodeId)}
                        AND code = ${db.escape(activityCodeId)}
                `;
                let rejected = false;
                const result = await db.query(sql).catch(function (error) {
                    // Check if this was
                    log.error(`Database Object ${tableName} UPDATE State error :` + error + __location);
                    rejected = true;
                    reject(error);
                });
                if (rejected) {
                    return false;
                }
                resolve(true);
            }
            else {
                reject(new Error('no ncciCodeId and activityCodeId supplied'))
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
            from clw_talage_activity_code_associations
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
    "code": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "insurer_code": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    }
}

class DbTableOrm extends DatabaseObject {
	constructor(tableName){
		super(tableName, properties);
	}
}