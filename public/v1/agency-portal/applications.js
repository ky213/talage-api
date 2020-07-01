'use strict';
const auth = require('./helpers/auth.js');
const crypt = global.requireShared('./services/crypt.js');
const csvStringify = require('csv-stringify');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const moment = require('moment');
const serverHelper = require('../../../server.js');
const sha1 = require('sha1');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

const salt = '3h42kize0loh16ke3otxfebkq5rqp91y6uj9jmg751r9ees97l61ycodwbw74o3o';

/**
 * Validates the parameters for the applications call
 * @param {Array} parent - The list of parameters to validate
 * @param {Array} expectedParameters - The list of expected parameters
 * @return {boolean} true or false for if the parameters are valid
 */
function validateParameters(parent, expectedParameters){
	if (!parent){
		log.info('Bad Request: Missing all parameters');
		return false;
	}
	for (let i = 0; i < expectedParameters.length; i++){
		const expectedParameter = expectedParameters[i];
		if (!Object.prototype.hasOwnProperty.call(parent, expectedParameter.name) || typeof parent[expectedParameter.name] !== expectedParameter.type){
			log.info(`Bad Request: Missing ${expectedParameter.name} parameter (${expectedParameter.type})`);
			return false;
		}
		const parameterValue = parent[expectedParameter.name];
		if (Object.prototype.hasOwnProperty.call(expectedParameter, 'values') && !expectedParameter.values.includes(parameterValue)){
			log.info(`Bad Request: Invalid value for ${expectedParameters[i].name} parameter (${parameterValue})`);
			return false;
		}
		if (expectedParameters[i].verifyDate && !moment(parameterValue).isValid()){
			log.info(`Bad Request: Invalid date value for ${expectedParameters[i].name} parameter (${parameterValue})`);
			return false;
		}
	}
	return true;
}

/**
 * Generate a CSV file of exported application data
 *
 * @param {array} agents - The list of agents this user is permitted to access
 * @param {mixed} agencyNetwork - The ID of the agency network if the user is an agency network user, false otherwise
 * @returns {Promise.<String, Error>} A promise that returns a string of CSV data on success, or an Error object if rejected
 */
