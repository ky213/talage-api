'use strict';

const regex = /^[0-9]{3}[-]?[0-9]{2}[-]?[0-9]{4}$/;

/**
 * Checks whether or not an SSN is valid
 * @param {string} ssn - A string to examine
 * @returns {boolean} - Boolean true if valid, false otherwise
 */
module.exports = function(ssn){
    if(ssn){
        // Check formatting
        if(regex.test(ssn)){
            return true;
        }
    }
    return false;
};