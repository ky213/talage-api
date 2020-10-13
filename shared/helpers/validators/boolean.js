'use strict';

/**
 * Checks whether the value is a valid boolean
 *
 * @param {mixed} val - The value to check
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(val){

    // Based on the datatype, perform different checks
    switch(typeof val){

        case 'boolean':
            return true;

        case 'number':
            if(val === 0 || val === 1){
                return true;
            }
            break;

        case 'string':
            if(val === 'true' || val === 'false'){
                return true;
            }
            break;

        default:
            log.error('Boolean Validator encountered value it cannot check (must be boolean, number, or string)' + __location);
            break;
    }

    return false;
};