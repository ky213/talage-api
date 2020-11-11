'use strict';

const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');
const ApplicationBO = global.requireShared('./models/Application-BO.js');

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
    //

    // Define a query to get a list of agencies
    const agenciesSQL = `
			SELECT
				id,
				name,
				IF(state >= 1, 'Active', 'Inactive') AS 'state'
			FROM clw_talage_agencies
			WHERE
				state >= 0 AND
                id IN (${agents.join(',')})
            Order by name
		`;

    // Get the agencies from the database
    const retAgencies = await db.query(agenciesSQL).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });
    if(retAgencies){
        //Get app count.
        const applicationBO = new ApplicationBO();
        for(let i = 0; i < retAgencies.length; i++){
            try{
                const query = {
                    "agencyId": retAgencies[i].id,
                    count: 1
                };
                const appCount = await applicationBO.getList(query);
                retAgencies[i].applications = appCount.count;

            }
            catch(err){
                log.error(`Error getting Application count for Agency ${retAgencies[i].id}`)
            }
        }
    }

    // Return the response
    res.send(200, retAgencies);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get agencies', `${basePath}/agencies`, getAgencies, 'agencies', 'view');
};