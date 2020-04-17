/**
 * Encryption/Decryption helper (based on Sodium)
 *
 * Note: Thirty-two zeros. The original NaCl crypto_box() function required extra padding before
 * the ciphertext. As the node.js Sodium library is based on that original library, it also requires
 * extra padding, in this case 16 bytes (32 hex characters) of zeros before the cypher text begins. 😱
 */

'use strict';

const php_serialize = require('php-serialize');
const sha1 = require('sha1');
const sodium = require('sodium').api;

// Private Functions

/**
 * Returns a unique encryption nonce (number only used once).
 * Also manages the security_nonce table of our database to ensure nonces are only used once.
 *
 * @returns {Promise.<object, Error>} - A promise that returns an object containing the nonce as a string if resolved, or an Error if rejected
 */
function getUniqueNonce() {
	return new Promise(async function (fulfill, reject) {
		let duplicate = true;
		let nonce = '';

		while (duplicate) {
			// Generate a random nonce
			nonce = Buffer.allocUnsafe(sodium.crypto_secretbox_NONCEBYTES);
			sodium.randombytes(nonce, sodium.crypto_secretbox_NONCEBYTES);

			// Query the database to check if the nonce is unique
			const sql = `SELECT id FROM #__security_nonces WHERE nonce = '${nonce.toString('hex')}';`;
			const rows = await db.query(sql).catch(function (error) { // eslint-disable-line no-await-in-loop
				reject(error);
			});
			if (!rows || rows.length === 0) {
				duplicate = false;
			}
		}

		fulfill(nonce);

		// Store this nonce so we know it was used
		const sql = `INSERT INTO #__security_nonces (nonce) VALUES ('${nonce.toString('hex')}');`;
		await db.query(sql).catch(function (error) {
			reject(error);
		});
	});
}

// Public Interfaces

/**
 * Decrypts a value
 *
 * @param {string} val - The encrypted value
 * @returns {mixed} - The decrypted value on success, false otherwise
 */
exports.decrypt = function (val) {
	if (!val) {
		return val;
	}

	// Make sure this is a string, and if it is not, try to convert it to one
	if (typeof val !== 'string') {
		try {
			val = val.toString();
		} catch (error) {
			log.error(error);
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
	val = sodium.crypto_secretbox_open(val, nonce, Buffer.from(settings.ENCRYPTION_KEY));

	// Check if decryption was successful, if not, return
	if (!val) {
		return false;
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
exports.encrypt = function (val) {
	return new Promise(async function (fulfill, reject) {
		if (!val) {
			fulfill(false);
			return;
		}

		// Serialize the value for easy storage
		val = php_serialize.serialize(val);

		// Get a nonce to use
		let hadError = false;
		const nonce = await getUniqueNonce().catch(function (error) {
			reject(error);
			hadError = true;
		});
		if (hadError) {
			fulfill(false);
			return;
		}

		// Encrypt
		val = sodium.crypto_secretbox(Buffer.from(val), nonce, Buffer.from(settings.ENCRYPTION_KEY));

		// Convert the value buffer to hex
		val = Buffer.from(val).toString('hex');

		// Remove 32 zeros
		val = val.substring(32);

		// Append the nonce to the value
		val = `${val}|${Buffer.from(nonce).toString('hex')}`;

		fulfill(val);
	});
};


/**
 * Creates a hash for a value. This function should only be used to create hashes for matching purposes. No security should be assumed.
 *
 * @param {string} val - A string to be hashed
 * @return {string} - The hash value
 */
exports.hash = function (val) {
	// Convert the value to lowercase
	val = val.toLowerCase();

	// Salt the value
	val += settings.SALT;

	// Hash the value and return the result
	return sha1(val);
};

/**
 * Hashes a password. Must be called synchronously using 'await.'
 *
 * @param {string} val - A password string to be hashed
 * @return {Promise.<string, Error>} - A promise that returns an string containing the hashed password if successful, or an Error if rejected
 */
exports.hashPassword = function (val) {
	return new Promise(function (fulfill, reject) {
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