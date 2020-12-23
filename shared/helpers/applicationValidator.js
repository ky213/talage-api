

/**
 * Provides functions for validating data
 */

'use strict';

const validator = require('./validator.js');
const serverHelper = require('../../server.js');
const moment = require('moment');

/**
 * Checks that the data supplied is valid - Rejection should be done inside the Insurer Integration files.
 *  since rules vary by insurer and policy type.
 *
 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
*/
const validateBusiness = async (business) => {
    return new Promise(async(fulfill, reject) => {

        /**
         * Bureau Number (optional)
         * - <= 999999999
         * - In CA, must be formatted as ##-##-##
         * - All other states, must be formatted as #########
         */
        try {
            if (business.bureau_number) {
                if (business.bureau_number.length > 9) {
                    log.warn(`Bureau Number max length is 9 appId: ${business.appId}` + __location);
                }
                if (business.primary_territory.toString().toUpperCase() === 'CA') {
                // Expected Formatting for 'CA' is 99-99-99
                    if (!validator.isBureauNumberCA(business.bureau_number)) {
                        log.error(`Bureau Number must be formatted as 99-99-99 appId: ${business.appId}` + __location);
                    }
                }
                else if (!validator.isBureauNumberNotCA(business.bureau_number)) {
                // Expected Formatting for all other states is 999999999
                    log.error(`Bureau Number must be numeric appId: ${business.appId}` + __location);
                }
            }
        } catch (e) {
            log.error(`Business Validation bureau_number error: ${e} ${__location}`)
        }


        /**
         * Contacts (required - validation handled in Contact object)
         */
        if (business.contacts.length) {
            const contact_promises = [];
            business.contacts.forEach(contact => {
                contact_promises.push(validateContact(contact)); 
            });

            let error = null;
            await Promise.all(contact_promises).catch(contact_error => {
                error = contact_error;
            });
            if (error) {
                // TODO Consistent return ERROR type - currently mixed
                return reject(error);
            }
        } else {
            return reject(new Error('At least 1 contact must be provided'));
        }

        /**
         * DBA (optional)
         * - Must be a valid business name
         * - Must be 100 characters or less
         */
        if (business.dba) {
            // Check for invalid characters
            //Do not stop the quote over dba name.  Different insurers have different rules
            if (!validator.isBusinessName(business.dba)) {
                log.warn(`Invalid characters in DBA. Appid ${business.appId}` + __location)
                //reject(new Error('Invalid characters in DBA')
                //return;
            }

            // Check for max length
            //Do not stop the quote over dba name.  Different insurers have different rules
            if (business.dba.length > 100) {
                log.warn(`DBA exceeds maximum length of 100 characters Appid ${business.appId}` + __location);
                business.dba = business.dba.substring(0,100);
                // reject(new Error('DBA exceeds maximum length of 100 characters'));
                // return;
            }
        }

        /**
         * Entity Type (required)
         * - Must be one of our supported entity types
         */
        if (business.entity_type) {
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
            if (valid_types.indexOf(business.entity_type) === -1) {
                log.error(`Invalid data in property: entity_type Appid ${business.appId}` + __location);
            }
        } else {
            return reject(new Error('Missing property: entity_type'));
        }

        /**
         * Experience Modifier (optional)
         * - Only accepted if a Bureau Number is provided
         * - Defaults to 1.00 if nothing is specified
         * - Minimum Value = 0.20 (Not inclusive)
         * - Maximum Value = 10 (Not inclusive)
         * limited use of experience_modifier in integration files.
         *  only log warning.
         */
        if (business.bureau_number) {
            if (business.experience_modifier < 0.20 || business.experience_modifier > 10) {
                log.warn(`Experience Modifier must be between 0.20 and 10 Appid ${business.appId}` + __location);
            }
        }

        /**
         * Founded (required)
         * - Must be a valid date formatted mm-yyyy
         * - Cannot be in the future
         * - Cannot be prior to July 4, 1776
         */
        if (business.founded) {
            // Check for mm-yyyy formatting
            if (!business.founded.isValid()) {
                return reject(new Error('Invalid Date for founded.'));
            }

            // Confirm date is not in the future
            if (business.founded.isAfter(moment())) {
                return reject(new Error('Invalid value for property: founded. Founded date cannot be in the future'));
            }

            // Confirm founded date is at least somewhat reasonable
            if (business.founded.isBefore(moment('07-04-1776', 'MM-DD-YYYY'))) {
                return reject(new Error('Invalid value for property: founded. Founded date is too far in the past.'));
            }
        } else {
            return reject(new Error('Missing property: founded'));
        }

        /**
         * Industry Code (required)
         * - > 0
         * - <= 99999999999
         * - Must existin our database
         */
        if (business.industry_code) {
            business.industry_code_description = await validator.industry_code(business.industry_code);
            if (!business.industry_code_description) {
                return reject(new Error('The industry code ID you provided is not valid'));
            }
        } else {
            return reject(new Error('Missing property: industry_code'));
        }

        /**
         * Locations (required - validation handled in Location object)
         */
        if (business.locations.length) {
            const location_promises = [];
            business.locations.forEach(location => {
                location_promises.push(validateLocation(location));
            });

            let error = null;
            await Promise.all(location_promises).catch(location_error => {
                error = location_error;
            });
            if (error) {
                // TODO Consistent return ERROR type - currently mixed
                return reject(error);
            }
        } else {
            return reject(new Error('At least 1 location must be provided'));
        }

        /**
         * Mailing Address (required)
         * - Must be under 100 characters
         */
        if (business.mailing_address) {
            // Check for maximum length
            if (business.mailing_address.length > 100) {
                log.error('Mailing address exceeds maximum of 100 characters');
                business.mailing_address = business.mailing_address.substring(0,100);
            }
        } else {
            return reject(new Error('Missing required field: mailing_address'));
        }

        /**
         * Mailing Zip (required)
         * - Must be a 5 digit string
         */
        if (business.mailing_zipcode) {
            //let 9 digit zipcodes process.  log an error
            if (!validator.isZip(business.mailing_zipcode)) {
                log.error(`Invalid formatting for business: mailing_zip. Expected 5 digit format. appId: ${business.AppId} actual zip: ` + business.mailing_zipcode + __location)
            }
        } else {
            log.error('Missing required field: business mailing_zip' + __location);
            return reject(new Error('Missing required field:  business mailing_zip'));
        }

        /**
         * Name (required)
         * - Must be a valid business name
         * - Must be 100 characters or less
         */
        if (business.name) {
            // Check for invalid characters
            // Let different Insurers have different rules
            // reject and clean rules should be in insurer integrations files.
            if (!validator.isBusinessName(business.name)) {
                log.error(`Invalid characters in name appId: ${business.appId}` + __location);
            }

            // Check for max length
            if (business.name.length > 100) {
                return reject(new Error('Name exceeds maximum length of 100 characters'));
            }
        } else {
            return reject(new Error('Missing required field: name'));
        }

        /**
         * Number of Owners (conditionally required)
         * 0 < num_owners <= 99
         */
        if(!business.num_owners){
            // Depend on insurer and policyType.
            // reject decision should be in insurer integration file.  as of 11/14/2020 only Acuity and BTIS are using num_owners
            log.warn(`You must specify the number of owners in the business appId: ${business.appId}` + __location);
        }

        if (business.num_owners && isNaN(business.num_owners)) {
            log.error('Number of owners in the business must be a number' + __location);
            return reject(new Error('Number of owners in the business must be a number.'));
        }

        if (business.num_owners && business.num_owners < 1) {
            return reject(new Error('Number of owners cannot be less than 1.'));
        }

        if (business.num_owners && business.num_owners > 99) {
            return reject(new Error('Number of owners cannot exceed 99.'));
        }

        /**
         * Phone (required)
         * - Must be a valid 9 digit phone number
         */
        if (business.phone) {
            // Check that it is valid
            if (!validator.phone(business.phone)) {
                return reject(new Error('The phone number you provided is not valid. Please try again.'));
            }

            // Clean up the phone number for storage
            if (typeof business.phone === 'number') {
                business.phone = business.phone.toString();
            }

            if (business.phone.startsWith('+')) {
                business.phone = business.phone.slice(1);
            }

            if (business.phone.startsWith('1')) {
                business.phone = business.phone.slice(1);
            }

            business.phone = business.phone.replace(/[^0-9]/ig, '');
            business.phone = parseInt(business.phone, 10);
        } else {
            return reject(new Error('Missing required field: phone'));
        }

        /**
         * Website (optional)
         * - Must be a valid URL
         * - Must be 100 characters or less
         */
        if (business.website) {
            // Check formatting
            if (!validator.isWebsite(business.website)) {
                log.info(`Invalid formatting for property: website. Expected a valid URL for ${business.appId}`)
                business.website = '';
            }

            // Check length if too long eliminate from qoute app
            if (business.website.length > 100) {
                log.info(`Invalid value for property: website. over 100 characters for ${business.appId}`)
                business.website = '';
            }
        }

        // Years of Experience (conditionally required)
        // - Only required if founded less than 3 years ago
        // - Must be a number between 0 and 99
        if (business.founded.isAfter(moment().subtract(3, 'years'))) {
            if (business.years_of_exp < 0 || business.years_of_exp > 99) {
                //let it quote and the insurer reject it.
                log.info(`Invalid value for property: years_of_exp. Value must be between 0 and 100 (not inclusive) for ${business.appId}`)
            }
        }

        fulfill(true);
    });
}

