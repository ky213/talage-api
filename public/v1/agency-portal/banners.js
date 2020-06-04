'use strict';

const axios = require('axios');
const serverHelper = require('../../../server.js');
const auth = require('./helpers/auth.js');

/**
 * Retrieves available banners
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetBanners(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'view').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Get the banner images from the file service
	await axios.get(`http://localhost:${global.settings.PRIVATE_API_PORT}/v1/file/list?prefix=public/agency-banners`)
	.then(function(response){
		// Remove the first element as it is just the folder
		response.data.shift();

		// Parse and send the data back
		res.send(200, response.data);
	})
	.catch(function(err){
		log.error('Failed to get a list of banner files from the server.');
		log.verbose(err);
		res.send(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Banners', `${basePath}/banners`, GetBanners);
};