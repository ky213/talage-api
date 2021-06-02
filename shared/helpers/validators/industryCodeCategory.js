'use strict';

const positive_integer = /^[1-9]\d*$/;

/**
 * Checks whether an industry code category is valid (exists in our database)
 *
 * @param {number} id - The ID of the industry code category
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(id){
    if(positive_integer.test(id)){
        let had_error = false;
        const IndustryCodeCategoryBO = global.requireShared('./models/IndustryCodeCategory-BO.js');
        const industryCodeCategoryBO = new IndustryCodeCategoryBO();
        const objectJSON = await industryCodeCategoryBO.getById(id).catch(function(err) {
            log.error("Industry Code Category Category load error " + err + __location);
            had_error = err;
        });
        if(had_error){
            return false;
        }
        if(!objectJSON || objectJSON.name === ''){
            return false;
        }
        return true;
    }
    return false;
};