/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
const moment = require('moment');
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
    delete requestJSON.num_owners;
    requestJSON.owners_covered = stringFunctions.santizeNumber(requestJSON.owners_covered, makeInt);

    if(requestJSON.owners_covered > 0){
        if(requestJSON.activity_code && requestJSON.payroll){
            requestJSON.owner_payroll = {}
            requestJSON.owner_payroll.activity_code = stringFunctions.santizeNumber(requestJSON.activity_code, makeInt);
            requestJSON.owner_payroll.payroll = stringFunctions.santizeNumber(requestJSON.payroll, makeInt);
            requestJSON.businessInfo.owner_payroll = JSON.parse(JSON.stringify(requestJSON.owner_payroll));
            delete requestJSON.activity_code
            delete requestJSON.payroll
        }
    }
    else {
        const ownersJSON = JSON.parse(requestJSON.owners);
        requestJSON.businessInfo.ownersJSON = ownersJSON;

    }

    delete requestJSON.owners;

    log.debug("Owners Parser requestJSON: " + JSON.stringify(requestJSON));
    return true;
}