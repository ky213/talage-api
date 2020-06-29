/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
const moment = require('moment');
var sanitizer = require('sanitize')();


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
            const fieldName = pType + '_effective_date';
            requestJSON[fieldName] = effective_date.format(db.dbTimeFormat());
            if(pType === 'bop' || pType === 'GL'){
                requestJSON.limits = typeQuestionJSON.limits.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g,"").replace("/[^0-9]/", '');
                requestJSON.deductible = sanitizer.my.str(typeQuestionJSON.deductible);
                if(policy_typesJSON.includes('WC') === false){
                    log.debug("has WC");
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
                requestJSON.wc_limits = typeQuestionJSON.limits.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g,"").replace("/[^0-9]/", '');
            }
            if(pType === 'bop'){
                requestJSON.coverage = typeQuestionJSON.coverage.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g,"").replace("/[^0-9]/", '');
            }
        }
        else {
            throw new Error(`Couldn't get questions for policy type: ${pType}`)
        }
        delete requestJSON.questions;

    }
    return true;
}