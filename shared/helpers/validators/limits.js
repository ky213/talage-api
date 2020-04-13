'use strict';

const helper = requireShared('helpers/helper.js');

/**
 * Checks whether the limits set is valid.
 *
 * @param {string} limits - The specified limits
 * @param {string} policyType - The policy type as an abbreviation (e.g. WC = worker's compensation)
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(limits, policyType){
	return helper.supportedLimits[policyType].includes(limits);
};