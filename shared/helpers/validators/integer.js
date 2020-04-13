'use strict';

const positive_integer = /^\d*$/;

/**
 * Checks whether an a value is a positive integer
 *
 * @param {number} integer - A value to test
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(integer){
	return positive_integer.test(integer);
};