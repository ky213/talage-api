'use strict';
const serverHelper = require('../../../server.js');

/**
 * Responds to get requests for the getCityTerritory endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getCityTerritory(req, res, next){

	// Check that query parameters were received
	if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
		log.info('Bad Request: Query parameters missing');
		return next(serverHelper.requestError('Query parameters missing'));
	}

	// Check for required parameters
	if(!Object.prototype.hasOwnProperty.call(req.query, 'zip') || !req.query.zip){
		log.info('Bad Request: You must specify a zip code');
		return next(serverHelper.requestError('You must specify a zip code'));
	}

	// Get the user groups, excluding 'Administrator' for now as this permission is currently unused. It will be added soon.
	const sql = `
			SELECT
				\`city\`,
				\`territory\`
			FROM \`#__zip_codes\`
			WHERE \`zip\` = ${db.escape(req.query.zip)}
			LIMIT 1;
		`;
	const result = await db.query(sql).catch(function(){
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});
	if(!result){
		return next(serverHelper.requestError('The zip code you entered is invalid'));
	}

	// Return the response
	res.send(200, {
		'city': result[0].city,
		'territory': result[0].territory
	});
	return next();
}


exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get City State', `${basePath}/city-territory`, getCityTerritory);
};