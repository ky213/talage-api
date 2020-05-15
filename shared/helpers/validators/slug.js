'use strict';
const slug = /^[a-z0-9\-]*$/;

module.exports = function(val){
	// Make sure the value is the type of data we are expecting
	if(typeof val !== 'string'){
		return false;
	}

	// Enforce the length requirements
	if(val.length < 3 || val.length > 50){
		return false;
	}

	// Check the regex
	return slug.test(val);
};