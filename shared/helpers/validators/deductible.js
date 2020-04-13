'use strict';

const valid_deductibles = [
	500,
	1000,
	1500
];

/**
 * Checks whether the deductible is valid.
 *
 * @param {mixed} deductible - The specified deductible
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(deductible){

	// Check that we can use this type
	if(typeof deductible !== 'string' && typeof deductible !== 'number'){
		log.error('Deductible Validator encountered value it cannot check (must be number or string)');
		return false;
	}

	// If this is a string, convert it to an integer before starting
	if(typeof deductible === 'string'){
		deductible = parseInt(deductible, 10);
	}

	return valid_deductibles.includes(deductible);
};