'use strict';

//const exports = module.exports = {};

exports.Sleep = async function(ms){
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};