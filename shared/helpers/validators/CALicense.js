'use strict';
const CALicense = /^[0-9]{1}[0-9A-Z]{1}[0-9]{5}$/;

module.exports = function(val){
    return CALicense.test(val);
};