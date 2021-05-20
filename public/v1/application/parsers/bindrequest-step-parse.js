/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
// const moment = require('moment');
// const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
// const makeInt = true;

exports.process = async function(requestJSON) {

    try{
        if(typeof requestJSON.quotes === 'string'){
            requestJSON.quotes = JSON.parse(requestJSON.quotes)
        }
    }
    catch(err){
        log.error(`bindrequest parser ${err} requestJSON${JSON.stringify(requestJSON)}  ` + __location)
    }
    //Convert to boolean
    requestJSON.additionalInsured = requestJSON.additionalInsured === 'true';
    // waiver_subrogation
    requestJSON.waiverSubrogation = requestJSON.waiverOfSubrogation === 'true'
    if (requestJSON.waiverOfSubrogation) {
        delete requestJSON.waiverOfSubrogation
    }

    log.info("bindRequest AF parser requestJSON: " + JSON.stringify(requestJSON));
    return true;
}