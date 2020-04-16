/**
 * Hanldes tasks related to listing files
 */

'use strict';

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
function GetFileList(req, res) {
	// Check if a prefix was supplied
	let prefix = '';
	if (req.query.prefix) {
		prefix = req.query.prefix.replace(/[^a-zA-Z0-9-_/.]/g, '');
	}

	// Call out to S3
	s3.listObjectsV2({
		Bucket: process.env.S3_BUCKET,
		Prefix: prefix
	}, function (err, data) {
		if (err) {
			log.warn(err.message);
			res.send(ServerInternalError(err.message));
			return;
		}

		// Reduce down to just the part we care about
		data = data.Contents.map(function (item) {
			return `https://${process.env.S3_BUCKET}.s3-us-west-1.amazonaws.com/${item.Key}`;
		});

		log.info(`${data.length} files found`);

		// Send the data back to the user
		res.send(200, data);
	});
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddGet('List Files', basePath + '/list', GetFileList);
};