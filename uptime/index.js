'use strict';

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

exports.RegisterEndpoints = (server) => {
	ServerAddGet('Uptime Check', '/', GetUptime);
};