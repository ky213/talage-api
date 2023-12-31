/* eslint-disable multiline-comment-style */
/* eslint-disable no-invalid-this */
/* eslint-disable consistent-this */
/**
 * File helper. Provides an interface for our internal file service which stores and retrieves files from cloud storage.
 */

'use strict';
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('/helpers/tracker.js');

//So we can reference exports. functions.


/**
 * Responds to PUT requests to add a single file to our cloud storage
 *
 * @param {String} s3Key - key for S3 file.
 * @param {String} fileContent - base64 string of contents of file.
 * @param {String} contentType - string of contents of file.
 *
 * @returns {void}
 */
exports.PutFile = function(s3Key, fileContent, contentType = null) {
    return new Promise(async function(resolve, reject) {

        // Sanitize the file path
        let s3Path = '';
        let s3KeyClean = s3Key;
        if (s3Key) {
            s3KeyClean = s3KeyClean.replace(/[^a-zA-Z0-9-_/.]/g, '');
            s3KeyClean = s3KeyClean.replace(/\s/g, '');
            s3Path = s3KeyClean;
        }

        // Make sure a file path was provided
        if (!s3Path) {
            const errorMsg = 'You must specify a s3Key path';
            log.error("File Service PUT: " + errorMsg + __location);
            reject(errorMsg);
        }

        // Make sure file data was provided
        if (fileContent && fileContent.length > 0) {
            // Conver to base64
            const fileBuffer = Buffer.from(fileContent, 'base64');
            // Make sure the data is valid
            if (fileBuffer.toString('base64') !== fileContent) {
                const errorMsg = 'The data you supplied is not valid. It must be base64 encoded';
                log.error("File Service PUT: " + errorMsg + __location);
                reject(errorMsg);
            }
            // if content type provided then set that as well
            const params = {
                'Body': fileBuffer,
                'Bucket': global.settings.S3_BUCKET,
                'Key': s3Path
            };
            if (contentType){
                params.ContentType = contentType;
            }
            global.s3.putObject(params, function(err) {
            // Call out to S3
            // global.s3.putObject({
            //     'Body': fileBuffer,
            //     'Bucket': global.settings.S3_BUCKET,
            //     'Key': s3Path
            // }, function(err) {
                if (err) {
                    log.error(`File Service PUT:  ${global.settings.S3_BUCKET}/${s3Path} error:` + err.message + __location);
                    reject(err.message);
                }

                log.info('File saved at ' + s3Path + __location);

                // Send the data back to the user
                resolve({
                    'code': 'Success',
                    s3KeyUpdated: s3KeyClean
                });
            });

        }
        else {
            const errorMsg = 'You must provide file data';
            log.warn("File Service PUT: " + errorMsg + __location);
            reject(errorMsg);
        }

    });
}


/**
 * Retrieves a file from cloud storage
 *
 * @param {string} path - The path at which this file is stored
 * @return {boolean} - True if successful; false otherwise
 */
