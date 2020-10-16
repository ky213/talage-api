'use strict';

/**
 * Helper function for concatentating nested template literals
 * by determining if the given value is a String that contains
 * at least one non-space character (that is worth embedding)
 *
 * @param {*} input the nested string
 * @returns {string} the concatenated output
 */
function isEmbeddable(input){

    const isString = String(input) === input;
    const hasContent = /\S/.test(input);

    return isString && hasContent;

}

module.exports = function embed(...args){

    const strings = args[0];
    const values = args.slice(1);
    const results = [];

    for(let i = 0; i < strings.length; i++){

        // Make sure the string part isn't just spaces and tabs.
        if(isEmbeddable(strings[i])){
            results.push(strings[i]);
        }

        // Make sure the value is a String and more than just spaces and tabs.
        if(isEmbeddable(values[i])){
            results.push(values[i]);
        }

    }

    return results.join('');
};