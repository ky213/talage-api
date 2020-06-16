/**
 * Defines a single Agency
 */

'use strict';

const AgencyLocation = require('./AgencyLocation.js');
const DatabaseObject = require('./DatabaseObject.js');
const axios = require('axios');
const imgSize = require('image-size');
const serverHelper = require('../../../../../server.js');
const{'v4': uuidv4} = require('uuid');
const validator = global.requireShared('./helpers/validator.js');

const constructors = {'AgencyLocation': AgencyLocation};

// Define the properties of this class and their settings
const properties = {
	'caLicenseNumber': { // The name of the property
		'default': null, // Default value
		'encrypted': true, // Whether or not it is encrypted before storing in the database
		'required': false, // Whether or not it is required
		'rules': [
			validator.CALicense
		],
		'type': 'string' // The data type
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
	'locations': {
		'associatedField': 'agency', // The ID of this object will be placed into this property
		'class': 'AgencyLocation',
		'default': [],
		'encrypted': false,
		'required': false,
		'rules': [],
		'type': 'object'
	},
	'logo': {
		'default': null,
		'encrypted': false,
		'required': false,
		'rules': null,
		'type': 'string'
	},
	'name': {
		'default': null,
		'encrypted': false,
		'required': true,
		'rules': [
			validator.agency_name
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
	},
	'enable_optout': {
		'default': 0,
		'encrypted': false,
		'required': false,
		'rules': [],
		'type': 'number'
	}
};

module.exports = class Agency extends DatabaseObject{

	constructor(){
		super('#__agencies', properties, constructors);
	}

	/**
	 * Removes the existing logo for this agency, if there is one
	 *
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if successful, or an Error if rejected
	 */
	removeLogo(){
		return new Promise(async(fulfill, reject) => {

			// If no logo is set, reject and stop
			if(!this.id){
				log.warn('Cannot remove agency logo when no agency ID is specified');
				fulfill(false);
				return;
			}

			// Get the existing file path of the logo
			const pathSQL = `
				SELECT
					\`logo\`
				FROM
					\`#__agencies\`
				WHERE
					\`id\` = ${db.escape(this.id)}
				LIMIT 1;
			`;

			// Run the query
			let rejected = false;
			const pathResult = await db.query(pathSQL).catch(function(){
				rejected = true;
				log.error('Unable to get path of existing agency logo');
				reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
			});
			if(rejected){
				return;
			}

			// Isolate the path
			const path = pathResult[0].logo;

			// Check if a logo was returned, if not, consider it removed
			if(!path){
				fulfill(true);
				return;
			}

			// Remove the defunct logo from cloud storage
			await axios.delete(`http://localhost:${global.settings.PRIVATE_API_PORT}/v1/file/file?path=public/agency-logos/${path}`).
			catch(function(){
				rejected = true;
				reject(serverHelper.internalError('Well, that wasn\’t supposed to happen. Please try again and if this continues please contact us. (Failed to delete old logo)'));
				log.error('Failed to connect to file service.');
			});
			if(rejected){
				return;
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
		return new Promise(async(fulfill, reject) => {
			let rejected = false;

			// Handle the logo file
			if(this.logo){

				// If the logo is base64, we need to save it; otherwise, assume no changes were made
				if(this.logo.startsWith('data:')){

					// If this is an existing record, attempt to remove the old logo first
					if(this.id){

						// The logo was changed, delete the old one
						await this.removeLogo().catch(function(error){
							rejected = true;
							reject(error);
						});
						if(rejected){
							return;
						}
					}

					// Isolate the extension
					const extension = this.logo.substring(11, this.logo.indexOf(';'));
					if(!['gif',
						'jpeg',
						'png'].includes(extension)){
						reject(serverHelper.requestError('Please upload your logo in gif, jpeg, or preferably png format.'));
						return;
					}

					// Isolate the file data from the type prefix
					const logoData = this.logo.substring(this.logo.indexOf(',') + 1);

					// Check the minimum image size
					const logoBuffer = Buffer.from(logoData, 'base64');
					const logoDimensions = imgSize(logoBuffer);
					if(logoDimensions.height < 200 || logoDimensions.width < 655){
						reject(serverHelper.requestError('The logo you supplied is too small. We want it to look great, and that requires that it be at least 655 pixels wide by 200 pixels tall.'));
						return;
					}

					// Check the file size (max 150KB)
					if(logoData.length * 0.75 > 150000){
						reject(serverHelper.requestError('Logo too large. The maximum file size is 150KB.'));
						return;
					}

					// Generate a random file name (defeats caching issues issues)
					const fileName = `${this.id}-${uuidv4().substring(24)}.${extension}`;

					// Store on S3
					await axios.put(`http://localhost:${global.settings.PRIVATE_API_PORT}/v1/file/file`, {
						'data': logoData,
						'path': `public/agency-logos/${fileName}`
					}).
					catch(function(){
						rejected = true;
						reject(serverHelper.internalError('Well, that wasn\’t supposed to happen. Please try again and if this continues please contact us. (Failed to upload new logo)'));
						log.error('Failed to connect to file service.');
					});
					if(rejected){
						return;
					}

					// Save the file name locally
					this.logo = fileName;
				}
			}
else if(this.id){
				// The logo was unset, remove it
				await this.removeLogo().catch(function(error){
					rejected = true;
					reject(error);
				});
			}
			if(rejected){
				return;
			}

			// Save
			await DatabaseObject.prototype.save.call(this).catch(function(err){
				rejected = true;
				reject(err);
			});
			if(rejected){
				return;
			}

			fulfill(true);
		});
	}
};