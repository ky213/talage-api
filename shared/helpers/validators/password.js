'use strict';

const lowercase = /[a-z]/;
const number = /[0-9]/;
const special_characters = /[^\w]/;
const uppercase = /[A-Z]/;

/**
 * Checks whether a password meets our complexity requirements.
 * A valid password is 8 characters or longer and contains at least one uppercase letter, one lowercase letter, one number, and one special character
 *
 * @param {string} password - The password to check
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(password){
    if(typeof password !== 'string' || !lowercase.test(password) || !number.test(password) || !special_characters.test(password) || !uppercase.test(password) || password.length < 8){
        return false;
    }
    return true;
};