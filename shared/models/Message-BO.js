'use strict';


const DatabaseObject = require('./DatabaseObject.js');
const crypt = requireShared('./services/crypt.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const moment = require('moment');



const tableName = 'clw_talage_messages'
const skipCheckRequired = false;
module.exports = class MessageBO{

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
    // saveModel(newObjectJSON){
    //     return new Promise(async(resolve, reject) => {
    //         if(!newObjectJSON){
    //             reject(new Error(`empty ${tableName} object given`));
    //         }
    //         await this.cleanupInput(newObjectJSON);
    //         if(newObjectJSON.id){
    //             await this.#dbTableORM.getById(newObjectJSON.id).catch(function (err) {
    //                 log.error(`Error getting ${tableName} from Database ` + err + __location);
    //                 reject(err);
    //                 return;
    //             });
    //             this.updateProperty();
    //             this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
    //         }
    //         else{
    //             this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
    //         }

    //         //save
    //         await this.#dbTableORM.save().catch(function(err){
    //             reject(err);
    //         });
    //         this.updateProperty();
    //         this.id = this.#dbTableORM.id;
    //         //MongoDB


    //         resolve(true);

    //     });
    // }

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
            //MongoDB

            // //validate
            // if(id && id >0 ){
            //     await this.#dbTableORM.getById(id).catch(function (err) {
            //         log.error(`Error getting  ${tableName} from Database ` + err + __location);
            //         reject(err);
            //         return;
            //     });
            //     this.updateProperty();
            //     resolve(true);
            // }
            // else {
            //     reject(new Error('no id supplied'))
            // }
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

    async saveMessage(columns, recipients, sendGridResp, attachments){
        const mongoModelMapping = {
            application: "applicationId",
            business: "businessId",
            id: "mySqlId",
            agency_location: "agencyLocationId"
        }
        //************************** */
        //   MYSQL Write 
        //************************** */
        const insertQuery = `INSERT INTO clw_talage_messages (${Object.keys(columns).join(',')}) VALUES (${Object.values(columns).
            map(function(val) {
                return db.escape(val);
            }).
            join(',')})`;
        let messagesId = null;
        await db.
            query(insertQuery).
            then(function(results) {
                messagesId = results.insertId;
            }).
            catch(function(err) {
                log.error('Unable to record email message in the database' + err + ' sql: ' + insertQuery + __location);
                throw err;
            });
        if (messagesId) {
            if (global.settings.ENV === 'development' || global.settings.ENV === 'awsdev') {
                log.debug('recipients:' + recipients + __location);
            }
            //write to message_recipents table  clw_talage_message_recipients
            const recipientsList = recipients.split(',');
            let error = null;
            for (let i = 0; i < recipientsList.length; i++) {
                const encryptRecipent = await crypt.encrypt(recipientsList[i]);
                const hashRecipent = await crypt.hash(recipientsList[i]);
                const insertQuery2 = `Insert INTO clw_talage_message_recipients (message,recipient,email_hash ) VALUES (${messagesId}, '${encryptRecipent}', '${hashRecipent}' )`;
                // eslint-disable-next-line no-loop-func
                await db.query(insertQuery2).catch(function(errDb) {
                    log.error('Unable to record email message recipient in the database' + errDb + ' sql: ' + insertQuery2 + __location);
                    error = errDb;
                });
            }
            if (error) {
                throw error;
            }
        }
         //************************** */
        //   MongoDB Write 
        //************************** */
        if(global.settings.USE_MONGO === "YES"){
            var Message = require('mongoose').model('Message');
            columns.message = await crypt.decrypt(columns.message);
            let mongoMessageDoc = {}
            mongoMessageDoc.recipients = recipients;
            mongoMessageDoc.sendGridResp = sendGridResp;
            const sentDtm = moment(columns.sent)
            columns.sent  = sentDtm;

            if(attachments){
                mongoMessageDoc.attachments = attachments;
            }
            //Map columns
            Object.entries(columns).forEach(([key, value]) => {
                let mongoProp = key;
                if(mongoModelMapping[key]){
                    mongoProp = mongoModelMapping[key]
                }
                mongoMessageDoc[mongoProp] = value;
            });
            //log.debug("mongoMessageDoc: " + JSON.stringify(mongoMessageDoc));
           
            var message = new Message(mongoMessageDoc);

            //Insert a doc
            await message.save().catch(function(err){
                log.error('Mongo Message Save err ' + err + __location);
                //log.debug("message " + JSON.stringify(message.toJSON()));
            });
           
        }

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
    "agency_location": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "application": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "business": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "number",
      "dbType": "int(11) unsigned"
    },
    "subject": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "string",
      "dbType": "varchar(100)"
    },
    "message": {
      "default": "",
      "encrypted": true,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "blob"
    },
    "attachment": {
      "default": "",
      "encrypted": false,
      "hashed": false,
      "required": true,
      "rules": null,
      "type": "string",
      "dbType": "varchar(50)"
    },
    "sent": {
      "default": null,
      "encrypted": false,
      "hashed": false,
      "required": false,
      "rules": null,
      "type": "datetime",
      "dbType": "datetime"
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