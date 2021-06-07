'use strict';

const helper = global.requireShared('helpers/helper.js');

/**
 * Checks whether the limits set is valid.
 *
 * @param {string} limits - The specified limits
 * @param {string} policyType - The policy type as an abbreviation (e.g. WC = worker's compensation)
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(limits, policyType){
    // Only called from application validation code
    // should be database driven.  not hardcoded helper.
    return helper.supportedLimits[policyType].includes(limits);
};