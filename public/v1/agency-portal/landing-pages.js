'use strict';
const auth = require('./helpers/auth.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');

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
	let where = ``;
	if(req.authentication.agencyNetwork && req.query.agency){
		// Get all agencies belonging to this agency network
		const agencies = await auth.getAgents(req).catch(function(e){error = e;})
		if(error){
			return next(error);
		} 
		// validate the agency id provided is valid
		if (!await validator.agent(req.query.agency)) {
			log.warn(`Agency validation error: ${__location}`)
			return next(serverHelper.notFoundError('Agency is invalid'));
		}
		// Make sure the current agency network has the agency as part of its network
		if (!agencies.includes(parseInt(req.query.agency, 10))) {
			log.warn(`Agency network tried to access information about an agency that is not part of its network. ${__location}`);
			return next(serverHelper.notFoundError('Agency is invalid'));
		}
		where = `AND \`alp\`.\`agency\` = ${parseInt(req.query.agency, 10)}`;
	}
	else if (req.authentication.agencyNetwork){
		where = `AND \`alp\`.\`agency_network\`= ${parseInt(req.authentication.agencyNetwork, 10)}`;
	}
	else {
		// Get the agents that we are permitted to view
		const agents = await auth.getAgents(req).catch(function(e){
			error = e;
		});
		if (error){
			return next(error);
		}

		where = `AND \`alp\`.\`agency\` = ${parseInt(agents[0], 10)}`;
	}
	// Build a query that will return all of the landing pages
	const landingPageSQL = `
			SELECT
			\`alp\`.\`id\`,
			\`alp\`.\`hits\`,
			\`alp\`.\`name\`,
			\`alp\`.\`slug\`,
			\`alp\`.\`primary\`
			FROM \`#__agency_landing_pages\` as \`alp\`
			WHERE \`state\` > 0 ${where};
		`;

	// Run the query
	const landingPages = await db.query(landingPageSQL).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Send the user's data back
	res.send(200, landingPages);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Landing Pages', `${basePath}/landing-pages`, getLandingPages, 'pages', 'view');
};