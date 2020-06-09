/**
 * Hanldes tasks related to listing files
 */

'use strict';

const serverHelper = require('../../../server.js');

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to GET requests to list files
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
function GetFileList(req, res){
	// Check if a prefix was supplied
	let prefix = '';
	if(req.query.prefix){
		prefix = req.query.prefix.replace(/[^a-zA-Z0-9-_/.]/g, '');
	}

	// Call out to S3
	global.s3.listObjectsV2({
		'Bucket': global.settings.S3_BUCKET,
		'Prefix': prefix
	}, function(err, data){
		if(err){
			log.error("File Service LIST: " + err.message + __location);
			res.send(serverHelper.internalError(err.message));
			return;
		}

		// Reduce down to just the part we care about
		data = data.Contents.map(function(item){
			return `https://${global.settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/${item.Key}`;
		});

		// Log.info(`${data.length} files found`);

		// Send the data back to the user
		res.send(200, data);
	});
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addGet('List Files', `${basePath}/list`, GetFileList);
};