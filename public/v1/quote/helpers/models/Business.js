/* eslint-disable valid-jsdoc */
/* eslint-disable prefer-const */
/**
 * Defines a single industry code
 */

'use strict';

const Contact = require('./Contact.js');
const Location = require('./Location.js');
const moment = require('moment');
//const {reject} = require('async');
const validator = global.requireShared('./helpers/validator.js');
const crypt = global.requireShared('./services/crypt.js');

//const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');


module.exports = class Business {

    constructor() {
        this.appPolicyTypeList = [];
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
        this.mailing_state_abbr = '';
        this.mailing_zipcode = '';
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
    getTerritories() {
        const territories = [];

        this.locations.forEach(function(loc) {
            if (!territories.includes(loc.state)) {
                territories.push(loc.state);
            }
        });

        return territories;
    }

    /**
	 * Returns a list of all zip codes present in the application
	 *
	 * @returns {array} - A list of zip codes
	 */
    getZips() {
        const zips = [];

        this.locations.forEach(function(loc) {
            if (!zips.includes(loc.zipcode)) {
                zips.push(loc.zipcode);
            }
        });

        return zips;
    }

    setPolicyTypeList(appPolicyTypeList) {
        this.appPolicyTypeList = appPolicyTypeList;
        this.locations.forEach(function(loc) {
            loc.setPolicyTypeList(appPolicyTypeList);
        });

    }


    //mapping function
    mapToSnakeCaseJSON(sourceJSON, targetJSON, propMappings){
        for(const sourceProp in sourceJSON){
            if(typeof sourceJSON[sourceProp] !== "object"){
                if(propMappings[sourceProp]){
                    const appProp = propMappings[sourceProp]
                    targetJSON[appProp] = sourceJSON[sourceProp];
                }
                else {
                //check if snake_case
                    targetJSON[sourceProp.toSnakeCase()] = sourceJSON[sourceProp];
                }

            }
        }
    }


    /**
	 * Populates this object with data from the request
	 *
     * @param {object} applicationDoc - The App data
	 * @returns  returns true , or an Error if rejected
	 */
    async load(applicationDoc) {
        let data2 = {}
        const applicationDocJSON = JSON.parse(JSON.stringify(applicationDoc))
        const propMappings = {}
        this.mapToSnakeCaseJSON(applicationDocJSON, data2, propMappings);
        //log.debug("data2 " + JSON.stringify(data2));
        //population from database record
        try {
            Object.keys(this).forEach((property) => {
                if (!Object.prototype.hasOwnProperty.call(data2, property)) {
                    return;
                }
                // Trim whitespace
                if (typeof data2[property] === 'string') {
                    data2[property] = data2[property].trim();
                }
                switch (property) {
                    case "industry_code":
                        //database has it as int, downstream expects string.
                        this.industry_code = data2.industry_code.toString();
                        break;
                    case 'website':
                        this[property] = data2[property] ? data2[property].toLowerCase() : '';
                        break;
                    default:
                        if (data2[property]) {
                            this[property] = data2[property];
                        }
                        break;
                }
            });
            //log.debug("Business: " + JSON.stringify(this));
            //backward compatible for integration code.
            this.zip = applicationDocJSON.mailingZipcode;
            this.mailing_zip = applicationDocJSON.mailingZipcode;
            this.mailing_territory = applicationDocJSON.mailingState;
            this.mailing_state_abbr = applicationDocJSON.mailingState;
        }
        catch (e) {
            log.error('populating business from db error: ' + e + __location)
        }
        this.name = applicationDocJSON.businessName;
        this.founded = moment(applicationDocJSON.founded);
        this.owners = applicationDocJSON.owners;
        this.industry_code = data2.industry_code.toString();

        this.owners_included = applicationDocJSON.ownersCovered;
        this.years_of_exp = applicationDocJSON.yearsOfExp;
        this.primary_territory = applicationDocJSON.mailingState;

        if (applicationDocJSON.contacts && applicationDocJSON.contacts.length > 0) {
            this.phone = applicationDocJSON.contacts[0].phone;
            for (let i = 0; i < applicationDocJSON.contacts.length; i++) {
                const contact = new Contact();
                contact.load(applicationDocJSON.contacts[i]);
                this.contacts.push(contact);
            }
        }
        if (applicationDocJSON.locations && applicationDocJSON.locations.length > 0) {
            for (let i = 0; i < applicationDocJSON.locations.length; i++) {
                const appDocLocation = applicationDocJSON.locations[i];
                const location = new Location();
                try {
                    await location.load(appDocLocation);
                }
                catch (err) {
                    log.error(`Unable to load location ${JSON.stringify(appDocLocation)}: ${err} ${__location}`);
                    throw err;
                }
                location.business_entity_type = applicationDocJSON.entityType;
                location.identification_number = appDocLocation.ein ? appDocLocation.ein : applicationDocJSON.ein;
                //location.identification_number
                if (applicationDocJSON.hasEin) {
                    location.identification_number = `${location.identification_number.substr(0, 2)}-${location.identification_number.substr(2, 7)}`;
                }
                else {
                    location.identification_number = `${location.identification_number.substr(0, 3)}-${location.identification_number.substr(3, 2)}-${location.identification_number.substr(5, 4)}`;
                }
                // log.debug('business location adding ' + JSON.stringify(location));
                this.locations.push(location);
            }
        }
        else {
            log.error("Missing locations application  " + applicationDocJSON.applicationId + __location);
        }


        // log.debug(JSON.stringify(this));
        return;

    }

    /**
	 * Populates this object with data from the database
	 *
	 * @param {int} id - The id of the business
	 * @returns {Promise.<Boolean, ServerError>} A promise that returns true if resolved, or a ServerError if rejected
	 */
    load_by_id(id) {
        return new Promise(async(fulfill, reject) => {
            // Validate the business ID
            if (!await validator.business(id)) {
                reject(new Error('Invalid business ID'));
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
            const business_info = await db.query(sql).catch(function(error) {
                log.error("Loading business error: " + error + __location);
                had_error = true;
            });
            if (had_error || !business_info || business_info.length !== 1) {
                reject(new Error('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
                return;
            }

            // Save the results in this object and decrypt as needed
            const encrypted = [
                'dba',
                'ein',
                'name'
            ];

            // Localize each property in this object
            for (const property in business_info[0]) {
                // Make sure this property is a direct descendent of insurer_info, that it is also represented in this object, and that it has a value
                if (Object.prototype.hasOwnProperty.call(business_info[0], property) && Object.prototype.hasOwnProperty.call(this, property) && business_info[0][property] && business_info[0][property].length) {
                    // Check if this needs decryption
                    if (encrypted.includes(property)) {
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
    validate() {
        return new Promise(async(fulfill, reject) => {


            /**
			 * Association (optional)
			 * - Defaults to null
			 * - Must be an integer >= 1
			 * - Maximum of 11 digits
			 */
            if (this.association) {
                if(typeof this.association === 'string'){
                    try{
                        this.association = parseInt(this.association, 10);
                    }
                    catch(err){
                        log.error("Error converting association to integer " + err + __location);
                    }
                }
                // We have association data...
                if (!Number.isInteger(this.association) || !(this.association >= 1) || this.association.toString().length > 11) {
                    reject(new Error('Association must be a positive integer between 1 and 11 digits'));
                    return;
                }
            }

            /**
			 * Association ID (conditionally required)
			 * - Required if Association is set
			 * - Cannot exceed 20 characters
			 */
            if (this.association) {
                // Required if association is present
                if (this.association_id === '') {
                    reject(new Error('Association ID is required'));
                    return;
                }
                // Max length 20 characters
                if (this.association_id.toString().length > 20) {
                    reject(new Error('Association ID must be less than 20 characters'));
                    return;
                }
            }

            /**
			 * Bureau Number (optional)
			 * - <= 999999999
			 * - In CA, must be formatted as ##-##-##
			 * - All other states, must be formatted as #########
			 */
            try{
                if (this.bureau_number) {
                    if (this.bureau_number.length > 9) {
                        reject(new Error('Bureau Number max length is 9'));
                        return;
                    }
                    if (this.primary_territory.toString().toUpperCase() === 'CA') {
                    // Expected Formatting for 'CA' is 99-99-99
                        if (!validator.isBureauNumberCA(this.bureau_number)) {
                            reject(new Error('Bureau Number must be formatted as 99-99-99'));
                            return;
                        }
                    }
                    else if (!validator.isBureauNumberNotCA(this.bureau_number)) {
                    // Expected Formatting for all other states is 999999999
                        reject(new Error('Bureau Number must be numeric'));
                        return;
                    }
                }
            }
            catch(err){
                log.error("Business Validation bureau_number error " + err + __location)
            }


            /**
			 * Contacts (required - validation handled in Contact object)
			 */
            if (this.contacts.length) {
                const contact_promises = [];
                this.contacts.forEach(function(contact) {
                    contact_promises.push(contact.validate());
                });

                let error = null;
                await Promise.all(contact_promises).catch(function(contact_error) {
                    error = contact_error;
                });
                if (error) {
                    // TODO Consistent return ERROR type - currently mixed
                    reject(error);
                    return;
                }
            }
            else {
                reject(new Error('At least 1 contact must be provided'));
                return;
            }

            /**
			 * DBA (optional)
			 * - Must be a valid business name
			 * - Must be 100 characters or less
			 */
            if (this.dba) {
                // Check for invalid characters
                if (!validator.isBusinessName(this.dba)) {
                    reject(new Error('Invalid characters in DBA'));
                    return;
                }

                // Check for max length
                if (this.dba.length > 100) {
                    reject(new Error('DBA exceeds maximum length of 100 characters'));
                    return;
                }
            }

            /**
			 * Entity Type (required)
			 * - Must be one of our supported entity types
			 */
            if (this.entity_type) {
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
                if (valid_types.indexOf(this.entity_type) === -1) {
                    reject(new Error('Invalid data in property: entity_type'));
                    return;
                }
            }
            else {
                reject(new Error('Missing property: entity_type'));
                return;
            }

            /**
			 * Experience Modifier (optional)
			 * - Only accepted if a Bureau Number is provided
			 * - Defaults to 1.00 if nothing is specified
			 * - Minimum Value = 0.20 (Not inclusive)
			 * - Maximum Value = 10 (Not inclusive)
			 */
            if (this.bureau_number) {
                if (this.experience_modifier < 0.20 || this.experience_modifier > 10) {
                    reject(new Error('Experience Modifier must be between 0.20 and 10'));
                    return;
                }
            }

            /**
			 * Founded (required)
			 * - Must be a valid date formatted mm-yyyy
			 * - Cannot be in the future
			 * - Cannot be prior to July 4, 1776
			 */
            if (this.founded) {
                // Check for mm-yyyy formatting
                if (!this.founded.isValid()) {
                    reject(new Error('Invalid formatting for property: founded. Expected mm-yyyy'));
                    return;
                }

                // Confirm date is not in the future
                if (this.founded.isAfter(moment())) {
                    reject(new Error('Invalid value for property: founded. Founded date cannot be in the future'));
                    return;
                }

                // Confirm founded date is at least somewhat reasonable
                if (this.founded.isBefore(moment('07-04-1776', 'MM-DD-YYYY'))) {
                    reject(new Error('Invalid value for property: founded. Founded date is far past'));
                    return;
                }
            }
            else {
                reject(new Error('Missing property: founded'));
                return;
            }

            /**
			 * Industry Code (required)
			 * - > 0
			 * - <= 99999999999
			 * - Must existin our database
			 */
            if (this.industry_code) {
                this.industry_code_description = await validator.industry_code(this.industry_code);
                if (!this.industry_code_description) {
                    reject(new Error('The industry code ID you provided is not valid'));
                    return;
                }
            }
            else {
                reject(new Error('Missing property: industry_code'));
                return;
            }

            /**
			 * Locations (required - validation handled in Location object)
			 */
            if (this.locations.length) {
                const location_promises = [];
                this.locations.forEach(function(location) {
                    location_promises.push(location.validate());
                });

                let error = null;
                await Promise.all(location_promises).catch(function(location_error) {
                    error = location_error;
                });
                if (error) {
                    // TODO Consistent return ERROR type - currently mixed
                    reject(error);
                    return;
                }
            }
            else {
                reject(new Error('At least 1 location must be provided'));
                return;
            }

            /**
			 * Mailing Address (required)
			 * - Must be under 100 characters
			 */
            if (this.mailing_address) {
                // Check for maximum length
                if (this.mailing_address.length > 100) {
                    reject(new Error('Mailing address exceeds maximum of 100 characters'));
                    return;
                }
            }
            else {
                reject(new Error('Missing required field: mailing_address'));
                return;
            }

            /**
			 * Mailing Zip (required)
			 * - Must be a 5 digit string
			 */
            if (this.mailing_zipcode) {
                if (!validator.isZip(this.mailing_zipcode)) {
                    log.error('Invalid formatting for business: mailing_zip. Expected 5 digit format. actual zip: ' + this.mailing_zipcode + __location)
                    reject(new Error('Invalid formatting for business: mailing_zip. Expected 5 digit format ' + this.mailing_zipcode));
                    return;
                }
            }
            else {
                log.error('Missing required field: business mailing_zip' + __location);
                reject(new Error('Missing required field:  business mailing_zip'));
                return;
            }

            /**
			 * Name (required)
			 * - Must be a valid business name
			 * - Must be 100 characters or less
			 */
            if (this.name) {
                // Check for invalid characters
                if (!validator.isBusinessName(this.name)) {
                    log.error('Invalid characters in name ' + __location);
                    reject(new Error('Invalid characters in name'));
                    return;
                }

                // Check for max length
                if (this.name.length > 100) {
                    reject(new Error('Name exceeds maximum length of 100 characters'));
                    return;
                }
            }
            else {
                reject(new Error('Missing required field: name'));
                return;
            }

            /**
			 * Number of Owners (conditionally required)
			 * - > 0
			 * - <= 99
			 */
            if(!this.num_owners){
                log.error('You must specify the number of owners in the business' + __location);
                reject(new Error('You must specify the number of owners in the business.'));
                return;
            }

            if (isNaN(this.num_owners)) {
                log.error('You must specify the number of owners in the business' + __location);
                reject(new Error('You must specify the number of owners in the business.'));
                return;
            }
            if (this.num_owners < 1) {
                reject(new Error('Number of owners cannot be less than 1.'));
                return;
            }
            if (this.num_owners > 99) {
                reject(new Error('Number of owners cannot exceed 99.'));
                return;
            }


            /**
			 * Phone (required)
			 * - Must be a valid 9 digit phone number
			 */
            if (this.phone) {
                // Check that it is valid
                if (!validator.phone(this.phone)) {
                    reject(new Error('The phone number you provided is not valid. Please try again.'));
                    return;
                }

                // Clean up the phone number for storage
                if (typeof this.phone === 'number') {
                    this.phone = this.phone.toString();
                }
                if (this.phone.startsWith('+')) {
                    this.phone = this.phone.slice(1);
                }
                if (this.phone.startsWith('1')) {
                    this.phone = this.phone.slice(1);
                }
                this.phone = this.phone.replace(/[^0-9]/ig, '');
                this.phone = parseInt(this.phone, 10);
            }
            else {
                reject(new Error('Missing required field: phone'));
                return;
            }


            /**
			 * Website (optional)
			 * - Must be a valid URL
			 * - Must be 100 characters or less
			 */
            if (this.website) {
                // Check formatting
                if (!validator.isWebsite(this.website)) {
                    reject(new Error('Invalid formatting for property: website. Expected a valid URL'));
                    return;
                }

                // Check length
                if (this.website.length > 100) {
                    reject(new Error('Website exceeds max length of 100 characters'));
                    return;
                }
            }

            // Years of Experience (conditionally required)
            // - Only required if founded less than 3 years ago
            // - Must be a number between 0 and 99
            if (this.founded.isAfter(moment().subtract(3, 'years'))) {
                if (this.years_of_exp < 0 || this.years_of_exp > 99) {
                    reject(new Error('Invalid value for property: years_of_exp. Value must be between 0 and 100 (not inclusive)'));
                    return;
                }
            }

            fulfill(true);
        });
    }
};