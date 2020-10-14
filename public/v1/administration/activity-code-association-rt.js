/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const ActivityCodeAssociationBO = global.requireShared('./models/ActivityCodeAssociation-BO.js');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const activityCodeAssociationBO = new ActivityCodeAssociationBO();
    const rows = await activityCodeAssociationBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('activity code association not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const activityCodeAssociationBO = new ActivityCodeAssociationBO();
    // Load the request data into it
    const questionAnswerJSON = await activityCodeAssociationBO.getById(id).catch(function(err) {
        log.error("activity code association load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (questionAnswerJSON) {
        res.send(200, questionAnswerJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('activity code association not found'));
    }
}

async function add(req, res, next) {
    log.debug("activity code association post " + JSON.stringify(req.body));
    // Validate
    if(!req.body.ncciCodeId){
        return next(serverHelper.requestError("bad missing ncciCodeId"));
    }
    if(!req.body.activityCodeId){
        return next(serverHelper.requestError("bad missing activityCodeId"));
    }
    const activityCodeAssociationBO = new ActivityCodeAssociationBO();
    let error = null;
    const newRecord = true;
    await activityCodeAssociationBO.saveModel(req.body,newRecord).catch(function(err) {
        log.error("activity code association save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, activityCodeAssociationBO.cleanJSON());
    return next();
}

async function deleteObject(req, res, next) {
    log.debug("activity code association delete " + JSON.stringify(req.body));
    // Validate
    if(!req.body.ncciCodeId){
        return next(serverHelper.requestError("bad missing ncciCodeId"));
    }
    if(!req.body.activityCodeId){
        return next(serverHelper.requestError("bad missing activityCodeId"));
    }

    const ncciCodeId = stringFunctions.santizeNumber(req.body.ncciCodeId, true);
    const activityCodeId = stringFunctions.santizeNumber(req.body.activityCodeId, true);
    if (!ncciCodeId || !activityCodeId) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const activityCodeAssociationBO = new ActivityCodeAssociationBO();
    await activityCodeAssociationBO.delete(ncciCodeId, activityCodeId).catch(function(err) {
        log.error("activity code association load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Question Answer list', `${basePath}/activity-code-association`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Question Answer Object', `${basePath}/activity-code-association/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Question Answer Object', `${basePath}/activity-code-association`, add, 'administration', 'all');
    // server.addPutAuthAdmin('PUT Question Answer Object', `${basePath}/activity-code-association/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('DELETE Question Answer', `${basePath}/activity-code-association`, deleteObject, 'administration', 'all');
};