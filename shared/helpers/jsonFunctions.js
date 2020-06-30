'use strict';

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

/**
 * Copy JSON object
 *
 * @param {JSON} sourceJSON - source JSON object
 * @return {JSON} - New independent JSON object
 */
exports.jsonCopy = function(sourceJSON){
	return JSON.parse(JSON.stringify(sourceJSON))
};


/**
 * Copy JSON object
 *
 * @param {string} sourceString - source string for JSON object
 * @return {JSON} - New JSON object, if error null;
 */
exports.jsonParse = function(sourceString){
    let newJSON = null;
    try{
        newJSON = JSON.parse(sourceString)
    }
    catch(e){
        log.error("jsonParse error:" + e + __location)
    }
    return newJSON;
};