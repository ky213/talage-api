'use strict';
const address2 = /^[A-Za-z0-9\.\-\# ]*$/;

module.exports = function(val){
	return Boolean(address2.test(val) && val.length <= 30);
};