/**
 * Checks that the data supplied is valid
 *
 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
 */
const validateContact = async (contact) => {
    return new Promise((fulfill, reject) => {

        // TO DO: Validate all fields here
        // Store the most recent validation message in the 'error' property

        // Validate email
        if (contact.email) {
            const email_result = validator.email(contact.email);
            if (email_result !== true) {
                return reject(new Error('Invalid email'));
            }
        } else {
            return reject(new Error('Missing required field in contact: email'));
        }

        // Validate first_name
        if (contact.first_name) {
            if (!validator.isName(contact.first_name)) {
                return reject(new Error('Invalid characters in first_name'));
            }

            if (contact.first_name.length > 30) {
                return reject(new Error('First name exceeds maximum length of 30 characters'));
            }
        } else {
            return reject(new Error('Missing required field in contact: first_name'));
        }

        // Validate last_name
        if (contact.last_name) {
            if (!validator.isName(contact.last_name)) {
                return reject(new Error('Invalid characters in last_name'));
            }

            if (contact.last_name.length > 30) {
                return reject(new Error('Last name exceeds maximum length of 30 characters'));
            }
        } else {
            return reject(new Error('Missing required field in contact: last_name'));
        }

        // Validate phone
        if (contact.phone) {
            // Check that it is valid
            if (!validator.phone(contact.phone)) {
                return reject(new Error('The phone number you provided is not valid. Please try again.'));
            }

            // Clean up the phone number for storage
            if (typeof contact.phone === 'number') {
                contact.phone = contact.phone.toString();
            }

            if (contact.phone.startsWith('+')) {
                contact.phone = contact.phone.slice(1);
            }

            if (contact.phone.startsWith('1')) {
                contact.phone = contact.phone.slice(1);
            }

            contact.phone = contact.phone.replace(/[^0-9]/ig, '');
            contact.phone = parseInt(contact.phone, 10);
        } else {
            return reject(new Error('Phone number is required'));
        }

        fulfill(true);
    });
}

