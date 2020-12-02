'use strict';


const DatabaseObject = require('./DatabaseObject.js');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


const tableName = 'clw_talage_insurer_policy_types'
const skipCheckRequired = false;
module.exports = class InsurerPolicyTypeBO{

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
            let rejected = false;
            if(newObjectJSON.id){
                await this.#dbTableORM.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    const errMessage = `InsurerPolicyTypeBO saveModel getById ${newObjectJSON.id} ` + err;
                    reject(errMessage);
                    rejected = true;
                    return;
                });
                if(rejected){
                    return;
                }

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
    save(){
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
                    select * from ${tableName}  
                `;
            if(queryJSON){
                let hasWhere = false;
                if(queryJSON.policy_type){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` policy_type = ${db.escape(queryJSON.policy_type)} `
                    hasWhere = true;
                }
                if(queryJSON.insurer){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` insurer = ${db.escape(queryJSON.insurer)} `
                    hasWhere = true;
                }
                if(queryJSON.wheelhouse_support){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` wheelhouse_support = ${db.escape(queryJSON.wheelhouse_support)} `
                    hasWhere = true;
                }
                if(queryJSON.api_support){
                    sql += hasWhere ? " AND " : " WHERE ";
                    sql += ` api_support = ${db.escape(queryJSON.api_support)} `
                    hasWhere = true;
                }
                if(queryJSON.distinct_insurer) {
                    sql += ` GROUP BY insurer `
                }
            }
            sql += ` order by insurer `
            // Run the query
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
                    const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
                    //await insurerPolicyTypeBO.#dbTableORM.decryptFields(result[i]);
                    //await insurerPolicyTypeBO.#dbTableORM.convertJSONColumns(result[i]);
                    const resp = await insurerPolicyTypeBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                        log.error(`getList error loading object: ` + err + __location);
                    })
                    if(!resp){
                        log.debug("Bad BO load" + __location)
                    }
                    boList.push(insurerPolicyTypeBO);
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

    deleteById(id) {
        return new Promise(async(resolve, reject) => {
            //validate
            if(id && id > 0){

                //Remove old records.
                const sql = `DELETE FROM ${tableName} 
                        WHERE id = ${id}
                `;
                let rejected = false;
                await db.query(sql).catch(function(error) {
                    // Check if this was
                    log.error(`Database Object ${tableName} DELETE  error :` + error + __location);
                    rejected = true;
                    reject(error);
                });
                if (rejected) {
                    return false;
                }
                resolve(true);

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
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(3)"
    },
    "api_support": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    },
    "wheelhouse_support": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
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
    "acord_support": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
    }
}

class DbTableOrm extends DatabaseObject {

    // eslint-disable-next-line no-shadow
    constructor(tableName){
        super(tableName, properties);
    }

}