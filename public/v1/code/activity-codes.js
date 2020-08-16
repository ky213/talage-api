/**
 * Gets all activity codes
 */

'use strict';

const util = require('util');
const wrap = global.requireShared('helpers/wrap.js');

/**
 * Responds to post requests for all activity codes related to a given territory
 *
 * @param {object} req - Expects {territory: 'NV', industry_code: 2880}
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an array of objects containing activity codes [{"id": 2866}]
 */
const GetActivityCodes = wrap(async (req, res, next) => {
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.info('Bad Request: You must supply an industry code and territory');
		res.send(400, {
			message: 'You must supply an industry code and territory',
			status: 'error'
		});
		return next();
	}

	log.verbose(util.inspect(req.query));

	// Validate the parameters
	if (!req.query.industry_code) {
		log.info('Bad Request: You must supply an industry code');
		res.send(400, {
			message: 'You must supply an industry code',
			status: 'error'
		});
		return next();
	}
	if (!req.query.territory) {
		log.info('Bad Request: You must supply a territory');
		res.send(400, {
			message: 'You must supply a territory',
			status: 'error'
		});
		return next();
	}

	const territory = req.query.territory;
	const industry_code = parseInt(req.query.industry_code, 10);

	// Get activity codes by territory, filtered by industry code
	const sql_all_activity_codes = `
		SELECT nc.id, nc.description,
		CASE
			WHEN ica.frequency > 30
			THEN 1
			ELSE 0
		END AS suggested,
		GROUP_CONCAT(DISTINCT acan.name) AS 'alternate_names'
		FROM #__activity_codes AS nc
		JOIN #__activity_code_associations AS nca ON nc.id = nca.code
		JOIN #__insurer_ncci_codes AS inc ON nca.insurer_code = inc.id
		LEFT JOIN #__industry_code_associations AS ica ON nc.id = ica.ncci_code AND ica.industry_code = ${db.escape(industry_code)}
		LEFT JOIN #__activity_code_alt_names AS acan ON nc.id = acan.activity_code
		WHERE inc.territory = ${db.escape(territory)} AND nc.state = 1 AND inc.state = 1 GROUP BY nc.id ORDER BY nc.description;
		`;
	let error = false;
	const codes = await db.query(sql_all_activity_codes).catch(function (e) {
		log.error(e.message);
		res.send(500, {
			message: 'Internal Server Error',
			status: 'error'
		});
		error = true;
	});
	if (error) {
		return next(false);
	}

	if (codes && codes.length) {
		codes.forEach(function (code) {
			if (code.alternate_names) {
				code.alternate_names = code.alternate_names.split(',');
			} else {
				delete code.alternate_names;
			}
		});
		// log.info(`Returning ${codes.length} Activity Codes`);
		res.send(200, codes);
		return next();
	}
	log.info('No Codes Available');
	res.send(404, {
		message: 'No Codes Available',
		status: 'error'
	});
	return next(false);
});

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addGet('Get Activity Codes', `${basePath}/activity-codes`, GetActivityCodes);
	server.addGet('Get Activity Codes (depr)', `${basePath}/activity_codes`, GetActivityCodes);
};
