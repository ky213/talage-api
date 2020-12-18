/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const IndustryCodeQuestionBO = global.requireShared('./models/IndustryCodeQuestion-BO.js');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const industryCodeQuestionBO = new IndustryCodeQuestionBO();
    const rows = await industryCodeQuestionBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('industry code question not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const industryCodeQuestionBO = new IndustryCodeQuestionBO();
    // Load the request data into it
    const questionAnswerJSON = await industryCodeQuestionBO.getById(id).catch(function(err) {
        log.error("industry code question load error " + err + __location);
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
        return next(serverHelper.notFoundError('industry code question not found'));
    }
}

async function add(req, res, next) {
    log.debug("industry code question post " + JSON.stringify(req.body));
    // Validate
    if(!req.body.talageQuestionId){
        return next(serverHelper.requestError("bad missing talageQuestionId"));
    }
    if(!req.body.insurerIndustryCodeId){
        return next(serverHelper.requestError("bad missing insurerIndustryCodeId"));
    }
    const industryCodeQuestionBO = new IndustryCodeQuestionBO();
    let error = null;
    const newRecord = true;
    await industryCodeQuestionBO.saveModel(req.body,newRecord).catch(function(err) {
        log.error("industry code question save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, industryCodeQuestionBO.cleanJSON());
    return next();
}

async function deleteObject(req, res, next) {
    log.debug("industry code question delete " + JSON.stringify(req.body));
    // Validate
    if(!req.body.talageQuestionId){
        return next(serverHelper.requestError("bad missing talageQuestionId"));
    }
    if(!req.body.insurerIndustryCodeId){
        return next(serverHelper.requestError("bad missing insurerIndustryCodeId"));
    }

    const talageQuestionId = stringFunctions.santizeNumber(req.body.talageQuestionId, true);
    const insurerIndustryCodeId = stringFunctions.santizeNumber(req.body.insurerIndustryCodeId, true);
    if (!talageQuestionId || !insurerIndustryCodeId) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const industryCodeQuestionBO = new IndustryCodeQuestionBO();
    await industryCodeQuestionBO.delete(talageQuestionId, insurerIndustryCodeId).catch(function(err) {
        log.error("industry code question load error " + err + __location);
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
    server.addGetAuthAdmin('GET Question Answer list', `${basePath}/industry-code-question`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Question Answer Object', `${basePath}/industry-code-question/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Question Answer Object', `${basePath}/industry-code-question`, add, 'administration', 'all');
    // server.addPutAuthAdmin('PUT Question Answer Object', `${basePath}/industry-code-question/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('DELETE Question Answer', `${basePath}/industry-code-question`, deleteObject, 'administration', 'all');
};