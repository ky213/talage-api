'use strict';

/**
 * Checks whether the close time is valid.
 *
 * @param {number} time - The specified close time
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(time){
	if(Number.isInteger(time) && time >= 3 && time <= 8){
		return true;
	}
	return false;
};