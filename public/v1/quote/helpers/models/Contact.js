/**
 * Defines a single industry code
 */

'use strict';

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

            if(data.firstName){
                this.first_name = data.firstName;
            }

            if(data.lastName){
                this.last_name = data.lastName;
            }

            // Trim whitespace
            if (typeof data[property] === 'string') {
                data[property] = data[property].trim();
            }
            if(data[property]){
                this[property] = data[property];
            }
        });
    }
}