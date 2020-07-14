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

    requestJSON.corporation_type = stringFunctions.santizeString(requestJSON.corporation_type);
    requestJSON.coverage_lapse = stringFunctions.santizeNumber(requestJSON.coverage_lapse, makeInt);
    requestJSON.coverage_lapse_non_payment = stringFunctions.santizeNumber(requestJSON.coverage_lapse_non_payment, makeInt);
    requestJSON.entity_type = stringFunctions.santizeString(requestJSON.entity_type);
    try{
        requestJSON.experience_modifier = parseFloat(requestJSON.experience_modifier);
    }
    catch(e){
        log.error("experience_modifier convert error" + e + __location)
    }
    requestJSON.gross_sales_amt = stringFunctions.santizeNumber(requestJSON.gross_sales_amt, makeInt);
    requestJSON.has_ein = stringFunctions.santizeNumber(requestJSON.has_ein, makeInt);
    requestJSON.management_structure = stringFunctions.santizeString(requestJSON.management_structure);
    requestJSON.unincorporated_association = stringFunctions.santizeNumber(requestJSON.unincorporated_association, makeInt);
    requestJSON.years_of_exp = stringFunctions.santizeNumber(requestJSON.years_of_exp, makeInt);


    requestJSON.businessInfo.entity_type = stringFunctions.santizeString(requestJSON.entity_type);
    requestJSON.businessInfo.ein = stringFunctions.santizeString(requestJSON.ein);
    requestJSON.businessInfo.file_num = stringFunctions.santizeString(requestJSON.file_num);
    requestJSON.businessInfo.association = stringFunctions.santizeString(requestJSON.association);
    requestJSON.businessInfo.association_id = stringFunctions.santizeString(requestJSON.association_id);

    //requestJSON.businessInfo.founded = new \DateTime(requestJSON.founded', null, 'string')),
    try{
        const found_date = moment(requestJSON.founded, 'MM/DD/YYYY');
        requestJSON.businessInfo.founded = found_date.format(db.dbTimeFormat());
    }
    catch(e){
        log.error("Detail found_date convert error " + e + __location)
    }
    requestJSON.businessInfo.has_ein = stringFunctions.santizeNumber(requestJSON.has_ein,makeInt);
    requestJSON.businessInfo.ncci_number = stringFunctions.santizeString(requestJSON.ncci_number);
    requestJSON.businessInfo.website = stringFunctions.santizeString(requestJSON.website);

   // log.debug("Detail Parser requestJSON: " + JSON.stringify(requestJSON));
    return true;
}