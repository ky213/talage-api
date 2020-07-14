/* eslint-disable array-element-newline */
'use strict';


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

exports.process = function(requestJSON) {

    // move to business and contact info
    // to businessInfo
    //Clean inputs

    requestJSON.experience_modifier = 1.00;

    if(requestJSON.agency_id){
        requestJSON.agency = requestJSON.agency_id
        if(requestJSON.agency === 0 || requestJSON.agency === "0"){
            requestJSON.agency = 1;
        }
    }
    else {
        requestJSON.agency = 1;
    }
    if(requestJSON.agencylocation_id){
        requestJSON.agency_location = requestJSON.agencylocation_id
        if(requestJSON.agency_location === 0 || requestJSON.agency_location === "0"){
            requestJSON.agency_location = 1;
        }
    }
    else {
        requestJSON.agency_location = 1;
    }

    var fieldstoMoveToBusineess = ["industry_code", "dba", "name"]
    var fieldstoMoveToBusineessContact = ["fname", "lname", "email", "phone"]
    requestJSON.businessInfo = {};
    const businessInfo = requestJSON.businessInfo;
    businessInfo.contacts = [];
    for (var i = 0; i < fieldstoMoveToBusineess.length; i++) {
        if (requestJSON[fieldstoMoveToBusineess[i]]) {
            businessInfo[fieldstoMoveToBusineess[i]] = requestJSON[fieldstoMoveToBusineess[i]];
        }
    }
    const contact = {};
    contact.primary = 1;
    contact.state = 1;
    for (var j = 0; j < fieldstoMoveToBusineessContact.length; j++) {
        if (requestJSON[fieldstoMoveToBusineessContact[j]]) {
            contact[fieldstoMoveToBusineessContact[j]] = requestJSON[fieldstoMoveToBusineessContact[j]];
        }
    }
    businessInfo.contacts.push(contact);

    requestJSON.demo = false;
    if (requestJSON.name.toLowerCase().startsWith('talage')) {
        requestJSON.demo = true;
    }

    return true;
}