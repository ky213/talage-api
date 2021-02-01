'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = require('../../../server.js');
const AgencyLandingPageBO = global.requireShared('./models/AgencyLandingPage-BO.js');

/**
 * Retrieves the landing-pages for the logged in user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getLandingPages(req, res, next){
    let error = false;
    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });

    if (error){
        log.warn(`Error when retrieving agents: ${error} ${__location}`)
        return next(error);
    }
    // Get the first value in agents
    let agent = agents[0];

    // If this is an agency network, use the the agency id from the query
    if (req.authentication.isAgencyNetworkUser) {
        agent = req.query.agency;
    }

    // Make sure this user has access to the requested agent
    if (!agents.includes(parseInt(agent, 10))) {
        log.info('Forbidden: User is not authorized to access the requested agent');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested agent'));
    }

    // Build a query that will return only the needed information for landing pages table for all of the landing pages
    // const landingPageSQL = `
    // 		SELECT
    // 			id,
    // 			hits,
    // 			name,
    // 			slug,
    // 			\`primary\`
    // 		FROM clw_talage_agency_landing_pages
    // 		WHERE agency = ${} AND state > 0;
    // 	`;
    // // Run the query
    // const landingPages = await db.query(landingPageSQL).catch(function(err){
    //     log.error(err.message);
    //     return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    // });
    let landingPages = [];
    try{
        const agencyId = parseInt(agent, 10);
        const agencyLandingPageBO = new AgencyLandingPageBO();
        const nameQuery = {agencyId: agencyId};
        landingPages = await agencyLandingPageBO.getList(nameQuery);
        // eslint-disable-next-line prefer-const
        for(let landingPage of landingPages){
            landingPage.id = landingPage.systemId;
        }
    }
    catch(err){
        log.error('agency_landing_pages error ' + err + __location)
    }

    // Send the user's data back
    res.send(200, landingPages);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Landing Pages', `${basePath}/landing-pages`, getLandingPages, 'pages', 'view');
};