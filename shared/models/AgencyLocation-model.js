/**
 * Defines a single Agency Location
 */

'use strict';

const AgencyLocationInsurers = require('./AgencyLocationInsurers-model');
const DatabaseObject = require('./DatabaseObject.js');
//const serverHelper = require('../../../server.js');
const serverHelper = global.requireRootPath('server.js');
const validator = global.requireShared('./helpers/validator.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const constructors = {'AgencyLocationInsurers': AgencyLocationInsurers};

// Define the properties of this class and their settings
const properties = {
	'address': { // The name of the property
		'default': null, // Default value
		'encrypted': true, // Whether or not it is encrypted before storing in the database
		'required': false, // Whether or not it is required
		'rules': [
			validator.address
		],
		'type': 'string' // The data type
	},
	'address2': {
		'default': null,
		'encrypted': true,
		'required': false,
		'rules': [
			validator.address2
		],
		'type': 'string'
	},
	'agency': {
		'default': null,
		'encrypted': false,
		'required': true,
		'rules': [
			validator.id
		],
		'type': 'number'
    },
	'closeTime': {
		'default': 5,
		'encrypted': false,
		'required': true,
		'rules': [
			validator.closeTime
		],
		'type': 'number'
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
	'insurers': {
		'associatedField': 'agencyLocation', // The ID of this object will be placed into this property of each object
		'class': 'AgencyLocationInsurers',
		'default': [],
		'encrypted': false,
		'required': true,
		'rules': [],
		'type': 'object'
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
	'openTime': {
		'default': 8,
		'encrypted': false,
		'required': true,
		'rules': [
			validator.openTime
		],
		'type': 'number'
	},
	'primary': {
		'default': null,
		'encrypted': false,
		'required': false,
		'rules': [
			validator.boolean
		],
		'type': 'number'
	},
	'state': {
		'default': 1,
		'encrypted': false,
		'required': false,
		'rules': [],
		'type': 'number'
	},
	'territories': {
		'default': [],
		'encrypted': false,
		'required': true,
		'rules': [],
		'saveHandler': 'associateTerritories',
		'type': 'object'

	},
	'zip': {
		'default': null,
		'encrypted': false,
		'required': false,
		'rules': [
			validator.zip
		],
		'type': 'string'
	}
};

module.exports = class AgencyLocation extends DatabaseObject{
	constructor(){
		super('#__agency_locations', properties, constructors);
	}

	/**
	 * Associates the territories to this location
	 *
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	associateTerritories(){
		return new Promise(async(fulfill, reject) => {
			let rejected = false;

			// Check for needed data, if it is not present, skip
			if(!this.id || !this.territories || !this.territories.length){
				log.error('AgencyLocation associateTerritories() missing required data. Unable to run.');
				reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
				return;
			}

			// Compile some insert statements
			const inserts = [];
			for(const abbr of this.territories){
				inserts.push(`(${db.escape(this.id)}, ${db.escape(abbr)})`);
			}

			// Remove unassociated territories
			const deleteSQL = `
				DELETE FROM
					\`#__agency_location_territories\`
				WHERE
					\`agency_location\` = ${db.escape(this.id)} AND
					\`territory\` NOT IN (${this.territories.map((territory) => db.escape(territory)).join(',')});
			`;

			// Run the query
			await db.query(deleteSQL).catch(function(){
				rejected = true;
				reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
			});
			if(rejected){
				return;
			}

			// Associate all new codes, leaving existing ones unchanged
			const associateSQL = `
				INSERT INTO \`#__agency_location_territories\` (\`agency_location\`, \`territory\`)
				VALUES ${inserts.join(',')}
				ON DUPLICATE KEY UPDATE \`id\` = \`id\`;
			`;

			// Run the query
			await db.query(associateSQL).catch(function(err){
                rejected = true;
                log.err("clw_talage_agency_location_territories insert error: " + err + __location);
				reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
			});
			if(rejected){
				return;
			}

			fulfill(true);
		});
	}

	/**
	 * Save this agency location in the database
	 *
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	save(){
		return new Promise(async (fulfill, reject) => {
			let rejected = false;

			// If this location is primary, set all other locations to not primary
			if(this.primary){
				let where = '';

				// If we are editing and this location is primary, don't change it
				if(this.id){
					where = `AND \`id\` != ${db.escape(this.id)}`
				}

				// Build the SQL query to update other locations
				const sql = `
					UPDATE
						\`#__agency_locations\`
					SET
						\`primary\` = NULL
					WHERE
						\`agency\` = ${this.agency}
						${where};
                `;
                //Sanitize phone
                this.phone = stringFunctions.santizeNumber(this.phone);


				// Run the query
				const result = await db.query(sql).catch(function(error){
					rejected = true;
					reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
				});
				if(rejected){
					return;
				}
			}

			// Attempt to save
			try{
				// Call the parent class save() function
				await super.save();
				fulfill(true);
			}catch(error){
				reject(error);
			}
		});
	}
};