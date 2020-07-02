'use strict';

const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');

/**
 * Define some helper functions -- better documentation coming soon (Josh)
 * @param {Array} result - The result
 * @return {*} The row
 */
function singleRowResult(result) {
	// Single row result -- extract the value
	const row = result[0];

	// Get the names of all returned columns
	const columns = Object.keys(row);

	// If only one column was returned return the value of that column. Otherwise, return the entire row
	if (columns.length === 1) {
		return row[columns[0]];
	}
	return row;
}

/**
 * Define some helper functions -- better documentation coming soon (Josh)
 * @param {Object} results - The results
 * @return {*} The name and count
 */
function multiRowResult(results) {
	// Multirow result - Currently this is just converting results into arrays for Google charts and only works because all the multirow queries are selecting `name` and `count`
	return Object.keys(results).map((key) => {
		const name = results[key].name;
		const count = results[key].count ? results[key].count : 0;

		return [name, count];
	});
}

/**
 * Responds to get requests for the reports endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getReports(req, res, next) {
	let error = false;

	// Get the agents that we are permitted to view
	const agents = await auth.getAgents(req).catch(function(e) {
		error = e;
	});
	if (error) {
		return next(error);
	}

	// Get the filter parameters
	let startDate = req.query.startDate;
	let endDate = req.query.endDate;
	let utcOffset = req.query.utcOffset;
	if (!utcOffset) {
		utcOffset = '+00:00';
	}

	// When the static query parameter is set only the queries keyed under 'static' will be executed
	let initialRequest = false;
	if (req.query.initial === 'true') {
		initialRequest = true;
	}

	// If static data isn't being requested both dates are required
	if (!initialRequest) {
		// Process the dates if they were included in the request or return an error if they werent
		if (startDate && endDate) {
			startDate = db.escape(`${startDate.substring(0, 10)} ${startDate.substring(11, 19)}`);
			endDate = db.escape(`${endDate.substring(0, 10)} ${endDate.substring(11, 19)}`);
		}
 else {
			log.info('Bad Request: Query parameters missing');
			return next(serverHelper.requestError('Query parameters missing'));
		}
	}

	// Localize data variables that the user is permitted to access
	const agencyNetwork = parseInt(req.authentication.agencyNetwork, 10);

	// Begin by only allowing applications that are not deleted from agencies that are also not deleted
	let where = `${db.quoteName('a.state')} > 0 AND ${db.quoteName('ag.state')} > 0`;

	// If this is AF Group, filter out agency 42
	if(agencyNetwork === 2){
		where += ` AND ${db.quoteName('a.agency')} != 42`;
	}

	// This is a very special case. If this is the agent 'Solepro' (ID 12) asking for applications, query differently
	if(!agencyNetwork && agents[0] === 12){
		where += ` AND ${db.quoteName('a.solepro')} = 1`;
	}else{
		where += ` AND ${db.quoteName('a.agency')} IN(${agents.join(',')})`;
	}

	// List of accepted parameters to query from the database
	const queries = {
		funnel: `
				SELECT
					COUNT(\`a\`.\`id\`)  AS \`started\`,
					SUM(IF(\`a\`.\`last_step\` >= 8, 1, 0)) AS \`completed\`,
					SUM((SELECT 1 FROM \`clw_talage_quotes\` AS \`q\` WHERE \`q\`.\`application\` = \`a\`.\`id\` AND (\`q\`.\`bound\` = 1 OR \`q\`.\`status\` = 'bind_requested' OR \`q\`.\`api_result\` = 'quoted' OR \`q\`.\`api_result\` = 'referred_with_price') LIMIT 1)) AS \`quoted\`,
					SUM((SELECT 1 FROM \`clw_talage_quotes\` AS \`q\` WHERE \`q\`.\`application\` = \`a\`.\`id\` AND (\`q\`.\`bound\` = 1 OR \`q\`.\`status\` = 'bind_requested') LIMIT 1)) AS \`bound\`
				FROM \`#__applications\` AS \`a\`
				INNER JOIN \`#__agencies\` AS \`ag\` ON \`a\`.\`agency\` = \`ag\`.\`id\`
				WHERE
					${where} AND
					${db.quoteName('a.created')} BETWEEN ${startDate} AND ${endDate}
				LIMIT 1;`,

		geography: `
				SELECT
					${db.quoteName('t.name')},
					COUNT(${db.quoteName('t.name')}) AS ${db.quoteName('count')}
				FROM ${db.quoteName('#__zip_codes', 'z')}
				LEFT JOIN ${db.quoteName('#__territories', 't')} ON ${db.quoteName('z.territory')} = ${db.quoteName('t.abbr')}
				LEFT JOIN ${db.quoteName('#__applications', 'a')} ON ${db.quoteName('a.zip')} = ${db.quoteName('z.zip')}
				INNER JOIN \`#__agencies\` AS \`ag\` ON \`a\`.\`agency\` = \`ag\`.\`id\`
				WHERE
					${where} AND
					${db.quoteName('a.created')} BETWEEN ${startDate} AND ${endDate}
				GROUP BY ${db.quoteName('z.territory')};
			`,
		// Get total number of applications
		hasApplications: `
				SELECT IF(COUNT(${db.quoteName('a.id')}), 1, 0) AS ${db.quoteName('hasApplications')}
				FROM ${db.quoteName('#__applications', 'a')}
				INNER JOIN \`#__agencies\` AS \`ag\` ON \`a\`.\`agency\` = \`ag\`.\`id\`
				WHERE ${where}
				LIMIT 1;
			`,
		industries: `
				SELECT
					${db.quoteName('icc.name')},
					COUNT(${db.quoteName('icc.name')}) AS ${db.quoteName('count')}
				FROM ${db.quoteName('#__industry_code_categories', 'icc')}
				LEFT JOIN ${db.quoteName('#__industry_codes', 'ic')} ON ${db.quoteName('ic.category')} = ${db.quoteName('icc.id')}
				LEFT JOIN ${db.quoteName('#__applications', 'a')} ON ${db.quoteName('a.industry_code')} = ${db.quoteName('ic.id')}
				INNER JOIN \`#__agencies\` AS \`ag\` ON \`a\`.\`agency\` = \`ag\`.\`id\`
				WHERE
					${where} AND
					${db.quoteName('a.created')} BETWEEN ${startDate} AND ${endDate}
				GROUP BY ${db.quoteName('icc.name')} ORDER BY ${db.quoteName('count')} DESC;
			`,

		// Get the earliest application created date
		minDate: `
				SELECT ${db.quoteName('a.created')} AS ${db.quoteName('minDate')}
				FROM ${db.quoteName('#__applications', 'a')}
				INNER JOIN \`#__agencies\` AS \`ag\` ON \`a\`.\`agency\` = \`ag\`.\`id\`
				WHERE ${where}
				ORDER BY ${db.quoteName('a.created')} ASC
				LIMIT 1;
			`,
		monthlyTrends: `
			SELECT
				MONTHNAME(CONVERT_TZ(${db.quoteName('a.created')}, '+00:00', '${utcOffset}')) AS ${db.quoteName('name')},
				COUNT(CONVERT_TZ(${db.quoteName('a.created')}, '+00:00', '${utcOffset}')) AS ${db.quoteName('count')}
			FROM ${db.quoteName('#__applications', 'a')}
			INNER JOIN \`#__agencies\` AS \`ag\` ON \`a\`.\`agency\` = \`ag\`.\`id\`
			WHERE
				${db.quoteName('a.created')} BETWEEN ${startDate} AND ${endDate} AND
				${where}
			GROUP BY YEAR(CONVERT_TZ(${db.quoteName('a.created')}, '+00:00', '${utcOffset}')), MONTH(CONVERT_TZ(${db.quoteName('a.created')}, '+00:00', '${utcOffset}')), MONTHNAME(CONVERT_TZ(${db.quoteName('a.created')}, '+00:00', '${utcOffset}'))
			ORDER BY YEAR(CONVERT_TZ(${db.quoteName('a.created')}, '+00:00', '${utcOffset}')), MONTH(CONVERT_TZ(${db.quoteName('a.created')}, '+00:00', '${utcOffset}')), MONTHNAME(CONVERT_TZ(${db.quoteName('a.created')}, '+00:00', '${utcOffset}'));
			`,

		premium: `
				SELECT
					SUM(${db.quoteName('q.amount')}) AS ${db.quoteName('quoted')},
					SUM(IF(
						${db.quoteName('q.bound')} = 1 OR ${db.quoteName('q.status')} = 'bind_requested',
						${db.quoteName('q.amount')},
						0
					)) AS ${db.quoteName('bound')}
				FROM ${db.quoteName('#__quotes', 'q')}
				INNER JOIN ${db.quoteName('#__applications', 'a')} ON ${db.quoteName('a.id')} = ${db.quoteName('q.application')}
				INNER JOIN \`#__agencies\` AS \`ag\` ON \`a\`.\`agency\` = \`ag\`.\`id\`
				WHERE
					${where} AND
					${db.quoteName('a.created')} BETWEEN ${startDate} AND ${endDate} AND
					${db.quoteName('q.amount')} IS NOT NULL
				LIMIT 1;
			`
	};
	//log.debug(queries['monthlyTrends']);
	// Define a list of queries to be executed based on the request type
	const selectedQueries = initialRequest ? ['minDate', 'hasApplications'] : ['funnel',
'geography',
'industries',
'monthlyTrends',
'premium'];

	// Query the database and build a response for the client
	const response = {};
	await Promise.all(selectedQueries.map(async(queryName) => {
			// Query the database and wait for a result
			const result = await db.query(queries[queryName]).catch((err) => {
				log.error(err.message);
				return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
			});

			// Names of reports that should be handled by the singleRowResult helper method
			const singleRowQueries = ['funnel',
'hasApplications',
'minDate',
'premium'];

			// Process the result
			let processedResult = null;
			if (result && result.length > 0) {
				if (singleRowQueries.includes(queryName)) {
					// Extract single row result
					processedResult = singleRowResult(result, queryName);
				}
 else {
					// Parse multirow results - provide start and end dates as options
					processedResult = multiRowResult(result);
				}

				// Perform some special adaptations to the industries data to limit it to 8 results and group the excess
				if (queryName === 'industries') {
					// If there are more than 8 items, combine them
					if (processedResult && processedResult.length > 8) {
						// Loop over all records after the 8th and add them together
						let other = 0;
						for (let index = 8; index < processedResult.length; index++) {
							other += processedResult[index][1];
						}

						// Remove all but the first 8 records
						processedResult = processedResult.slice(0, 8);

						// Alphabetize what's left of the array
						processedResult.sort(function(a, b) {
							if (a[1] < b[1]) {
								return -1;
							}
							if (a[1] > b[1]) {
								return 1;
							}
							return 0;
						});

						// Append in an 'other' field
						processedResult.push(['Other', other]);
					}
 else {
						// Alphabetize the array
						processedResult.sort(function(a, b) {
							if (a[1] < b[1]) {
								return -1;
							}
							if (a[1] > b[1]) {
								return 1;
							}
							return 0;
						});
					}
				}
			}

			// Add it to the response
			response[queryName] = processedResult ? processedResult : null;
		}));

	// Send the response
	res.send(200, response);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get reports', `${basePath}/reports`, getReports, 'dashboard', 'view');
};