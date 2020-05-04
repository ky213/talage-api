'use strict';

const request = require('request');
const serverHelper = require('../../../server.js');

/**
 * Retrieves available banners
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetBanners(req, res, next) {
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'view').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}


	// Get a list of banners on the server
	await request({
		'method': 'GET',
		'url': `http://localhost:${settings.PRIVATE_API_PORT}/v1/file/list?prefix=public/agency-banners`
	}, function (err, response, body) {
		if (err) {
			log.error('Failed to get a list of banner files from the server.');
			log.verbose(err);
			res.send(serverHelper.InternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
		}
		// Prase teh body
		const result = JSON.parse(body);

		// Remove the first element as it is just the folder
		result.shift();

		// Parse and send the data back
		res.send(200, result);
	});

	return next();
}

exports.RegisterEndpoint = (server, basePath) => {
	server.AddGetAuth('Get Banners', basePath + '/banners', GetBanners);
};