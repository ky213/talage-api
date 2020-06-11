/* eslint-disable no-invalid-this */
/* eslint-disable consistent-this */
/**
 * File helper. Provides an interface for our internal file service which stores and retrieves files from cloud storage.
 */

'use strict';
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

//So we can reference exports. functions.
var _this = this;

/**
 * Stores a file in cloud storage
 *
 * @param {string} path - The path at which this file will be stored
 * @param {string} data - The PDF data, base64 encoded
 * @return {boolean} - True if successful; false otherwise
 */
exports.store = async function(path, data){

	// If we are in the test environment, don't store anything and just return true
	if(global.settings.ENV === 'test'){
		return true;
	}

	// Make sure we have a path
	if(!path || !path.length){
		log.warn('File helper: You must supply a path when using store()');
		return false;
	}

	// Make sure we have data
	if(!data || !data.length){
		log.warn('File helper: You must supply file data when using store()');
		return false;
	}

	_this.PutFile(path, data).then(function(res){
		return res;
	}).catch(function(err){
		throw err;
	});
};

/**
 * Responds to PUT requests to add a single file to our cloud storage
 *
 * @param {String} s3Key - key for S3 file.
 * @param {String} fileContent - base64 string of contents of file.
 *
 * @returns {void}
 */
exports.PutFile = function(s3Key, fileContent){
	return new Promise(async function(resolve,reject){

		// Sanitize the file path
		let s3Path = '';
		if(s3Key){
			s3Path = s3Key.replace(/[^a-zA-Z0-9-_/.]/g, '');
		}

		// Make sure a file path was provided
		if(!s3Path){
			const errorMsg = 'You must specify a s3Key path';
			log.warn("File Service PUT: " + errorMsg + __location);
			reject(errorMsg);
		}

		// Make sure file data was provided
		if(!fileContent){
			const errorMsg = 'You must provide file data';
			log.warn("File Service PUT: " + errorMsg + __location);
			reject(errorMsg);
		}

		// Conver to base64
		const fileBuffer = Buffer.from(fileContent, 'base64');

		// Make sure the data is valid
		if(fileBuffer.toString('base64') !== fileContent){
			const errorMsg = 'The data you supplied is not valid. It must be base64 encoded';
			log.warn("File Service PUT: " + errorMsg + __location);
			reject(errorMsg);
		}

		// Call out to S3
		global.s3.putObject({
			'Body': fileBuffer,
			'Bucket': global.settings.S3_BUCKET,
			'Key': s3Path
		}, function(err){
			if(err){
				log.error("File Service PUT: " + err.message + __location);
				reject(err.message);
			}

			log.info('File saved at ' + s3Path + __location );

			// Send the data back to the user
			resolve({'code': 'Success'});
		});
	});
}

// exports.storeOld = async function(path, data){

// 	// If we are in the test environment, don't store anything and just return true
// 	if(global.settings.ENV === 'test'){
// 		return true;
// 	}

// 	// Make sure we have a path
// 	if(!path || !path.length){
// 		log.warn('File helper: You must supply a path when using store()');
// 		return false;
// 	}

// 	// Make sure we have data
// 	if(!data || !data.length){
// 		log.warn('File helper: You must supply file data when using store()');
// 		return false;
// 	}

// 	// Compose the options for the request to the file service
// 	const options = {
// 		'headers': {'content-type': 'application/json'},
// 		'json': {
// 			'data': data,
// 			'path': path
// 		},
// 		'method': 'PUT',
// 		'url': `http://localhost:${global.settings.PRIVATE_API_PORT}/v1/file/file`
// 	};

// 	// Send the request
// 	let rtn = true;
// 	await request(options, function(e, response, body){

// 		// If there was an error, return false
// 		if(e){
// 			rtn = false;
// 			log.error('Failed to connect to file service.');
// 			return;
// 		}

// 		// If the response was anything but a success, return false
// 		if(response.statusCode !== 200){
// 			// The response is JSON, parse out the error
// 			const message = `${response.statusCode} - ${body.message}`;
// 			log.warn(message);
// 			rtn = false;
// 		}
// 	});

// 	return rtn;
// };


/**
 * Retrieves a file from cloud storage
 *
 * @param {string} path - The path at which this file is stored
 * @return {boolean} - True if successful; false otherwise
 */
exports.get = function(path){
	return new Promise(async function(resolve,reject){
		// Make sure we have a path
		if(!path || !path.length){
			log.error('File helper: You must supply a path when using get()' + __location);
			reject(new Error("No path supplied"));
			return false;
		}
		// Call out to S3
		global.s3.getObject({
			'Bucket': global.settings.S3_BUCKET,
			'Key': path
		}, function(err, data){
			if(err){
				log.error("File Service GET: " + err.message + 'Bucket: ' + global.settings.S3_BUCKET + " path: " + path + __location);
				reject(err);
				return false;
			}

			// Convert the Body to Base64
			data.Body = data.Body.toString('base64');

			// Remove items we don't care about
			delete data.AcceptRanges;
			delete data.LastModified;
			delete data.ETag;
			delete data.Metadata;
			delete data.TagCount;

			log.info('Returning file' + __location);
			resolve(data);

		});
	});
};

/**
 * Return URL for files list S3
 *
 * @param {String} s3Prefix - s3 path prefix
 *
 * @returns {Object} array of file urls
 */
exports.GetFileList = async function(s3Prefix){
	return new Promise(async function(resolve,reject){
		// Check if a prefix was supplied
		let prefix = '';
		if(s3Prefix){
			prefix = s3Prefix.replace(/[^a-zA-Z0-9-_/.]/g, '');
		}
		// Call out to S3
		global.s3.listObjectsV2({
			'Bucket': global.settings.S3_BUCKET,
			'Prefix': prefix
		}, function(err, data){
			if(err){
				log.error("File Service LIST: " + err.message + __location);
				reject(err);
				//return false;
			}
			// Reduce down to just the part we care about
			try {
				data = data.Contents.map(function(item){
					return `https://${global.settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/${item.Key}`;
				});
			}
			catch(err2){
				log.error("GetFileListS3 data processing error: " + err2 + __location);
			}
			// Send the data back to caller
			resolve(data);
		});
	});
}