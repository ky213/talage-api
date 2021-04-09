'use strict';

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


const tableName = 'clw_talage_insurer_industry_codes'
const skipCheckRequired = false;
module.exports = class InsurerIndustryCodeBO{

    #dbTableORM = null;

    doNotSnakeCase = ['effectiveDate','expirationDate'];

    constructor(){
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
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
            const sqlSelect = `
                SELECT * FROM ${tableName}  
            `;
            const sqlCount = `
                SELECT count(*) FROM ${tableName}  
            `;
            let sqlWhere = "";
            let sqlLimit = "";
            if(queryJSON){
                let hasWhere = false;
                if(queryJSON.description){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` description like ${db.escape(`%${queryJSON.description}%`)} `;
                    hasWhere = true;
                }
                if(queryJSON.territory && !queryJSON.mergeTerritories){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` territory like ${db.escape(`%${queryJSON.territory}%`)} `;
                    hasWhere = true;
                }
                if(queryJSON.type){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` type = ${db.escape(`${queryJSON.type}`)} `;
                    hasWhere = true;
                }
                if(queryJSON.code){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` code like ${db.escape(`%${queryJSON.code}%`)} `;
                    hasWhere = true;
                }
                if(queryJSON.insurers) {
                    // if its a string turn it into an array
                    const insurers = typeof queryJSON.insurers === "string" ? queryJSON.insurers.split(",") : queryJSON.insurers;
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` insurer IN (${db.escape(insurers)}) `;
                    hasWhere = true;
                }

                // set a hard limit of 5000
                let queryLimit = 5000;
                if (queryJSON.limit) {
                    let desiredLimit = queryLimit;
                    try{
                        desiredLimit = parseInt(stringFunctions.santizeNumber(queryJSON.limit, true), 10);
                    }
                    catch {
                        log.error(`Error parsing limit:  ${queryJSON.limit}` + __location);
                    }

                    if (desiredLimit < queryLimit) {
                        queryLimit = desiredLimit;
                    }
                }
                sqlLimit += ` LIMIT ${db.escape(queryLimit)} `;

                // if page is not provided, do not offset
                const page = queryJSON.page ? stringFunctions.santizeNumber(queryJSON.page, true) : null;
                if(page) {
                    // offset by page number * max rows, so we go that many rows
                    sqlLimit += ` OFFSET ${db.escape((page - 1) * queryLimit)}`;
                }
            }
            // Run the query
            const count = await db.query(sqlCount + sqlWhere).catch(function(error) {
                rejected = true;
                log.error(`getList ${tableName} sql: ${sqlCount + sqlWhere}  error ` + error + __location)
                reject(error);
            });
            const result = await db.query(sqlSelect + sqlWhere + sqlLimit).catch(function(error) {
                rejected = true;
                log.error(`getList ${tableName} sql: ${sqlSelect + sqlWhere + sqlLimit}  error ` + error + __location)
                reject(error);
            });
            if (rejected) {
                return;
            }
            const boList = [];
            if(result && result.length > 0){
                for(let i = 0; i < result.length; i++){
                    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();
                    await insurerIndustryCodeBO.#dbTableORM.decryptFields(result[i]);
                    await insurerIndustryCodeBO.#dbTableORM.convertJSONColumns(result[i]);
                    const resp = await insurerIndustryCodeBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                        log.error(`getList error loading object: ` + err + __location);
                    })
                    if(!resp){
                        log.debug("Bad BO load" + __location)
                    }
                    boList.push(insurerIndustryCodeBO);
                }
                resolve({
                    data: boList,
                    count: count[0] ? count[0]["count(*)"] : 0
                });
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
    "territory": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(2)"
    },
    "type": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "char(1)"
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
    "code": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "number",
        "dbType": "mediumint(6) unsigned"
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
    "attributes": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
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
    }
}


class DbTableOrm extends DatabaseObject {

    constructor(tableName){
        super(tableName, properties);
    }

}