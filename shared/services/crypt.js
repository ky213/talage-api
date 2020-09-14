/**
 * Encryption/Decryption Service (based on Sodium)
 *
 * Note: Thirty-two zeros. The original NaCl crypto_box() function required extra padding before
 * the ciphertext. As the node.js Sodium library is based on that original library, it also requires
 * extra padding, in this case 16 bytes (32 hex characters) of zeros before the cypher text begins. 😱
 */

'use strict';

// const request = require('request');
const php_serialize = require('php-serialize');
const sha1 = require('sha1');
const sodium = require('sodium').api;
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

// Private Functions

//
// Sends a request to our encryption service. Must be called using await.
//
// @param {string} endpoint - The API endpoint to be used
// @param {string|Object} data - The data to be sent to the encryption service
// @returns {Promise.<string, Error>} - A promise that returns the result of the request as a string if resolved, or an Error if rejected
//
// Deprecated
// function sendRequest(endpoint, data){
// // Send the request to the encryption service
// return new Promise(function(resolve, reject){
// // Establish the options for the request
// const options = {
// 'headers': {'accept': 'text/plain'},
// 'method': 'POST',
// 'url': `http://localhost:${global.settings.PRIVATE_API_PORT}/v1/encryption/${endpoint}`
// };
//
// // Determine what type of data to send
// switch(typeof data){
// case 'object':
// 				options.json = data;
// 				options.headers['content-type'] = 'application/json';
// 				break;
// case 'string':
// 				options.body = data;
// 				options.headers['content-type'] = 'text/plain';
// 				break;
// default:
// 				log.warn('crypt sendRequest only accepts data as a string or an object');
// 				reject(new Error('crypt sendRequest only accepts data as a string or an object'));
// 				break;
// }
//
// // Send the request
// request(options, function(error, response, body){
// // If there was an error, reject
// if(error){
// 				log.error('Failed to connect to encryption service.');
// 				reject(new Error('Failed to connect to encryption service.'));
// 				return;
// }
//
// // If the response was anything but a success, reject
// if(response.statusCode !== 200){
// 				// The response is JSON, parse out the error
// 				const message = `${response.statusCode} - ${JSON.parse(body).message}`;
// 				log.warn(message);
// 				reject(new Error(message));
// 				return;
// }
//
// // Everything worked, return the response
// resolve(body);
// });
// });
// }
//

/**
 * Returns a unique encryption nonce (number only used once).
 * Also manages the security_nonce table of our database to ensure nonces are only used once.
 *
 * @returns {Promise.<object, Error>} - A promise that returns an object containing the nonce as a string if resolved, or an Error if rejected
 */
function getUniqueNonce() {
    return new Promise(async function(fulfill, reject) {
        let duplicate = true;
        let nonce = '';

        while (duplicate) {
            // Generate a random nonce
            nonce = Buffer.allocUnsafe(sodium.crypto_secretbox_NONCEBYTES);
            sodium.randombytes(nonce, sodium.crypto_secretbox_NONCEBYTES);

            // Query the database to check if the nonce is unique
            const sql = `SELECT id FROM #__security_nonces WHERE nonce = '${nonce.toString('hex')}';`;
            const rows = await db.query(sql).catch(function(error) {
                // eslint-disable-line no-await-in-loop
                reject(error);
            });
            if (!rows || rows.length === 0) {
                duplicate = false;
            }
        }

        fulfill(nonce);

        // Store this nonce so we know it was used
        const sql = `INSERT INTO #__security_nonces (nonce) VALUES ('${nonce.toString('hex')}');`;
        await db.query(sql).catch(function(error) {
            reject(error);
        });
    });
}

// Public Interfaces

/**
 * Decrypts a value. Must be called synchronously using 'await.'
 *
 * @param {string} val - The encrypted value
 * @return {Promise.<string, boolean>} - The decrypted value on success, false otherwise
 */
