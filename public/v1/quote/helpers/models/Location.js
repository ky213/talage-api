/* eslint-disable prefer-const */
/**
 * Defines a single industry code
 */

'use strict';

const ActivityCode = require('./ActivityCode.js');
const validator = global.requireShared('./helpers/validator.js');
//const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');

module.exports = class Location {

    constructor() {
        // set by from parent business
        this.appPolicyTypeList = [];
        this.business_entity_type = '';


        this.activity_codes = [];
        this.address = '';
        this.address2 = '';
        this.city = '';
        this.full_time_employees = 0;
        this.identification_number = '';
        this.identification_number_type = null;
        this.part_time_employees = 0;
        this.square_footage = 0;
        this.territory = '';
        this.zipcode = '';
        this.state = '';
        this.state_abbr = '';

        // WC Only
        //this.unemployment_num = 0;
        this.unemployment_number = 0;
    }

    /**
	 * Populates this object with data from the request
	 *
	 * @param {object} locationDocJson - The Location from Mongoose Application Model
	 * @returns {void}
	 */
    async load(locationDocJson) {
        Object.keys(this).forEach((property) => {
            if (!Object.prototype.hasOwnProperty.call(locationDocJson, property)) {
                return;
            }

            // Trim whitespace
            if (typeof locationDocJson[property] === 'string') {
                locationDocJson[property] = locationDocJson[property].trim();
            }

            // Perform property specific tasks
            if (locationDocJson[property] && typeof locationDocJson[property] !== 'object') {
                switch (property) {
                    case "identification_number":
                        this[property] = locationDocJson.ein;
                        break;

                    case 'full_time_employees':
                    case 'part_time_employees':
                    case 'square_footage':
                    case 'year_built':
                        this[property] = parseInt(locationDocJson[property], 10);
                        break;
                    default:
                        if(locationDocJson[property]){
                            this[property] = locationDocJson[property];
                        }
                        break;
                }
            }
        }); //object loop
        //backward compatible for integration code.
        this.zip = locationDocJson.zipcode;
        this.territory = locationDocJson.state;
        this.state_abbr = locationDocJson.state;
        this.state = locationDocJson.state;
        if(this.unemployment_num){
            try{
                this.unemployment_number = parseInt(this.unemployment_num, 10);
            }
            catch(err){
                log.error(`Int Parse error on unemployment_num s${this.unemployment_num} ` + err + __location)
            }
        }
        //log.debug("Location finished load " + JSON.stringify(this));
        // 'activity_codes':
        if (locationDocJson.activityPayrollList && locationDocJson.activityPayrollList.length > 0) {
            locationDocJson.activityPayrollList.forEach((actvityPayroll) => {
                // Check if we have already seen this activity code
                let match = false;
                const tmp_id = parseInt(actvityPayroll.ncciCode, 10);
                this.activity_codes.forEach(function(modelActivityCode) {
                    if (tmp_id === modelActivityCode.ncciCode) {
                        match = true;
                        modelActivityCode.load(actvityPayroll);
                    }
                });

                // If the activity code is new, add it
                if (!match) {
                    const activity_code = new ActivityCode();
                    activity_code.load(actvityPayroll);
                    this.activity_codes.push(activity_code);
                }
            });
        }

    }

    setPolicyTypeList(appPolicyTypeList){
        this.appPolicyTypeList = appPolicyTypeList;
        this.activity_codes.forEach(function(activity_code) {
            activity_code.appPolicyTypeList = appPolicyTypeList;
        });

    }

    /**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
    validate() {
        return new Promise(async(fulfill, reject) => {
            // Validate address
            if (this.address) {
                // Check for maximum length
                if (this.address.length > 100) {
                    reject(new Error('Address exceeds maximum of 100 characters'));
                    return;
                }
            }
            else {
                reject(new Error('Missing required field: address'));
                return;
            }

            // Validate address2
            if (this.address2) {
                // Check for maximum length
                if (this.address2.length > 20) {
                    reject(new Error('Address exceeds maximum of 20 characters'));
                    return;
                }
            }

            // Validate activity_codes
            if (this.appPolicyTypeList.includes('WC')) {
                if (this.activity_codes.length) {
                    const activity_code_promises = [];
                    this.activity_codes.forEach(function(activity_code) {
                        activity_code_promises.push(activity_code.validate());
                    });
                    await Promise.all(activity_code_promises).catch(function(error) {
                        reject(error);
                    });
                }
                else {
                    reject(new Error('At least 1 class code must be provided per location'));
                    return;
                }
            }

            // Identification Number
            if (this.identification_number) {
                if (validator.ein(this.identification_number)) {
                    this.identification_number_type = 'EIN';
                }
                else if (this.business_entity_type === 'Sole Proprietorship' && validator.ssn(this.identification_number)) {
                    this.identification_number_type = 'SSN';
                }
                else {
                    reject(new Error('Invalid formatting for property: identification number.'));
                    return;
                }

                // Strip out the slashes, insurers don't like slashes
                this.identification_number = this.identification_number.replace(/-/g, '');
            }
            else {
                reject(new Error('Identification Number is required'));
                return;
            }

            /**
			 * Full-Time Employees
			 * - Integer (enforced with parseInt() on load())
			 * - >= 0
			 * - <= 99,999
			 */
            if (isNaN(this.full_time_employees) || this.full_time_employees < 0 || this.full_time_employees > 255) {
                reject(new Error('full_time_employees must be an integer between 0 and 255 inclusive'));
                return;
            }

            /**
			 * Part-Time Employees
			 * - Integer (enforced with parseInt() on load())
			 * - >= 0
			 * - <= 99,999
			 */
            if (isNaN(this.part_time_employees) || this.part_time_employees < 0 || this.part_time_employees > 255) {
                reject(new Error('part_time_employees must be an integer between 0 and 255 inclusive'));
                return;
            }

            // Validate square footage
            // BOP specific
            // - Integer (enforced with parseInt() on load())
            // - >= 100
            // - <= 99,999
            if (this.appPolicyTypeList.includes('BOP')) {
                if (!validator.isSqFtg(this.square_footage) || this.square_footage < 100 || this.square_footage > 99999) {
                    return reject(new Error('square_footage must be an integer between 100 and 99,999 inclusive'));
                }
            }

            // Validate zip
            if (this.zipcode) {
                if (!validator.isZip(this.zipcode)) {
                    log.error('Invalid formatting for location: mailing_zip. Expected 5 digit format. actual zip: ' + this.zipcode + __location)
                    reject(new Error('Invalid formatting for location: zip. Expected 5 digit format'));
                    return;
                }
            }
            else {
                log.error('Missing required field: zip' + __location)
                reject(new Error('Missing required field: zip'));
                return;
            }


            // Validate unemployment_number (WC only)
            if (this.appPolicyTypeList.includes('WC')) {
                const unemployment_number_states = [
                    'CO',
                    'HI',
                    'ME',
                    'MN',
                    'NJ',
                    'RI',
                    'UT'
                ];

                // Check if an unemployment number is required
                if (unemployment_number_states.includes(this.state_abbr)) {
                    log.debug("this.unemployment_number " + this.unemployment_number + __location)
                    if (this.unemployment_number === 0) {
                        reject(new Error(`Unemployment Number is required for all locations in ${unemployment_number_states.join(', ')}`));
                        return;
                    }
                    if (!Number.isInteger(this.unemployment_number)) {
                        reject(new Error('Unemployment Number must be an integer'));
                        return;
                    }
                }
                else {
                    if (this.territory === 'MI' && this.unemployment_number && !Number.isInteger(this.unemployment_number)) {
                        reject(new Error('Unemployment Number must be an integer in MI'));
                        return;
                    }
                    this.unemployment_number = 0;
                }
            }
            else {
                this.unemployment_number = 0;
            }

            fulfill(true);
        });
    }
};