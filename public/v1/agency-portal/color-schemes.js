'use strict';

const serverHelper = require('../../../server.js');

/**
 * Retrieves available color schemes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getColorSchemes(req, res, next){
	// Build a query that will return all of the landing pages
	const colorSchemesSQL = `
			SELECT
				\`id\`,
				\`name\`,
				\`primary\`,
				\`secondary\`
			FROM \`#__color_schemes\`
			WHERE \`state\` > 0
			ORDER BY \`name\` ASC;
		`;

	// Run the query
	const colorSchemes = await db.query(colorSchemesSQL).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Send the data back
	res.send(200, colorSchemes);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Color Schemes', `${basePath}/color-schemes`, getColorSchemes, 'pages', 'view');
};