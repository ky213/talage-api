/**
 * Defines a single industry code
 */

'use strict';

module.exports = class AdditionalInsured{

	constructor(){
		this.address = '';
		this.name = '';
	}

	/**
	 * Populates this object with data from the request
	 *
	 * @param {object} data - The business data
	 * @returns {void}
	 */
	load(data){
		Object.keys(this).forEach((property) => {
			if(!Object.prototype.hasOwnProperty.call(data, property)){
				return;
			}

			// Trim whitespace
			if(typeof data[property] === 'string'){
				data[property] = data[property].trim();
			}

			this[property] = data[property];
		});
	}

	/**
	 * Checks that the data supplied is valid
	 *
	 * @returns {boolean} True if valid, false otherwise (with error text stored in the error property)
	 */
	validate(){

		// TO DO: Validate all fields here
		// Store the most recent validation message in the 'error' property
		return true;
	}
};