/**
 * Defines a single industry code
 */

'use strict';

const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class Contact {

    constructor() {
        this.email = '';
        this.first_name = '';
        this.last_name = '';
        this.phone = 0;
    }

	/**
	 * Populates this object with data from the request
	 *
	 * @param {object} data - The business data
	 * @returns {void}
	 */
    load(data) {
        Object.keys(this).forEach((property) => {
            if (!Object.prototype.hasOwnProperty.call(data, property)) {
                return;
            }
            if(data.fname){
                this.first_name = data.fname;
            }

            if(data.lname){
                this.last_name = data.lname;
            }

            // Trim whitespace
            if (typeof data[property] === 'string') {
                data[property] = data[property].trim();
            }

            this[property] = data[property];
        });
    }

	/**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
    validate() {
        return new Promise((fulfill, reject) => {

            // TO DO: Validate all fields here
            // Store the most recent validation message in the 'error' property

            // Validate email
            const email_result = validator.email(this.email);
            if (email_result !== true) {
                reject(serverHelper.requestError(email_result));
                return;
            }

            // Validate first_name
            if (this.first_name) {
                if (!validator.isName(this.first_name)) {
                    reject(serverHelper.requestError('Invalid characters in first_name'));
                    return;
                }

                if (this.first_name.length > 30) {
                    reject(serverHelper.requestError('First name exceeds maximum length of 30 characters'));
                    return;
                }
            }
            else {
                reject(serverHelper.requestError('Missing required field in contact: first_name'));
                return;
            }

            // Validate last_name
            if (this.last_name) {
                if (!validator.isName(this.last_name)) {
                    reject(serverHelper.requestError('Invalid characters in last_name'));
                    return;
                }

                if (this.last_name.length > 30) {
                    reject(serverHelper.requestError('Last name exceeds maximum length of 30 characters'));
                    return;
                }
            }
            else {
                reject(serverHelper.requestError('Missing required field in contact: last_name'));
                return;
            }

            // Validate phone
            if (this.phone) {

                // Check that it is valid
                if (!validator.phone(this.phone)) {
                    reject(serverHelper.requestError('The phone number you provided is not valid. Please try again.'));
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
                reject(serverHelper.requestError('Phone number is required'));
                return;
            }

            fulfill(true);
        });
    }
};