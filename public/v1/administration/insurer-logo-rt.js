'use strict';
const fileSvc = global.requireShared('services/filesvc.js');
const serverHelper = require('../../../server.js');

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getInsurerLogos(req, res, next){
    await fileSvc.
        GetFileList('insurers').
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
    server.addGetAuthAdmin('GET Insurer Logo list', `${basePath}/insurer-logo`, getInsurerLogos, 'administration', 'all');
};