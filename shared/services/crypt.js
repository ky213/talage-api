/**
 * Encryption/Decryption helper. Provides an interface for our internal encryption service.
 */

'use strict';

const request = require('request');

// Private Functions

/**
 * Sends a request to our encryption service. Must be called using await.
 *
 * @param {string} endpoint - The API endpoint to be used
 * @param {string|Object} data - The data to be sent to the encryption service
 * @returns {Promise.<string, Error>} - A promise that returns the result of the request as a string if resolved, or an Error if rejected
 */
function sendRequest(endpoint, data) {
	// Send the request to the encryption service
	return new Promise(function (resolve, reject) {
		// Establish the options for the request
		const options = {
			'headers': {
				'accept': 'text/plain'
			},
			'method': 'POST',
			'url': `http://localhost:${settings.PRIVATE_API_PORT}/v1/encryption/${endpoint}`
		};

		// Determine what type of data to send
		switch (typeof data) {
			case 'object':
				options.json = data;
				options.headers['content-type'] = 'application/json';
				break;
			case 'string':
				options.body = data;
				options.headers['content-type'] = 'text/plain';
				break;
			default:
				log.warn('crypt sendRequest only accepts data as a string or an object');
				reject(new Error('crypt sendRequest only accepts data as a string or an object'));
				break;
		}

		// Send the request
		request(options, function (error, response, body) {
			// If there was an error, reject
			if (error) {
				log.error('Failed to connect to encryption service.');
				reject(new Error('Failed to connect to encryption service.'));
				return;
			}

			// If the response was anything but a success, reject
			if (response.statusCode !== 200) {
				// The response is JSON, parse out the error
				const message = `${response.statusCode} - ${JSON.parse(body).message}`;
				log.warn(message);
				reject(new Error(message));
				return;
			}

			// Everything worked, return the response
			resolve(body);
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
exports.decrypt = function (val) {
	return new Promise(async function (resolve) {
		// If this is a buffer, convert it to a string
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
		const result = await sendRequest('decrypt', val).catch(function () {
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
 * Encrypts a value. Must be called synchronously using 'await.'
 *
 * @param {mixed} val - Any value to be encrypted
 * @return {Promise.<string, boolean>} - The decrypted value on success, false otherwise
 */
exports.encrypt = function (val) {
	return new Promise(async function (resolve) {
		// Make sure this is a string and that it is not empty
		if (typeof val !== 'string' || val === '') {
			resolve(false);
			return;
		}

		// Send a request to the encryption service
		let hadError = false;
		const result = await sendRequest('encrypt', val).catch(function () {
			hadError = true;
			resolve(false);
		});
		if (hadError) {
			return;
		}

		// Return the encrypted result
		resolve(result);
	});
};

/**
 * Creates a hash for a value. This function should only be used to create hashes for matching purposes. No security should be assumed. Must be called synchronously using 'await.'
 *
 * @param {string} val - A value to be hashed
 * @return {Promise.<string, boolean>} - The decrypted value on success, false otherwise
 */
exports.hash = function (val) {
	return new Promise(async function (resolve) {
		// Make sure this is a string and that it is not empty
		if (typeof val !== 'string' || val === '') {
			resolve(false);
			return;
		}

		// Send a request to the encryption service
		let hadError = false;
		const result = await sendRequest('hash', val).catch(function () {
			hadError = true;
			resolve(false);
		});
		if (hadError) {
			return;
		}

		// Return the hashed result
		resolve(result);
	});
};

/**
 * Hashes a password. Must be called synchronously using 'await.'
 *
 * @param {string} val - Any value to be hashed
 * @return {Promise.<string, boolean>} - The decrypted value on success, false otherwise
 */
exports.hashPassword = function (val) {
	return new Promise(async function (resolve) {
		// Make sure this is a string and that it is not empty
		if (typeof val !== 'string' || val === '') {
			resolve(false);
			return;
		}

		// Send a request to the encryption service
		let hadError = false;
		const result = await sendRequest('hashPassword', val).catch(function () {
			hadError = true;
			resolve(false);
		});
		if (hadError) {
			return;
		}

		// Return the hashed password
		resolve(result);
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
exports.verifyPassword = function (hash, password) {
	return new Promise(async function (resolve) {
		// Make sure this is a string and that it is not empty
		if (typeof hash !== 'string' || hash === '' || typeof password !== 'string' || password === '') {
			resolve(false);
			return;
		}

		// Send a request to the encryption service
		let hadError = false;
		const result = await sendRequest('verifyPassword', {
			hash,
			password
		}).catch(function () {
			hadError = true;
			resolve(false);
		});
		if (hadError) {
			return;
		}

		// Return the hashed password
		resolve(result);
	});
};

// ==========================================================
// docs-api, quote-api, agency-portal/api

/**
 * Takes in an array of objects and decrypts all encrypted values in each object
 *
 * @param {Array} objectArray - An array of objects
 * @param {String} action - Either decrypt, encrypt, or hash
 * @param {Array} encryptedKeys - An array of strings corresponding to key names of encrypted fields
 *
 * @return {mixed} - Returns null for invalid input, promise otherwise
 */
exports.batchProcessObjectArray = function (objectArray, action, encryptedKeys) {
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
exports.batchProcessObject = function (object, action, encryptedKeys) {
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
			} else {
				object[key] = null;
			}

			resolve();
		});
	})));
};

