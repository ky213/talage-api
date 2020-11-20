

const DatabaseObject = require('./DatabaseObject.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


const tableName = 'clw_talage_limits'
const skipCheckRequired = false;
module.exports = class QuoteLimitBO {

    #dbTableORM = null;

    constructor() {
        this.id = 0;
        this.#dbTableORM = new DbTableOrm(tableName);
    }


    /**
   * Save Model
     *
   * @param {object} newObjectJSON - newObjectJSON JSON
   * @returns {Promise.<JSON, Error>} A promise that returns an JSON with saved businessContact , or an Error if rejected
   */
    saveModel(newObjectJSON) {
        return new Promise(async(resolve, reject) => {
            if (!newObjectJSON) {
                reject(new Error(`empty ${tableName} object given`));
            }
            await this.cleanupInput(newObjectJSON);
            if (newObjectJSON.id) {
                await this.#dbTableORM.getById(newObjectJSON.id).catch(function(err) {
                    log.error(`Error getting ${tableName} from Database ` + err + __location);
                    reject(err);
                    return;
                });
                this.updateProperty();
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }
            else {
                this.#dbTableORM.load(newObjectJSON, skipCheckRequired);
            }
            //save
            await this.#dbTableORM.save().catch(function(err) {
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

    save() {
        return new Promise(async(resolve) => {
            //validate

            resolve(true);
        });
    }

    insertByColumnValue(columns, values) {
        return new Promise(async(resolve, reject) => {
            let error = null;
            const Result = await db.query(`INSERT INTO ${tableName} (\`${columns.join('`,`')}\`) VALUES ${values.join(',')};;`).catch(function(err) {
                log.error("Error QuoteBO insertByColumnValue " + err + __location);
                error = err;
            });
            if(error){
                reject(error);
            }
            else {
                log.debug(`${tableName} saved ids ` + Result.insertId);
                resolve(true);
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

    loadFromId(id) {
        return new Promise(async(resolve, reject) => {
            try {
                await this.getById(id);
            }
            catch (error) {
                reject(error);
            }
            resolve(true);
        });
    }

    async cleanupInput(inputJSON) {
        for (const property in properties) {
            if (inputJSON[property]) {
                // Convert to number
                try {
                    if (properties[property].type === "number" && typeof inputJSON[property] === "string") {
                        if (properties[property].dbType.indexOf("int") > -1) {
                            inputJSON[property] = parseInt(inputJSON[property], 10);
                        }
                        else if (properties[property].dbType.indexOf("float") > -1) {
                            inputJSON[property] = parseFloat(inputJSON[property]);
                        }
                    }
                }
                catch (e) {
                    log.error(`Error converting property ${property} value: ` + inputJSON[property] + __location)
                }
            }
        }
    }

    updateProperty() {
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
    async loadORM(inputJSON) {
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
        "dbType": "tinyint(2) unsigned"
    },
    "description": {
        "default": 0,
        "encrypted": false,
        "hashed": false,
        "required": true,
        "rules": null,
        "type": "string",
        "dbType": "varchar(40)"
    }
}

class DbTableOrm extends DatabaseObject {

    // eslint-disable-next-line no-shadow
    constructor(tableName) {
        super(tableName, properties);
    }

}