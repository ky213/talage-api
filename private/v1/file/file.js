/**
 * Handles tasks for working with a single file
 */

'use strict';

const serverHelper = require('../../../server.js');

/* -----==== Version 1 Functions ====-----*/

/**
 * Responds to DELETE requests to remove a single file from cloud storage
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
function DeleteFile(req, res, next){

	// Sanitize the file path
	let path = '';
	if(req.query.path){
		path = req.query.path.replace(/[^a-zA-Z0-9-_/.]/g, '');
	}

	// Make sure a file path was provided
	if(!path){
		const errorMsg = 'You must specify a file path';
		log.warn(errorMsg);
		return next(serverHelper.requestError(errorMsg));
	}

	// Call out to S3
	global.s3.deleteObject({
		'Bucket': global.settings.S3_BUCKET,
		'Key': path
	}, function(err){
		if(err){
			log.warn(err.message);
			res.send(serverHelper.internalError(err.message));
			return;
		}

		log.info('File Deleted, if it Existed');

		// Send the data back to the user
		res.send(200, {'code': 'Success'});
	});
	// FIXME: need to await completion and return next()
}

/**
 * Responds to GET requests to return a single file
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
function GetFile(req, res, next){

	// Sanitize the file path
	let path = '';
	if(req.query.path){
		path = req.query.path.replace(/[^a-zA-Z0-9-_/.]/g, '');
	}

	// Make sure a file path was provided
	if(!path){
		const errorMsg = 'You must specify a file path';
		log.warn(errorMsg);
		return next(serverHelper.requestError(errorMsg));
	}

	// Call out to S3
	global.s3.getObject({
		'Bucket': global.settings.S3_BUCKET,
		'Key': path
	}, function(err, data){
		if(err){
			log.warn(err.message);
			res.send(serverHelper.internalError(err.message));
			return;
		}

		// Convert the Body to Base64
		data.Body = data.Body.toString('base64');

		// Remove items we don't care about
		delete data.AcceptRanges;
		delete data.LastModified;
		delete data.ETag;
		delete data.Metadata;
		delete data.TagCount;

		log.info('Returning file');

		// Send the data back to the user
		res.send(200, data);
	});
	// FIXME: need to await completion and return next()
}

/**
 * Responds to PUT requests to add a single file to our cloud storage
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
function PutFile(req, res, next){

	// Sanitize the file path
	let path = '';
	if(req.body && Object.prototype.hasOwnProperty.call(req.body, 'path')){
		path = req.body.path.replace(/[^a-zA-Z0-9-_/.]/g, '');
	}

	// Make sure a file path was provided
	if(!path){
		const errorMsg = 'You must specify a file path';
		log.warn(errorMsg);
		return next(serverHelper.requestError(errorMsg));
	}

	// Make sure file data was provided
	if(!Object.prototype.hasOwnProperty.call(req.body, 'data')){
		const errorMsg = 'You must provide file data';
		log.warn(errorMsg);
		return next(serverHelper.requestError(errorMsg));
	}

	// Conver to base64
	const fileBuffer = Buffer.from(req.body.data, 'base64');

	// Make sure the data is valid
	if(fileBuffer.toString('base64') !== req.body.data){
		const errorMsg = 'The data you supplied is not valid. It must be base64 encoded';
		log.warn(errorMsg);
		return next(serverHelper.requestError(errorMsg));
	}

	// Call out to S3
	global.s3.putObject({
		'Body': fileBuffer,
		'Bucket': global.settings.S3_BUCKET,
		'Key': path
	}, function(err){
		if(err){
			log.warn(err.message);
			res.send(serverHelper.internalError(err.message));
			return;
		}

		log.info('File saved');

		// Send the data back to the user
		res.send(200, {'code': 'Success'});
	});
	// FIXME: need to await completion and return next()
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addGet('File', `${basePath}/file`, GetFile);
	server.addGet('File (depr)', `${basePath}/`, GetFile);
	server.addPut('File', `${basePath}/file`, PutFile);
	server.addPut('File (depr)', `${basePath}/`, PutFile);
	server.addDelete('File', `${basePath}/file`, DeleteFile);
	server.addDelete('File (depr)', `${basePath}/`, DeleteFile);
};