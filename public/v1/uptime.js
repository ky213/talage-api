/**
 * Checks that the API is running
 */

'use strict';

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to get requests for the uptime endpoint by writing an XML response
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetUptime(req, res, next) {
	res.setHeader('content-type', 'application/xml');
	const startTime = process.hrtime();

	// Check the database connection by selecting all active activity codes
	let error = false;
	await db.query('SELECT COUNT(*) FROM `#__api_users`').catch(function (e) {
		log.error(e.message);
		error = true;
	});

	// Calculate the elapsed time
	const elapsed = process.hrtime(startTime)[1] / 1000000;

	// Send the appropriate response
	if (error) {
		res.end(`<pingdom_http_custom_check> <status>DOWN</status> <response_time>${elapsed.toFixed(8)}</response_time> <version>${global.version}</version> </pingdom_http_custom_check>`);
		return next();
	}
	res.end(`<pingdom_http_custom_check> <status>OK</status> <response_time>${elapsed.toFixed(8)}</response_time> <version>${global.version}</version> </pingdom_http_custom_check>`);
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddGet('Uptime Check', basePath + '/uptime', GetUptime);
};