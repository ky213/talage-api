'use strict';

const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');

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

	// Define a query to get a list of agencies
	const agenciesSQL = `
			SELECT
				${db.quoteName('ag.id')},
				${db.quoteName('ag.name')},
				IF(${db.quoteName('ag.state')} >= 1, 'Active', 'Inactive') AS ${db.quoteName('state')},
				COUNT(DISTINCT ${db.quoteName('app.id')}) AS ${db.quoteName('applications')}
			FROM ${db.quoteName('#__agencies', 'ag')}
			LEFT JOIN ${db.quoteName('#__applications', 'app')} ON ${db.quoteName('app.agency')} = ${db.quoteName('ag.id')}
			WHERE
				${db.quoteName('ag.state')} >= 0 AND
				${db.quoteName('ag.id')} IN(${agents.join(',')})
			GROUP BY ${db.quoteName('ag.id')};
		`;

	// Get the agencies from the database
	const retAgencies = await db.query(agenciesSQL).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Return the response
	res.send(200, retAgencies);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get agencies', `${basePath}/agencies`, getAgencies, 'agencies', 'view');
};