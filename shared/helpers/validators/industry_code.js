'use strict';

const positive_integer = /^[1-9]\d*$/;
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');

/**
 * Checks whether an industry code is valid (exists in our database)
 *
 * @param {number} industryCodeId - The ID of the industry code
 * @returns {mixed} - Description as a string if valid, false otherwise
 */
module.exports = async function(industryCodeId){
    if(positive_integer.test(industryCodeId)){

        const industryCodeBO = new IndustryCodeBO();
        let industryCodeJson = null;
        try{
            industryCodeJson = await industryCodeBO.getById(industryCodeId);
        }
        catch(err){
            log.error("Error getting industryCodeBO " + err + __location);
        }
        if(industryCodeJson){
            return true;
        }
        else {
            return false;
        }
    }
    else {
        return false;
    }

};