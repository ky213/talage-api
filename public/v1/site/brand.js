/**
 * Returns an auth token for the Agency Portal
 */

'use strict';

const serverHelper = require('../../../server.js');

/**
 * Responds to get requests for an authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function PostBrand(req, res, next) {
	switch (req.body.hostName) {
		case "tahoe.talageins.com":
		case "www.talageins.com":
		case "talageins.com":
			res.send(200, {
				brand: "wheelhouse",
				env: "production",
				siteURL: "https://www.talageins.com",
				portalURL: "https://agents.talageins.com",
				apiURL: "https://api.talageins.com:3000",
				s3Bucket: "website-images-staging"
			});
			break;
		case "alpine.talageins.com":
			res.send(200, {
				brand: "wheelhouse",
				env: "staging",
				siteURL: "https://alpine.talageins.com",
				portalURL: "https://alpinewh.talageins.com",
				apiURL: "https://alpine.talageins.com:3000",
				s3Bucket: "website-images-staging"
			});
			break;
		case "localhost":
			res.send(200, {
				brand: "wheelhouse",
				env: "development",
				siteURL: "http://localhost:8080",
				portalURL: "http://localhost:8081",
				apiURL: "http://localhost:3000",
				s3Bucket: "website-images-staging"
			});
			break;
		default:
			res.send(400, serverHelper.RequestError('Invalid domain'));
			break;
	}
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (server, basePath) => {
	server.AddPost('Get Site Branding', basePath + '/brand', PostBrand);
};