/**
 * Checks that the data supplied is valid
 *
 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
 */
const validateLocation = async (location) => {
    return new Promise(async(fulfill, reject) => {
        // Validate address
        if (location.address) {
            // Check for maximum length
            if (location.address.length > 100) {
                return reject(new Error('Address exceeds maximum of 100 characters'));
            }
        } else {
            return reject(new Error('Missing required field: address'));
        }

        // Validate address2
        if (location.address2) {
            // Check for maximum length
            if (location.address2.length > 20) {
                return reject(new Error('Address exceeds maximum of 20 characters'));
            }
        }

        // Validate activity_codes
        if (location.appPolicyTypeList.includes('WC')) {
            if (location.activity_codes.length) {
                for (const activityCode of location.activity_codes) {
                    try {
                        // currently the this gets and returns the description for the activity code
                        // TODO: This should not be the this's responsability. The activity code should 
                        //       get its description prior to being validated
                        const description = validateActivityCode(activityCode);
                        activityCode.description = description;
                    } catch (e) {
                        return reject(e);
                    }
                }
            } else {
                return reject(new Error('At least 1 class code must be provided per location'));
            }
        }

        // Identification Number
        if (location.identification_number) {
            if (validator.ein(location.identification_number)) {
                location.identification_number_type = 'EIN';
            } else if (location.business_entity_type === 'Sole Proprietorship' && validator.ssn(location.identification_number)) {
                location.identification_number_type = 'SSN';
            } else {
                return reject(new Error(`Invalid formatting for property: EIN. Value: ${location.identification_number}.`));
            }

            // Strip out the slashes, insurers don't like slashes
            location.identification_number = location.identification_number.replace(/-/g, '');
        } else {
            return reject(new Error('Identification Number is required'));
        }

        /**
         * Full-Time Employees
         * - Integer (enforced with parseInt() on load())
         * - >= 0
         * - <= 99,999
         */
        if (isNaN(location.full_time_employees) || location.full_time_employees < 0 || location.full_time_employees > 255) {
            return reject(new Error('full_time_employees must be an integer between 0 and 255 inclusive'));
        }

        /**
         * Part-Time Employees
         * - Integer (enforced with parseInt() on load())
         * - >= 0
         * - <= 99,999
         */
        if (isNaN(location.part_time_employees) || location.part_time_employees < 0 || location.part_time_employees > 255) {
            return reject(new Error('part_time_employees must be an integer between 0 and 255 inclusive'));
        }

        // Validate square footage
        // BOP specific
        // - Integer (enforced with parseInt() on load())
        // - >= 100
        // - <= 99,999
        if (location.appPolicyTypeList.includes('BOP')) {
            if (!validator.isSqFtg(location.square_footage) || location.square_footage < 100 || location.square_footage > 99999) {
                return reject(new Error('square_footage must be an integer between 100 and 99,999 inclusive'));
            }
        }

        // Validate zip
        if (location.zipcode) {
            if (!validator.isZip(location.zipcode)) {
                log.error('Invalid formatting for location: mailing_zip. Expected 5 digit format. actual zip: ' + location.zipcode + __location)
                return reject(new Error('Invalid formatting for location: zip. Expected 5 digit format'));
            }
        } else {
            log.error('Missing required field: zip' + __location)
            return reject(new Error('Missing required field: zip'));
        }


        // Validate unemployment_number (WC only)
        if (location.appPolicyTypeList.includes('WC')) {
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
            if (unemployment_number_states.includes(location.state_abbr)) {
                log.debug("unemployment_number " + location.unemployment_number + __location)
                if (location.unemployment_number === 0) {
                    return reject(new Error(`Unemployment Number is required for all locations in ${unemployment_number_states.join(', ')}`));
                }
                if (!Number.isInteger(location.unemployment_number)) {
                    return reject(new Error('Unemployment Number must be an integer'));
                }
            } else {
                if (location.territory === 'MI' && location.unemployment_number && !Number.isInteger(location.unemployment_number)) {
                    return reject(new Error('Unemployment Number must be an integer in MI'));
                }
                location.unemployment_number = 0;
            }
        } else {
            location.unemployment_number = 0;
        }

        fulfill(true);
    });
}

