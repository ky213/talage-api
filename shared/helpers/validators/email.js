'use strict';

const email = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

module.exports = function(val){
	if(val){
		// Check formatting
		if(!email.test(val)){
			return false;

			// Quote-api
			// Return 'Invalid email address in contact';
		}

		// Check length
		if(val.length > 100){
			return false;

			// Quote-api
			// Return 'Email exceeds maximum length of 100 characters';

		}
	}else{
		return false;

		// Quote-api
		// Return 'Missing required field in contact: email';
	}
	return true;
};