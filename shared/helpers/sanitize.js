/**
 * This is a Restify sanitization middleware package. When installed properly, Restify
 * passes all requests through it before they go to the endpoint for processing. This
 * middleware will automatically sanitize any data it finds within the request body,
 * parameters, or query.
 *
 * To use, require this file in your Restify server and then 'use' it as follows:
 * server.use(sanitize);
 * Note: The 'use' command must come before any endpoints have been defined
 */

'use strict';

const striptags = require('striptags');

/**
 * Sanitizes a single string value
 *
 * @param {string} dirty_string - Te string to sanitize
 * @return {string} The clean string
 */
function sanitize_string(dirty_string){
	let clean_string = '';

	// Make sure this is a string
	if(typeof dirty_string !== 'string'){
		log.error('Attempted to sanitize non-string value. Returning no data for safety.');
		return;
	}

	// If the string is empty, do nothing
	if(dirty_string.length === 0){
		return clean_string;
	}

	// Remove any HTML tags, reducing the liklihood of XXS attacks
	dirty_string = striptags(dirty_string);

	// Encode any remaining triangle brackets, further reducing the liklihood of XXS attacks
	dirty_string = dirty_string.replace('<', '&lt;').replace('>', '&gt;');

	// As the last step, trim whitespace off to make this more convienent for users, it is now clean
	clean_string = dirty_string.trim();

	// Return the clean value
	return clean_string;
}

/**
 * Sanitizes an object key
 *
 * @param {mixed} dirty_key - A key to sanitize
 * @return {mixed} The clean data
 */
function sanitize_key(dirty_key){
	// Start by running our generic sanitize function
	dirty_key = sanitize_string(dirty_key);

	// Next, convert to lower case as keys can only be lowercase
	dirty_key = dirty_key.toLowerCase();

	// Finally, use a rejex to disallow all but the approved characters
	const clean_key = dirty_key.replace(/[^0-9a-z_]/g, '');

	// Return the clean input
	return clean_key;
}

/**
 * Sanitizes a piece of data
 *
 * @param {mixed} dirty_data - A piece of data to sanitize
 * @return {mixed} The clean data
 */
function sanitize_value(dirty_data){
	let clean_data = '';

	switch(typeof dirty_data){
		case 'string':
			clean_data = sanitize_string(dirty_data);
			break;
		default:
			log.error('Attempted to sanitize non-supported datatype. Returning no data for safety.');
			break;
	}

	// Return the clean input
	return clean_data;
}

/**
 * Sanitizes an object
 *
 * @param {obj} dirty_obj - The object to be sanitized
 * @return {obj} The sanitized obj
 */
function sanitize_object(dirty_obj){
	const clean_obj = {};

	// Make sure this is an object
	if(typeof dirty_obj !== 'object'){
		log.error('Attempted to sanitize non-object. Returning no data for safety.');
		return;
	}

	// Loop through each element
	for(const key in dirty_obj){
		if(Object.prototype.hasOwnProperty.call(dirty_obj, key)){

			// Sanitize the value
			const clean_value = sanitize_value(dirty_obj[key]);

			// Sanitize the key
			const clean_key = sanitize_key(key);

			// Store the clean data in a new object that will be returned
			clean_obj[clean_key] = clean_value;
		}
	}

	// Return the clean object
	return clean_obj;
}

/**
 * Export Restify middleware
 * @return {function} Middleware function
 */
module.exports = function(){
	return (req, res, next) => {

		// Sanitize each part of the request, the body, parameters, and the query string
		if(req.body){
			req.body = sanitize_object(req.body);
		}

		if(req.params){
			req.params = sanitize_object(req.params);
		}

		if(req.query){
			req.query = sanitize_object(req.query);
		}

		next();
	};
};