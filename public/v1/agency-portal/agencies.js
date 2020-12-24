'use strict';

const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getAgencies(req, res, next){
    let error = false;

    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e){
        error = e;
    });
    if (error){
        return next(error);
    }

    // Make sure we got agents
    if (!agents.length){
        log.info('Bad Request: No agencies permitted');
        return next(serverHelper.requestError('Bad Request: No agencies permitted'));
    }

    let retAgencies = null;
    try{
        error = null;
        const query = {systemId: agents}
        const agencyBO = new AgencyBO();
        // Load the request data into it
        retAgencies = await agencyBO.getList(query);
    }
    catch(err){
        log.error("getAgencies load error " + err + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }


    let returnAgencyList = null;
    if(retAgencies){
        //Get app count.
        returnAgencyList = [];
        const applicationBO = new ApplicationBO();
        for(let i = 0; i < retAgencies.length; i++){
            try{
                // eslint-disable-next-line prefer-const
                let agencyInfo = {};
                agencyInfo.id = retAgencies[i].systemId;
                agencyInfo.name = retAgencies[i].name;
                agencyInfo.state = retAgencies[i].active ? "Active" : "Inactive";
                if(retAgencies[i].primaryAgency === null || typeof retAgencies[i].primaryAgency === 'undefined'){
                    agencyInfo.primaryAgency = false;
                }else {
                    agencyInfo.primaryAgency = retAgencies[i].primaryAgency;
                }
                const query = {
                    "agencyId": retAgencies[i].systemId,
                    count: 1
                };
                const appCount = await applicationBO.getList(query);
                agencyInfo.applications = appCount.count;
                returnAgencyList.push(agencyInfo);


            }
            catch(err){
                log.error(`Error getting Application count for Agency ${retAgencies[i].id}`)
            }
        }
    }

    // Return the response
    res.send(200, returnAgencyList);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get agencies', `${basePath}/agencies`, getAgencies, 'agencies', 'view');
};