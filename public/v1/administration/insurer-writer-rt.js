
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerWriterBO = global.requireShared('./models/InsurerWriter-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const insurerWriterBO = new InsurerWriterBO();

    const rows = await insurerWriterBO.getList(req.query).catch(function(err) {
        log.error("admin InsurerWriter error: " + err + __location);
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
        return next(serverHelper.notFoundError('InsurerWriter not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerWriterBO = new InsurerWriterBO();
    // Load the request data into it
    const objectJSON = await insurerWriterBO.getById(id).catch(function(err) {
        log.error("insurerWriterBO load error " + err + __location);
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
        return next(serverHelper.notFoundError('InsurerWriter not found'));
    }

}
//add
async function add(req, res, next) {


    const insurerWriterBO = new InsurerWriterBO();
    let error = null;
    await insurerWriterBO.saveModel(req.body).catch(function(err) {
        log.error("insurerWriterBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerWriterBO.cleanJSON());
    return next();

}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerWriterBO = new InsurerWriterBO();
    let error = null;
    await insurerWriterBO.saveModel(req.body).catch(function(err) {
        log.error("insurerWriterBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerWriterBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get InsurerWriter list', `${basePath}/insurer-writer`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get InsurerWriter Object', `${basePath}/insurer-writer/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post InsurerWriter Object', `${basePath}/insurer-writer`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put InsurerWriter Object', `${basePath}/insurer-writer/:id`, update, 'administration', 'all');


    // server.addGet('Get InsurerWriter list', `${basePath}/insurer-writer`, findAll, 'administration', 'all');
    // server.addGet('Get InsurerWriter Object', `${basePath}/insurer-writer/:id`, findOne, 'administration', 'all');
    // server.addPost('Post InsurerWriter Object', `${basePath}/insurer-writer`, add, 'administration', 'all');
    // server.addPut('Put InsurerWriter Object', `${basePath}/insurer-writer/:id`, update, 'administration', 'all');


};