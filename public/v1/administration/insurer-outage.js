/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerOutageBO = global.requireShared('./models/InsurerOutage-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const moment = require("moment")

async function findAll(req, res, next) {
    let error = null;
    const insurerOutageBO = new InsurerOutageBO();
    const rows = await insurerOutageBO.getListForAdmin(req.query).catch(function(err){
        error = err;
    })
    if(error){
        return next(error);
    }
    if (rows) {

        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Location not found'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerOutageBO = new InsurerOutageBO();
     // Load the request data into it
     const outageJSON = await insurerOutageBO.getById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (outageJSON) {
        res.send(200, outageJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Location not found'));
    }

}

async function add(req, res, next) {
    const insurerOutageBO = new InsurerOutageBO();


    res.send(200,doc);
    return next();

}

async function deleteObject(req, res, next) {
    let doc = {};
    res.send(200,doc);
    return next();

}



exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    // server.addGetAuthAdmin('Get Insurer Outage list', `${basePath}/insurer-outage`, findAll, 'administration', 'all');
    // server.addGetAuthAdmin('GET Insurer Outage  Object', `${basePath}/insurer-outage/:id`, findOne, 'administration', 'all');
    // server.addPostAuthAdmin('Get Insurer Outage list', `${basePath}/insurer-outage`, add, 'administration', 'all');
    // server.addDeleteAuthAdmin('GET Insurer Outage  Object', `${basePath}/insurer-outage/:id`, deleteObject, 'administration', 'all');

    server.addGet('Get Insurer Outage list', `${basePath}/insurer-outage`, findAll, 'administration', 'all');
    server.addGet('GET Insurer Outage  Object', `${basePath}/insurer-outage/:id`, findOne, 'administration', 'all');
    server.addPost('Add Insurer Outage', `${basePath}/insurer-outage`, add, 'administration', 'all');
    server.addDelete('DELETE Insurer Outage  Object', `${basePath}/insurer-outage/:id`, deleteObject, 'administration', 'all');

};