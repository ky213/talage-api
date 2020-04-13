'use strict';
const twelveHourTime = /^(0?[1-9]|1[0-2])$/;

module.exports = function(val){
	return twelveHourTime.test(val);
};