exports.get = function(path) {
    return new Promise(async function(resolve, reject) {
        // Make sure we have a path
        if (!path || !path.length) {
            log.error('File helper: You must supply a path when using get()' + __location);
            reject(new Error("No path supplied"));
            return false;
        }
        // Call out to S3
        global.s3.getObject({
            'Bucket': global.settings.S3_BUCKET,
            'Key': path
        }, function(err, data) {
            if (err) {
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
exports.GetFileList = async function(s3Prefix) {
    return new Promise(async function(resolve, reject) {
        // Check if a prefix was supplied
        let prefix = '';
        if (s3Prefix) {
            prefix = s3Prefix.replace(/[^a-zA-Z0-9-_/.]/g, '');
        }
        // Call out to S3
        global.s3.listObjectsV2({
            'Bucket': global.settings.S3_BUCKET,
            'Prefix': prefix
        }, function(err, data) {
            if (err) {
                log.error("File Service LIST: " + err.message + __location);
                reject(err);
                //return false;
            }
            // Reduce down to just the part we care about
            try {
                data = data.Contents.map(function(item) {
                    //return `https://${global.settings.S3_BUCKET}.s3-us-west-1.amazonaws.com/${item.Key}`;
                    return `${global.settings.IMAGE_URL}/${item.Key}`;
                });
            }
            catch (err2) {
                log.error("GetFileListS3 data processing error: " + err2 + __location);
            }
            // Send the data back to caller
            resolve(data);
        });
    });
}

/**
 * Deletes a file from cloud storage
 *
 * @param {string} path - The S3 key for file to be deleted
 * @return {boolean} - True if successful; false otherwise
 */
exports.deleteFile = function(path) {
    return new Promise(async function(resolve, reject) {
        // Make sure we have a path
        if (!path || !path.length) {
            log.error('File helper: You must supply a path when using get()' + __location);
            reject(new Error("No path supplied"));
            return false;
        }
        // Call out to S3
        global.s3.deleteObject({
            'Bucket': global.settings.S3_BUCKET,
            'Key': path
        }, function(err) {
            if (err) {
                log.error("File Service DELETE: " + err.message + 'Bucket: ' + global.settings.S3_BUCKET + " path: " + path + __location);
                reject(err);
                return false;
            }

            log.info('Deleted: ' + path + __location);
            const response = {'code': 'Success'}
            resolve(response);

        });
    });
};

/*************************************************
*
* SECURE BUCKET Methods
*
*
**************************************************/
/**
 * Responds to PUT requests to add a single file to our cloud storage
 *
 * @param {String} s3Key - key for S3 file.
 * @param {String} fileContent - base64 string of contents of file.
 *
 * @returns {void}
 */
exports.PutFileSecure = function(s3Key, fileContent) {
    return new Promise(async function(resolve, reject) {

        // Sanitize the file path
        let s3Path = '';
        let s3KeyClean = s3Key;
        if (s3Key) {
            s3KeyClean = s3KeyClean.replace(/[^a-zA-Z0-9-_/.]/g, '');
            s3KeyClean = s3KeyClean.replace(/\s/g, '');
            s3Path = s3KeyClean;
        }

        // Make sure a file path was provided
        if (!s3Path) {
            const errorMsg = 'You must specify a s3Key path';
            log.warn("File Service PUT SECURE: " + errorMsg + __location);
            reject(errorMsg);
        }

        // Make sure file data was provided
        if (fileContent && fileContent.length > 0) {
            // Conver to base64
            const fileBuffer = Buffer.from(fileContent, 'base64');
            // Make sure the data is valid
            if (fileBuffer.toString('base64') !== fileContent) {
                const errorMsg = 'The data you supplied is not valid. It must be base64 encoded';
                log.warn("File Service PUT SECURE: " + errorMsg + __location);
                reject(errorMsg);
            }

            // Call out to S3
            global.s3.putObject({
                'Body': fileBuffer,
                'Bucket': global.settings.S3_SECURE_BUCKET,
                'Key': s3Path
            }, function(err) {
                if (err) {
                    log.error("File Service PUT SECURE: " + err.message + __location);
                    reject(err.message);
                }

                log.info('File saved at ' + s3Path + __location);

                // Send the data back to the user
                resolve({
                    'code': 'Success',
                    s3KeyUpdated: s3KeyClean
                });
            });

        }
        else {
            const errorMsg = 'You must provide file data';
            log.warn("File Service PUT SECURE: " + errorMsg + __location);
            reject(errorMsg);
        }

    });
}


/**
 * Retrieves a file from cloud storage
 *
 * @param {string} path - The path at which this file is stored
 * @return {boolean} - True if successful; false otherwise
 */
exports.GetFileSecure = function(path) {
    return new Promise(async function(resolve, reject) {
        // Make sure we have a path
        if (!path || !path.length) {
            log.error('File helper: You must supply a path when using get()' + __location);
            reject(new Error("No path supplied"));
            return false;
        }
        // Call out to S3
        global.s3.getObject({
            'Bucket': global.settings.S3_SECURE_BUCKET,
            'Key': path
        }, function(err, data) {
            if (err) {
                log.error("File Service GET SECURE: " + err.message + 'Bucket: ' + global.settings.S3_SECURE_BUCKET + " path: " + path + __location);
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

            log.info('Returning SECURE file' + __location);
            resolve(data);

        });
    });
};