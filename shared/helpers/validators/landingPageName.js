'use strict';
const pageName = /^[a-zA-Z0-9\- ]*$/;

module.exports = function(val){
	// Make sure the value is the type of data we are expecting
	if(typeof val !== 'string'){
		return false;
	}

	// Enforce the maximum length
	if(val.length > 70){
		return false;
	}

	// Check the regex
	return pageName.test(val);
};