/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const IndustryCodeToInsurerIndustryCodeBO = global.requireShared('./models/IndustryCodeToInsurerIndustryCode-BO.js');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const industryCodeToInsurerIndustryCodeBO = new IndustryCodeToInsurerIndustryCodeBO();
    const rows = await industryCodeToInsurerIndustryCodeBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('industry code to insurer industry code not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const industryCodeToInsurerIndustryCodeBO = new IndustryCodeToInsurerIndustryCodeBO();
    // Load the request data into it
    const questionAnswerJSON = await industryCodeToInsurerIndustryCodeBO.getById(id).catch(function(err) {
        log.error("industry code to insurer industry code load error " + err + __location);
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
        return next(serverHelper.notFoundError('industry code to insurer industry code not found'));
    }
}

async function add(req, res, next) {
    log.debug("industry code to insurer industry code post " + JSON.stringify(req.body));
    // Validate
    if(!req.body.insurerIndustryCodeId){
        return next(serverHelper.requestError("bad missing insurerIndustryCodeId"));
    }
    if(!req.body.talageIndustryCodeId){
        return next(serverHelper.requestError("bad missing talageIndustryCodeId"));
    }
    const industryCodeToInsurerIndustryCodeBO = new IndustryCodeToInsurerIndustryCodeBO();
    let error = null;
    const newRecord = true;
    await industryCodeToInsurerIndustryCodeBO.saveModel(req.body,newRecord).catch(function(err) {
        log.error("industry code to insurer industry code save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        //do not await not need to wait for response
        questionSvc.CreateRedisIndustryCodeQuestionEntry(req.body.talageIndustryCodeId);
    }
    catch(err){
        log.error(`Error update question cache for ${req.body.talageIndustryCodeId}`)
    }

    res.send(200, industryCodeToInsurerIndustryCodeBO.cleanJSON());
    return next();
}

async function deleteObject(req, res, next) {
    log.debug("industry code to insurer industry code delete " + JSON.stringify(req.body));
    // Validate
    if(!req.body.insurerIndustryCodeId){
        return next(serverHelper.requestError("bad missing insurerIndustryCodeId"));
    }
    if(!req.body.talageIndustryCodeId){
        return next(serverHelper.requestError("bad missing talageIndustryCodeId"));
    }

    const insurerIndustryCodeId = stringFunctions.santizeNumber(req.body.insurerIndustryCodeId, true);
    const talageIndustryCodeId = stringFunctions.santizeNumber(req.body.talageIndustryCodeId, true);
    if (!insurerIndustryCodeId || !talageIndustryCodeId) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const industryCodeToInsurerIndustryCodeBO = new IndustryCodeToInsurerIndustryCodeBO();
    await industryCodeToInsurerIndustryCodeBO.delete(talageIndustryCodeId, insurerIndustryCodeId).catch(function(err) {
        log.error("industry code to insurer industry code load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        //do not await not need to wait for response
        questionSvc.CreateRedisIndustryCodeQuestionEntry(talageIndustryCodeId);
    }
    catch(err){
        log.error(`Error update question cache for ${talageIndustryCodeId}`)
    }
    res.send(200, {"success": true});
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Question Answer list', `${basePath}/industry-code-to-insurer-indusry-code`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Question Answer Object', `${basePath}/industry-code-to-insurer-indusry-code/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Question Answer Object', `${basePath}/industry-code-to-insurer-indusry-code`, add, 'administration', 'all');
    server.addDeleteAuthAdmin('DELETE Question Answer', `${basePath}/industry-code-to-insurer-indusry-code`, deleteObject, 'administration', 'all');
};