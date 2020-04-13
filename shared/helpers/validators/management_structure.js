'use strict';

const valid_types = [
	'manager', 'member'
];

/**
 * Checks whether the management_structure is valid.
 *
 * @param {string} management_structure - The selected management structure
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(management_structure){
	return valid_types.includes(management_structure);
};