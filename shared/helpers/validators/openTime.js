'use strict';

/**
 * Checks whether the open time is valid.
 *
 * @param {number} time - The specified open time
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(time){
    if(Number.isInteger(time) && time >= 7 && time <= 11){
        return true;
    }
    return false;
};