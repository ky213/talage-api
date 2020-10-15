'use strict';

const valid_types = [
    'c',
    'n',
    's'
];

/**
 * Checks whether the corporation_type is valid.
 *
 * @param {string} corporation_type - The specified corporation_type
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(corporation_type){
    return valid_types.includes(corporation_type);
};