/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const IndustryCodeAssociationBO = global.requireShared('./models/IndustryCodeAssociation-BO.js');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const industryCodeAssociationBO = new IndustryCodeAssociationBO();
    const rows = await industryCodeAssociationBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('industry code association not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const industryCodeAssociationBO = new IndustryCodeAssociationBO();
    // Load the request data into it
    const questionAnswerJSON = await industryCodeAssociationBO.getById(id).catch(function(err) {
        log.error("industry code association load error " + err + __location);
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
        return next(serverHelper.notFoundError('industry code association not found'));
    }
}

async function add(req, res, next) {
    log.debug("industry code association post " + JSON.stringify(req.body));
    // Validate
    if(!req.body.industryCodeId){
        return next(serverHelper.requestError("bad missing industryCodeId"));
    }
    if(!req.body.activityCodeId){
        return next(serverHelper.requestError("bad missing activityCodeId"));
    }

    // set the old values as well or else they will be set to 0 and the table will break
    const addJSON = {
        industryCodeId: req.body.industryCodeId,
        industry_code: req.body.industryCodeId,
        activityCodeId: req.body.activityCodeId,
        ncci_code: req.body.activityCodeId,
        frequency: 100
    };

    const industryCodeAssociationBO = new IndustryCodeAssociationBO();
    let error = null;
    const newRecord = true;
    await industryCodeAssociationBO.saveModel(addJSON, newRecord).catch(function(err) {
        log.error("industry code association save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, industryCodeAssociationBO.cleanJSON());
    return next();
}

async function deleteObject(req, res, next) {
    log.debug("industry code association delete " + JSON.stringify(req.body));
    // Validate
    if(!req.body.industryCodeId){
        return next(serverHelper.requestError("bad missing industryCodeId"));
    }
    if(!req.body.activityCodeId){
        return next(serverHelper.requestError("bad missing activityCodeId"));
    }

    const industryCodeId = stringFunctions.santizeNumber(req.body.industryCodeId, true);
    const activityCodeId = stringFunctions.santizeNumber(req.body.activityCodeId, true);
    if (!industryCodeId || !activityCodeId) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const industryCodeAssociationBO = new IndustryCodeAssociationBO();
    await industryCodeAssociationBO.delete(industryCodeId, activityCodeId).catch(function(err) {
        log.error("industry code association load error " + err + __location);
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
    server.addGetAuthAdmin('GET Question Answer list', `${basePath}/industry-code-association`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Question Answer Object', `${basePath}/industry-code-association/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Question Answer Object', `${basePath}/industry-code-association`, add, 'administration', 'all');
    // server.addPutAuthAdmin('PUT Question Answer Object', `${basePath}/industry-code-association/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('DELETE Question Answer', `${basePath}/industry-code-association`, deleteObject, 'administration', 'all');
};