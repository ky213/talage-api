/**
 * Defines a single Agency Location
 */

'use strict';

// Const AgencyLocationTerritory = require('./AgencyLocationTerritory');
const DatabaseObject = require('./DatabaseObject.js');
const validator = global.requireShared('./helpers/validator.js');

// Var constructors = {
// AgencyLocationTerritory
// };

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

	// 'territories': {
	// 'associatedField': 'agencyLocation', // The ID of this object will be placed into this property
	// 'class': 'AgencyLocationTerritory',
	// 'default': [],
	// 'encrypted': false,
	// 'required': true,
	// 'rules': [],
	// 'type': 'object'
	// },
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
};