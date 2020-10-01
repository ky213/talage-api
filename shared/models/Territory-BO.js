'use strict';


const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const { debug } = require('request');
const { query } = require('winston');


const tableName = 'clw_talage_territories'
const skipCheckRequired = false;
const doNotUpdateColumns = ['id','uuid','created', 'created_by', 'modified', 'deleted'];

module.exports = class TerritoryBO{

    #dbTableORM = null;

	constructor(){
        this.#dbTableORM = new DbTableOrm(tableName);
    }


    /**
	 * Save Model 
     *
	 * @param {object} newObjectJSON - newObjectJSON JSON
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */
    // Use SaveMessage
    saveModel(newObjectJSON ,isNew = false){
        return new Promise(async(resolve, reject) => {
            if(!newObjectJSON){
                reject(new Error(`empty ${tableName} object given`));
            }
            await this.cleanupInput(newObjectJSON);
            if(isNew === false){
                await this.loadByAbbr(newObjectJSON.abbr).catch(function (err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                //this.updateProperty();
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
                this.updateProperty();
                if(newObjectJSON.licensed === 0 ){
                    log.debug("set zero")
                    this.#dbTableORM.licensed = 0;
                    this.licensed = 0;
                }
            }
            else{
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }

            //save
            if(isNew){
                await this.#dbTableORM.save().catch(function(err){
                    reject(err);
                });
                this.updateProperty();
            }
            else {
                //no id column DbTableOrm will not work
                // use update in this class:
               // this.updateProperty();
                log.debug("update territory: " + JSON.stringify(this))
                await this.update().catch(function(err){
                    reject(err);
                });
            }
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

    loadByAbbr(abbr) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(abbr ){
                let rejected = false;
                let sql = `
                    select *  from ${tableName} where abbr = ${db.escape(abbr)}
                `;

                const result = await db.query(sql).catch(function (error) {
                    // Check if this was
                
                    rejected = true;
                    log.error(`loadByAbbr ${tableName} sql: ${sql}  error ` + error + __location)
                    reject(error);
                });
                if (rejected) {
                    return;
                }
                if(result && result.length > 0 ){
                    const i = 0;
                    const resp = await this.loadORM(result[i], skipCheckRequired).catch(function(err){
                        log.error(`loadByAbbr error loading object: ` + err + __location);
                        //not reject on issues from database object.
                        //reject(err);
                    })
                    if(!resp){
                        log.debug("Bad BO load" + __location)
                        reject(new Error('internal error'))
                    }
                    else {
                        resolve(true);
                    }    
                }
                else {
                    resolve(false);
                }

            }
            else {
                reject(new Error('no abbr supplied'))
            }
        });
    }

    getByAbbr(abbr) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(abbr ){
                let rejected = false;
                let sql = `
                    select *  from ${tableName} where abbr = ${db.escape(abbr)}
                `;

                const result = await db.query(sql).catch(function (error) {
                    // Check if this was
                
                    rejected = true;
                    log.error(`getByAbbr ${tableName} sql: ${sql}  error ` + error + __location)
                    reject(error);
                });
                if (rejected) {
                    return;
                }
                if(result && result.length > 0 ){
                    const i = 0;
                    let territoryBO = new TerritoryBO();
                    const resp = await territoryBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                        log.error(`getByAbbr error loading object: ` + err + __location);
                        //not reject on issues from database object.
                        //reject(err);
                    })
                    if(!resp){
                        log.debug("Bad BO load" + __location)
                        reject(new Error('internal error'))
                    }
                    else {
                        if(result[i].licensed === 0){
                            territoryBO.licensed = 0;
                        }
                        resolve(territoryBO);
                    }    
                }
                else {
                    resolve(null);
                }
                
            }
            else {
                reject(new Error('no abbr supplied'))
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
                    if(queryJSON.abbr){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` abbr = ${db.escape(queryJSON.abbr)} `
                        hasWhere = true;
                    }
                    if(queryJSON.name){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` name like ${db.escape(queryJSON.name)} `
                        hasWhere = true;
                    }
                    if(queryJSON.searchbegindate  ){
                        let searchDate = moment(queryJSON.searchbegindate);
                        if(searchDate.isValid()){
                            const searchDateDbString = searchDate.format(db.dbTimeFormat());
                            sql += hasWhere ? " AND " : " WHERE ";
                            sql += ` talage_license_expiration_date >= '${searchDateDbString}' OR individual_license_expiration_date >= '${searchDateDbString}' `
                            hasWhere = true;
                        }
                    }

                    if(queryJSON.searchenddate  ){
                        let searchDate = moment(queryJSON.searchenddate);
                        if(searchDate.isValid()){
                            const searchDateDbString = searchDate.format(db.dbTimeFormat());
                            sql += hasWhere ? " AND " : " WHERE ";
                            sql += ` ( talage_license_expiration_date <= '${searchDateDbString}' OR  individual_license_expiration_date <= '${searchDateDbString}') `
                            hasWhere = true;
                        }
                    }
                }
                // Run the query
                //log.debug("Territory getlist sql: " + sql);
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
                        let territoryBO = new TerritoryBO();
                        const resp = await territoryBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`getList error loading object: ` + err + __location);
                            //not reject on issues from database object.
                            //reject(err);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                        boList.push(territoryBO);
                    }
                    resolve(boList);
                }
                else {
                    //Search so no hits ok.
                    resolve([]);
                    // log.debug("not found getList: " + sql);
                    // reject(new Error("not found"));
                    // return
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
    /**********************************************
     * 
     *  no id column update
     */
    /*
    /**
	 * Update an existing database object
	 *
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	update() {
		return new Promise(async (fulfill, reject) => {
			let rejected = false;
            log.debug("this update " + JSON.stringify(this))
			// Build the update statements by looping over properties
            const setStatements = [];
            log.debug("this.properties: " + JSON.stringify(this.#dbTableORM.properties))
			for (const property in properties) {
                if(doNotUpdateColumns.includes(property)){
                    continue;
                }
				// Localize the data value
                //let value = this.#dbTableORM[property];
                let value = this[property];
				if(this[property] || this[property] == '' || this[property] === 0 ){
					if(properties[property].type === "timestamp" || properties[property].type === "date" || properties[property].type === "datetime"){
						value = this.#dbTableORM.dbDateTimeString(value);
                    }
                    if(properties[property].type === "json"){
						value = JSON.stringify(value);
					}
                    if(value || value === '' || value === 0){
                        // Write the set statement for this value
					    setStatements.push(`\`${property.toSnakeCase()}\` = ${db.escape(value)}`);
                    }
					
				}
			}

			// Create the update query
			const sql = `
				UPDATE
					\`${tableName}\`
				SET
					${setStatements.join(',')}
				WHERE
					abbr = ${db.escape(this.abbr)}
				LIMIT 1;
			`;
            // Run the query
            // usable in catch
			const result = await db.query(sql).catch(function (error) {
				// Check if this was
				if (error.errno === 1062) {
                    rejected = true;
                    log.error(`${tableName} Duplicate index error on update ` + error + __location);
                    reject(new Error('Duplicate index error'));
					//reject(new Error('The link (slug) you selected is already taken. Please choose another one.'));
					return;
				}
                rejected = true;
                log.error(`${tableName} error on update ` + error + __location);
				reject(new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
			});
			if (rejected) {
				return;
			}

			// Make sure the query was successful
			if (result.affectedRows !== 1) {
				log.error(`Update failed. Query ran successfully; however, an unexpected number of records were affected. (${result.affectedRows} records)`);
				reject(new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
				return;
			}
            log.info(`updated record ${tableName} abbr:  ` + this.abbr);
			fulfill(true);
        });
    }

    async fliptoStateName(stateAbbrArray, commaDelimitedString = false ){
        
        if(stateAbbrArray){
            let rejected  = false;
         
            const parmList = [stateAbbrArray];
            const sql = `SELECT
                t.name
            FROM clw_talage_territories as t as lt
            WHERE t.abbr in  (?)
            ORDER BY t.name ASC;`

            const result = await db.queryParam(sql,parmList).catch(function (error) {
                // Check if this was
                rejected = true;
                log.error(`${tableName} error on select ` + error + __location);
            });
            if(result && result.length>0) {
                if (!rejected && result && result.length >0) {
                    let territoryList = []
                    for(let i=0; i< result.length; i++ ){
                        territoryList.push(result[i].name);
                    }
                    if(commaDelimitedString === true ){
                        return territoryList.join(',');
                    }
                    else {
                        return territoryList;
                    }
                    
                }
                else {
                    return null;
                }
            }
            else {
                return null;
            }
        }
        else {
            throw new Error("No stateAbbrArray");
        }
    }

}

const properties = {
    "abbr": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "char(2)"
    },
    "name": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(24)"
    },
    "licensed": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "resource": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(100)"
    },
    "individual_license_expiration_date": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "date",
      "dbType": "date"
    },
    "individual_license_number": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "varchar(15)"
    },
    "talage_license_expiration_date": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "date",
      "dbType": "date"
    },
    "talage_license_number": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "varchar(15)"
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