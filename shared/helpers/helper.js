/**
 * Provides functions used in multiple places in our system
 */

'use strict';

/**
 * Converts the value to a boolean
 *
 * @param {mixed} val - The value to convert
 * @returns {boolean} - The value as a boolean
 */
exports.convert_to_boolean = function(val){
    // Based on the datatype, perform different checks
    switch(typeof val){

        case 'boolean':
            return val;

        case 'number':
            return val > 0;

        case 'string':
            return val === 'true';

        default:
            log.error('convert_to_boolean() encountered value it cannot convert accurately' + __location);
            break;
    }

    return false;
};


// TODO need to be database driven not hardcoded.
// Only called from application validation code
exports.supportedLimits = {
    'BOP': [
        '300000/300000/300000',
        '500000/500000/500000',
        '500000/1000000/1000000',
        '1000000/1000000/1000000',
        '1000000/2000000/1000000',
        '1000000/2000000/2000000'
    ],
    'GL': [
        '300000/300000/300000',
        '500000/500000/500000',
        '500000/1000000/1000000',
        '1000000/1000000/1000000',
        '1000000/2000000/1000000',
        '1000000/2000000/2000000'
    ],
    'WC': [
        '100000/500000/100000',
        '500000/500000/500000',
        '500000/1000000/500000',
        '1000000/1000000/1000000',
        '2000000/2000000/2000000'
    ]
};

exports.splitArray = function(array, chunkSize) {
    return Array(Math.ceil(array.length / chunkSize)).fill().map(function(_,i) {
        return array.slice(i * chunkSize, i * chunkSize + chunkSize);
    });
}

exports.sleep = async function(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}