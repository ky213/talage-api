'use strict';

const DatabaseObject = require('./DatabaseObject.js');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const tableName = 'clw_talage_insurer_ncci_codes';
const skipCheckRequired = false;
module.exports = class InsurerNcciCodeBO{

    #dbTableORM = null;
    // allowNulls = ["parent", "parent_answer"];

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
             let hasWhere = false;
             let sql = `SELECT * FROM ${tableName} `;

             if(queryJSON){

                 if(queryJSON.activityCode) {
                     // map from the mapping table
                     sql += hasWhere ? " AND " : " WHERE ";
                     sql += ` id IN (SELECT insurer_code 
                                        FROM clw_talage_activity_code_associations 
                                        WHERE code = ${db.escape(queryJSON.activityCode)}) `;
                     hasWhere = true;
                 }
                 if(queryJSON.activityCodeNotLinked) {
                     // map from the mapping table
                     sql += hasWhere ? " AND " : " WHERE ";
                     sql += ` id NOT IN (SELECT insurer_code 
                                        FROM clw_talage_activity_code_associations 
                                        WHERE code = ${db.escape(queryJSON.activityCodeNotLinked)}) `;
                     hasWhere = true;
                 }
                 if(queryJSON.insurers) {
                     sql += hasWhere ? " AND " : " WHERE ";
                     sql += ` insurer IN (${db.escape(queryJSON.insurers)}) `;
                     hasWhere = true;
                 }
                 if(queryJSON.territory) {
                     sql += hasWhere ? " AND " : " WHERE ";
                     sql += ` territory LIKE '%${queryJSON.territory}%' `;
                     hasWhere = true;
                 }
                 if(queryJSON.code) {
                     sql += hasWhere ? " AND " : " WHERE ";
                     sql += ` code LIKE '%${queryJSON.code}%' `;
                     hasWhere = true;
                 }
                 if(queryJSON.description) {
                     sql += hasWhere ? " AND " : " WHERE ";
                     sql += ` description LIKE '%${queryJSON.description}%' `;
                     hasWhere = true;
                 }
                 if(queryJSON.state) {
                     sql += hasWhere ? " AND " : " WHERE ";
                     sql += ` state = ${db.escape(queryJSON.state)} `;
                 }
                 else {
                     sql += hasWhere ? " AND " : " WHERE ";
                     sql += ` state > 0 `
                 }
                 hasWhere = true;

                 const limit = queryJSON.limit ? stringFunctions.santizeNumber(queryJSON.limit, true) : 5000;
                 const page = queryJSON.page ? stringFunctions.santizeNumber(queryJSON.page, true) : 1;
                 if(limit && page) {
                     sql += ` LIMIT ${db.escape(limit)} `;
                     // offset by page number * max rows, so we go that many rows
                     sql += ` OFFSET ${db.escape((page - 1) * limit)}`;
                 }
             }


             // Run the query
             log.debug("InsurerNcciCodeBO getlist sql: " + sql);
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
                     const insurerNcciCodeBO = new InsurerNcciCodeBO();
                     await insurerNcciCodeBO.#dbTableORM.decryptFields(result[i]);
                     await insurerNcciCodeBO.#dbTableORM.convertJSONColumns(result[i]);
                     const resp = await insurerNcciCodeBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                         log.error(`getList error loading object: ` + err + __location);
                     })
                     if(!resp){
                         log.debug("Bad BO load" + __location)
                     }
                     boList.push(insurerNcciCodeBO);
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
            from clw_talage_insurer_ncci_codes
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
    "insurer": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "int(11) unsigned"
    },
    "territory": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "char(2)"
    },
    "code": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(4)"
    },
    "sub": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(2)"
    },
    "description": {
        "default": "",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(255)"
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
    "result": {
        "default": "2",
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "number",
        "dbType": "tinyint(1)"
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
    }
}

class DbTableOrm extends DatabaseObject {
    constructor(tableName){
        super(tableName, properties);
    }
}