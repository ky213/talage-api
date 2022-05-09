
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerPortalUserGroupBO = global.requireShared('./models/InsurerPortalUserGroup-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

async function findAll(req, res, next) {
    const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
    let rows = null;
    try {
        rows = await insurerPortalUserGroupBO.getList(req.query)
    }
    catch(err) {
        log.error("admin insurerPortalUserGroupBO error: " + err + __location);
        return next(err);
    }
    if (rows) {
        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('InsurerPortalUserGroupBO not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
    // Load the request data into it
    let objectJSON = null;
    try {
        objectJSON = await insurerPortalUserGroupBO.getById(id);
    }
    catch(err) {
        log.error("insurerPortalUserGroupBO load error " + err + __location);
        if (err && err.message !== "not found") {
            return next(err);
        }
    }
    // Send back a success response
    if (objectJSON) {
        res.send(200, objectJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('InsurerPortalUserGroupBO not found'));
    }

}
//add
async function add(req, res, next) {
    const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
    let userGroupJSON = null;
    try {
        userGroupJSON = await insurerPortalUserGroupBO.saveModel(req.body);
    }
    catch(err) {
        log.error("insurerPortalUserGroupBO save error " + err + __location);
        return next(err);
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
    const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
    let userGroupJSON = null;
    try {
        userGroupJSON = await insurerPortalUserGroupBO.saveModel(req.body);
    }
    catch(err) {
        log.error("insurerPortalUserGroupBO save error " + err + __location);
        return next(err);
    }
    res.send(200, userGroupJSON);
    return next();
}

async function deleteObject(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
    try {
        await insurerPortalUserGroupBO.deleteSoftById(id);
    }
    catch(err) {
        log.error("insurerPortalUserGroupBO delete error " + err + __location);
        return next(err);
    }
    res.send(200, {"success": true});
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get InsurerPortalUserGroup list', `${basePath}/insurer-portal/user-group`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get InsurerPortalUserGroup Object', `${basePath}/insurer-portal/user-group/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post InsurerPortalUserGroup Object', `${basePath}/insurer-portal/user-group`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put InsurerPortalUserGroup Object', `${basePath}/insurer-portal/user-group/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('Delete InsurerPortalUserGroup  Object', `${basePath}/insurer-portal/user-group/:id`, deleteObject, 'administration', 'all');

};