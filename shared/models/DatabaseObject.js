/* eslint-disable prefer-const */
/* eslint-disable no-extra-parens */
/* eslint-disable no-loop-func */
/* eslint-disable no-lonely-if */
/* eslint-disable guard-for-in */
/* eslint-disable valid-jsdoc */
/* eslint-disable lines-between-class-members */
// This file is eslint-ignored in the package.json file due to use of '#' as properties in the DatabaseObject.
// We will need to update in order for it to recognize the ECMAscript extension for private properties. -SF

/**
 * Defines a single record
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//const validator = global.requireShared('./helpers/validator.js');
//usable in catches from promises.  (this not available)
let tableName = '';
// do not update or insert into database
const doNotInsertColumns = ['id',
    'created',
    'created_by',
    'modified',
    'deleted'];
const doNotUpdateColumns = ['id',
    'uuid',
    'created',
    'created_by',
    'modified',
    'deleted'];

module.exports = class DatabaseObject {
    #constructors = {};

    #table = '';

    #properties = {};

    doNotSnakeCase = [];
    allowNulls = [];

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
        tableName = t;
        // Loop over each property
        for (const property in this.#properties) {
            // Create local property with default value (local properties are denoted with an underscore)
            this[`#${property}`] = this.#properties[property].default;

            // Create getters and setters
            Object.defineProperty(this, property, {
                // Returns the local value of the property
                get: () => this[`#${property}`],

                // Performs validation and sets the property into the local value
                set: (value) => {

                    let expectedDataType = this.#properties[property].type;

                    if (this.hasValue(value) || this.allowNulls.includes(property)) {

                        // Verify the data type
                        // Special timestamp and Date processing
                        if (expectedDataType === "timestamp"
                            || expectedDataType === "date"
                            || expectedDataType === "datetime") {
                            let errorMessage = null;
                            try {
                                if (typeof value === "object") {
                                    value = JSON.stringify(value)
                                    value = value.replace(/"/g, '');
                                }
                                else if (typeof value === "string") {
                                    value = value.replace(/"/g, '');
                                }
                                else {
                                    const badType = typeof value;
                                    errorMessage = `${this.#table} Unexpected data type for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType} value: ` + JSON.stringify(value);
                                    log.error(errorMessage + __location)
                                }
                            }
                            catch (e) {
                                const badType = typeof value;
                                errorMessage = `${this.#table} Datetime procesing error for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType} value: ` + JSON.stringify(value) + " error: " + e;
                                log.error(errorMessage + __location)
                            }
                            if (errorMessage) {
                                throw new Error(errorMessage);
                            }
                        }
                        else if (expectedDataType === "number" && typeof value === 'string' && this.#properties[property].dbType) {
                            // correct input.
                            try {
                                if (value.length > 0) {
                                    if (this.#properties[property].dbType.indexOf("int") > -1) {
                                        value = parseInt(value, 10);
                                    }
                                    else if (this.#properties[property].dbType.indexOf("float") > -1) {
                                        value = parseFloat(value);
                                    }
                                }
                                else if (this.#properties[property].default) {
                                    value = this.#properties[property].default;
                                }
                                else {
                                    value = null;
                                }
                            }
                            catch (e) {
                                const badType = typeof value;
                                const errorMessage = `${this.#table} Unable to convert data type for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType} value: ` + JSON.stringify(value);
                                log.error(errorMessage + __location)
                                throw new Error(errorMessage);
                            }


                        }
                        else if (expectedDataType === "number" && typeof value === 'boolean') {
                            // correct input.
                            try {
                                value = value === true ? 1 : 0;
                            }
                            catch (e) {
                                const badType = typeof value;
                                const errorMessage = `${this.#table} Unable to convert data type for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType} value: ` + JSON.stringify(value);
                                log.error(errorMessage + __location)
                                throw new Error(errorMessage);
                            }
                        }
                        else if (expectedDataType === "string" && typeof value === 'object') {
                            const badType = typeof value;
                            if (badType.type === 'buffer') {
                                try {
                                    value = value.toSting();
                                }
                                catch (e) {
                                    const badType2 = typeof value;
                                    const errorMessage = `${this.#table} Unable to convert data type for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType2} value: ` + JSON.stringify(value);
                                    log.error(errorMessage + __location)
                                    throw new Error(errorMessage);
                                }

                            }
                            // correct input.

                        }
                        else if (expectedDataType === "json" && typeof value === 'object') {
                            //log.debug('Load() Processing JSON column');
                        }
                        else if (expectedDataType === "json" && typeof value === 'string') {
                            //log.debug('Load() Processing JSON column convert string');
                            value = JSON.parse(value)
                        }
                        else {
                            // if the property allows null and value is null, allow it
                            if (expectedDataType !== typeof value && (!this.allowNulls.includes(property) || value !== null)) {
                                const badType = typeof value;
                                const errorMessage = `${this.#table} Unexpected data type for ${property}, expecting ${this.#properties[property].type}. supplied Type: ${badType} value: ` + JSON.stringify(value);
                                log.error(errorMessage + __location)
                                throw new Error(errorMessage);
                            }
                        }

                        // For strings, trim whitespace
                        if (typeof value === 'string') {
                            value = value.trim();
                        }

                        // Validate the property value
                        if (this.#properties[property].rules && value) {
                            for (const func of this.#properties[property].rules) {
                                if (!func(value)) {
                                    log.error(`${this.#table} The ${property} you provided is invalid, expecting ${this.#properties[property].type}. value: ` + JSON.stringify(value));
                                    throw new Error(`The ${property} you provided is invalid`);
                                }
                            }
                        }

                        // Set the private value
                        this[`#${property}`] = value;

                    }
                    else {
                        //if null is provide, probably from database, leave at default
                        // unless string.
                        if (expectedDataType === "string") {
                            this[`#${property}`] = "";
                        }
                        else if (expectedDataType === "number" && this.#properties[property].default) {
                            value = this.#properties[property].default;
                        }
                        else {
                            log.debug(`No value for ${this.#table}.${property} value:  ` + value + __location)
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
                if (isObjLoad === true && (!Object.prototype.hasOwnProperty.call(data, property) || !this.hasValue(data[property]))) {
                    // Enforce required fields
                    if (this.#properties[property].required) {
                        log.error(`${this.#table}.${property} is required` + __location)
                        if (isObjLoad === true) {
                            throw new Error(`${property} is required`);
                        }

                        rejectError = new Error(`${this.#table}.${property} is required`)
                    }
                    //continue;
                }

                // If this property belongs to another class, create an instance of that class and load the data into it
                if (Object.prototype.hasOwnProperty.call(this.#properties[property], 'class') && this.#properties[property].class) {
                    data[property].forEach((itemData, index) => {
                        // Initialize the class
                        const obj = new this.#constructors[this.#properties[property].class]();

                        // Load the data of this item into the object
                        try {
                            obj.load(itemData);
                        }
                        catch (e) {
                            log.error(`${this.#table}.${property} caused error: ` + e + __location)
                            rejected = true;
                            rejectError = e
                            if (isObjLoad === true) {
                                reject(e);
                            }
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
                    if (this.hasValue(data[property]) || this.allowNulls.includes(property)) {
                        this[property] = data[property];
                    }
                }
                catch (error) {
                    log.error(`${this.#table}.${property} caused error: ` + error + "value: " + data[property] + __location)
                    rejected = true;
                    rejectError = error
                    if (isObjLoad === true) {
                        reject(error);
                    }
                }

            }
            if (rejected && isObjLoad === false) {
                reject(rejectError);
            }
            if (rejected && isObjLoad === true) {
                return;
            }

            fulfill(true);
        });
    }


    save() {
        return new Promise(async(fulfill, reject) => {
            let rejected = false;

            if (this.id && this.id > 0) {
                // Update this record
                try {
                    await this.update();
                }
                catch (error) {
                    reject(error);
                    return;
                }
            }
            else {
                // Insert a new record
                try {
                    await this.insert();
                }
                catch (error) {
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
                    }
                    catch (error) {
                        log.error(this.#properties[property] + " Save error " + error + __location);
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
                    }
                    catch (error) {
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


    insert() {
        return new Promise(async(fulfill, reject) => {
            let rejected = false;

            if (this.id) {
                log.error(`${this.#table} Attempt to insert record with ID. Would result in duplication. Stopping.`);
                reject(new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
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
                if (doNotInsertColumns.includes(property)) {
                    continue;
                }
                if (this[property] || this[property] === '' || this[property] === 0) {
                    // Localize the data value
                    let value = this[property];

                    // Check if we need to encrypt this value, and if so, encrypt
                    if (this.#properties[property].encrypted && (value || value === "")) {
                        value = await crypt.encrypt(value);
                        if (value === false) {
                            value = "";
                        }
                    }
                    if (this.#properties[property].type === "timestamp" || this.#properties[property].type === "date" || this.#properties[property].type === "datetime") {
                        value = this.dbDateTimeString(value);
                    }

                    if (this.#properties[property].type === "json") {
                        value = JSON.stringify(value);
                    }

                    // Store the column and value
                    if (this.hasValue(value) || this.allowNulls.includes(property)) {
                        if (this.doNotSnakeCase.includes(property)) {
                            columns.push(`\`${property}\``);
                        }
                        else {
                            columns.push(`\`${property.toSnakeCase()}\``);
                        }

                        values.push(`${db.escape(value)}`);
                    }

                }
            }
            // Create the insert query
            let sql = "";
            try {
                sql = `
				INSERT INTO \`${this.#table}\` (${columns.join(',')})
				VALUES (${values.join(',')});
			`;
            }
            catch (err) {
                log.error("Error creating insert statement: " + err)
                reject(err);
                return;
            }
            //log.debug('DB Object sql : ' + sql);

            // Run the query
            const result = await db.query(sql).catch(function(error) {
                // Check if this was
                log.error("Database Object Insert error :" + error);
                if (error.errno === 1062) {
                    rejected = true;
                    log.error(`${tableName} Duplicate index error on insert ` + error + __location);
                    reject(new Error('Duplicate index error'));
                    //reject(new Error('The link (slug) you selected is already taken. Please choose another one.'));
                    return;
                }
                rejected = true;
                log.error(`${tableName} error on insert ` + error + __location);
                reject(error);
            });
            if (rejected) {
                return false;
            }

            // Make sure the query was successful
            if (result.affectedRows !== 1) {
                log.error(`${this.#table} Insert failed. Query ran successfully; however, an unexpected number of records were affected. (${result.affectedRows} records)`);
                reject(new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
                return;
            }

            // Store the ID in this object

            this.id = result.insertId;
            if (this.#table !== 'clw_talage_search_strings') {
                log.info(`new record ${this.#table} id:  ` + result.insertId);
            }

            // log.debug(`new record ${this.#table} id:  ` + this.id);

            fulfill(true);
        });
    }


    update() {
        return new Promise(async(fulfill, reject) => {
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

                // Skip the ID column
                if (property === 'id') {
                    continue;
                }

                if (doNotUpdateColumns.includes(property)) {
                    continue;
                }

                // Localize the data value
                let value = this[property];
                // if the property allows null and value is null, allow it
                if (value || value === '' || value === 0 || (this.allowNulls.includes(property) && value === null)) {
                    // Check if we need to encrypt this value, and if so, encrypt
                    if (this.#properties[property].encrypted && value) {
                        value = await crypt.encrypt(value);
                    }
                    if (this.#properties[property].type === "timestamp" || this.#properties[property].type === "date" || this.#properties[property].type === "datetime") {
                        value = this.dbDateTimeString(value);
                    }
                    if (this.#properties[property].type === "json") {
                        value = JSON.stringify(value);
                    }

                    if (this.hasValue(value) || this.allowNulls.includes(property)) {
                        // Write the set statement for this value
                        if (this.doNotSnakeCase.includes(property)) {
                            setStatements.push(`\`${property}\` = ${db.escape(value)}`);
                        }
                        else {
                            setStatements.push(`\`${property.toSnakeCase()}\` = ${db.escape(value)}`);
                        }

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
            // usable in catch
            const result = await db.query(sql).catch(function(error) {
                // Check if this was
                if (error.errno === 1062) {
                    rejected = true;
                    log.error(`${tableName} Duplicate index error on update ` + error + __location);
                    reject(new Error('Duplicate index error'));
                    //reject(new Error('The link (slug) you selected is already taken. Please choose another one.'));
                    return;
                }
                rejected = true;
                log.error(`${tableName} error on update ` + error + __location);
                reject(new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
            });
            if (rejected) {
                return;
            }

            // Make sure the query was successful
            if (result.affectedRows !== 1) {
                log.error(`Update failed. Query ran successfully; however, an unexpected number of records were affected. (${result.affectedRows} records)  ${sql}`);
                reject(new Error(`Update failed on ${tableName}.`));
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
        return new Promise(async(fulfill, reject) => {
            let rejected = false;
            // Create the update query
            const sql = `
				select * from ${this.#table} 
				WHERE
					\`id\` = ${db.escape(id)}
				LIMIT 1;
			`;

            // Run the query
            const result = await db.query(sql).catch(function(error) {
                // Check if this was

                rejected = true;
                log.error(`getById ${tableName} id: ${db.escape(id)}  error ` + error + __location)
                reject(error);
            });
            if (rejected) {
                return;
            }
            // log.debug("getbyId results: " + JSON.stringify(result));
            if (result && result.length === 1) {
                //Decrypt encrypted fields.
                await this.decryptFields(result[0]);
                await this.convertJSONColumns(result[0]);

                this.load(result[0], false).catch(function(err) {
                    log.error(`getById error loading object: ` + err);
                    //not reject on issues from database object.
                    //reject(err);
                })
            }
            else {
                log.debug("not found getbyId: " + sql);
                reject(new Error("not found"));
                return
            }
            fulfill(true);
        });
    }
    async decryptFields(data) {
        for (const property in this.#properties) {
            // Only set properties that were provided in the data
            // if from database ignore required rules.
            if (this.#properties[property].encrypted === true && Object.prototype.hasOwnProperty.call(data, property) && data[property]) {
                data[property] = await crypt.decrypt(data[property]);
                if (data[property] === false) {
                    data[property] = null;
                }
            }
        }
        return
    }

    async convertJSONColumns(data) {
        for (const property in this.#properties) {
            // Only set properties that were provided in the data
            // if from database ignore required rules.
            if (this.#properties[property].type === 'json' && Object.prototype.hasOwnProperty.call(data, property) && data[property]) {
                try {
                    data[property] = JSON.parse(data[property]);
                }
                catch (e) {
                    log.error("json parse error " + e + __location)
                }

            }
        }
        return
    }

    cleanJSON(noNulls = true) {
        let propertyNameJson = {};
        for (const property in this.#properties) {
            if (noNulls === true) {
                if (this.hasValue(this[`#${property}`]) || this.allowNulls.includes(property)) {
                    propertyNameJson[property] = this[`#${property}`]
                }
            }
            else {
                propertyNameJson[property] = this[`#${property}`]
            }

        }
        return propertyNameJson;
    }

    dbDateTimeString(value) {
        const datetimeFormat = db.dbTimeFormat();
        let returnValue = null;
        try {
            var properyDateTime = moment(value).utc();

            returnValue = properyDateTime.utc().format(datetimeFormat)
            if (returnValue === 'Invalid date') {
                returnValue = null;
            }
        }
        catch (e) {
            log.debug('dbDateTimeString error processing: ' + value);
        }

        return returnValue;

    }

    hasValue(testValue) {
        return (testValue || testValue === '' || testValue === 0);
    }
};