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
async function GetColorSchemes(req, res, next) {
	let error = false;

		// Make sure the authentication payload has everything we are expecting
		await auth.validateJWT(req, 'pages', 'view').catch(function(e){
			error = e;
		});
		if(error){
			return next(error);
		}

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
	const colorSchemes = await db.query(colorSchemesSQL).catch(function (err) {
		log.error(err.message);
		return next(serverHelper.InternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Send the data back
	res.send(200, colorSchemes);
	return next();
}

exports.RegisterEndpoint = (server, basePath) => {
	server.AddGetAuth('Get Color Schemes', basePath + '/color-schemes', GetColorSchemes);
};