function generateCSV(agents, agencyNetwork){
	return new Promise(async(fulfill, reject) => {
		let error = false;

		// Define the columns that need to be decrypted
		const needDecrypting = [
			'address',
			'address2',
			'dba',
			'ein',
			'fname',
			'lname',
			'name',
			'email',
			'phone',
			'primaryAddress',
			'primaryAddress2',
			'website'
		];

		// Define the different statuses and their user-friendly values
		const statusMap = {
			'acord_sent': 'ACORD form sent',
			'bound': 'Bound',
			'declined': 'Declined',
			'error': 'Error',
			'incomplete': 'Incomplete',
			'quoted': 'Quoted',
			'quoted_referred': 'Quoted (referred)',
			'referred': 'Referred',
			'request_to_bind': 'Request to bind',
			'request_to_bind_referred': 'Request to bind (referred)',
			'wholesale': 'Wholesale'
		};

		// Prepare to get all application data
		let sql = `
			SELECT
				\`a\`.\`id\`,
				\`a\`.\`status\`,
				\`ad\`.\`address\`,
				\`ad\`.\`address2\`,
				\`ad\`.\`zip\`,
				\`ag\`.\`name\` AS \`agency\`,
				\`b\`.\`dba\`,
				\`b\`.\`ein\`,
				\`b\`.\`entity_type\`,
				\`b\`.\`name\`,
				\`b\`.\`website\`,
				\`c\`.\`email\`,
				\`c\`.\`fname\`,
				\`c\`.\`lname\`,
				\`c\`.\`phone\`,
				\`pa\`.\`address\` AS \`primaryAddress\`,
				\`pa\`.\`address2\` AS \`primaryAddress2\`,
				\`pa\`.\`zip\` AS \`primaryZip\`,
				\`z\`.\`city\`,
				\`z\`.\`territory\`,
				\`z2\`.\`city\` AS \`primaryCity\`,
				\`z2\`.\`territory\` AS \`primaryTerritory\`
			FROM \`#__applications\` AS \`a\`
			LEFT JOIN \`#__agencies\` AS \`ag\` ON \`a\`.\`agency\` = \`ag\`.\`id\`
			LEFT JOIN \`#__addresses\` AS \`ad\` ON \`a\`.\`business\` = \`ad\`.\`business\` AND \`ad\`.\`billing\` = 1
			LEFT JOIN (SELECT * FROM \`#__addresses\` AS \`ad2\` GROUP BY \`ad2\`.\`business\`) AS \`pa\` ON \`a\`.\`business\` = \`pa\`.\`business\`
			LEFT JOIN \`#__businesses\` AS \`b\` ON \`a\`.\`business\` = \`b\`.\`id\`
			LEFT JOIN \`#__contacts\` AS \`c\` ON \`a\`.\`business\` = \`c\`.\`business\` AND \`c\`.\`primary\` = 1
			LEFT JOIN \`#__zip_codes\` AS \`z\` ON \`ad\`.\`zip\` = \`z\`.\`zip\`
			LEFT JOIN \`#__zip_codes\` AS \`z2\` ON \`pa\`.\`zip\` = \`z2\`.\`zip\`
			WHERE
				\`a\`.\`state\` > 0
		`;

		// If this is an AF Group Agency Network user, exclude Agency 42 from the output
		if(agencyNetwork === 2){
			sql += ' AND a.agency != 42';
		}

		// This is a very special case. If this is the agency 'Solepro' (ID 12) is asking for applications, query differently
		if(!agencyNetwork && agents[0] === 12){
			sql += ` AND \`a\`.\`solepro\` = 1`;
		}else{
			sql += ` AND \`a\`.\`agency\` IN(${agents.join()})`;
		}

		// Run the query
		const data = await db.query(sql).catch(function(err){
			log.error(err.message);
			error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
		});
		if(error){
			reject(error);
			return;
		}

		// If no data was returned, stop and alert the user
		if(data.length === 0){
			log.info('There are no applications to export');
			reject(serverHelper.requestError('There are no applications to export. Please try again when there are some applications in your account.'));
			return;
		}

		// Process the returned data
		for(const record of data){
			for(const property in record){
				if(Object.prototype.hasOwnProperty.call(record, property)){
					// Decrypt if needed
					if(needDecrypting.includes(property)){
						record[property] = await crypt.decrypt(record[property]);
					}
				}
			}

			/* --- Make the data pretty --- */

			// Address and Primary Address - Combine the two address lines (if there is an address and an address line 2)
			if(record.address && record.address2){
				record.address += `, ${record.address2}`;
			}
			if(record.primaryAddress && record.primaryAddress2){
				record.primaryAddress += `, ${record.primaryAddress2}`;
			}

			// Contact Name - Combine first and last
			record.contactName = `${record.fname} ${record.lname}`;

			// Business Name and DBA - Clean the name and DBA (grave marks in the name cause the CSV not to render)
			record.dba = record.dba ? record.dba.replace(/’/g, '\'') : null;
			record.name = record.name.replace(/’/g, '\'');

			// City and Primary City - Proper capitalization
			if(record.city){
				record.city = stringFunctions.ucwords(record.city.toLowerCase());
			}
			if(record.primaryCity){
				record.primaryCity = stringFunctions.ucwords(record.primaryCity.toLowerCase());
			}

			// Phone Number - Formatted
			record.phone = formatPhone(record.phone);

			// Status
			if(Object.prototype.hasOwnProperty.call(statusMap, record.status)){
				record.status = statusMap[record.status];
			}else{
				record.status = 'Unknown';
			}
		}

		// Define the columns (and column order) in the CSV file and their user friendly titles
		const columns = {
			'name': 'Business Name',
			'dba': 'DBA',
			'status': 'Application Status',
			'agency': 'Agency',
			'address': 'Mailing Address',
			'city': 'Mailing City',
			'territory': 'Mailing State',
			'zip': 'Mailing Zip Code',
			'primaryAddress': 'Physical Address',
			'primaryCity': 'Physical City',
			'primaryTerritory': 'Physical State',
			'primaryZip': 'Physical Zip Code',
			'contactName': 'Contact Name',
			'email': 'Contact Email',
			'phone': 'Contact Phone',
			'entity_type': 'Entity Type',
			'ein': 'EIN',
			'website': 'Website',
			'id': 'ID'
		};

		// Establish the headers for the CSV file
		const options = {
			'columns': columns,
			'header': true
		};

		// Generate the CSV data
		csvStringify(data, options, function(err, output){
			// Check if an error was encountered while creating the CSV data
			if(err){
				log.error(`Application Export to CSV error: ${err} ${__location}`);
				reject(serverHelper.internalError('Unable to generate CSV file'));
				return;
			}

			// Send the CSV data
			fulfill(output);
		});
	});
}

