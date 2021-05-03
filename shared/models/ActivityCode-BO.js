'use strict';

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const tableName = 'clw_talage_activity_codes';
const skipCheckRequired = false;
module.exports = class ActivityCodeBO{

    #dbTableORM = null;
    // allowNulls = ["parent", "parent_answer"];

    constructor(){
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
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
            let findCount = false;
            // Create the update query
            let hasWhere = false;
            let stateSet = false;
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
                    findCount = true;
                    delete queryJSON.count;
                }
                if(queryJSON.activityCodeId){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";

                    let queryIdList = queryJSON.activityCodeId;
                    if(Array.isArray(queryJSON.activityCodeId)){
                        queryIdList = queryJSON.activityCodeId.join(",");
                    }

                    sqlWhere += ` id IN (${queryIdList}) `;
                    hasWhere = true;
                }
                if(queryJSON.description){
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` description like ${db.escape(`%${queryJSON.description}%`)} `
                    hasWhere = true;
                }
                if(queryJSON.state) {
                    sqlWhere += hasWhere ? " AND " : " WHERE ";
                    sqlWhere += ` state = ${db.escape(queryJSON.state)} `;
                    stateSet = true;
                    hasWhere = true;
                }
                //GetList is used by more the ADmin.
                //This logic for the admin should be in the route code. - Brian
                const limit = queryJSON.limit ? stringFunctions.santizeNumber(queryJSON.limit, true) : null;
                const page = queryJSON.page ? stringFunctions.santizeNumber(queryJSON.page, true) : null;
                if(limit && page) {
                    sqlPaging += ` LIMIT ${db.escape(limit)} `;
                    // offset by page number * max rows, so we go that many rows
                    sqlPaging += ` OFFSET ${db.escape((page - 1) * limit)}`;
                }
            }

            if(!stateSet) {
                sqlWhere += hasWhere ? " AND " : " WHERE ";
                sqlWhere += ` state >= 0 `;
                hasWhere = true;
            }

            // reverse the list to sort by id descending by default
            const sqlOrder = " ORDER BY id DESC";

            if (findCount === false) {
                const sql = sqlSelect + sqlWhere + sqlOrder + sqlPaging;
                // Run the query
                log.debug("ActivityCodeBO getlist sql: " + sql);
                const result = await db.query(sql).catch(function(error) {
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
                        const activityCodeBO = new ActivityCodeBO();
                        await activityCodeBO.#dbTableORM.decryptFields(result[i]);
                        await activityCodeBO.#dbTableORM.convertJSONColumns(result[i]);
                        const resp = await activityCodeBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`getList error loading object: ` + err + __location);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                        boList.push(activityCodeBO);
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
        const sql = `select id, name, logo  
            from clw_talage_activity_codes
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
    "description": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(150)"
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