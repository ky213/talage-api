'use strict';

const serverHelper = require('../../../server.js');
const auth = require('./helpers/auth.js');

/**
 * Retrieves the landing-pages for the logged in user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getLandingPages(req, res, next) {
	// TO DO: Add support for Agency Networks (take in an angency as a parameter)
	const agency = req.authentication.agents[0];

	// Build a query that will return all of the landing pages
	const landingPageSQL = `
			SELECT
				\`id\`,
				\`hits\`,
				\`name\`,
				\`slug\`,
				\`primary\`
			FROM \`#__agency_landing_pages\`
			WHERE \`agency\` = ${parseInt(agency, 10)} AND \`state\` > 0;
		`;

	// Run the query
	const landingPages = await db.query(landingPageSQL).catch(function (err) {
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Send the user's data back
	res.send(200, landingPages);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Landing Pages', `${basePath}/landing-pages`, getLandingPages, 'pages', 'view');
};