/**
 * Checks that the supplied Activity Code is valid
 *
 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
 */
const validateActivityCode = async (activityCode) => {
    return new Promise(async(fulfill, reject) => {
        // Check that ID is a number
        if (isNaN(activityCode.id)) {
            return reject(new Error('You must supply a valid ID with each class code.'));
        }

        // Check that the ID is valid
        let result = null;
        try {
            result = await db.query(`SELECT \`description\`FROM \`#__activity_codes\` WHERE \`id\` = ${activityCode.id} LIMIT 1;`);
            if (!result || result.length !== 1) {
                return reject(new Error(`The activity code you selected (ID: ${activityCode.id}) is not valid.`));
            }
        } catch (e) {
            log.error(`DB SELECT activity codes error: ${e}. ` + __location);
            //TODO Consistent error types
            return reject(error);
        }

        // Check that Payroll is a number
        if (isNaN(activityCode.payroll)) {
            return reject(new Error(`Invalid payroll amount (Activity Code ${activityCode.id})`));
        }

        if (activityCode.appPolicyTypeList.includes('WC')) {
            if (activityCode.payroll < 1) {
                return reject(new Error(`You must provide a payroll for each activity code (Activity Code ${activityCode.id})`));
            }
        }

        fulfill(result[0].description);
    });
}

/**
 * Checks that the data supplied is valid
 *
 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
 */
