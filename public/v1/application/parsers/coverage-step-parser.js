/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
const moment = require('moment');
//var sanitizer = require('sanitize')();
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

exports.process = async function(requestJSON) {

    // move to business and contact info
    // to businessInfo
    //Clean inputs

    const policy_typesJSON = JSON.parse(requestJSON.policy_types);
    const questionsJSON = JSON.parse(requestJSON.questions);
    requestJSON.policy_types = policy_typesJSON;
    for(var i = 0; i < policy_typesJSON.length; i++){
        const pType = policy_typesJSON[i].toLowerCase();
        if(questionsJSON[pType]){
            const typeQuestionJSON = questionsJSON[pType];

            const effective_dateStr = typeQuestionJSON.effective_date;
            const effective_date = moment(effective_dateStr, 'MM/DD/YYYY');
            const effective_fieldName = pType + '_effective_date';
            requestJSON[effective_fieldName] = effective_date.format(db.dbTimeFormat());

            // Expiration date is 1 years past the effective date
            const expiration_date = effective_date.clone().add(1, 'years');
            const expiration_fieldName = pType + '_expiration_date';
            requestJSON[expiration_fieldName] = expiration_date.format(db.dbTimeFormat());

            if(pType === 'bop' || pType === 'gl'){
                //requestJSON.limits = typeQuestionJSON.limits.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g,"").replace("/[^0-9]/", '');
                requestJSON.limits = stringFunctions.santizeNumber(typeQuestionJSON.limits);
                requestJSON.deductible = stringFunctions.santizeNumber(typeQuestionJSON.deductible);
                if(policy_typesJSON.includes('WC') === false){
                    // log.debug("has not WC");
                    const num_of_ownersStr = typeQuestionJSON.num_owners.replace("/[^0-9]/", '');
                    try{
                        const num_of_owner = parseInt(num_of_ownersStr, 10);
                        requestJSON.businessInfo = {"num_owners": num_of_owner};
                    }
                    catch(e){
                        log.error("coverage parse error number of owners: " + e);
                    }
                }

            }
            else {
                requestJSON.wc_limits = stringFunctions.santizeNumber(typeQuestionJSON.limits);
            }
            if(pType === 'bop'){
                requestJSON.coverage = stringFunctions.santizeNumber(typeQuestionJSON.coverage);
            }
        }
        else {
            throw new Error(`Couldn't get questions for policy type: ${pType}`)
        }
        delete requestJSON.questions;

    }
    //log.debug("Coverage Parser requestJSON: " + JSON.stringify(requestJSON));
    return true;
}