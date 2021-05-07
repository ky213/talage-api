'use strict';


const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const {debug} = require('request');


const tableName = 'clw_talage_industry_codes'
const skipCheckRequired = false;
module.exports = class IndustryCodeBO{

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
            //log.debug(`Industrycode Get List ${JSON.stringify(queryJSON)} ` + __location)
            let rejected = false;
            let findCount = false;
            // Create the update query
            const sqlSelect = `
                SELECT * FROM ${tableName}  
            `;
            const sqlCount = `
                SELECT count(*) FROM ${tableName}  
            `;
            let sqlWhere = "";
            let sqlPaging = "";
            if(queryJSON){
                if (queryJSON.count) {
                    if(queryJSON.count === 1 || queryJSON.count === true || queryJSON.count === "1" || queryJSON.count === "true"){
                        findCount = true;
                    }
                    delete queryJSON.count;
                }
                let hasWhere = false;
                if(queryJSON.industryCodeId){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";

                    let queryIdList = queryJSON.industryCodeId;
                    if(Array.isArray(queryJSON.industryCodeId)){
                        queryIdList = queryJSON.industryCodeId.join(",");
                    }
                    sqlWhere += ` id IN (${queryIdList}) `;
                }
                if(queryJSON.activityCode) {
                    // map from the mapping table
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` id IN (SELECT industryCodeId 
                                        FROM clw_talage_industry_code_associations 
                                        WHERE activityCodeId = ${db.escape(queryJSON.activityCode)}) `;
                    hasWhere = true;
                }
                if(queryJSON.description){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` description like ${db.escape(`%${queryJSON.description}%`)} `
                    hasWhere = true;
                }
                if(queryJSON.cgl){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` cgl like ${db.escape(`%${queryJSON.cgl}%`)} `
                    hasWhere = true;
                }
                if(queryJSON.sic){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` sic like ${db.escape(`%${queryJSON.sic}%`)} `
                    hasWhere = true;
                }
                if(queryJSON.naics){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` naics like ${db.escape(`%${queryJSON.naics}%`)} `
                    hasWhere = true;
                }
                if(queryJSON.iso){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` iso like ${db.escape(`%${queryJSON.iso}%`)} `
                    hasWhere = true;
                }
                if(queryJSON.hiscox){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` hiscox like ${db.escape(`%${queryJSON.hiscox}%`)} `
                    hasWhere = true;
                }
                //GetList is used by more than just the Admin.
                //This logic for the admin should be in the route code. - Brian
                const limit = queryJSON.limit ? stringFunctions.santizeNumber(queryJSON.limit, true) : null;
                const page = queryJSON.page ? stringFunctions.santizeNumber(queryJSON.page, true) : null;
                if(limit && page) {
                    sqlPaging += ` LIMIT ${db.escape(limit)} `;
                    // offset by page number * max rows, so we go that many rows
                    sqlPaging += ` OFFSET ${db.escape((page - 1) * limit)}`;
                }
            }

            if (findCount === false) {
                // Run the query
                //log.debug("IndustryCodeBO getlist sql: " + sqlSelect + sqlWhere);
                // Run the query
                const result = await db.query(sqlSelect + sqlWhere + sqlPaging).catch(function(error) {
                    rejected = true;
                    log.error(`getList ${tableName} sql: ${sqlSelect + sqlWhere + sqlPaging}  error ` + error + __location)
                    reject(error);
                });

                if (rejected) {
                    return;
                }
                const boList = [];
                if(result && result.length > 0){
                    for(let i = 0; i < result.length; i++){
                        const industryCodeBO = new IndustryCodeBO();
                        await industryCodeBO.#dbTableORM.decryptFields(result[i]);
                        await industryCodeBO.#dbTableORM.convertJSONColumns(result[i]);
                        const resp = await industryCodeBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`getList error loading object: ` + err + __location);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                        boList.push(industryCodeBO);
                    }
                }
                resolve(boList);
            }
            else{
                const count = await db.query(sqlCount + sqlWhere).catch(function(error) {
                    rejected = true;
                    log.error(`getList ${tableName} sql: ${sqlCount + sqlWhere}  error ` + error + __location)
                    reject(error);
                });
                if (rejected) {
                    return;
                }
                // return the sql count
                resolve({count: count[0] ? count[0]["count(*)"] : 0});
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
                resolve(this.#dbTableORM.cleanJSON());
            }
            else {
                reject(new Error('no id supplied ' + id))
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
            from clw_talage_industry_codes
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
    "state": {
        "default": "1",
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
    "category": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "description": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(100)"
    },
    "cgl": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "mediumint(5) unsigned"
    },
    "sic": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "smallint(4) unsigned"
    },
    "naics": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "mediumint(6) unsigned"
    },
    "iso": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "int(10) unsigned"
    },
    "hiscox": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(3)"
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
        "dbType": "int(11) unsigned"
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