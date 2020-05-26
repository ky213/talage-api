/**
 * Defines a single Agency
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const helper = global.requireShared('./helpers/helper.js');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

// Define the properties of this class and their settings
const properties = {
	'caLicenseNumber': { // the name of the property
		'default': null, // default value
		'encrypted': true, // whether or not it is encrypted before storing in the database
		'required': false, // whether or not it is required
		'rules': [ // the validation functions that must pass for this value
			validator.CALicense
		],
		'type': 'string' // the data type
	},
	'email': {
		'default': null,
		'encrypted': true,
		'required': true,
		'rules': [
			validator.email
		],
		'type': 'string'
	},
	'fname': {
		'default': null,
		'encrypted': true,
		'required': true,
		'rules': [
			validator.name
		],
		'type': 'string'
	},
	'id': {
		'default': 0,
		'encrypted': false,
		'required': false,
		'rules': [
			validator.agency
		],
		'type': 'number'
	},
	'lname': {
		'default': null,
		'encrypted': true,
		'required': true,
		'rules': [
			validator.name
		],
		'type': 'string'
	},
	'phone': {
		'default': null,
		'encrypted': true,
		'required': false,
		'rules': [
			validator.phone
		],
		'type': 'string'
	},
	'slug': {
		'default': null,
		'encrypted': false,
		'required': false,
		'rules': [
			validator.slug
		],
		'type': 'string'
	},
	'website': {
		'default': null,
		'encrypted': true,
		'required': false,
		'rules': [
			validator.website
		],
		'type': 'string'
	}
};

module.exports = class Agency{

	constructor(){
		// Loop over each property
		for(const property in properties){

			// Create local property with default value (local properties are denoted with an underscore)
			this[`_${property}`] = properties[property].default;

			// Create getters and setters
			Object.defineProperty(this, property, {

				// Returns the local value of the property
				get: () => {
					return this[`_${property}`];
				},

				// Performs validation and sets the property into the local value
				set: (value) => {

					// Verify the data type
					if(typeof value !== properties[property].type){
						throw serverHelper.internalError(`Unexpected data type for ${property}, expecting ${properties[property].type}`);
					}

					// For strings, trim whitespace
					if(typeof value === 'string'){
						value = value.trim();
					}

					// Validate the property value
					for(const func of properties[property].rules){
						if(!func(value)){
							throw serverHelper.requestError(`The ${property} you provided is invalid`);
						}
					}

					// Set the value locally
					this[`_${property}`] = value;
				}
			});
		}
	}

	/**
	 * Populates this object with data
	 *
	 * @param {object} data - Data to be loaded
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	load(data){
		return new Promise((fulfill) => {
			// Loop through and load all data items into this object
			for(const property in properties){

				// Only set properties that were provided in the data
				if(!Object.prototype.hasOwnProperty.call(data, property) || !data[property]){

					// Enforce required fields
					if(properties[property].required){
						throw serverHelper.requestError(`${property} is required`);
					}

					continue;
				}

				// Store the value of the property in this object
				this[property] = data[property];
			}

			fulfill(true);
		});
	}

	/**
	 * Save this agency in the database
	 *
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	save(){
		return new Promise(async (fulfill) => {
			// Build the update statements by looping over properties
			const setStatements = [];
			for(const property in properties){

				// Localize the data value
				let value = this[property];

				// Check if we need to encrypt this value, and if so, encrypt
				if(properties[property].encrypted && value){
					value = await crypt.encrypt(value);
				}

				// Write the set statement for this value
				setStatements.push(`\`${property.toSnakeCase()}\` = ${db.escape(value)}`);
			}

			// Create the update query
			const sql = `
				UPDATE
					\`#__agencies\`
				SET
					${setStatements.join(',')}
				WHERE
					\`id\` = ${db.escape(this.id)}
				LIMIT 1;
			`;

			// Run the query
			const result = await db.query(sql).catch(function(err){
				throw serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
			});

			// Make sure the query was successful
			if(result.affectedRows !== 1){
				log.error(`Agency update failed. Query ran successfully; however, an unexpected number of records were affected. (${result.affectedRows} records)`);
				throw serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
			}

			fulfill(true);
		});
	}
};