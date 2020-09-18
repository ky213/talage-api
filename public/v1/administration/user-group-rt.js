
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const AgencyPortalUserGroupBO = global.requireShared('./models/AgencyPortalUserGroup-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

async function findAll(req, res, next) {
    let error = null;
    const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();

    const rows = await agencyPortalUserGroupBO.getList(req.query).catch(function(err) {
        log.error("admin insurercontact error: " + err + __location);
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
        return next(serverHelper.notFoundError('AgencyPortalUserGroupBO not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();
    // Load the request data into it
    const objectJSON = await agencyPortalUserGroupBO.getById(id).catch(function(err) {
        log.error("agencyPortalUserGroupBO load error " + err + __location);
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
        return next(serverHelper.notFoundError('AgencyPortalUserGroupBO not found'));
    }

}
//add
async function add(req, res, next) {


    const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();
    let error = null;
    const userGroupJSON = await agencyPortalUserGroupBO.saveModel(req.body).catch(function(err) {
        log.error("agencyPortalUserGroupBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, userGroupJSON);
    return next();

}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();
    let error = null;
    const userGroupJSON = await agencyPortalUserGroupBO.saveModel(req.body).catch(function(err) {
        log.error("agencyPortalUserGroupBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, userGroupJSON);
    return next();

}

async function deleteObject(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();
    await agencyPortalUserGroupBO.deleteSoftById(id).catch(function(err) {
        log.error("agencyPortalUserGroupBO delete error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get AgencyPortalUserGroup list', `${basePath}/user-group`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get AgencyPortalUserGroup Object', `${basePath}/user-group/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post AgencyPortalUserGroup Object', `${basePath}/user-group`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put AgencyPortalUserGroup Object', `${basePath}/user-group/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('Delete AgencyPortalUserGroup  Object', `${basePath}/user-group/:id`, deleteObject, 'administration', 'all');

};