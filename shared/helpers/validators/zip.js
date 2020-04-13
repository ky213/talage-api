'use strict';
const zip = /^("|')?[0-9]{5}("|')?$/;

module.exports = function(val){
	return Boolean(zip.test(val));
};