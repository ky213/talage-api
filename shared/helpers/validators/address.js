'use strict';
const address = /^[A-Za-z0-9'\.\-\s\,]*$/;

module.exports = function(val){
    return Boolean(address.test(val) && val.length <= 100);
};