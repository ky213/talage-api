// This file is eslint-ignored in the package.json file due to use of '#' as properties in the DatabaseObject.
// We will need to update in order for it to recognize the ECMAscript extension for private properties. -SF

/**
 * Defines a single Agency
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const serverHelper = require('../../../../../server.js');
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

					// Verify the data type
					if (expectedDataType !== typeof value) {
						throw serverHelper.internalError(`Unexpected data type for ${property}, expecting ${this.#properties[property].type}`);
					}

					// For strings, trim whitespace
					if (typeof value === 'string') {
						value = value.trim();
					}

					// Validate the property value
					if (this.#properties[property].rules) {
						for (const func of this.#properties[property].rules) {
							if (!func(value)) {
								throw serverHelper.requestError(`The ${property} you provided is invalid`);
							}
						}
					}

					// Set the value locally
					this[`#${property}`] = value;
				}
			});
		}
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

				// Localize the data value
				let value = this[property];

				// Check if we need to encrypt this value, and if so, encrypt
				if (this.#properties[property].encrypted && value) {
					value = await crypt.encrypt(value);
				}

				// Store the column and value
				columns.push(`\`${property.toSnakeCase()}\``);
				values.push(`${db.escape(value)}`);
			}

			// Create the insert query
			const sql = `
				INSERT INTO \`${this.#table}\` (${columns.join(',')})
				VALUES (${values.join(',')});
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
				log.error(`Insert failed. Query ran successfully; however, an unexpected number of records were affected. (${result.affectedRows} records)`);
				reject(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
				return;
			}

			// Store the ID in this object
			this.id = result.insertId;

			fulfill(true);
		});
	}

	/**
	 * Populates this object with data
	 *
	 * @param {object} data - Data to be loaded
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	load(data) {
		return new Promise((fulfill, reject) => {
			let rejected = false;

			// Loop through and load all data items into this object
			for (const property in this.#properties) {
				// Only set properties that were provided in the data
				if (!Object.prototype.hasOwnProperty.call(data, property) || !data[property]) {
					// Enforce required fields
					if (this.#properties[property].required) {
						throw serverHelper.requestError(`${property} is required`);
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
							rejected = true;
							reject(e);
						}
						if (rejected) {
							return;
						}

						// Replace the data with the class version
						data[property][index] = obj;
					});
				}
				if (rejected) {
					break;
				}

				// Store the value of the property in this object
				try {
					this[property] = data[property];
				} catch (error) {
					rejected = true;
					reject(error);
				}
			}

			if (rejected) {
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

			if (this.id) {
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

				// Check if we need to encrypt this value, and if so, encrypt
				if (this.#properties[property].encrypted && value) {
					value = await crypt.encrypt(value);
				}

				// Write the set statement for this value
				setStatements.push(`\`${property.toSnakeCase()}\` = ${db.escape(value)}`);
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

			fulfill(true);
		});
	}
};
