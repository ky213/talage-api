'use strict';

const serverHelper = require('../../../server.js');

/**
 * Retrieves the information for a single user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetUserInfo(req, res, next){

	// Localize data variables that the user is permitted to access
	const agencyNetwork = parseInt(req.authentication.agencyNetwork, 10);

	// Prepare to get the information for this user, building a query based on their user type
	let userInfoSQL = '';
	if(agencyNetwork){
		userInfoSQL = `
				SELECT
					\`an\`.\`id\` AS agencyNetwork,
					\`an\`.\`logo\`,
					\`an\`.\`name\`,
					\`t\`.\`tz\`
				FROM \`#__agency_networks\` AS \`an\`
				LEFT JOIN \`#__agency_portal_users\` AS \`au\` ON \`au\`.\`agency_network\` =\`an\`.\`id\`
				LEFT JOIN \`#__timezones\` AS \`t\` ON \`au\`.\`timezone\` = \`t\`.\`id\`
				WHERE \`au\`.\`id\` = ${parseInt(req.authentication.userID, 10)}
				LIMIT 1;
			`;
	}else{
		userInfoSQL = `
				SELECT
					\`a\`.\`agency_network\` AS agencyNetwork,
					\`a\`.\`id\` AS \`agency\`,
					\`a\`.\`logo\`,
					\`a\`.\`name\`,
					\`a\`.\`slug\`,
					\`a\`.\`wholesale\`,
					\`an\`.\`help_text\` AS helpText,
					\`t\`.\`tz\`
				FROM \`#__agencies\` AS \`a\`
				LEFT JOIN \`#__agency_networks\` AS \`an\` ON \`a\`.\`agency_network\` = \`an\`.\`id\`
				LEFT JOIN \`#__agency_portal_users\` AS \`au\` ON \`au\`.\`agency\` =\`a\`.\`id\`
				LEFT JOIN \`#__timezones\` AS \`t\` ON \`au\`.\`timezone\` = \`t\`.\`id\`
				WHERE \`au\`.\`id\` = ${parseInt(req.authentication.userID, 10)}
				LIMIT 1;
			`;
	}

	// Going to the database to get the user's info
	const userInfo = await db.query(userInfoSQL).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Send the user's data back
	res.send(200, userInfo[0]);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get user information', `${basePath}/user-info`, GetUserInfo);
};