const validatePolicy = async (policy) => {
    return new Promise(async(fulfill, reject) => {

        // store a temporary limit '/' deliniated, because for some reason, we don't store it that way in mongo...
        let indexes = [];
        for (let i = 1; i < policy.limits.length; i++) {
            if (policy.limits[i] !== "0") {
                indexes.push(i);
            }
        }
        let limits = policy.limits.split("");
        limits.splice(indexes[1], 0, "/");
        limits.splice(indexes[0], 0, "/");
        limits = limits.join("");

        // Validate effective_date
        if (policy.effective_date) {
            // Check for mm-dd-yyyy formatting
            if (!moment(policy.effective_date).isValid()) {
                return reject(new Error('Invalid formatting for property: effectiveDate. Expected mm-dd-yyyy'));
            }

            // Check if this date is in the past
            if (moment(policy.effective_date).isBefore(moment().startOf('day'))) {
                return reject(new Error('Invalid property: effectiveDate. The effective date cannot be in the past'));
            }

            // Check if this date is too far in the future
            if (moment(policy.effective_date).isAfter(moment().startOf('day').add(90, 'days'))) {
                return reject(new Error('Invalid property: effectiveDate. The effective date cannot be more than 90 days in the future'));
            }
        } else {
            return reject(new Error('Missing property: effectiveDate'));
        }

        // Validate claims
        for (const claim of policy.claims) {
            try {
                await validateClaim(claim);
            } catch (e) {
                return reject(e);
            }
        }

        // Limits: If this is a WC policy, check if further limit controls are needed (IFF we have territory information)
        if (policy.type === 'WC' && policy.territories) {
            if (policy.territories.includes('CA')) {
                // In CA, force limits to be at least 1,000,000/1,000,000/1,000,000
                if (limits !== '2000000/2000000/2000000') {
                    limits = '1000000/1000000/1000000';
                }

            }
            else if (policy.territories.includes('OR')) {
                // In OR force limits to be at least 500,000/500,000/500,000
                if (limits === '100000/500000/100000') {
                    limits = '500000/500000/500000';
                }
            }
        }

        // Validate type
        if (policy.type) {
            const validTypes = [
                'BOP',
                'GL',
                'WC'
            ];
            if (!validTypes.includes(policy.type)) {
                return reject(new Error('Invalid policy type'));
            }
        }
        else {
            return reject(new Error('You must provide a policy type'));
        }

        // Determine the deductible
        if (typeof policy.deductible === "string") {
            // Parse the deductible string
            try {
                policy.deductible = parseInt(policy.deductible, 10);
            } catch (e) {
                // Default to 500 if the parse fails
                log.warn(`appId: ${policy.applicationId} policyType: ${policy.type} Could not parse deductible string '${policy.deductible}': ${e}. Defaulting to 500.`);
                policy.deductible = 500;
            }
        }

        // BOP specific validation
        if (policy.type === 'BOP') {
            // Coverage Lapse Due To Non-Payment - Note: Quote does not collect this for BOP only WC.
            if (policy.coverageLapseNonPayment === null) {
                return reject(new Error('coverage_lapse_non_payment is required, and must be a true or false value'));
            }
        }
        else if (policy.type === 'GL') {
            // GL specific validation
            // currently nothing specific to do here...
        }
        else if (policy.type === 'WC') {
            // WC Specific Properties

            /**
             * Coverage Lapse
             * - Boolean
             */
            if (policy.coverageLapse === null) {
                return reject(new Error('coverage_lapse is required, and must be a true or false value'));
            }
        }

        // Limits
        if (!validator.limits(limits, policy.type)) {
            return reject(new Error('The policy limits you supplied are invalid.'));
        }

        policy.limits = limits;

        fulfill(policy);
    });
}

/**
 * Checks that the data supplied is valid
 *
 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
 */
const validateQuestion = async (question) => {
    return new Promise((fulfill, reject) => {
        // If this question is not required, just return true
        if (!question.required) {
            return fulfill(true);
        }

        // Prepare the error messages
        let type_help = '';
        switch(question.type){
            case 'Yes/No':
                type_help = 'Only boolean values are accepted';
                break;
            case 'Checkboxes':
                type_help = 'Answer must match one of the available values';
                break;
            case 'Select List':
                type_help = 'Answer must match one of the available values';
                break;
            case 'Text - Multiple Lines':
                type_help = 'Blank values are not accepted';
                break;
            case 'Text - Single Line':
                type_help = 'Blank values are not accepted';
                break;
            default:
                break;
        }

        // If the question is single line text, make sure we got an answer (zero is allowed, blank is not)
        if (question.type === 'Text - Single Line' && (question.answer || question.answer === 0)) {
            return fulfill(true);
        }

        // If the question is multi-line text, make sure we got something for an answer (blank is not allowed)
        if (question.type === 'Text - Multiple Lines' && question.answer) {
            return fulfill(true);
        }

        // If the question is a checkbox, make sure we have an answer (this.answer must have an array value with one or more integer )
        if (question.type === 'Checkboxes' && question.answer && typeof question.answer === 'object' && question.answer.length > 0) {
            // Check each answer within the array to make sure they are all valid possible answers
            for(const answer of question.answer){
                // Check that the answer ID is one of those available for this question
                if(Object.keys(question.possible_answers).indexOf(answer.toString()) < 0){
                    // Answer is invalid, return an error and stop
                    return reject(new Error(`Answer to question ${question.id} is invalid. (${type_help})`));
                }
            }

            return fulfill(true);
        }

        // If no answer ID is set, reject
        if (!question.answer_id) {
            return reject(serverHelper.requestError(`Answer to question ${question.id} is invalid. (${type_help})`));
        }

        // Check that the answer ID is one of those available for this question
        if (Object.keys(question.possible_answers).indexOf(question.answer_id.toString()) >= 0) {
            return fulfill(true);
        }

        reject(new Error(`Answer to question ${question.id} is invalid. (${type_help})`));
    });
}

