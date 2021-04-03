'use strict';

//const exports = module.exports = {};

exports.Sleep = async function(ms){
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};


exports.stringArraytoArray = function(dbString){
    if(typeof dbString === 'object'){
        return dbString;
    }
    else if(dbString && typeof dbString === 'string'){
        return dbString.split(',')
    }
    else if(dbString){
        log.debug(`dbstring type ${typeof dbString}`)
        log.debug(`dbstring  ${dbString}`)
        return [];
    }
    else {
        return [];
    }
}


exports.addArrayToArray = function(targetArray, addArray){
    for(let j = 0; j < addArray.length; j++){
        if(targetArray.indexOf(addArray[j]) === -1){
            targetArray.push(addArray[j]);
        }
    }
}