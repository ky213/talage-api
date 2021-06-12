/* eslint-disable init-declarations */
/* eslint-disable space-before-function-paren */
/**
 * Encryption/Decryption Service (based on Sodium)
 *
 * Note: Thirty-two zeros. The original NaCl crypto_box() function required extra padding before
 * the ciphertext. As the node.js Sodium library is based on that original library, it also requires
 * extra padding, in this case 16 bytes (32 hex characters) of zeros before the cypher text begins. 😱
 */

'use strict';


const CRYPT_ENCRYPTION_ALGORITHM = 'aes-256-ctr';

// const request = require('request');
const php_serialize = require('php-serialize');
const sha1 = require('sha1');
const sodium = require('sodium').api;
const crypto = require('crypto');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


// Public Interfaces

/**
 * Decrypts a value from Sodium. Must be called synchronously using 'await.'
 *
 * @param {string} val - The encrypted value
 * @return {Promise.<string, boolean>} - The decrypted value on success, false otherwise
 */
exports.decryptSodium = function(val) {
    return new Promise(async function(resolve) {
        // If this is a buffer, convert it to a string
        if(!val){
            resolve(null);
            return;
        }

        if (Buffer.isBuffer(val)) {
            val = val.toString();
        }

        // Make sure this is a string and that it is not empty
        if (typeof val !== 'string' || val === '') {
            resolve(false);
            return;
        }
        //min length check
        if (val.length < 2) {
            resolve(false);
            return;
        }

        // Send a request to the encryption service
        let hadError = false;

        const result = await decryptInternal(val).catch(function(err) {
            log.error('decrypt err ' + err + __location)
            hadError = true;
            resolve(false);
        });
        if (hadError) {
            return;
        }
        // Return the decrypted result
        resolve(result);
    });
};


/**
 * Decrypts a value
 *
 * @param {string} val - The encrypted value
 * @returns {mixed} - The decrypted value on success, false otherwise
 */
var decryptInternal = async function(val) {
    if (!val) {
        return val;
    }

    // Make sure this is a string, and if it is not, try to convert it to one
    if (typeof val !== 'string') {
        try {
            val = val.toString();
        }
        catch(error){
            log.error(error + __location);
            return false;
        }
    }

    // Separate the value from its IV
    const pieces = val.split('|');
    val = Buffer.from(`00000000000000000000000000000000${pieces[0]}`, 'hex');
    const nonce = Buffer.from(pieces[1], 'hex');
    if (nonce.length !== 24) {
        return false;
    }
    let encryptionKey = global.settings.ENCRYPTION_KEY_OLD;
    if(!encryptionKey){
        encryptionKey = global.settings.ENCRYPTION_KEY;
    }
    // Decrypt
    val = sodium.crypto_secretbox_open(val, nonce, Buffer.from(encryptionKey));

    // Check if decryption was successful, if not, return
    if (!val) {
        return null;
    }

    // Convert the buffer back to a string
    val = val.toString();

    // Unserialize
    return php_serialize.unserialize(val);
};


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

/**
 * Hashes a password. Must be called synchronously using 'await.'
 *
 * @param {string} val - A password string to be hashed
 * @return {Promise.<string, Error>} - A promise that returns an string containing the hashed password if successful, or an Error if rejected
 */
exports.hashPasswordSodium = function(val) {
    return new Promise(function(fulfill, reject) {
        // Make sure we have a value to work with
        if (!val || typeof val !== 'string') {
            reject(new Error('Invalid value passed to hashPassword. Must be a non-empty string.'));
        }

        // Hash the value
        val = sodium.crypto_pwhash_str(Buffer.from(val, 'utf8'), sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE);

        if (val) {
            // Conver from a buffer to a string
            val = val.toString();

            // Remove all but the first 97 characters as those are the only ones that contain hash data, the rest is zeros
            val = val.substring(0, 97);

            // Return the password
            fulfill(val);
            return;
        }

        reject(new Error('Failed to hash'));
    });
};

/**
 * Checks whether the password provided by the user matches their previously entered password.
 * Must be called synchronously using 'await.'
 *
 * @param {string} hash - The hash value of a known good password
 * @param {string} password - A string entered by the user which will be checked against the hash
 * @return {Promise.<string, boolean>} - The decrypted value on success, false otherwise
 */
exports.verifyPasswordSodium = function(hash, password) {
    return new Promise(async function(resolve) {
        // Make sure this is a string and that it is not empty
        if (typeof hash !== 'string' || hash === '' || typeof password !== 'string' || password === '') {
            resolve(false);
            return;
        }

        // Send a request to the encryption service
        let result = false;
        try {
            hash = hash.padEnd(128, '\u0000');
            result = sodium.crypto_pwhash_str_verify(Buffer.from(hash), Buffer.from(password));
        }
        catch (e) {
            log.error('sodium password check ' + e + __location);
        }
        // Return password check result
        resolve(result);
        return;
    });
};


// eslint-disable-next-line arrow-body-style
exports.verifyPassword = function(hash, password) {
    return exports.hashPassword(password) === hash;
};