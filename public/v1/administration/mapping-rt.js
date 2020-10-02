
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const MappingBO = global.requireShared('./models/Mapping-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

async function findAll(req, res, next) {
    let error = null;
    const mappingBO = new MappingBO();

    const rows = await mappingBO.getList(req.query).catch(function(err) {
        log.error("admin mapping error: " + err + __location);
        error = err;
    })
    if (error) {
        return next(error);
    }
    if (rows) {
        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('MappingBO not found'));
    }


}

async function findOne(req, res, next) {
    const id = req.params.id;
    //TODO check it is a uuid.
    
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const mappingBO = new MappingBO();
    // Load the request data into it
    const objectJSON = await mappingBO.getById(id).catch(function(err) {
        log.error("mappingBO load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (objectJSON) {
        res.send(200, objectJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('MappingBO not found'));
    }

}
//add
async function add(req, res, next) {


    const mappingBO = new MappingBO();
    let error = null;
    const mappingJSON = await mappingBO.saveModel(req.body).catch(function(err) {
        log.error("mappingBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, mappingJSON);
    return next();

}


//update
async function update(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const mappingBO = new MappingBO();
    let error = null;
    const mappingJSON = await mappingBO.saveModel(req.body).catch(function(err) {
        log.error("mappingBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, mappingJSON);
    return next();

}

async function deleteObject(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const mappingBO = new MappingBO();
    await mappingBO.deleteSoftById(id).catch(function(err) {
        log.error("mappingBO delete error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get Mapping list', `${basePath}/mapping`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Mapping Object', `${basePath}/mapping/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post Mapping Object', `${basePath}/mapping`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Mapping Object', `${basePath}/mapping/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('Delete Mapping  Object', `${basePath}/mapping/:id`, deleteObject, 'administration', 'all');

};