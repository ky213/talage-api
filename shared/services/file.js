/**
 * File helper. Provides an interface for our internal file service which stores and retrieves files from cloud storage.
 */

'use strict';

const request = require('request');

/**
 * Stores a file in cloud storage
 *
 * @param {string} path - The path at which this file will be stored
 * @param {string} data - The PDF data, base64 encoded
 * @return {boolean} - True if successful; false otherwise
 */
exports.store = async function (path, data) {

	// If we are in the test environment, don't store anything and just return true
	if (settings.NODE_ENV === 'test') {
		return true;
	}

	// Make sure we have a path
	if (!path || !path.length) {
		log.warn('File helper: You must supply a path when using store()');
		return false;
	}

	// Make sure we have data
	if (!data || !data.length) {
		log.warn('File helper: You must supply file data when using store()');
		return false;
	}

	// Compose the options for the request to the file service
	const options = {
		'headers': { 'content-type': 'application/json' },
		'json': {
			'data': data,
			'path': path
		},
		'method': 'PUT',
		'url': `http://localhost:${settings.PRIVATE_API_PORT}/v1/file/file`
	};

	// Send the request
	let rtn = true;
	await request(options, function (e, response, body) {

		// If there was an error, return false
		if (e) {
			rtn = false;
			log.error('Failed to connect to file service.');
			return;
		}

		// If the response was anything but a success, return false
		if (response.statusCode !== 200) {
			// The response is JSON, parse out the error
			const message = `${response.statusCode} - ${body.message}`;
			log.warn(message);
			rtn = false;
		}
	});

	return rtn;
};

/**
 * Retrieves a file from cloud storage
 *
 * @param {string} path - The path at which this file is stored
 * @return {boolean} - True if successful; false otherwise
 */
exports.get = function (path) {
	return new Promise(async function (resolve) {

		// Make sure we have a path
		if (!path || !path.length) {
			log.warn('File helper: You must supply a path when using get()');
			return false;
		}

		// Compose the options for the request to the file service
		const options = {
			'method': 'GET',
			'url': `http://localhost:${settings.PRIVATE_API_PORT}/v1/file/file?path=${path}`
		};

		// Send the request
		await request(options, function (e, response, body) {

			// If there was an error, return false
			if (e) {
				log.error('Failed to connect to file service.');
				resolve(false);
				return;
			}

			// If the response was anything but a success, return false
			if (response.statusCode !== 200) {
				// The response is JSON, parse out the error
				const message = `${response.statusCode} - ${body.message}`;
				log.warn(message);
				resolve(false);
				return;
			}

			// Return the file data
			body = JSON.parse(body);
			resolve(body.Body);
		});
	});
};