'use strict';

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const crypt = global.requireShared('./services/crypt.js');


const tableName = 'clw_talage_agency_portal_users'
const skipCheckRequired = false;
const passwordProperty = "password";

const propToNotReturn =['password','email_hash']
module.exports = class AgencyPortalUserBO{

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
            if(newObjectJSON.email){
                newObjectJSON.email_hash = await crypt.hash(newObjectJSON.email);
            }
            await this.cleanupInput(newObjectJSON);
            //password hashing is do not outside Savemodel
            // do to needing to knowledge the workflow causing the save.
            // user created save password process by Account PUT for AgencyPortal
            //admin/agency-user for administration. 
           


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


            resolve(true);

        });
    }

    /**
	 * saves businessContact.
     *
	 * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
	 */

    save(asNew = false){
        return new Promise(async(resolve, reject) => {
        //validate

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
                    if(queryJSON.state){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` state = ${db.escape(queryJSON.state)} `
                        hasWhere = true;
                    } else {
                        sql += 'where state > 0';
                        hasWhere = true;
                    }
                    if(queryJSON.agencynetworkid){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` agency_network = ${db.escape(queryJSON.agencynetworkid)} `
                        hasWhere = true;
                    }
                    if(queryJSON.agencyid){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` agency = ${db.escape(queryJSON.agencyid)} `
                        hasWhere = true;
                    }
                    if(queryJSON.agencylocationid){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` agency_location = ${db.escape(queryJSON.agencylocationid)} `
                        hasWhere = true;
                    }
                    if(queryJSON.cansign){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` can_sign = ${db.escape(queryJSON.cansign)} `
                        hasWhere = true;
                    }
                    if(queryJSON.group){
                        sql += hasWhere ? " AND " : " WHERE ";
                        sql += ` can_sign = ${db.escape(queryJSON.group)} `
                        hasWhere = true;
                    }
                }
                else {
                    sql += 'where state > 0';
                }
                // Run the query
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
                        let agencyPortalUserBO = new AgencyPortalUserBO();
                        await agencyPortalUserBO.#dbTableORM.decryptFields(result[i]);
                        await agencyPortalUserBO.#dbTableORM.convertJSONColumns(result[i]);
                        const resp = await agencyPortalUserBO.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`getList error loading object: ` + err + __location);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                        let cleanJSON = agencyPortalUserBO.#dbTableORM.cleanJSON();
                        this.cleanOuput(cleanJSON)
                        boList.push(this.cleanOuput(cleanJSON));
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
                let cleanJSON = this.#dbTableORM.cleanJSON();
                this.cleanOuput(cleanJSON)
                resolve(cleanJSON);
            }
            else {
                reject(new Error('no id supplied'))
            }
        });
    }

    deleteSoftById(id) {
        return new Promise(async (resolve, reject) => {
            //validate
            if(id && id >0 ){
              
                //Remove old records.
                const sql =`Update ${tableName} 
                        SET state = -2
                        WHERE id = ${id}
                `;
                let rejected = false;
                const result = await db.query(sql).catch(function (error) {
                    // Check if this was
                    log.error("Database Object ${tableName} UPDATE State error :" + error + __location);
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
    cleanJSON(noNulls = true){
		return this.#dbTableORM.cleanJSON(noNulls);
    }
    
    cleanOuput(outputJSON){
        for(let i = 0 ; i < propToNotReturn.length; i++){
            if(outputJSON[propToNotReturn[i]]){
                delete outputJSON[propToNotReturn[i]]
            }
        }
        return outputJSON;
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
    "state": {
      "default": "1",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "agency": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "agency_location": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "agency_network": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "can_sign": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1) unsigned"
    },
    "email": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "email_hash": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(40)"
    },
    "group": {
      "default": "5",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "password": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(97)"
    },
    "require_reset": {
      "default": "1",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "last_login": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "timestamp",
      "dbType": "timestamp"
    },
    "reset_required": {
      "default": "1",
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "tinyint(1)"
    },
    "timezone": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "timezone_name": {
        "default": null,
        "encrypted": false,
        "hashed": false,
        "required": false,
        "rules": null,
        "type": "string",
        "dbType": "varchar(100)"
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