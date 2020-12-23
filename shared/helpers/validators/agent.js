'use strict';

const positive_integer = /^[1-9]\d*$/;


/**
 * Checks whether an agent is valid (exists in our database). Valid agents are active or disabled (not deleted)
 * A valid agent is identified by ID
 *
 * @param {number} agent - The ID of the agent
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async (agent) => {
    if (positive_integer.test(agent)) {
        let had_error = false;
        let agency = null;
        
        try {
            // Load the request data into it
            const AgencyBO = global.requireShared('./models/Agency-BO.js');
            const agencyBO = new AgencyBO();
            agency = await agencyBO.getById(agent);
        } catch(err) {
            log.error("agencyBO.getbyid load error " + err + __location);

            had_error = true;
        }
        if (had_error) {
            return false;
        } else if (agency && agency.systemId > 0) {
            return true;
        } else {
            return false;
        }
    }

    return false;
};