'use strict';


const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const { debug } = require('request');


const tableName = 'clw_talage_zip_codes'
const skipCheckRequired = false;
module.exports = class ZipCodeBO{

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
            newObjectJSON.state = 1;
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

    loadByZipCode(zipCode) {
        return new Promise(async (resolve, reject) => {
            if(zipCode){
                if(  typeof zipCode === 'string'){
                    zipCode = parseInt(zipCode, 10);
                }
                let rejected = false;
                // Create the update query
                const sql = `
                    select *  from clw_talage_zip_codes where zip = ${zipCode}
                `;

                // Run the query
                const result = await db.query(sql).catch(function (error) {
                    // Check if this was
                
                    rejected = true;
                    log.error(`getById ${tableName} id: ${db.escape(this.id)}  error ` + error + __location)
                    reject(error);
                });
                if (rejected) {
                    return;
                }
                let addressList = [];
                if(result && result.length > 0 ){
                        const i = 0;
                        //Decrypt encrypted fields.
                        await this.#dbTableORM.decryptFields(result[i]);
                        await this.#dbTableORM.convertJSONColumns(result[i]);
                      
                        const resp = await this.loadORM(result[i], skipCheckRequired).catch(function(err){
                            log.error(`loadByZipCode error loading object: ` + err + __location);
                            //not reject on issues from database object.
                            //reject(err);
                        })
                        if(!resp){
                            log.debug("Bad BO load" + __location)
                        }
                    resolve(this.cleanJSON());
                }
                else {
                    log.debug("not found loadByZipCode: " + sql);
                    reject(new Error("not found"));
                    return
                }
               
            }
            else {
                reject(new Error('no zipCode supplied'))
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


    
    

}

const properties = {
    "zip": {
      "default": 0,
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "number",
      "dbType": "mediumint(5) unsigned"
    },
    "type": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(8)"
    },
    "city": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(30)"
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
    "county": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "varchar(30)"
    },
    "num_tax_returns": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "mediumint(5) unsigned"
    },
    "est_population": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "mediumint(5) unsigned"
    },
    "total_wages": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(10) unsigned"
    }
  }

class DbTableOrm extends DatabaseObject {

	constructor(tableName){
		super(tableName, properties);
	}

}