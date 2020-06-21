// This file is eslint-ignored in the package.json file due to use of '#' as properties in the DatabaseObject.
// We will need to update in order for it to recognize the ECMAscript extension for private properties. -SF

/**
 * Defines a single Agency
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const serverHelper = global.requireRootPath('server.js');
const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class DatabaseObject {
	#constructors = {};
	#table = '';
	#properties = {};

	/**
	 * Constructor
	 *
	 * @params {string} t - The database table which stores this object
	 * @params {object} p - The properties of this object
	 * @params {object} c - The constructors needed by the object
	 */
	constructor(t, p, c) {
		// Localize the properties
		this.#constructors = c;
		this.#table = t;
		this.#properties = p;

		// Loop over each property
		for (const property in this.#properties) {
			// Create local property with default value (local properties are denoted with an underscore)
			this[`#${property}`] = this.#properties[property].default;

			// Create getters and setters
			Object.defineProperty(this, property, {
				// Returns the local value of the property
				get: () => {
					return this[`#${property}`];
				},

				// Performs validation and sets the property into the local value
				set: (value) => {
					let expectedDataType = this.#properties[property].type;
					if(value){

						// Verify the data type
                        // Special timestamp and Date processing
                        if(expectedDataType === "timestamp" 
                            || expectedDataType === "date" 
                            ||expectedDataType === "datetime"){
                            let errorMessage = null;
							try{
                                if("object" === typeof value){
                                    value = JSON.stringify(value)
                                    value = value.replace(/"/g,'');
                                } 
                                else if("string" === typeof value){
                                    value = value.replace(/"/g,'');
                                }
                                else {
                                    errorMessage = `Unexpected data type for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType} value: ` + JSON.stringify(value);
                                    log.error(errorMessage + __location)
                                }  
							}
							catch(e){
                                errorMessage = `Datetime procesing error for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType} value: ` + JSON.stringify(value) + " error: " + e;
								log.error(errorMessage + __location)
                            }
                            if(errorMessage){
                                throw serverHelper.internalError(errorMessage);
                            }
						}
						else {
                            if (expectedDataType !== typeof value) {
                                const badType = typeof value;
                                const errorMessage = `Unexpected data type for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType} value: ` + JSON.stringify(value);
                                log.error(errorMessage + __location)
                                throw serverHelper.internalError(errorMessage);
                            }
                        }

						// For strings, trim whitespace
						if (typeof value === 'string') {
							value = value.trim();
						}

						// Validate the property value
						if (this.#properties[property].rules) {
							for (const func of this.#properties[property].rules) {
								if (!func(value)) {
                                    log.error(`The ${property} you provided is invalid, expecting ${this.#properties[property].type}. value: ` + JSON.stringify(value) );
									throw serverHelper.requestError(`The ${property} you provided is invalid`);
								}
							}
						}

						// Set the value locally
						this[`#${property}`] = value;
					}
					else {
						//if null is provide, probably from database, leave at defualt
						// unless string.
						if (expectedDataType !== typeof value) {
							this[`#${property}`] = "";
						}
					}
					
				}
			});
		}
	}

	

	/**
	 * Populates this object with data
	 *
	 * @param {object} data - Data to be loaded
	 * @param {boolean} isObjLoad - true = loading JSONobj, false = loading result from database query
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	load(data, isObjLoad = true) {
		return new Promise((fulfill, reject) => {
			let rejected = false;
			let rejectError = null

			// Loop through and load all data items into this object
			for (const property in this.#properties) {
				// Only set properties that were provided in the data
				// if from database ignore required rules.
				if (isObjLoad === true  && (!Object.prototype.hasOwnProperty.call(data, property) || !data[property])) {
					// Enforce required fields
					if (this.#properties[property].required) {
						log.error(`${this.#table}.${property} is required` + __location)
						if(isObjLoad === true)
							throw serverHelper.requestError(`${property} is required`);

						rejectError = new Error(`${this.#table}.${property} is required`)
						
					}

					continue;
				}

				// If this property belongs to another class, create an instance of that class and load the data into it
				if (Object.prototype.hasOwnProperty.call(this.#properties[property], 'class') && this.#properties[property].class) {
					data[property].forEach((itemData, index) => {
						// Initialize the class
						const obj = new this.#constructors[this.#properties[property].class]();

						// Load the data of this item into the object
						try {
							obj.load(itemData);
						} catch (e) {
							log.error(`${this.#table}.${property} caused error: ` + e + __location)
							rejected = true;
							rejectError = e
							if(isObjLoad === true)
								reject(e);
						}
						if (rejected) {
							return;
						}

						// Replace the data with the class version
						data[property][index] = obj;
					});
				}
				if (rejected && isObjLoad === true) {
					break;
				}

				// Store the value of the property in this object
				try {
					//skip nulls
					if(data[property]){
						this[property] = data[property];
					}
				} catch (error) {
					log.error(`${this.#table}.${property} caused error: ` + error + "value: " + data[property] + __location)
					rejected = true;
					rejectError = error
					if(isObjLoad === true)
						reject(error);
				}

			}
			if (rejected && isObjLoad === false){
				reject(rejectError);
			}
			if (rejected && isObjLoad === true) {
				return; 
			} 

			fulfill(true);
		});
	}

	/**
	 * Save this object in the database
	 *
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	save() {
		return new Promise(async (fulfill, reject) => {
			let rejected = false;

			if (this.id && this.id > 0) {
				// Update this record
				try {
					await this.update();
				} catch (error) {
					reject(error);
					return;
				}
			} else {
				// Insert a new record
				try {
					await this.insert();
				} catch (error) {
					reject(error);
					return;
				}
			}

			// For child objects, save each
			for (const property in this.#properties) {
				// Process save handlers
				if (Object.prototype.hasOwnProperty.call(this.#properties[property], 'saveHandler') && this.#properties[property].saveHandler) {
					// There is a save handler, run it
					try {
						await this[this.#properties[property].saveHandler]();
					} catch (error) {
						rejected = true;
						reject(error);
						break;
					}
					continue;
				}

				// Skip non-class based properties
				if (!Object.prototype.hasOwnProperty.call(this.#properties[property], 'class') || !this.#properties[property].class) {
					continue;
				}

				// Localize the data value
				const value = this[property];

				// Loop over each value and save them
				for (const val of value) {
					// If there is an associatedField, add the ID of this object into it
					if (Object.prototype.hasOwnProperty.call(this.#properties[property], 'associatedField') && this.#properties[property].associatedField) {
						val[this.#properties[property].associatedField] = this.id;
					}

					// Save the value
					try {
						await val.save();
					} catch (error) {
						rejected = true;
						reject(error);
					}
				}
			}
			if (rejected) {
				return;
			}

			fulfill(true);
		});
	}

	/**
	 * Adds a new object into the database
	 */
	insert() {
		return new Promise(async (fulfill, reject) => {
			let rejected = false;

			if (this.id) {
				log.error('Attempt to insert record with ID. Would result in duplication. Stopping.');
				reject(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
				return;
			}

			// Build the columns and values lists by looping over properties
			const columns = [];
			const values = [];
			for (const property in this.#properties) {
				// If this property has a Class, skip it as it will be handled later
				if (
					(Object.prototype.hasOwnProperty.call(this.#properties[property], 'class') && this.#properties[property].class) ||
					(Object.prototype.hasOwnProperty.call(this.#properties[property], 'saveHandler') && this.#properties[property].saveHandler)
				) {
					continue;
				}

				// Skip the ID column
				if (property === 'id') {
					continue;
				}
				if(this[property] !== null){
					// Localize the data value
					let value = this[property];

					// Check if we need to encrypt this value, and if so, encrypt
					if (this.#properties[property].encrypted && value) {
						value = await crypt.encrypt(value);
                    }
                    if(this.#properties[property].type === "timestamp" || this.#properties[property].type === "date" || this.#properties[property].type === "datetime"){
						value = this.dbDateTimeString(value);
					}

                    // Store the column and value
                    if(value || value === '' || value === 0){
                        columns.push(`\`${property.toSnakeCase()}\``);
					    values.push(`${db.escape(value)}`);
                    }
					
				}
			}
			// Create the insert query
			let sql = "";
			try{
				sql = `
				INSERT INTO \`${this.#table}\` (${columns.join(',')})
				VALUES (${values.join(',')});
			`;
			}
			catch(err){
				log.error("Error creating insert statement: " + err)
				reject(err);
				return;
			}
			//log.debug('DB Object sql : ' + sql);

			// Run the query
			const result = await db.query(sql).catch(function (error) {
				// Check if this was
				log.error("Database Object Insert error :" + error);
				if (error.errno === 1062) {
					rejected = true;
					reject(serverHelper.requestError('The link (slug) you selected is already taken. Please choose another one.'));
					return;
				}
				rejected = true;
				reject(error);
			});
			if (rejected) {
				return false;
			}

			// Make sure the query was successful
			if (result.affectedRows !== 1) {
				log.error(`Insert failed. Query ran successfully; however, an unexpected number of records were affected. (${result.affectedRows} records)`);
				reject(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
				return;
			}

			// Store the ID in this object
			
			this['id'] = result.insertId;
			log.info(`new record ${this.#table} id:  ` + result.insertId);
			// log.debug(`new record ${this.#table} id:  ` + this.id);

			fulfill(true);
		});
	}

	/**
	 * Update an existing database object
	 *
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	update() {
		return new Promise(async (fulfill, reject) => {
			let rejected = false;

			// Build the update statements by looping over properties
			const setStatements = [];
			for (const property in this.#properties) {
				// If this property has a Class, skip it as it will be handled later
				if (
					(Object.prototype.hasOwnProperty.call(this.#properties[property], 'class') && this.#properties[property].class) ||
					(Object.prototype.hasOwnProperty.call(this.#properties[property], 'saveHandler') && this.#properties[property].saveHandler)
				) {
					continue;
				}

				// Localize the data value
				let value = this[property];
				if(this[property]){
					// Check if we need to encrypt this value, and if so, encrypt
					if (this.#properties[property].encrypted && value) {
						value = await crypt.encrypt(value);
					}
					if(this.#properties[property].type === "timestamp" || this.#properties[property].type === "date" || this.#properties[property].type === "datetime"){
						value = this.dbDateTimeString(value);
					}
                    if(value || value === '' || value === 0){
                        // Write the set statement for this value
					    setStatements.push(`\`${property.toSnakeCase()}\` = ${db.escape(value)}`);
                    }
					
				}
			}

			// Create the update query
			const sql = `
				UPDATE
					\`${this.#table}\`
				SET
					${setStatements.join(',')}
				WHERE
					\`id\` = ${db.escape(this.id)}
				LIMIT 1;
			`;

			// Run the query
			const result = await db.query(sql).catch(function (error) {
				// Check if this was
				if (error.errno === 1062) {
					rejected = true;
					reject(serverHelper.requestError('The link (slug) you selected is already taken. Please choose another one.'));
					return;
				}
				rejected = true;
				reject(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
			});
			if (rejected) {
				return;
			}

			// Make sure the query was successful
			if (result.affectedRows !== 1) {
				log.error(`Update failed. Query ran successfully; however, an unexpected number of records were affected. (${result.affectedRows} records)`);
				reject(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
				return;
			}
            log.info(`updated record ${this.#table} id:  ` + this.id);
			fulfill(true);
		});
	}

	/**
	 * Update an existing database object
	 *
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	getById(id) {
		return new Promise(async (fulfill, reject) => {
			let rejected = false;
   			// Create the update query
			const sql = `
				select * from ${this.#table} 
				WHERE
					\`id\` = ${db.escape(id)}
				LIMIT 1;
			`;

			// Run the query
			const result = await db.query(sql).catch(function (error) {
				// Check if this was
			
				rejected = true;
				log.error(`getById ${this.#table} id: ${db.escape(this.id)}  error ` + error + __location)
				reject(error);
			});
			if (rejected) {
				return;
			}
			// log.debug("getbyId results: " + JSON.stringify(result));
			if(result && result.length === 1){
				this.load(result[0], false).catch(function(err){
					log.error("getById error loading object: " + err);
					//not reject on issues from database object.
					//reject(err);
				})
			}
			else {
				reject(new Error("not found"));
				return
			}
			fulfill(true);
		});
	}

	cleanJSON(){
		let propertyNameJson = {};
		for (const property in this.#properties) {
			propertyNameJson[property] = this[`#${property}`]
		}
		return propertyNameJson;
	}

	dbDateTimeString(value){
        const datetimeFormat = db.dbTimeFormat();
        let returnValue= null;
        try{
            var properyDateTime = moment(value).utc();
            
            returnValue =  properyDateTime.utc().format(datetimeFormat)
            if(returnValue === 'Invalid date'){
                returnValue = null;
            }
        }
        catch(e){
            log.debug('dbDateTimeString error processing: ' + value);
        }

        return returnValue;
	
	}
};
