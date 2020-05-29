/**
 * Defines a single Agency Location
 */

'use strict';

const DatabaseObject = require('./DatabaseObject.js');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

// Define the properties of this class and their settings
const properties = {
	'agencyId': { // The name of the property
		'default': null, // Default value
		'encrypted': true, // Whether or not it is encrypted before storing in the database
		'required': true, // Whether or not it is required
		'rules': [],
		'type': 'string' // The data type
	},
	/*'agencyLocation': {
		'default': 0,
		'encrypted': false,
		'required': false,
		'rules': [
			validator.id
		],
		'type': 'number'
	},*/
	'id': {
		'default': 0,
		'encrypted': false,
		'required': false,
		'rules': [
			validator.id
		],
		'type': 'number'
	},
	'insurer': {
		'default': 0,
		'encrypted': false,
		'required': true,
		'rules': [
			validator.id
		],
		'type': 'number'
	},
	'wc': {
		'default': 1,
		'encrypted': false,
		'required': false,
		'rules': [],
		'type': 'number'
	}
	/*
	bop
	gl
	*/
};

module.exports = class AgencyLocationInsurers extends DatabaseObject{
	constructor(){
		super('#__agency_location_insurers', properties);
	}
};