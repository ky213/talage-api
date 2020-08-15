/**
 * Handles tasks for working with a single file
 */

'use strict';

const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const fileSvc = global.requireShared('services/filesvc.js');

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
        log.warn("File Service DEL: " + errorMsg + __location);
        return next(serverHelper.requestError(errorMsg));
    }


    fileSvc.deleteFile(path).then(function(data){
        res.send(200, data);
        next();

    }).catch(function(err){
        log.error("File Service HTTP DELETE: " + err + __location);
        res.send(500, "");
        next(serverHelper.requestError("file delete error: " + err.message));
    });
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
        log.error("File Service GET: " + errorMsg + __location);
        return next(serverHelper.requestError(errorMsg));
    }

    fileSvc.get(path).then(function(data){
        data.Body = data.Body.toString('base64');
        //	Remove items we don't care about
        delete data.AcceptRanges;
        delete data.LastModified;
        delete data.ETag;
        delete data.Metadata;
        delete data.TagCount;

        log.info('Returning file');

        // Send the data back to the user
        res.send(200, data);
        next();

    }).catch(function(err){
        log.error("File Service HTTP GET: " + err + __location);
        res.send(400, "");
        next(serverHelper.requestError("file get error: " + err.message));
    });
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
        log.warn("File Service PUT: " + errorMsg + __location);
        return next(serverHelper.requestError(errorMsg));
    }

    // Make sure file data was provided
    if(!Object.prototype.hasOwnProperty.call(req.body, 'data')){
        const errorMsg = 'You must provide file data';
        log.warn("File Service PUT: " + errorMsg + __location);
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

    fileSvc.PutFile(path, req.body.data).then(function(data){
        res.send(200, data);
        next();

    }).catch(function(err){
        log.error("File Service HTTP Put: " + err + __location);
        res.send(400, "");
        next(serverHelper.requestError("file get error: " + err.message));
    });
}

// eslint-disable-next-line multiline-comment-style
/*****************************************
 * 
 *  Secure Bucket medthods
 * 
 * 
 */

 /**
 * Responds to GET requests to return a single file
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
function GetFileSecure(req, res, next){

    // Sanitize the file path
    let path = '';
    if(req.query.path){
        path = req.query.path.replace(/[^a-zA-Z0-9-_/.]/g, '');
    }

    // Make sure a file path was provided
    if(!path){
        const errorMsg = 'You must specify a file path';
        log.error("File Service GET: " + errorMsg + __location);
        return next(serverHelper.requestError(errorMsg));
    }

    fileSvc.GetFileSecure(path).then(function(data){
        data.Body = data.Body.toString('base64');
        //	Remove items we don't care about
        delete data.AcceptRanges;
        delete data.LastModified;
        delete data.ETag;
        delete data.Metadata;
        delete data.TagCount;

        log.info('Returning file');

        // Send the data back to the user
        res.send(200, data);
        next();

    }).catch(function(err){
        log.error("File Service HTTP GET: " + err + __location);
        res.send(400, "");
        next(serverHelper.requestError("file get error: " + err.message));
    });
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('File', `${basePath}/file`, GetFile);
    server.addGet('File (depr)', `${basePath}/`, GetFile);
    server.addPut('File', `${basePath}/file`, PutFile);
    server.addPut('File (depr)', `${basePath}/`, PutFile);
    server.addDelete('File', `${basePath}/file`, DeleteFile);
    server.addDelete('File (depr)', `${basePath}/`, DeleteFile);

    //Secure
    server.addGet('File (depr)', `${basePath}/filesecure`, GetFileSecure);
};