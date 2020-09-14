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
    const rows = await insurerOutageBO.getListForAdmin(req.query).catch(function(err) {
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

    log.debug("insurer-outage post " + JSON.stringify(req.body));
    if (req.body.insurerId) {
        req.body.insurer = req.body.insurerId;
        delete req.body.insurerId
    }
    else {
        return next(serverHelper.requestError('Missing insurerId'))
    }
    if (req.body.start) {
        try{
            req.body.start = moment(req.body.start.trim()).tz("America/Los_Angeles").format(db.dbTimeFormat());
        }
        catch(e){
            log.error("Add outage start date error " + e + __location)
            return next(serverHelper.requestError('Bad start'))
        }
    }
    else {
        return next(serverHelper.requestError('Missing start'))
    }

    if (req.body.end) {
        try{
            req.body.end = moment(req.body.end.trim()).tz("America/Los_Angeles").format(db.dbTimeFormat());
        }
        catch(e){
            log.error("Add outage end date error " + e + __location)
            return next(serverHelper.requestError('Bad end'))
        }

    }
    else {
        return next(serverHelper.requestError('Missing end'))
    }
    log.debug("insurer-outage fixed json " + JSON.stringify(req.body));
    // if(req.cognitoUser){
    //     //req.body.created_by = req.cognitoUser
    // }
    const insurerOutageBO = new InsurerOutageBO();
    let error = null;
    await insurerOutageBO.saveModel(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerOutageBO.cleanJSON());
    return next();

}

async function deleteObject(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerOutageBO = new InsurerOutageBO();
    await insurerOutageBO.deleteSoftById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();

}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('Get Insurer Outage list', `${basePath}/insurer-outage`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer Outage  Object', `${basePath}/insurer-outage/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Get Insurer Outage list', `${basePath}/insurer-outage`, add, 'administration', 'all');
    server.addDeleteAuthAdmin('Delete Insurer Outage  Object', `${basePath}/insurer-outage/:id`, deleteObject, 'administration', 'all');

};