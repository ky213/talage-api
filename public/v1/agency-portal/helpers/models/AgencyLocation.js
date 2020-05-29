/**
 * Defines a single Agency Location
 */

'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

// Define the properties of this class and their settings
const properties = {
	'address': { // The name of the property
		'default': null, // Default value
		'encrypted': true, // Whether or not it is encrypted before storing in the database
		'required': true, // Whether or not it is required
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

	// 'agency': {
	// 'default': null,
	// 'encrypted': false,
	// 'required': false,
	// 'rules': [
	// Validator.id
	// ],
	// 'type': 'number'
	// },
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
		'required': true,
		'rules': [
			validator.zip
		],
		'type': 'string'
	}
};

module.exports = class AgencyLocation extends DatabaseObject{
	constructor(){
		super('#__agency_locations', properties);
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
				reject(new serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
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
			await db.query(deleteSQL).catch(function(error){
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
			await db.query(associateSQL).catch(function(error){
				rejected = true;
				reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
			});
			if(rejected){
				return;
			}

			fulfill(true);
		});
	}
};