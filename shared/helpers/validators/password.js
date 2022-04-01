'use strict';
const bannedPasswords = require('../passwords/banned-passwords.json');

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
function validatePasswordRequirements(password){
    if(typeof password !== 'string' || !lowercase.test(password) || !number.test(password) || !special_characters.test(password) || !uppercase.test(password) || password.length < 8){
        return false;
    }
    return true;
}

/**
 * Checks if the password is not included on the password banned list
 * @param {string} password valid password
 * @returns {boolean} if the password is on the banned list
 */
function checkBannedList(password){
    const isBanned = bannedPasswords.passwords.some(bannedPassword => bannedPassword === password);
    return isBanned;
}

module.exports = {
    validatePasswordRequirements: validatePasswordRequirements,
    checkBannedList: checkBannedList
};
