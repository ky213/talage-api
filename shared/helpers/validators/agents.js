'use strict';

const positive_integer = /^[1-9]\d*$/;


/**
 * Checks whether a list of agents is valid (exists in our database). Valid agents are active or disabled (not deleted)
 * A valid agent is identified by ID
 *
 * @param {array} agents - An array of numbers that are the ID of the agent
 * @returns {boolean} - True if valid, false otherwise
 */
module.exports = async function(agents){
    let had_error = false;

    // First, check that each agent appears to be an ID number
    agents.forEach(function(agent){
        if(!positive_integer.test(agent)){
            had_error = true;
        }
    });

    if(had_error){
        return false;
    }

    let agencyList = null;
    try{
        // Load the request data into it
        const query = {agencies: agents}
        const AgencyBO = global.requireShared('./models/Agency-BO.js');
        const agencyBO = new AgencyBO();
        // Load the request data into it
        agencyList = await agencyBO.getList(query);
    }
    catch(err){
        log.error("Agencies Validator getList error " + err + __location);
    }
    if (agencyList && agencyList.length > 0 ){
        return true;
    }
    else {
        return false;
    }
};