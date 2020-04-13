'use strict';

const regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Checks whether or not a uuid is valid
 * @param {string} uuid - A string to examine
 * @returns {mixed} - Boolean true if valid, string otherwise
 */
module.exports = function(uuid){
	if(uuid){
		// Check formatting
		if(!regex.test(uuid)){
			return 'Invalid uuid';
		}
	}else{
		return 'Missing required field: uuid';
	}
	return true;
};