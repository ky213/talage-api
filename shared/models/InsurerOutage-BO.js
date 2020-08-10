'use strict';


const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const { debug } = require('request');


const tableName = 'clw_talage_outages'
const skipCheckRequired = false;
module.exports = class InsurerOutageBO{

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
        return true;
    }

    async saveBoth(){
      
        //************************** */
        //   MYSQL Write 
        //************************** */

        // // Convert sent to Pacific timezone for mysql;
        // const sentPST = sentDtm.tz('America/Los_Angeles').format('YYYY-MM-DD HH:mm:ss');
        // log.debug("sentPST: " + sentPST);
        // columns.sent = sentPST;
        // const insertQuery = `INSERT INTO ${tableName} (${Object.keys(columns).join(',')}) VALUES (${Object.values(columns).
        //     map(function(val) {
        //         return db.escape(val);
        //     }).
        //     join(',')})`;
        // let messagesId = null;
        // await db.
        //     query(insertQuery).
        //     then(function(results) {
        //         messagesId = results.insertId;
        //     }).
        //     catch(function(err) {
        //         log.error('Unable to record email message in the database' + err + ' sql: ' + insertQuery + __location);
        //         throw err;
        //     });
        
         //************************** */
        //   MongoDB Write 
        // //************************** */
        // if(global.settings.USE_MONGO === "YES"){
        //     var Message = require('mongoose').model('Message');
        //     var message = new Message(mongoMessageDoc);

        //     //Insert a doc
        //     await message.save().catch(function(err){
        //         log.error('Mongo Message Save err ' + err + __location);
        //         //log.debug("message " + JSON.stringify(message.toJSON()));
        //     });
           
        // }

        return true;
    }
    /*****************************
     *   For administration site
     * 
     ***************************/
    getListForAdmin(queryJSON){
        return new Promise(async (resolve, reject) => {
            let sql = `
				SELECT io.id, i.id as insurerId, i.name as insurerName, io.start, io.end
				FROM clw_talage_outages AS io 
					 LEFT JOIN clw_talage_insurers AS i ON i.id = io.insurer
			`;
            let hasWhere = false;
            if(queryJSON.insurerid){
                sql +=  ` WHERE io.insurer = ${db.escape(parseInt(queryJSON.insurerid, 10))} `;
                hasWhere = true;

            }
            if(queryJSON.searchdate){
                sql += hasWhere ? " AND " : " WHERE ";
                sql +=  ` ('${moment(queryJSON.searchdate).tz('America/Los_Angeles').format('YYYY/MM/DD HH:mm:ss')}' BETWEEN io.start AND io.end)`;
            }
            sql += " Order by io.start desc"

            log.debug('Outage list sql: ' + sql);
            const rows = await db.query(sql).catch(function (err) {
                log.error(`Error getting  ${tableName} from Database ` + err + __location);
                reject(err);
                return;
            });
            //fix date to be UTC for front end.
            if(rows.length > 0 ){
                for(let i=0; i <rows.length;i++ ){
                    const dbSent = moment(rows[i].start);
                    const dbSentString = dbSent.utc().format('YYYY-MM-DD HH:mm:ss');
                    rows[i].start = moment.tz(dbSentString, "America/Los_Angeles").utc();

                    const dbSent2 = moment(rows[i].end);
                    const dbSentString2 = dbSent2.utc().format('YYYY-MM-DD HH:mm:ss');
                    rows[i].end = moment.tz(dbSentString2, "America/Los_Angeles").utc();
                    
                }
            }
            resolve(rows);
           
        });
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
      "required": false,
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
    "start": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "datetime",
      "dbType": "datetime"
    },
    "end": {
      "default": null,
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