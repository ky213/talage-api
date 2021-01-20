/**
 * Provides functions for validating data
 */

'use strict';

const validator = global.requireShared('./helpers/validator');
const moment = require('moment');

/**
 * Checks that the data supplied is valid - Rejection should be done inside the Insurer Integration files.
 *  since rules vary by insurer and policy type.
 *
 * @returns {void}
*/
const validateBusiness = async (applicationDocData) => {
    
    // Unincorporated Association (Required only for WC, in NH, and for LLCs and Corporations)
    if (
        applicationDocData.policies.find(policy => policy.policyType === "WC") &&
        (applicationDocData.entityType === 'Corporation' || applicationDocData.entityType === 'Limited Liability Company') && 
        applicationDocData.mailingState === 'NH'
    ) {

        // This is required
        if (applicationDocData.unincorporated_association === null) {
            return reject(new Error('Missing required field: unincorporated_association'));
        }

        // Validate
        if (!validator.boolean(applicationDocData.unincorporated_association)) {
            return reject(new Error('Invalid value for unincorporated_association, please use a boolean value'));
        }
    }

    /**
     * Bureau Number (optional)
     * - <= 999999999
     * - In CA, must be formatted as ##-##-##
     * - All other states, must be formatted as #########
     */
    try {
        if (applicationDocData.bureauNumber) {
            if (applicationDocData.bureauNumber.length > 9) {
                log.warn(`Bureau Number max length is 9 applicationId: ${applicationDocData.applicationId}` + __location);
            }
            if (applicationDocData.primary_territory.toString().toUpperCase() === 'CA') {
                // Expected Formatting for 'CA' is 99-99-99
                if (!validator.isBureauNumberCA(applicationDocData.bureauNumber)) {
                    log.error(`Bureau Number must be formatted as 99-99-99 applicationId: ${applicationDocData.applicationId}` + __location);
                }
            }
            else if (!validator.isBureauNumberNotCA(applicationDocData.bureauNumber)) {
                // Expected Formatting for all other states is 999999999
                log.error(`Bureau Number must be numeric applicationId: ${applicationDocData.applicationId}` + __location);
            }
        }
    } catch (e) {
        log.error(`Business Validation bureauNumber error: ${e} ${__location}`)
    }

    /**
     * DBA (optional)
     * - Must be a valid business name
     * - Must be 100 characters or less
     */
    if (applicationDocData.dba) {
        // Check for invalid characters
        //Do not stop the quote over dba name.  Different insurers have different rules
        if (!validator.isBusinessName(applicationDocData.dba)) {
            log.warn(`Invalid characters in DBA. applicationId ${applicationDocData.applicationId}` + __location)
        }
    }

    /**
     * Entity Type (required)
     * - Must be one of our supported entity types
     */
    if (applicationDocData.entityType) {
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
        if (valid_types.indexOf(applicationDocData.entityType) === -1) {
            log.error(`Invalid data in property: entityType applicationId ${applicationDocData.applicationId}` + __location);
        }
    } else {
        throw new Error('Missing property: entityType');
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
    if (applicationDocData.bureauNumber) {
        if (applicationDocData.experience_modifier < 0.20 || applicationDocData.experience_modifier > 10) {
            log.warn(`Experience Modifier must be between 0.20 and 10 applicationId ${applicationDocData.applicationId}` + __location);
        }
    }

    /**
     * Founded (required)
     * - Must be a valid date formatted mm-yyyy
     * - Cannot be in the future
     * - Cannot be prior to July 4, 1776
     */
    if (applicationDocData.founded) {
        const foundedMoment = moment(applicationDocData.founded.toISOString());

        // Check for mm-yyyy formatting
        if (!foundedMoment.isValid()) {
            throw new Error('Invalid Date for founded.');
        }

        // Confirm date is not in the future
        if (foundedMoment.isAfter(moment())) {
            throw new Error('Invalid value for property: founded. Founded date cannot be in the future');
        }

        // Confirm founded date is at least somewhat reasonable
        if (foundedMoment.isBefore(moment('07-04-1776', 'MM-DD-YYYY'))) {
            throw new Error('Invalid value for property: founded. Founded date is too far in the past.');
        }
    } else {
        throw new Error('Missing property: founded');
    }

    /**
     * Industry Code (required)
     * - > 0
     * - <= 99999999999
     * - Must existin our database
     */
    if (applicationDocData.industryCode) {
        applicationDocData.industryCode_description = await validator.industry_code(applicationDocData.industryCode);
        if (!applicationDocData.industryCode_description) {
            throw new Error('The industry code ID you provided is not valid');
        }
    } else {
        throw new Error('Missing property: industryCode');
    }

    /**
     * Mailing Address (required)
     */
    if (!applicationDocData.mailingAddress) {
        throw new Error('Missing required field: mailingAddress');
    }

    /**
     * Mailing Zip (required)
     * - Must be a 5 digit string
     */
    if (applicationDocData.mailingZipcode) {
        //let 9 digit zipcodes process. log an error
        if (!validator.isZip(applicationDocData.mailingZipcode)) {
            log.error(`Invalid formatting for business: mailingZipcode. Expected 5 digit format. applicationId: ${applicationDocData.applicationId} actual zip: ` + applicationDocData.mailingZipcode + __location)
        }
    } else {
        log.error('Missing required field: business mailingZipcode' + __location);
        throw new Error('Missing required field:  business mailingZipcode');
    }

    /**
     * Name (required)
     * - Must be a valid business name
     * - Must be 100 characters or less
     */
    if (applicationDocData.businessName) {
        // Check for invalid characters
        // Let different Insurers have different rules
        // reject and clean rules should be in insurer integrations files.
        if (!validator.isBusinessName(applicationDocData.businessName)) {
            log.error(`Invalid characters in businessName applicationId: ${applicationDocData.applicationId}` + __location);
        }

        // Check for max length
        if (applicationDocData.businessName.length > 100) {
            throw new Error('businessName exceeds maximum length of 100 characters');
        }
    } else {
        throw new Error('Missing required field: businessName');
    }

    /**
     * Number of Owners (conditionally required)
     * 0 < numOwners <= 99
     */
    if(!applicationDocData.numOwners && applicationDocData.owners.length === 0){

        // Depend on insurer and policyType.
        // reject decision should be in insurer integration file.  as of 11/14/2020 only Acuity and BTIS are using numOwners
        log.warn(`You must specify the number of owners in the business applicationId: ${applicationDocData.applicationId}` + __location);
    }
    if(applicationDocData.numOwners){
        if (isNaN(applicationDocData.numOwners)) {
            log.error('Number of owners in the business must be a number' + __location);
            throw new Error('Number of owners in the business must be a number.');
        }

        if (applicationDocData.numOwners < 1) {
            throw new Error('Number of owners cannot be less than 1.');
        }
        if (applicationDocData.numOwners > 99) {
            throw new Error('Number of owners cannot exceed 99.');
        }

    }


    /**
     * Phone (required)
     * - Must be a valid 9 digit phone number
     */
    if (applicationDocData.phone) {
        // Check that it is valid
        if (!validator.phone(applicationDocData.phone)) {
            throw new Error('The phone number you provided is not valid. Please try again.');
        }

        // Clean up the phone number for storage
        if (typeof applicationDocData.phone === 'number') {
            applicationDocData.phone = applicationDocData.phone.toString();
        }

        if (applicationDocData.phone.startsWith('+')) {
            applicationDocData.phone = applicationDocData.phone.slice(1);
        }

        if (applicationDocData.phone.startsWith('1')) {
            applicationDocData.phone = applicationDocData.phone.slice(1);
        }
    } else {
        throw new Error('Missing required field: phone');
    }

    // Years of Experience (conditionally required)
    // - Only required if founded less than 3 years ago
    // - Must be a number between 0 and 99
    const foundedMoment = moment(applicationDocData.founded.toISOString());
    if (foundedMoment.isAfter(moment().subtract(3, 'years'))) {
        if (applicationDocData.yearsOfExp < 0 || applicationDocData.yearsOfExp > 99) {
            //let it quote and the insurer reject it.
            log.info(`Invalid value for property: yearsOfExp. Value must be between 0 and 100 (not inclusive) for ${applicationDocData.applicationId}`)
        }
    }

    if (!applicationDocData.ein) {
        return reject(new Error('Identification Number is required'));
    }

    if (!(validator.ein(applicationDocData.ein) || validator.ssn(applicationDocData.ein))) {
        return reject(new Error(`Invalid formatting for property: EIN. Value: ${applicationDocData.ein}`));
    }
}

/**
 * Checks that the data supplied is valid
 * 
 * @returns {void}
 */
const validateContacts = async (applicationDocData) => {
    if (applicationDocData.contacts.length === 0) { 
        throw new Error('At least 1 contact must be provided');
    }
    
    for (const contact of applicationDocData.contacts) {
        // Validate email
        if (contact.email) {
            const email_result = validator.email(contact.email);
            if (email_result !== true) {
                throw new Error('Invalid email');
            }
        } else {
            throw new Error('Missing required field in contact: email');
        }

        // Validate firstName
        if (contact.firstName) {
            if (!validator.isName(contact.firstName)) {
                throw new Error('Invalid characters in first name');
            }

            if (contact.firstName.length > 30) {
                throw new Error('First name exceeds maximum length of 30 characters');
            }
        } else {
            throw new Error('Missing required field in contact: firstName');
        }

        // Validate lastName
        if (contact.lastName) {
            if (!validator.isName(contact.lastName)) {
                throw new Error('Invalid characters in last name');
            }

            if (contact.lastName.length > 30) {
                throw new Error('Last name exceeds maximum length of 30 characters');
            }
        } else {
            throw new Error('Missing required field in contact: lastName');
        }

        // Validate phone
        if (contact.phone) {
            // Check that it is valid
            if (!validator.phone(contact.phone)) {
                throw new Error('The phone number you provided is not valid. Please try again.');
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
            throw new Error('Phone number is required');
        }
    }
}

/**
 * Checks that the data supplied is valid
 *
 * @returns {void} 
 */
const validateLocations = async (applicationDocData) => {
    if (applicationDocData.locations.length === 0) { 
        throw new Error('At least 1 location must be provided');
    }

    for (const location of applicationDocData.locations) {
        // Validate address
        if (location.address) {
            // Check for maximum length
            if (location.address.length > 100) {
                throw new Error('Address exceeds maximum of 100 characters');
            }
        } else {
            throw new Error('Missing required field: address');
        }

        // Validate address2
        if (location.address2) {
            // Check for maximum length
            if (location.address2.length > 20) {
                throw new Error('Address exceeds maximum of 20 characters');
            }
        }

        /**
         * Full-Time Employees
         * - Integer (enforced with parseInt() on load())
         * - >= 0
         * - <= 99,999
         */
        if (isNaN(location.full_time_employees) || location.full_time_employees < 0 || location.full_time_employees > 255) {
            throw new Error('full_time_employees must be an integer between 0 and 255 inclusive');
        }

        /**
         * Part-Time Employees
         * - Integer (enforced with parseInt() on load())
         * - >= 0
         * - <= 99,999
         */
        if (isNaN(location.part_time_employees) || location.part_time_employees < 0 || location.part_time_employees > 255) {
            throw new Error('part_time_employees must be an integer between 0 and 255 inclusive');
        }

        // Validate square footage
        // BOP specific
        // - Integer (enforced with parseInt() on load())
        // - >= 100
        // - <= 99,999
        if (location.square_footage) {
            if (!validator.isSqFtg(location.square_footage) || location.square_footage < 100 || location.square_footage > 99999) {
                throw new Error('square_footage must be an integer between 100 and 99,999 inclusive');
            }
        }

        // Validate zip
        if (location.zipcode) {
            if (!validator.isZip(location.zipcode)) {
                log.error('Invalid formatting for location: mailing_zip. Expected 5 digit format. actual zip: ' + location.zipcode + __location)
                throw new Error('Invalid formatting for location: zip. Expected 5 digit format');
            }
        } else {
            log.error('Missing required field: zip' + __location)
            throw new Error('Missing required field: zip');
        }


        // Validate unemployment_number (WC only)
        if (location.unemployment_num) {
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
                log.debug("unemployment_number " + location.unemployment_num + __location)
                if (location.unemployment_num === 0) {
                    throw new Error(`Unemployment Number is required for all locations in ${unemployment_number_states.join(', ')}`);
                }
                if (!Number.isInteger(location.unemployment_num)) {
                    throw new Error('Unemployment Number must be an integer');
                }
            } else {
                if (location.territory === 'MI' && location.unemployment_num && !Number.isInteger(location.unemployment_num)) {
                    throw new Error('Unemployment Number must be an integer in MI');
                }
            }
        }
    }
}

/**
 * Checks that the supplied Activity Code is valid
 *
 * @returns {void}
 */
const validateActivityCodes = (applicationDocData) => {
    if (applicationDocData.activityCodes.length === 0) {
        throw new Error('At least 1 class code must be provided');    
    }

    for (const activityCode of applicationDocData.activityCodes) {
        // Check that ID is a number
        if (isNaN(activityCode.ncciCode)) {
            return reject(new Error('You must supply a valid ID with each class code.'));
        }

        // Check that Payroll is a number
        if (isNaN(activityCode.payroll)) {
            return reject(new Error(`Invalid payroll amount (Activity Code ${activityCode.ncciCode})`));
        }

        if (typeof activityCode.payroll === "undefined" || activityCode.payroll < 1) {
            return reject(new Error(`You must provide a payroll for each activity code (Activity Code ${activityCode.ncciCode})`));
        }
    }
}

/**
 * Checks that the data supplied is valid
 *
 * @returns {void}
 */
const validatePolicies = (applicationDocData) => {
    for (const policy of applicationDocData.policies) {
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
        if (policy.effectiveDate) {
            const effectiveMoment = moment(policy.effectiveDate);
            // Check for mm-dd-yyyy formatting
            if (!effectiveMoment.isValid()) {
                throw new Error('Invalid formatting for property: effectiveDate. Expected mm-dd-yyyy');
            }

            // Check if this date is in the past
            if (effectiveMoment.isBefore(moment().startOf('day'))) {
                throw new Error('Invalid property: effectiveDate. The effective date cannot be in the past');
            }

            // Check if this date is too far in the future
            if (effectiveMoment.isAfter(moment().startOf('day').add(90, 'days'))) {
                throw new Error('Invalid property: effectiveDate. The effective date cannot be more than 90 days in the future');
            }
        } else {
            throw new Error('Missing property: effectiveDate');
        }

        // Validate type
        if (policy.policyType) {
            const validTypes = [
                'BOP',
                'GL',
                'WC'
            ];
            if (!validTypes.includes(policy.policyType)) {
                throw new Error('Invalid policy type');
            }
        }
        else {
            throw new Error('You must provide a policy type');
        }

        // BOP specific validation
        if (policy.policyType === 'BOP') {
            // Coverage Lapse Due To Non-Payment - Note: Quote does not collect this for BOP only WC.
            if (policy.coverageLapseNonPayment === null) {
                throw new Error('coverage_lapse_non_payment is required, and must be a true or false value');
            }
        }
        else if (policy.policyType === 'GL') {
            // GL specific validation
            // currently nothing specific to do here...
        }
        else if (policy.policyType === 'WC') {
            // WC Specific Properties

            /**
             * Coverage Lapse
             * - Boolean
             */
            if (policy.coverageLapse === null) {
                throw new Error('coverage_lapse is required, and must be a true or false value');
            }
        }

        // Limits
        if (!validator.limits(limits, policy.policyType)) {
            throw new Error('The policy limits you supplied are invalid.');
        }
    }
}

/**
 * Checks that the data supplied is valid
 *
 * @returns {void}
 */
const validateQuestion = async (question) => {
    // If this question is not required, just return true
    if (!question.required) {
        return;
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
        return;
    }

    // If the question is multi-line text, make sure we got something for an answer (blank is not allowed)
    if (question.type === 'Text - Multiple Lines' && question.answer) {
        return;
    }

    // If the question is a checkbox, make sure we have an answer (answer must have an array value with one or more integer )
    if (question.type === 'Checkboxes' && question.answer && typeof question.answer === 'object' && question.answer.length > 0) {
        // Check each answer within the array to make sure they are all valid possible answers
        for(const answer of question.answer){
            // Check that the answer ID is one of those available for this question
            if(Object.keys(question.possible_answers).indexOf(answer.toString()) < 0){
                // Answer is invalid, return an error and stop
                throw new Error(`Answer to question ${question.id} is invalid. (${type_help})`);
            }
        }

        return;
    }

    // If no answer ID is set, reject
    if (!question.answer_id) {
        throw new Error(`Answer to question ${question.id} is invalid. (${type_help})`);
    }

    // Check that the answer ID is one of those available for this question
    if (Object.keys(question.possible_answers).indexOf(question.answer_id.toString()) >= 0) {
        return;
    }

    throw new Error(`Answer to question ${question.id} is invalid. (${type_help})`);
}

/**
 * Checks that the data supplied is valid, throws an execption (error) if not.
 * It is valid for the claims array to be empty, as claims are an optional field
 *
 * @returns {void}
 */
const validateClaims = async (applicationDocData) => {
    for (const claim of applicationDocData.claims) {
        /**
         * Date
         * - Date (enforced with moment() on load())
         * - Cannot be in the future
         */
        if (claim.date) {
            //  Valid date
            if (!claim.date.isValid()) {
                throw new Error('Invalid date of claim. Expected YYYY-MM-DD');
            }

            // Confirm date is not in the future
            if (claim.date.isAfter(moment())) {
                throw new Error('Invalid date of claim. Date cannot be in the future');
            }
        }

        /**
         * Missed Time
         * - Boolean
         */
        if (claim.missedWork) {
            // Other than bool?
            if (typeof claim.missedWork !== 'boolean') {
                throw new Error('Invalid format for missedWork. Expected true/false');
            }
        }

        /**
         * Open
         * - Boolean
         */
        if (claim.open) {
            // Other than bool?
            if (typeof claim.open !== 'boolean') {
                throw new Error('Invalid format for open claims. Expected true/false');
            }
        }

        /**
         * Only open claims can have an amount reserved
         */
        if (!claim.open && claim.amountReserved) {
            throw new Error('Only open claims can have an amount reserved');
        }
    }
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
    validateActivityCodes,
    validateAgencyLocation,
    validateBusiness,
    validateClaims,
    validateContacts,
    validateLocations,
    validatePolicies,
    validateQuestion
}