'use strict';
const name = /^[a-zA-Z' -]*$/;

module.exports = function(val){
	return Boolean(name.test(val));
};

// docusign-api
/*
const regex = /^[a-zA-Z'-]* [a-zA-Z'-]*$/;

module.exports = function(name){
	if(name){
		// Check formatting
		if(!regex.test(name)){
			return 'Invalid name';
		}

		// Check length
		if(name.length > 100){
			return 'Name exceeds maximum length of 100 characters';
		}
	}else{
		return 'Missing required field: name';
	}
	return true;
};
*/