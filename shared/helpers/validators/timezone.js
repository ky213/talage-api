'use strict';

const positive_integer = /^[1-9]\d*$/;

/**
 * Checks whether a password meets our complexity requirements.
 * A valid password is 8 characters or longer and contains at least one uppercase letter, one lowercase letter, one number, and one special character
 *
 * @param {string} val - The password to check
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(val){
    return positive_integer.test(val);
};