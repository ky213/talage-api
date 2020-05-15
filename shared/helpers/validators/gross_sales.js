'use strict';

const regex = /^\$?[1-9]\d{0,2}(,?\d{3})*(\.[0-9]{2})?$/;

/**
 * Checks whether the gross_sales is valid.
 *
 * @param {mixed} gross_sales - The specified gross_sales
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(gross_sales){
	if(typeof gross_sales !== 'string'){
		gross_sales = gross_sales.toString();
	}

	// Check that this is a valid dollar amount
	if(!regex.test(gross_sales)){
		return false;
	}

	// Remove all non numeric characters and check the length
	if(gross_sales.replace(/\D/g, '').length > 8){
		return false;
	}

	return true;
};