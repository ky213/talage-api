'use strict';


const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const smartystreetSvc = global.requireShared('./services/smartystreetssvc.js');


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

    async loadByZipCode(zipCode) {

        if(zipCode){
            if(typeof zipCode === 'string'){
                zipCode = parseInt(zipCode, 10);
            }
            let rejected = false;
            // Create the update query
            const sql = `
                select *  from clw_talage_zip_codes where zip = ${zipCode}
            `;

            // Run the query
            const result = await db.query(sql).catch(function(error) {
                // Check if this was

                rejected = true;
                log.error(`getById ${tableName} id: ${db.escape(this.id)}  error ` + error + __location)
                throw error;
            });
            if (rejected) {
                return;
            }
            if(result && result.length > 0){
                const i = 0;
                const resp = await this.loadORM(result[i], skipCheckRequired).catch(function(err){
                    log.error(`loadByZipCode error loading object: ` + err + __location);
                })
                if(!resp){
                    log.debug("Bad BO load" + __location)
                }
                return this.cleanJSON();
            }
            else {
                log.debug("not found loadByZipCode in DB check ZipCodeSvc: " + sql);
                //Call to zipcode service to lookup zip.
                const newZip = await this.checkZipCodeSvc(zipCode).catch(function(err){
                    log.error("checkZipCodeSvc error " + err + __location);
                    rejected = true;
                    throw err;
                })
                if (rejected) {
                    return;
                }
                if(newZip){
                    return this.cleanJSON();
                }
                else {
                    throw new Error("not found");
                }
            }

        }
        else {
            throw new Error('no zipCode supplied');
        }

    }

    async checkZipCodeSvc(zipCode){
        let error = null;
        const response = await smartystreetSvc.checkZipCode(zipCode.toString()).catch(function(err){
            log.error("smartystreetSvc error: " + err + __location);
            error = err;
        })
        if(error){
            throw error
        }
        if(response.error){
            return null;
        }
        //Got a zip code.
        if(response.zipcode){
        //populate BO and save.
            const newJSON = {};
            newJSON.zip = response.zipcode;
            switch(response.zipcode_type){
                case "S":
                    newJSON.type = "STANDARD";
                    break;
                case "U":
                    newJSON.type = "UNIQUE";
                    break;
                case "P":
                    newJSON.type = "PO BOX";
                    break;
                default:
                    newJSON.type = response.zipcode_type;
            }
            newJSON.city = response.city;
            newJSON.territory = response.state_abbreviation;
            newJSON.county = response.county_name;
            this.loadORM(newJSON);

            await this.#dbTableORM.insert();

            return this.#dbTableORM.cleanJSON();


        }
        else {
            return null;
        }

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