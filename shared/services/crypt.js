/* eslint-disable init-declarations */
/* eslint-disable space-before-function-paren */

'use strict';

const CRYPT_ENCRYPTION_ALGORITHM = 'aes-256-ctr';

// const request = require('request');
const sha1 = require('sha1');
const crypto = require('crypto');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


// Public Interfaces

// eslint-disable-next-line valid-jsdoc
/**
 * Encryption key must be exactly 32 characters. So we'll hash the global
 * encryption key and split off the first 32 characters.
 */
const getEncryptionKey = async () => exports.hashPassword(global.settings.ENCRYPTION_KEY).substr(0, 32);

exports.encrypt = async (val) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(CRYPT_ENCRYPTION_ALGORITHM, await getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(val), cipher.final()]);

    return [
        iv.toString('hex'), encrypted.toString('hex')
    ].join('.');
}

exports.decrypt = async (val) => {
    let hashObj;
    try {
        hashObj = val.split('.');
    }
    catch (ex) {
        return false;
    }
    let returnVal = '';
    try{
        const decipher = crypto.createDecipheriv(CRYPT_ENCRYPTION_ALGORITHM, await getEncryptionKey(), Buffer.from(hashObj[0], 'hex'));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(hashObj[1], 'hex')), decipher.final()]);
        returnVal = decrypted.toString();
    }
    catch(err){
        log.debug(`Decrypt val ${val} error ${err}` + __location);
        throw err;
    }

    return returnVal;
}


/**
 * Creates a hash for a value. This function should only be used to create hashes for matching purposes. No security should be assumed.
 *
 * @param {string} val - A string to be hashed
 * @return {string} - The hash value
 */
exports.hash = async function(val) {
    if(!val || typeof val !== 'string'){
        return "";
    }
    else if(val.length === 0){
        return "";
    }
    // Convert the value to lowercase
    val = val.toLowerCase();


    // Salt the value
    val += global.settings.SALT;

    // Hash the value and return the result
    return sha1(val);
};


/**
 * Hashes a password. Must be called synchronously using 'await.'
 *
 * @param {string} val - A password string to be hashed
 * @return {string} - A string containing the hashed password if successful, or an Error if rejected
 */
exports.hashPassword = function(val) {
    // eslint-disable-next-line prefer-const
    let hash = crypto.createHmac('sha512', global.settings.SALT);
    hash.update(val);
    return hash.digest('hex');
}

// eslint-disable-next-line arrow-body-style
exports.verifyPassword = function(hash, password) {
    return exports.hashPassword(password) === hash;
};