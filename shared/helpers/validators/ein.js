'use strict';

const regex = /^(0[1-6]||1[0-6]|2[0-7]|[35]\d|4[0-8]|[68][0-8]|7[1-7]|9[0-58-9])-?\d{7}$/;

/**
 * Checks whether or not an EIN is valid
 * @param {string} ein - A string to examine
 * @returns {boolean} - Boolean true if valid, false otherwise
 */
module.exports = function(ein){
	if(ein){
		// Check formatting
		if(regex.test(ein)){
			return true;
		}
	}
	return false;
};