/**
 * Checks that the data supplied is valid
 *
 * @returns {boolean} True if valid, false otherwise (with error text stored in the error property)
 */
const validateClaim = async (claim) => {
    return new Promise((fulfill, reject) => {
        /**
         * Amount Paid (dollar amount)
         * - >= 0
         * - < 15,000,000
         */
        if (claim.amountPaid) {
            if (!validator.claim_amount(claim.amountPaid)) {
                return reject(new Error('The amount must be a dollar value greater than 0 and below 15,000,000'));
            }

            // Cleanup this input
            if (typeof claim.amountPaid === 'number') {
                claim.amountPaid = Math.round(claim.amountPaid);
            } else {
                claim.amountPaid = Math.round(parseFloat(claim.amountPaid.toString().replace('$', '').replace(/,/g, '')));
            }
        } else {
            claim.amountPaid = 0;
        }

        /**
         * Amount Reserved (dollar amount)
         * - >= 0
         * - < 15,000,000
         */
        if (claim.amountReserved) {
            if (!validator.claim_amount(claim.amountReserved)) {
                return reject(new Error('The amountReserved must be a dollar value greater than 0 and below 15,000,000'));
            }

            // Cleanup this input
            if (typeof claim.amountReserved === 'number') {
                claim.amountReserved = Math.round(claim.amountReserved);
            } else {
                claim.amountReserved = Math.round(parseFloat(claim.amountReserved.toString().replace('$', '').replace(/,/g, '')));
            }
        } else {
            claim.amountReserved = 0;
        }

        /**
         * Date
         * - Date (enforced with moment() on load())
         * - Cannot be in the future
         */
        if (claim.date) {
            //  Valid date
            if (!claim.date.isValid()) {
                return reject(new Error('Invalid date of claim. Expected YYYY-MM-DD'));
            }

            // Confirm date is not in the future
            if (claim.date.isAfter(moment())) {
                return reject(new Error('Invalid date of claim. Date cannot be in the future'));
            }
        }

        /**
         * Missed Time
         * - Boolean
         */
        if (claim.missedWork) {
            // Other than bool?
            if (typeof claim.missedWork !== 'boolean') {
                return reject(new Error('Invalid format for missedWork. Expected true/false'));
            }
        }

        /**
         * Open
         * - Boolean
         */
        if (claim.open) {
            // Other than bool?
            if (typeof claim.open !== 'boolean') {
                return reject(new Error('Invalid format for open claims. Expected true/false'));
            }
        }

        /**
         * Only open claims can have an amount reserved
         */
        if (!claim.open && claim.amountReserved) {
            return reject(new Error('Only open claims can have an amount reserved'));
        }

        fulfill(true);
    });
}

/**
 * Checks that the supplied Agency Location is valid
 *
 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
 */
const validateAgencyLocation = async (agencyLocation) => {
    return new Promise(async(fulfill, reject) => {

        /**
         * Key (required) - This is how we uniquelly identify agents
         */
        if (agencyLocation.key) {
            // Check formatting
            if (!await validator.agent(agencyLocation.key)) {
                return reject(new Error('Invalid agent provided.'));
            }
        }

        fulfill(true);
    });
}

module.exports = {
    validateActivityCode,
    validateAgencyLocation,
    validateBusiness,
    validateClaim,
    validateContact,
    validateLocation,
    validatePolicy,
    validateQuestion
}