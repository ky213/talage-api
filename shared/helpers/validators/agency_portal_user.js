'use strict';

const positive_integer = /^[1-9]\d*$/;


/**
 * Checks whether an agency portal user is valid (exists in our database). Valid agents are active
 * A valid agent is identified by ID
 *
 * @param {number} agencyPortalUserId - The ID of the agency portal user
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(agencyPortalUserId){
    if(positive_integer.test(agencyPortalUserId)){
        let had_error = false;
        const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
        const agencyPortalUserBO = new AgencyPortalUserBO();
        const agencyPortalUserJSON = await agencyPortalUserBO.getById(parseInt(agencyPortalUserId, 10)).catch(function(error){
            log.error(error + __location);
            had_error = true;
        });
        if(had_error){
            return false;
        }

        if(agencyPortalUserJSON && agencyPortalUserJSON.agencyPortalUserId > 0){
            return true;
        }
        else {
            return false;
        }
    }
    return false;
};