exports.decrypt = function(val) {
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

    // Decrypt
    val = sodium.crypto_secretbox_open(val, nonce, Buffer.from(global.settings.ENCRYPTION_KEY));

    // Check if decryption was successful, if not, return
    if (!val) {
        return null;
    }

    // Convert the buffer back to a string
    val = val.toString();

    // Unserialize
    return php_serialize.unserialize(val);
};

/**
 * Encrypts a value. Must be called synchronously using 'await.'
 *
 * @param {mixed} val - Any value to be encrypted
 * @returns {Promise.<object, Error>} - A promise that returns an object containing the encrypted value as a string if resolved, or an Error if rejected
 */
exports.encrypt = function(val) {
    return new Promise(async function(fulfill, reject) {
        if (val || val === '') {
            // Serialize the value for easy storage
            val = php_serialize.serialize(val);

            // Get a nonce to use
            let hadError = false;
            const nonce = await getUniqueNonce().catch(function(error) {
                reject(error);
                hadError = true;
            });
            if (hadError) {
                fulfill(false);
                return;
            }

            // Encrypt
            val = sodium.crypto_secretbox(Buffer.from(val), nonce, Buffer.from(global.settings.ENCRYPTION_KEY));

            // Convert the value buffer to hex
            val = Buffer.from(val).toString('hex');

            // Remove 32 zeros
            val = val.substring(32);

            // Append the nonce to the value
            val = `${val}|${Buffer.from(nonce).toString('hex')}`;

            fulfill(val);
        }
        else {
            fulfill(false);
            return;
        }
    });
};

/**
 * Creates a hash for a value. This function should only be used to create hashes for matching purposes. No security should be assumed.
 *
 * @param {string} val - A string to be hashed
 * @return {string} - The hash value
 */
exports.hash = async function(val) {
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
 * @return {Promise.<string, Error>} - A promise that returns an string containing the hashed password if successful, or an Error if rejected
 */
exports.hashPassword = function(val) {
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
exports.verifyPassword = function(hash, password) {
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

// ==========================================================
// Docs-api, quote-api, agency-portal/api

/**
 * Takes in an array of objects and decrypts all encrypted values in each object
 *
 * @param {Array} objectArray - An array of objects
 * @param {String} action - Either decrypt, encrypt, or hash
 * @param {Array} encryptedKeys - An array of strings corresponding to key names of encrypted fields
 *
 * @return {mixed} - Returns null for invalid input, promise otherwise
 */
exports.batchProcessObjectArray = function(objectArray, action, encryptedKeys) {
    // Make sure an array was provided
    if (!Array.isArray(objectArray) || objectArray.length === 0) {
        return null;
    }

    // Batch decrypt each object in the array
    return Promise.all(objectArray.map((object) => module.exports.batchProcessObject(object, action, encryptedKeys)));
};

/**
 * Takes in an object and decrypts all encrypted values in the object
 *
 * @param {Array} object - An object containing keys with encrypted values
 * @param {String} action - Either decrypt, encrypt, or hash
 * @param {Array} encryptedKeys - An array of strings corresponding to key names of encrypted fields
 *
 * @return {mixed} - Returns null for invalid input, promise otherwise
 */
exports.batchProcessObject = function(object, action, encryptedKeys) {
    // Make sure we got valid arguments
    if (typeof object !== 'object' || object === null) {
        return null;
    }

    // Map each encrypted property to a promise that resolves once decryption is complete
    return Promise.all(encryptedKeys.map((key) => new Promise((resolve) => {
        // Make sure a valid action was provided
        if (!Object.prototype.hasOwnProperty.call(module.exports, action)) {
            resolve();
        }

        // Skip this value if its empty or doesn't exist
        if (!Object.prototype.hasOwnProperty.call(object, key) || object[key] === null || object[key].length === 0) {
            resolve();
        }

        // Get the action handler and ping the encryption service
        const handler = module.exports[action];
        handler(object[key]).then((decryptedValue) => {
            // Set the value if everything went smootly, null otherwise
            if (decryptedValue) {
                object[key] = decryptedValue;
            }
            else {
                object[key] = null;
            }

            resolve();
        });
    })));
};