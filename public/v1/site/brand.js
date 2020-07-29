/**
 * Returns an auth token for the Agency Portal
 */

'use strict';

const serverHelper = global.requireRootPath('server.js');

/**
 * Responds to get requests for an authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
function PostBrand(req, res, next){
	// TODO Branding AND demo
	switch(req.body.hostName){
		case 'tahoe.talageins.com':
		case 'www.talageins.com':
		case 'talageins.com':
			res.send(200, {
				'apiURL': 'https://api.talageins.com:3000',
				'brand': 'wheelhouse',
				'env': 'production',
				'portalURL': 'https://agents.talageins.com',
				's3Bucket': 'website-images-staging',
				'siteURL': 'https://www.talageins.com'
			});
			break;
		case 'alpine.talageins.com':
			res.send(200, {
				'apiURL': 'https://alpine.talageins.com:3000',
				'brand': 'wheelhouse',
				'env': 'staging',
				'portalURL': 'https://alpinewh.talageins.com',
				's3Bucket': 'website-images-staging',
				'siteURL': 'https://alpine.talageins.com'
			});
			break;
		case 'localhost':
			res.send(200, {
				'apiURL': 'http://localhost:3000',
				'brand': 'wheelhouse',
				'env': 'development',
				'portalURL': 'http://localhost:8081',
				's3Bucket': 'website-images-staging',
				'siteURL': 'http://localhost:8080'
			});
			break;
		default:
			res.send(400, serverHelper.requestError('Invalid domain'));
			break;
	}
	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Get Site Branding', `${basePath}/brand`, PostBrand);
};