/**
 * Defines a single Agency Location
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const DatabaseObject = require('./DatabaseObject.js');
const helper = global.requireShared('./helpers/helper.js');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

// Define the properties of this class and their settings
const properties = {
	'address': { // the name of the property
		'default': null, // default value
		'encrypted': true, // whether or not it is encrypted before storing in the database
		'required': true, // whether or not it is required
		'rules': [ // the validation functions that must pass for this value
			validator.address
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