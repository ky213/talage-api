/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
//const moment = require('moment');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const makeInt = true;

exports.process = async function(requestJSON) {
    // move to business and contact info
    // to businessInfo
    //Clean inputs
    requestJSON.businessInfo = {};

    requestJSON.businessInfo.num_owners = stringFunctions.santizeNumber(requestJSON.num_owners, makeInt);
    requestJSON.owners_covered = stringFunctions.santizeNumber(requestJSON.owners_covered, makeInt);

    if(requestJSON.owners){
        const ownersJSON = JSON.parse(requestJSON.owners);
        requestJSON.businessInfo.ownersJSON = ownersJSON;

    }

    delete requestJSON.owners;

    log.debug("Owners Parser requestJSON: " + JSON.stringify(requestJSON));
    return true;
}