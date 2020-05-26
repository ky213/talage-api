/**
 * Defines a single industry code
 */

'use strict';

const Contact = require('./Contact.js');
const Location = require('./Location.js');
const crypt = global.requireShared('./services/crypt.js');
const helper = global.requireShared('./helpers/helper.js');
const moment = require('moment');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class Business{

	constructor(app){
		this.app = app;

		this.association = 0;
		this.association_id = '';
		this.bureau_number = 0;
		this.contacts = [];
		this.dba = '';
		this.entity_type = '';
		this.experience_modifier = 1.00;
		this.founded = '';
		this.industry_code = 0;
		this.industry_code_description = '';
		this.locations = [];
		this.mailing_address = '';
		this.mailing_address2 = '';
		this.mailing_city = '';
		this.mailing_territory = '';
		this.mailing_zip = 0;
		this.name = '';
		this.num_owners = NaN;
		this.phone = 0;
		this.primary_territory = '';
		this.website = '';
		this.years_of_exp = 0;
		this.zip = 0;

		// WC Policies
		this.corporation_type = '';
		this.management_structure = '';
		this.owners_included = true;
		this.owners = [];
		this.unincorporated_association = null; // NH only, LLC or Corporation
	}

	/**
	 * Returns a list of all territories present in the application
	 *
	 * @returns {array} - A list of territory abbreviations
	 */
	getTerritories(){
		const territories = [];

		this.locations.forEach(function(loc){
			if(!territories.includes(loc.territory)){
				territories.push(loc.territory);
			}
		});

		return territories;
	}

	/**
	 * Returns a list of all zip codes present in the application
	 *
	 * @returns {array} - A list of zip codes
	 */
	getZips(){
		const zips = [];

		this.locations.forEach(function(loc){
			if(!zips.includes(loc.zip)){
				zips.push(loc.zip);
			}
		});

		return zips;
	}

	/**
	 * Populates this object with data from the request
	 *
	 * @param {object} data - The business data
	 * @returns {Promise.<Boolean, Error>} A promise that returns true if resolved, or an Error if rejected
	 */
	load(data){
		return new Promise((fulfill) => {
			Object.keys(this).forEach((property) => {
				if(!Object.prototype.hasOwnProperty.call(data, property)){
					return;
				}

				// Trim whitespace
				if(typeof data[property] === 'string'){
					data[property] = data[property].trim();
				}

				switch(property){
					case 'association':
					case 'association_id':
					case 'num_owners':
					case 'years_of_exp':
						this[property] = parseInt(data[property], 10);
						break;
					case 'contacts':
						data[property].forEach((c) => {
							const contact = new Contact();
							contact.load(c);
							this.contacts.push(contact);
						});
						break;
					case 'corporation_type':
					case 'management_structure':
					case 'website':
						this[property] = data[property] ? data[property].toLowerCase() : '';
						break;
					case 'experience_modifier':
						this[property] = parseFloat(data[property], 10);
						break;
					case 'founded':
						this[property] = moment(data[property], 'MM-YYYY', true);
						break;
					case 'locations':
						data[property].forEach((l) => {
							const location = new Location();
							location.app = this.app;
							location.load(l);
							this.locations.push(location);
						});
						break;
					case 'owners':
						this[property] = Array.isArray(data[property]) ? data[property] : [];
						break;
					case 'owners_included':
						this[property] = Boolean(data[property]);
						break;
					default:
						this[property] = data[property];
						break;
				}
			});
			fulfill(true);
		});
	}

	/**
	 * Populates this object with data from the database
	 *
	 * @param {int} id - The id of the business
	 * @returns {Promise.<Boolean, ServerError>} A promise that returns true if resolved, or a ServerError if rejected
	 */
	load_by_id(id){
		return new Promise(async(fulfill, reject) => {
			// Validate the business ID
			if(!await validator.business(id)){
				reject(serverHelper.requestError('Invalid business ID'));
				return;
			}

			// Build a query to get the business information from the database
			const sql = `
				SELECT \`b\`.\`dba\`, \`b\`.\`ein\`, \`b\`.\`entity_type\`, \`b\`.\`id\`, \`b\`.\`name\`, GROUP_CONCAT(\`a\`.\`id\`) AS \`locations\`
				FROM \`#__businesses\` AS \`b\`
				LEFT JOIN \`#__addresses\` AS \`a\` ON \`a\`.\`business\` = \`b\`.\`id\`
				WHERE \`b\`.\`id\` = ${db.escape(id)}
				LIMIT 1;
			`;

			// Execute that query
			let had_error = false;
			const business_info = await db.query(sql).catch(function(error){
				log.error(error);
				had_error = true;
			});
			if(had_error || !business_info || business_info.length !== 1){
				reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
				return;
			}

			// Save the results in this object and decrypt as needed
			const encrypted = [
				'dba',
				'ein',
				'name'
			];

			// Localize each property in this object
			for(const property in business_info[0]){
				// Make sure this property is a direct descendent of insurer_info, that it is also represented in this object, and that it has a value
				if(Object.prototype.hasOwnProperty.call(business_info[0], property) && Object.prototype.hasOwnProperty.call(this, property) && business_info[0][property] && business_info[0][property].length){
					// Check if this needs decryption
					if(encrypted.includes(property)){
						this[property] = await crypt.decrypt(business_info[0][property]); // eslint-disable-line no-await-in-loop
						continue;
					}
					this[property] = business_info[0][property];
				}
			}

			fulfill(true);
		});
	}

	/**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
	validate(){
		return new Promise(async(fulfill, reject) => {

			/**
			 * Zip Code (required)
			 * - Must be a string composed of 5 numeric digits
			 * - Must exist in our database
			 */
			if(this.zip){
				// Check formatting
				if(!validator.isZip(this.zip)){
					reject(serverHelper.requestError('Invalid formatting for property: zip. Expected 5 digit format'));
					return;
				}

				// Make sure we have a primary state
				const rows = await db.query(`SELECT \`territory\` FROM \`#__zip_codes\` WHERE \`zip\` = ${this.zip} LIMIT 1;`).catch(function(db_error){
					log.error(db_error);
					const error = new Error(db_error);
					error.code = 500;
					reject(error);

				});

				if(!rows || rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], 'territory')){
					reject(serverHelper.requestError('The zip code you entered is not valid'));
					return;
				}

				this.primary_territory = rows[0].territory;

			}else{
				reject(serverHelper.requestError('Missing required field: zip'));
				return;
			}

			/**
			 * Association (optional)
			 * - Defaults to null
			 * - Must be an integer >= 1
			 * - Maximum of 11 digits
			 */
			if(this.association){
				// We have association data...
				if(!Number.isInteger(this.association) || !(this.association >= 1) || this.association.toString().length > 11){
					reject(serverHelper.requestError('Association must be a positive integer between 1 and 11 digits'));
					return;
				}
			}

			/**
			 * Association ID (conditionally required)
			 * - Required if Association is set
			 * - Cannot exceed 20 characters
			 */
			if(this.association){
				// Required if association is present
				if(this.association_id === ''){
					reject(serverHelper.requestError('Association ID is required'));
					return;
				}
				// Max length 20 characters
				if(this.association_id.toString().length > 20){
					reject(serverHelper.requestError('Association ID must be less than 20 characters'));
					return;
				}
			}

			/**
			 * Bureau Number (optional)
			 * - <= 999999999
			 * - In CA, must be formatted as ##-##-##
			 * - All other states, must be formatted as #########
			 */
			if(this.bureau_number){
				if(this.bureau_number.length > 9){
					reject(serverHelper.requestError('Bureau Number max length is 9'));
					return;
				}
				if(this.primary_territory.toString().toUpperCase() === 'CA'){
					// Expected Formatting for 'CA' is 99-99-99
					if(!validator.isBureauNumberCA(this.bureau_number)){
						reject(serverHelper.requestError('Bureau Number must be formatted as 99-99-99'));
						return;
					}
				}else if(!validator.isBureauNumberNotCA(this.bureau_number)){
					// Expected Formatting for all other states is 999999999
					reject(serverHelper.requestError('Bureau Number must be numeric'));
					return;
				}
			}

			/**
			 * Contacts (required - validation handled in Contact object)
			 */
			if(this.contacts.length){
				const contact_promises = [];
				this.contacts.forEach(function(contact){
					contact_promises.push(contact.validate());
				});

				let error = null;
				await Promise.all(contact_promises).catch(function(contact_error){
					error = contact_error;
				});
				if(error){
					reject(error);
					return;
				}
			}else{
				reject(serverHelper.requestError('At least 1 contact must be provided'));
				return;
			}

			/**
			 * DBA (optional)
			 * - Must be a valid business name
			 * - Must be 100 characters or less
			 */
			if(this.dba){
				// Check for invalid characters
				if(!validator.isBusinessName(this.dba)){
					reject(serverHelper.requestError('Invalid characters in DBA'));
					return;
				}

				// Check for max length
				if(this.dba.length > 100){
					reject(serverHelper.requestError('DBA exceeds maximum length of 100 characters'));
					return;
				}
			}

			/**
			 * Entity Type (required)
			 * - Must be one of our supported entity types
			 */
			if(this.entity_type){
				// Check that provided value is one of the supported values
				const valid_types = [
					'Association',
					'Corporation',
					'Limited Liability Company',
					'Limited Partnership',
					'Partnership',
					'Sole Proprietorship',
					'Other'
				];
				if(valid_types.indexOf(this.entity_type) === -1){
					reject(serverHelper.requestError('Invalid data in property: entity_type'));
					return;
				}
			}else{
				reject(serverHelper.requestError('Missing property: entity_type'));
				return;
			}

			/**
			 * Experience Modifier (optional)
			 * - Only accepted if a Bureau Number is provided
			 * - Defaults to 1.00 if nothing is specified
			 * - Minimum Value = 0.20 (Not inclusive)
			 * - Maximum Value = 10 (Not inclusive)
			 */
			if(this.bureau_number){
				if(this.experience_modifier < 0.20 || this.experience_modifier > 10){
					reject(serverHelper.requestError('Experience Modifier must be between 0.20 and 10'));
					return;
				}
			}

			/**
			 * Founded (required)
			 * - Must be a valid date formatted mm-yyyy
			 * - Cannot be in the future
			 * - Cannot be prior to July 4, 1776
			 */
			if(this.founded){
				// Check for mm-yyyy formatting
				if(!this.founded.isValid()){
					reject(serverHelper.requestError('Invalid formatting for property: founded. Expected mm-yyyy'));
					return;
				}

				// Confirm date is not in the future
				if(this.founded.isAfter(moment())){
					reject(serverHelper.requestError('Invalid value for property: founded. Founded date cannot be in the future'));
					return;
				}

				// Confirm founded date is at least somewhat reasonable
				if(this.founded.isBefore(moment('07-04-1776', 'MM-DD-YYYY'))){
					reject(serverHelper.requestError('Invalid value for property: founded. Founded date is far past'));
					return;
				}
			}else{
				reject(serverHelper.requestError('Missing property: founded'));
				return;
			}

			/**
			 * Industry Code (required)
			 * - > 0
			 * - <= 99999999999
			 * - Must existin our database
			 */
			if(this.industry_code){
				this.industry_code_description = await validator.industry_code(this.industry_code);
				if(!this.industry_code_description){
					reject(serverHelper.requestError('The industry code ID you provided is not valid'));
					return;
				}
			}else{
				reject(serverHelper.requestError('Missing property: industry_code'));
				return;
			}

			/**
			 * Locations (required - validation handled in Location object)
			 */
			if(this.locations.length){
				const location_promises = [];
				this.locations.forEach(function(location){
					location_promises.push(location.validate());
				});

				let error = null;
				await Promise.all(location_promises).catch(function(location_error){
					error = location_error;
				});
				if(error){
					reject(error);
					return;
				}
			}else{
				reject(serverHelper.requestError('At least 1 location must be provided'));
				return;
			}

			/**
			 * Management Structure (required only for LLCs in MT)
			 * - Must be either 'member' or 'manager'
			 */
			if(this.app.has_policy_type('WC') && this.entity_type === 'Limited Liability Company' && this.primary_territory === 'MT'){
				if(this.management_structure){
					if(!validator.management_structure(this.management_structure)){
						reject(serverHelper.requestError('Invalid management structure. Must be either "member" or "manager."'));
						return;
					}
				}else{
					reject(serverHelper.requestError('Missing required field: management_structure'));
					return;
				}
			}

			/**
			 * Mailing Address (required)
			 * - Must be under 100 characters
			 */
			if(this.mailing_address){
				// Check for maximum length
				if(this.mailing_address.length > 100){
					reject(serverHelper.requestError('Mailing address exceeds maximum of 100 characters'));
					return;
				}
			}else{
				reject(serverHelper.requestError('Missing required field: mailing_address'));
				return;
			}

			/**
			 * Mailing Zip (required)
			 * - Must be a 5 digit string
			 */
			if(this.mailing_zip){
				if(!validator.isZip(this.mailing_zip)){
					reject(serverHelper.requestError('Invalid formatting for property: mailing_zip. Expected 5 digit format'));
					return;
				}

				// Make sure we have match in our database
				await db.query(`SELECT \`city\`, \`territory\` FROM \`#__zip_codes\` WHERE \`zip\` = ${this.mailing_zip} LIMIT 1;`).then((row) => {
					if(row){
						this.mailing_city = row[0].city;
						this.mailing_territory = row[0].territory;
					}else{
						reject(serverHelper.requestError('The mailing_zip code you entered is not valid'));
					}
				}).catch(function(error){
					log.warn(error);
					reject(serverHelper.requestError('The mailing_zip code you entered is not valid'));
				});
			}else{
				reject(serverHelper.requestError('Missing required field: mailing_zip'));
				return;
			}

			/**
			 * Name (required)
			 * - Must be a valid business name
			 * - Must be 100 characters or less
			 */
			if(this.name){
				// Check for invalid characters
				if(!validator.isBusinessName(this.name)){
					reject(serverHelper.requestError('Invalid characters in name'));
					return;
				}

				// Check for max length
				if(this.name.length > 100){
					reject(serverHelper.requestError('Name exceeds maximum length of 100 characters'));
					return;
				}
			}else{
				reject(serverHelper.requestError('Missing required field: name'));
				return;
			}

			/**
			 * Number of Owners (conditionally required)
			 * - > 0
			 * - <= 99
			 */
			if(isNaN(this.num_owners)){
				reject(serverHelper.requestError('You must specify the number of owners in the business.'));
				return;
			}
			if(this.num_owners < 1){
				reject(serverHelper.requestError('Number of owners cannot be less than 1.'));
				return;
			}
			if(this.num_owners > 99){
				reject(serverHelper.requestError('Number of owners cannot exceed 99.'));
				return;
			}

			/**
			 * Corporation type (required only for WC for Corporations in PA that are excluding owners)
			 * - Must be one of 'c', 'n', or 's'
			 */
			if(this.app.has_policy_type('WC') && this.entity_type === 'Corporation' && this.primary_territory === 'PA' && !this.owners_included){
				if(this.corporation_type){
					if(!validator.corporation_type(this.corporation_type)){
						reject(serverHelper.requestError('Invalid corporation type. Must be "c" (c-corp), "n" (non-profit), or "s" (s-corp).'));
						return;
					}
				}else{
					reject(serverHelper.requestError('Missing required field: corporation_type'));
					return;
				}
			}

			/**
			 * Owners (conditionally required)
			 * - Only used for WC policies, ignored otherwise
			 * - Only required if owners_included is false
			 */
			if(this.app.has_policy_type('WC') && !this.owners_included){
				if(this.owners.length){
					// TO DO: Owner validation is needed here
				}else{
					reject(serverHelper.requestError('The names of owners must be supplied if they are not included in this policy.'));
					return;
				}
			}

			/**
			 * Phone (required)
			 * - Must be a valid 9 digit phone number
			 */
			if(this.phone){
				// Check that it is valid
				if(!validator.phone(this.phone)){
					reject(serverHelper.requestError('The phone number you provided is not valid. Please try again.'));
					return;
				}

				// Clean up the phone number for storage
				if(typeof this.phone === 'number'){
					this.phone = this.phone.toString();
				}
				if(this.phone.startsWith('+')){
					this.phone = this.phone.slice(1);
				}
				if(this.phone.startsWith('1')){
					this.phone = this.phone.slice(1);
				}
				this.phone = this.phone.replace(/[^0-9]/ig, '');
				this.phone = parseInt(this.phone, 10);
			}else{
				reject(serverHelper.requestError('Missing required field: phone'));
				return;
			}

			/**
			 * Unincorporated Association (Required only for WC, in NH, and for LLCs and Corporations)
			 */
			if(this.app.has_policy_type('WC') && (this.entity_type === 'Corporation' || this.entity_type === 'Limited Liability Company') && this.primary_territory === 'NH'){

				// This is required
				if(this.unincorporated_association === null){
					reject(serverHelper.requestError('Missing required field: unincorporated_association'));
					return;
				}

				// Validate
				if(!validator.boolean(this.unincorporated_association)){
					reject(serverHelper.requestError('Invalid value for unincorporated_association, please use a boolean value'));
					return;
				}

				// Prepare the value for later use
				this.unincorporated_association = helper.convert_to_boolean(this.unincorporated_association);
			}

			/**
			 * Website (optional)
			 * - Must be a valid URL
			 * - Must be 100 characters or less
			 */
			if(this.website){
				// Check formatting
				if(!validator.isWebsite(this.website)){
					reject(serverHelper.requestError('Invalid formatting for property: website. Expected a valid URL'));
					return;
				}

				// Check length
				if(this.website.length > 100){
					reject(serverHelper.requestError('Website exceeds max length of 100 characters'));
					return;
				}
			}

			/*
			 * Years of Experience (conditionally required)
			 * - Only required if founded less than 3 years ago
			 * - Must be a number between 0 and 99
			 */
			if(this.founded.isAfter(moment().subtract(3, 'years'))){
				if(this.years_of_exp < 0 || this.years_of_exp > 99){
					reject(serverHelper.requestError('Invalid value for property: years_of_exp. Value must be between 0 and 100 (not inclusive)'));
					return;
				}
			}

			fulfill(true);
		});
	}
};