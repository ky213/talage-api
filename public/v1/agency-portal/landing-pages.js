'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const AgencyLandingPageBO = global.requireShared('./models/AgencyLandingPage-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

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

    let agent = -1;
    if (req.authentication.isAgencyNetworkUser) {
        // This is an agency network user, they can only modify agencies in their network
        // Get the agencies that we are permitted to manage
        const agencyId = parseInt(req.query.agency, 10);
        const agencyBO = new AgencyBO();
        const agencydb = await agencyBO.getById(agencyId);
        if(agencydb?.agencyNetworkId !== req.authentication.agencyNetworkId){
            log.info('Forbidden: User is not authorized to manage th is agency');
            return next(serverHelper.forbiddenError('You are not authorized to manage this agency'));
        }
        agent = req.query.agency
    }
    else {
        const agents = await auth.getAgents(req).catch(function(e) {
            error = e;
        });

        if (error){
            log.warn(`Error when retrieving agents: ${error} ${__location}`)
            return next(error);
        }
        // Get the first value in agents
        agent = agents[0];

        //if (!agents.includes(parseInt(agent, 10))) {
        if(!agent){
            log.info(`Forbidden: User is not authorized to access the requested agent - ${req.query.agency}`);
            return next(serverHelper.forbiddenError('You are not authorized to access the requested agent'));
        }
    }
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