/**
 * Retrieves quotes for an application and populates application.quotes[]
 * @param {Object} application - The application
 * @return {void}
 */
async function getQuotes(application){
	application.quotes = [];

	if (application.location){
		// Convert the case on the cities
		application.location = application.location.replace(/(^([a-zA-Z\p{M}]))|([ -][a-zA-Z\p{M}])/g, (s) => s.toUpperCase());
	}
	// Retrieve the quotes for this application and populate application.quotes[]
	const quotesSQL = `
		SELECT
			${db.quoteName('status')},
			${db.quoteName('api_result')},
			${db.quoteName('bound')}
		FROM ${db.quoteName('#__quotes', 'a')}
		WHERE ${db.quoteName('application')} = ${db.escape(application.id)}
	`;
	try {
		const quotes = await db.query(quotesSQL);
		quotes.forEach((quote) => {
			application.quotes.push(quote);
		});
	}
 catch (err){
		log.info(`Error retrieving quotes for application ${application.id}`);
	}
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
async function getApplications(req, res, next){
	let error = false;

	// Get the agents that we are permitted to view
	const agents = await auth.getAgents(req).catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Localize data variables that the user is permitted to access
	const agencyNetwork = parseInt(req.authentication.agencyNetwork, 10);

	// Check if we are exporting a CSV instead of the JSON list
	if(req.params && Object.prototype.hasOwnProperty.call(req.params, 'format') && req.params.format === 'csv'){
		const csvData = await generateCSV(agents,agencyNetwork).catch(function(e){
			error = e;
		});
		if(error){
			return next(error);
		}

		// Set the headers so the browser knows we are sending a CSV file
		res.writeHead(200, {
			'Content-Disposition': 'attachment; filename=applications.csv',
			'Content-Length': csvData.length,
			'Content-Type': 'text-csv'
		});

		// Send the CSV data
		res.end(csvData);
		return next();
	}

	const expectedParameters = [
		{
			"name": 'page',
			"type": 'number'
		},
		{
			"name": 'limit',
			"type": 'number'
		},
		{
			"name": 'sort',
			"type": 'string',
			"values": ['business',
'status',
'agencyName',
'industry',
'location',
'date']
		},
		{
			"name": 'sortDescending',
			"type": 'boolean'
		},
		{
			"name": 'searchText',
			"type": 'string'
		},
		{
			"name": 'searchApplicationStatus',
			"type": 'string',
			"values": ['',
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
			"name": 'startDate',
			"type": 'string',
			"verifyDate": true
		},
		{
			"name": 'endDate',
			"type": 'string',
			"verifyDate": true
		}
	];

	// Validate the parameters
	if (!validateParameters(req.params, expectedParameters)){
		return next(serverHelper.requestError('Bad Request: missing expected parameter'));
	}
	// All parameters and their values have been validated at this point -SF

	// Create MySQL date strings
	const startDateSQL = moment(req.params.startDate).format('YYYY-MM-DD HH:mm:ss');
	const endDateSQL = moment(req.params.endDate).format('YYYY-MM-DD HH:mm:ss');

	// Make sure we got agents
	if (!agents.length){
		log.info('Bad Request: No agencies permitted');
		return next(serverHelper.requestError('Bad Request: No agencies permitted'));
	}

	// This is a very special case. If this is the agent 'Solepro' (ID 12) asking for applications, query differently
	let where = agencyNetwork === 2 ? ' AND a.agency != 42' : '';
	if (!agencyNetwork && agents[0] === 12){
		where += ` AND ${db.quoteName('a.solepro')} = 1`;
	}
 else {
		where += ` AND ${db.quoteName('a.agency')} IN(${agents.join(',')})`;
	}

	// ================================================================================
	// Get the total number of applications for this agency
	const applicationsTotalCountSQL = `
			SELECT COUNT(DISTINCT ${db.quoteName('a.id')}) as count
			FROM ${db.quoteName('#__applications', 'a')}
			WHERE ${db.quoteName('a.state')} >= 1
			${where}
		`;
	let applicationsTotalCount = 0;
	try {
		applicationsTotalCount = (await db.query(applicationsTotalCountSQL))[0].count;
	}
 catch (err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	}

	// ================================================================================
	// Build the SQL search query
	let join = '';
	// Add a text search clause if requested
	if (req.params.searchText.length > 0){
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
		if (agencyNetwork){
			// If this user is an agency network role, then we search on the agency name
			where += ` OR ${db.quoteName('ag.name')} LIKE ${db.escape(`%${req.params.searchText}%`)}`;
		}
 else {
			// Otherwise, we search on industry description
			where += ` OR ${db.quoteName('ic.description')} LIKE ${db.escape(`%${req.params.searchText}%`)}`;
		}
		where += ')';
	}
	// Add a application status search clause if requested
	if (req.params.searchApplicationStatus.length > 0){
		where += `
				AND ${db.quoteName('a.status')} = ${db.escape(req.params.searchApplicationStatus)}
			`;
	}

	// ================================================================================
	// Build the common SQL between the total count and paginated results

	const commonSQL = `
			FROM ${db.quoteName('#__applications', 'a')}
			LEFT JOIN ${db.quoteName('#__businesses', 'b')} ON ${db.quoteName('b.id')} = ${db.quoteName('a.business')}
			LEFT JOIN ${db.quoteName('#__industry_codes', 'ic')} ON ${db.quoteName('ic.id')} = ${db.quoteName('a.industry_code')}
			LEFT JOIN ${db.quoteName('#__zip_codes', 'zc')} ON ${db.quoteName('zc.zip')} = ${db.quoteName('a.zip')}
			LEFT JOIN ${db.quoteName('#__agencies', 'ag')} ON ${db.quoteName('a.agency')} = ${db.quoteName('ag.id')}
			${join}
			WHERE ${db.quoteName('a.state')} >= 1
				AND ${db.quoteName('a.created')} BETWEEN CAST(${db.escape(startDateSQL)} AS DATETIME) AND CAST(${db.escape(endDateSQL)} AS DATETIME)
				${where}
		`;

	// ================================================================================
	// Get the number of total applications in the query. This can change between requests as applications are added so it needs to be calculated
	// Every time for proper pagination in the frontend.
	const applicationsSearchCountSQL = `
			SELECT COUNT(DISTINCT ${db.quoteName('a.id')}) as count
			${commonSQL}
		`;
	let applicationsSearchCount = 0;
	try {
		applicationsSearchCount = (await db.query(applicationsSearchCountSQL))[0].count;
	}
 catch (err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	}

	// ================================================================================
	// Get the requested applications
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
	}
 catch (err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	}

	// Exit with default values if no applications were received
	if (!applications.length){
		res.send(200, {
			"applications": [],
			"applicationsSearchCount": 0,
			"applicationsTotalCount": applicationsTotalCount
		});
		return next();
	}

	// Decrypt the business names
	await crypt.batchProcessObjectArray(applications, 'decrypt', ['business']);

	// Get all quotes for each application
	const getQuotesPromises = [];
	applications.forEach((application) => {
		getQuotesPromises.push(getQuotes(application));
	});
	await Promise.all(getQuotesPromises);

	// Build the response
	const response = {
		"applications": applications,
		"applicationsSearchCount": applicationsSearchCount,
		"applicationsTotalCount": applicationsTotalCount
	};

	// Return the response
	res.send(200, response);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addPostAuth('Get applications', `${basePath}/applications`, getApplications, 'applications', 'view');
};