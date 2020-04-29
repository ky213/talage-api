'use strict';
const moment = require('moment');
const sha1 = require('sha1');
const crypt = requireShared('./services/crypt.js');
const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');

const salt = '3h42kize0loh16ke3otxfebkq5rqp91y6uj9jmg751r9ees97l61ycodwbw74o3o';

/**
 * Validates the parameters for the applications call
 * @param {Array} parent - The list of parameters to validate
 * @param {Array} expectedParameters - The list of expected parameters
 * @return {boolean} true or false for if the parameters are valid
 */
function validateParameters(parent, expectedParameters) {
	if (!parent) {
		log.info('Bad Request: Missing all parameters');
		return false;
	}
	for (let i = 0; i < expectedParameters.length; i++) {
		const expectedParameter = expectedParameters[i];
		if (!Object.prototype.hasOwnProperty.call(parent, expectedParameter.name) || typeof parent[expectedParameter.name] !== expectedParameter.type) {
			log.info(`Bad Request: Missing ${expectedParameter.name} parameter (${expectedParameter.type})`);
			return false;
		}
		const parameterValue = parent[expectedParameter.name];
		if (Object.prototype.hasOwnProperty.call(expectedParameter, 'values') && !expectedParameter.values.includes(parameterValue)) {
			log.info(`Bad Request: Invalid value for ${expectedParameters[i].name} parameter (${parameterValue})`);
			return false;
		}
		if (expectedParameters[i].verifyDate && !moment(parameterValue).isValid()) {
			log.info(`Bad Request: Invalid date value for ${expectedParameters[i].name} parameter (${parameterValue})`);
			return false;
		}
	}
	return true;
}

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostApplications(req, res, next) {
	const expectedParameters = [
		{
			'name': 'page',
			'type': 'number'
		},
		{
			'name': 'limit',
			'type': 'number'
		},
		{
			'name': 'sort',
			'type': 'string',
			'values': ['business',
				'status',
				'agencyName',
				'industry',
				'location',
				'date']
		},
		{
			'name': 'sortDescending',
			'type': 'boolean'
		},
		{
			'name': 'searchText',
			'type': 'string'
		},
		{
			'name': 'searchApplicationStatus',
			'type': 'string',
			'values': ['',
				'bound',
				'request_to_bind_referred',
				'request_to_bind',
				'quoted_referred',
				'quoted',
				'referred',
				'declined',
				'error']
		},
		{
			'name': 'startDate',
			'type': 'string',
			'verifyDate': true
		},
		{
			'name': 'endDate',
			'type': 'string',
			'verifyDate': true
		}
	];

	// Validate the parameters
	if (!validateParameters(req.params, expectedParameters)) {
		return next(serverHelper.RequestError('Bad Request: missing expected parameter'));
	}
	// All parameters and their values have been validated at this point -SF

	// Create MySQL date strings
	const startDateSQL = moment(req.params.startDate).format('YYYY-MM-DD HH:mm:ss');
	const endDateSQL = moment(req.params.endDate).format('YYYY-MM-DD HH:mm:ss');

	// Get the agents that we are permitted to view
	let error = false;
	const agents = await auth.getAgents(req).catch(function (e) {
		error = e;
	});
	if (error) {
		return next(error);
	}

	// Make sure we got agents
	if (!agents.length) {
		log.info('Bad Request: No agencies permitted');
		return next(serverHelper.RequestError('Bad Request: No agencies permitted'));
	}

	// Localize data variables that the user is permitted to access
	const agencyNetwork = parseInt(req.authentication.agencyNetwork, 10);

	// This is a very special case. If this is the agent 'Solepro' (ID 12) asking for applications, query differently
	let where = '';
	if (!agencyNetwork && agents[0] === 12) {
		where += ` AND ${db.quoteName('a.solepro')} = 1`;
	} else {
		where += ` AND ${db.quoteName('a.agency')} IN(${agents.join(',')})`;
	}

	/*
	 * ================================================================================
	 * Get the total number of applications for this agency
	 */
	const applicationsTotalCountSQL = `
			SELECT COUNT(DISTINCT ${db.quoteName('a.id')}) as count
			FROM ${db.quoteName('#__applications', 'a')}
			WHERE ${db.quoteName('a.state')} >= 1 
			${where}
		`;
	let applicationsTotalCount = 0;
	try {
		applicationsTotalCount = (await db.query(applicationsTotalCountSQL))[0].count;
	} catch (err) {
		log.error(err.message);
		return next(serverHelper.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	/*
	 * ================================================================================
	 * Build the SQL search query
	 */
	let join = '';
	// Add a text search clause if requested
	if (req.params.searchText.length > 0) {
		req.params.searchText = req.params.searchText.toLowerCase();
		// The search_strings table has partials stored as sha1 hashes
		const searchTextHash = sha1(req.params.searchText + salt);
		// Left join the search_strings table, only looking at table=businesses and field=name rows
		join += `
				LEFT JOIN ${db.quoteName('#__search_strings', 'ss')} ON ${db.quoteName('ss.item_id')} = ${db.quoteName('a.business')}
					AND ${db.quoteName('ss.table')} = ${db.escape('businesses')}
					AND ${db.quoteName('ss.field')} = ${db.escape('name')}
			`;
		// Search the description (industry), city, territory (state), and business name columns
		where += `
				AND (
					${db.quoteName('zc.city')} LIKE ${db.escape(`%${req.params.searchText}%`)}
					OR ${db.quoteName('zc.territory')} LIKE ${db.escape(`%${req.params.searchText}%`)}
					OR ${db.quoteName('ss.hash')} = ${db.escape(searchTextHash)}
			`;
		if (agencyNetwork) {
			// If this user is an agency network role, then we search on the agency name
			where += ` OR ${db.quoteName('ag.name')} LIKE ${db.escape(`%${req.params.searchText}%`)}`;
		} else {
			// Otherwise, we search on industry description
			where += ` OR ${db.quoteName('ic.description')} LIKE ${db.escape(`%${req.params.searchText}%`)}`;
		}
		where += ')';
	}
	// Add a application status search clause if requested
	if (req.params.searchApplicationStatus.length > 0) {
		where += `
				AND ${db.quoteName('a.status')} = ${db.escape(req.params.searchApplicationStatus)}
			`;
	}

	/*
	 * ================================================================================
	 * Build the common SQL between the total count and paginated results
	 */
	const commonSQL = `
			FROM ${db.quoteName('#__applications', 'a')}
			LEFT JOIN ${db.quoteName('#__businesses', 'b')} ON ${db.quoteName('b.id')} = ${db.quoteName('a.business')}
			LEFT JOIN ${db.quoteName('#__industry_codes', 'ic')} ON ${db.quoteName('ic.id')} = ${db.quoteName('a.industry_code')}
			LEFT JOIN ${db.quoteName('#__zip_codes', 'zc')} ON ${db.quoteName('zc.zip')} = ${db.quoteName('a.zip')}
			LEFT JOIN ${db.quoteName('#__agencies', 'ag')} ON ${db.quoteName('a.agency')} = ${db.quoteName('ag.id')}
			${join}
			WHERE ${db.quoteName('a.state')} >= 1 
				AND ${db.quoteName('a.created')} BETWEEN CAST(${db.escape(startDateSQL)} AS DATE) AND CAST(${db.escape(endDateSQL)} AS DATE)
				${where}
		`;

	/*
	 * ================================================================================
	 * Get the number of total applications in the query. This can change between requests as applications are added so it needs to be calculated
	 * every time for proper pagination in the frontend.
	 */
	const applicationsSearchCountSQL = `
			SELECT COUNT(DISTINCT ${db.quoteName('a.id')}) as count
			${commonSQL}
		`;
	let applicationsSearchCount = 0;
	try {
		applicationsSearchCount = (await db.query(applicationsSearchCountSQL))[0].count;
	} catch (err) {
		log.error(err.message);
		return next(serverHelper.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	/*
	 * ================================================================================
	 * Get the requested applications
	 */
	const applicationsSQL = `
			SELECT
				DISTINCT ${db.quoteName('a.id')},
				${db.quoteName('a.status')},
				${db.quoteName('a.agency')},
				${db.quoteName('a.created', 'date')},
				${db.quoteName('a.solepro')},
				${db.quoteName('a.wholesale')},
				${db.quoteName('ag.name', 'agencyName')},
				${db.quoteName('b.name', 'business')},
				${db.quoteName('a.last_step', 'lastStep')},
				${db.quoteName('ic.description', 'industry')},
				CONCAT(LOWER(${db.quoteName('zc.city')}), ', ', ${db.quoteName('zc.territory')}) AS ${db.quoteName('location')}
			${commonSQL}
			ORDER BY ${db.quoteName(req.params.sort)} ${req.params.sortDescending ? 'DESC' : 'ASC'}
			LIMIT ${req.params.limit}
			OFFSET ${req.params.page * req.params.limit}
		`;
	let applications = null;
	try {
		applications = await db.query(applicationsSQL);
	} catch (err) {
		log.error(err.message);
		return next(serverHelper.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	// Exit with default values if no applications were received
	if (!applications.length) {
		res.send(200, {
			'applications': [],
			'applicationsSearchCount': 0,
			'applicationsTotalCount': applicationsTotalCount

		});
		return next();
	}

	// Decrypt the business names
	await crypt.batchProcessObjectArray(applications, 'decrypt', ['business']);

	// Process the applications
	const applicationIDs = [];
	applications.forEach((application) => {
		// Convert the case on the cities
		if (application.location) {
			application.location = application.location.replace(/(^([a-zA-Z\p{M}]))|([ -][a-zA-Z\p{M}])/g, (s) => s.toUpperCase());
		}
		// These should be handled in a trigger on the applications table -SF
		if (application.solepro || application.wholesale) {
			application.status = 'wholesale';
		} else if (application.status === null) {
			application.status = 'incomplete';
		}
		applicationIDs.push(application.id);
	});

	// Build the response
	const response = {
		'applications': applications,
		'applicationsSearchCount': applicationsSearchCount,
		'applicationsTotalCount': applicationsTotalCount

	};

	// Return the response
	res.send(200, response);
	return next();
}

exports.RegisterEndpoint = (server, basePath) => {
	server.AddPostAuth('Get applications', basePath + '/applications', PostApplications);
};