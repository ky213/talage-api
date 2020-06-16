'use strict';

//const axios = require('axios');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const fileSvc = global.requireShared('./services/filesvc.js');

/**
 * Retrieves available banners
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getBanners(req, res, next) {
	await fileSvc.
		GetFileList('public/agency-banners').
		then(function(fileList) {
			if (fileList) {
				// Remove the first element as it is just the folder
				fileList.shift();
			}
 else {
				log.warn('banner empty list from S3 ' + __location);
			}
			// Parse and send the data back
			res.send(200, fileList);
		}).
		catch(function(err) {
			log.error('Failed to get a list of banner files from the S3.' + __location);
			log.verbose(err + __location);
			res.send(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
		});
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Banners', `${basePath}/banners`, getBanners, 'pages', 'view');
};