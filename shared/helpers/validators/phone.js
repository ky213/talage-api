'use strict';

const phone = /^\+?([0-9]( |-|.)?)?(\(?[2-9][0-9]{2}\)?|[2-9][0-9]{2})( |-|.)?([2-9][0-9]{2}( |-|.)?[0-9]{4}|[a-zA-Z0-9]{7})$/;

module.exports = function(val){
	// Check that we have a type we can work with
	if(typeof val !== 'number' && typeof val !== 'string'){
		return false;
	}

	// If this is a number, convert it to a string
	if(typeof val === 'number'){
		val = val.toString();
	}

	// Check the formatting
	if(!phone.test(val)){
		return false;
	}

	// If there is a plus or a one at the start, remove it
	if(val.startsWith('+')){
		val = val.slice(1);
	}
	if(val.startsWith('1')){
		val = val.slice(1);
	}

	// Remove any non-number characters
	val = val.replace(/[^0-9]/ig, '');

	// Check the length
	if(val.length === 10){
		return true;
	}

	return false;
};