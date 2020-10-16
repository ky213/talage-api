'use strict';

const dollar_amount = /^\$?[1-9]\d{0,2}(,?\d{3})*(\.[0-9]{2})?$/;

/**
 * Checks whether a claim amount is valid (can be used for amount and amount_reserved).
 *
 * @param {mixed} amount - The specified amount
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = function(amount){
    if(typeof amount !== 'string'){
        amount = amount.toString();
    }

    // Check that this is a valid dollar amount
    if(!dollar_amount.test(amount)){
        return false;
    }

    // Cleanup
    amount = Math.round(parseFloat(amount.toString().replace('$', '').replace(/,/g, '')));

    // Check that we are within limits
    if(amount > 15000000){
        return false;
    }

    return true;
};