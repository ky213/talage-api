'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const {debug} = require('request');

const tableName = 'clw_talage_insurer_questions';
const skipCheckRequired = false;
module.exports = class InsurerQuestionBO{

    #dbTableORM = null;

    allowNulls = ["question"];

    // eslint-disable-next-line array-element-newline
    doNotSnakeCase = ['questionSubjectArea','effectiveDate','expirationDate'];

    constructor(){
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
        this.#dbTableORM.allowNulls = this.allowNulls;
        this.#dbTableORM.doNotSnakeCase = this.doNotSnakeCase;
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

    getList(queryJSON) {
        return new Promise(async(resolve, reject) => {
            let rejected = false;
            // Create the update query
            let sql = `
                    select *  from ${tableName}  
                `;
            if(queryJSON){
                let hasWhere = false;
                if(queryJSON.question){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` question = ${db.escape(queryJSON.question)} `
                    hasWhere = true;
                }
            }
            // Run the query
            log.debug("InsurerQuestionBO getlist sql: " + sql);
            const result = await db.query(sql).catch(function(error) {
                // Check if this was

                rejected = true;
                log.error(`getList ${tableName} sql: ${sql}  error ` + error + __location)
                reject(error);
            });
            if (rejected) {
                return;
            }
            const boList = [];
            if(result && result.length > 0){
                for(let i = 0; i < result.length; i++){
                    const insurerQuestionBO = new InsurerQuestionBO();
                    await insurerQuestionBO.#dbTableORM.decryptFields(result[i]);
                    await insurerQuestionBO.#dbTableORM.convertJSONColumns(result[i]);
                    const resp = await insurerQuestionBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                        log.error(`getList error loading object: ` + err + __location);
                    })
                    if(!resp){
                        log.debug("Bad BO load" + __location)
                    }
                    boList.push(insurerQuestionBO);
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
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){
                await this.#dbTableORM.getById(id).catch(function(err) {
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

    // ***************************
    //    For administration site
    //
    // *************************
    async getSelectionList(){

        let rejected = false;
        const responseLandingPageJSON = {};
        const reject = false;
        const sql = `select id, name, logo  
            from clw_talage_insurer_questions
            where state > 0
            order by name`
        const result = await db.query(sql).catch(function(error) {
            // Check if this was
            rejected = true;
            log.error(`${tableName} error on select ` + error + __location);
        });
        if (!rejected && result && result.length > 0) {
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
    "question": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "insurer": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "policy_type": {
        "default": "WC",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(3)"
    },
    "universal": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "questionSubjectArea": {
        "default": "general",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(150)"
    },
    "text": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(500)"
    },
    "identifier": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(60)"
    },
    "attributes": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(150)"
    },
    "effectiveDate": {
        "default": "1980-01-01 00:00:00",
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "datetime",
        "dbType": "datetime"
    },
    "expirationDate": {
        "default": "2100-01-01 00:00:00",
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "datetime",
        "dbType": "datetime"
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
    "modified": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "timestamp",
        "dbType": "timestamp"
    }
}

class DbTableOrm extends DatabaseObject {
    constructor(tableName){
        super(tableName, properties);
    }
}