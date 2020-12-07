'use strict';
const fileSvc = global.requireShared('services/filesvc.js');
const serverHelper = require('../../../server.js');

/**
 * Responds to get requests for the list of insurer logos
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

/**
 * POST request to add a single logo to our cloud storage for insurer logos
 * this call will always overwrite existing files
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function postInsurerLogo(req, res, next){
    // Sanitize the file path
    let name = '';
    if(req.body && Object.prototype.hasOwnProperty.call(req.body, 'name')){
        name = req.body.name.replace(/[^a-zA-Z0-9-_/.]/g, '');
    }

    // Make sure a file name was provided
    if(!name){
        const errorMsg = 'You must specify a file name';
        log.warn("File Service POST: " + errorMsg + __location);
        return next(serverHelper.requestError(errorMsg));
    }

    // Make sure file data was provided
    if(!Object.prototype.hasOwnProperty.call(req.body, 'data')){
        const errorMsg = 'You must provide file data';
        log.warn("File Service POST: " + errorMsg + __location);
        return next(serverHelper.requestError(errorMsg));
    }

    if(Buffer.from(req.body.data, 'base64').toString('base64') !== req.body.data){
        //convert to base64
        const buff = Buffer.from(req.body.data);
        req.body.data = buff.toString('base64');
    }

    // Conver to base64
    const fileBuffer = Buffer.from(req.body.data, 'base64');

    // Make sure the data is valid
    if(fileBuffer.toString('base64') !== req.body.data){
        const errorMsg = 'The data you supplied is not valid. It must be base64 encoded';
        log.warn("File Service PUT: " + errorMsg + __location);
        return next(serverHelper.requestError(errorMsg));
    }

    // TODO: make sure the path for the put is good - dont let this execute or it will add files, until we are 100% sure
    fileSvc.PutFile(`insurers/${name}`, req.body.data, req.body.type).then((data) => {
        res.send(200, data);
        next();
    }).catch((err) => {
        log.error("File Service HTTP Put: " + err + __location);
        res.send(400, "");
        next(serverHelper.requestError("file get error: " + err.message));
    });
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Insurer Logo list', `${basePath}/insurer-logo`, getInsurerLogos, 'administration', 'all');
    server.addPostAuthAdmin('POST Insurer Logo list', `${basePath}/insurer-logo`, postInsurerLogo, 'administration', 'all');
};