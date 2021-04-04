'use strict'

/**
 * Takes in a limits string and formats it
 *
 * @param {string} limitsString - String conatining limits (ex. '100000020000001000000')
 * @return {array} - The formatted limits (ex. ['1,000,000', '2,000,000', '1,000,000'])
 */
exports.getLimitsAsDollarAmounts = function(limitsString){
    const limitsArray = limitsString.match(/[1-9]+0*/g);
    limitsArray.forEach((limit, index) => {
        limitsArray[index] = limit.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    });
    return limitsArray;
}

/**
 * Takes in a limits string and returns array of amounts
 *
 * @param {string} limitsString - String conatining limits (ex. '100000020000001000000')
 * @return {array} - The individual limits (ex. ['1000000', '2000000', '1000000'])
 */
exports.getLimitsAsAmounts = function(limitsString){
    const limitsArray = limitsString.match(/[1-9]+0*/g);
    return limitsArray;
}