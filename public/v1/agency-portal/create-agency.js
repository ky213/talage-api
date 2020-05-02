'use strict';

const serverHelper = require('../../../server.js');

/**
 * Returns data necessary for creating an agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetCreateAgency(req, res, next) {
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'agencies', 'manage').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Make sure this is an agency network
	if (req.authentication.agencyNetwork === false) {
		log.info('Forbidden: User is not authorized to create agecies');
		return next(serverHelper.ForbiddenError('You are not authorized to access this resource'));
	}

	// Begin building the response
	const response = {
		'insurers': [],
		'territories': {}
	};

	// Get all insurers for this agency network
	if (req.authentication.insurers.length) {
		// Begin compiling a list of territories
		let territoryAbbreviations = [];

		// Build a query for getting all insurers with their territories
		const insurersSQL = `
				SELECT \`i\`.\`id\`, \`i\`.\`logo\`, \`i\`.\`name\`, GROUP_CONCAT(\`it\`.\`territory\`) AS 'territories'
				FROM \`#__insurers\` AS \`i\`
				LEFT JOIN \`#__insurer_territories\` AS \`it\` ON \`it\`.\`insurer\` = \`i\`.\`id\`
				WHERE \`i\`.\`id\` IN (${req.authentication.insurers.join(',')}) AND \`i\`.\`state\` > 0
				GROUP BY \`i\`.\`id\`
				ORDER BY \`i\`.\`name\` ASC;
			`;

		// Run the query
		const insurers = await db.query(insurersSQL).catch(function (err) {
			log.error(err.message);
			return next(serverHelper.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
		});

		// Convert the territories list into an array
		insurers.forEach(function (insurer) {
			insurer.territories = insurer.territories.split(',');
			territoryAbbreviations = territoryAbbreviations.concat(insurer.territories);
		});

		// Add the insurers to the response
		response.insurers = insurers;

		// Build a query to get the territory names from the database
		const territoriesSQL = `
				SELECT \`abbr\`, \`name\`
				FROM \`#__territories\`
				WHERE \`abbr\` IN (${territoryAbbreviations.map(function (abbr) {
			return db.escape(abbr);
		}).join(',')})
				ORDER BY \`name\`;
			`;

		// Run the query
		const territories = await db.query(territoriesSQL).catch(function (err) {
			log.error(err.message);
			return next(serverHelper.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
		});

		// Add each of these territories to the response
		territories.forEach(function (territory) {
			response.territories[territory.abbr] = territory.name;
		});
	}

	// Return the response
	res.send(200, response);
	return next();
}

exports.RegisterEndpoint = (server, basePath) => {
	server.AddGetAuth('Create Agency', basePath + '/create-agency', GetCreateAgency);
};