'use strict';
const id = /^[1-9][0-9]*$/;

module.exports = function(val){
    return id.test(val);
};