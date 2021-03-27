/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerQuestionMySql = global.requireShared('./models/InsurerQuestionMySql-BO.js');
const InsurerQuestion = global.requireShared('./models/InsurerQuestion-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAllSql(req, res, next) {
    let error = null;
    const insurerQuestionMySqlBO = new InsurerQuestionMySql();
    const rows = await insurerQuestionMySqlBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('question not found'));
    }
}

async function findOneSql(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const insurerQuestionMySqlBO = new InsurerQuestionMySql();
    // Load the request data into it
    const insurerQuestionJSON = await insurerQuestionMySqlBO.getById(id).catch(function(err) {
        log.error("question load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (insurerQuestionJSON) {
        res.send(200, insurerQuestionJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('question not found'));
    }
}

async function addSql(req, res, next) {

    log.debug("insurer question post " + JSON.stringify(req.body));
    //TODO Validate
    if(!req.body.text){
        return next(serverHelper.requestError("bad missing question"));
    }

    const insurerQuestionMySqlBO = new InsurerQuestionMySql();
    let error = null;
    const newRecord = true;
    await insurerQuestionMySqlBO.saveModel(req.body, newRecord).catch(function(err) {
        log.error("insurer question save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    //update cache
    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        //do not await not need to wait for response
        questionSvc.UpdateRedisIndustryQuestionByQuestionId(insurerQuestionMySqlBO.question);
    }
    catch(err){
        log.error(`Error update question cache for ${insurerQuestionMySqlBO.question}`)
    }
    res.send(200, insurerQuestionMySqlBO.cleanJSON());
    return next();
}

async function updateSql(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    if(!req.body){
        return next(serverHelper.requestError("bad put"));
    }
    const insurerQuestionMySqlBO = new InsurerQuestionMySql();
    let error = null;
    let questionId = null;
    if(req.body && req.body.id && !req.body.question){
        const insurerQuestionDB = await insurerQuestionMySqlBO.getById(req.body.id).catch(function(err) {
            log.error("insurer question load error " + err + __location);
            error = err;
        });
        questionId = insurerQuestionDB.question;
    }

    const updateRecord = false;
    log.debug(JSON.stringify(req.body));
    await insurerQuestionMySqlBO.saveModel(req.body, updateRecord).catch(function(err) {
        log.error("insurer question load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    //update cache
    if(insurerQuestionMySqlBO.question){
        questionId = insurerQuestionMySqlBO.question;
    }
    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        //do not await not need to wait for response
        questionSvc.UpdateRedisIndustryQuestionByQuestionId(questionId);
    }
    catch(err){
        log.error(`Error update question cache for ${questionId}`)
    }
    res.send(200, insurerQuestionMySqlBO);
    return next();
}

// MONGO

async function findAll(req, res, next) {
    let error = null;
    const insurerQuestionBO = new InsurerQuestion();
    const rows = await insurerQuestionBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('question not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const insurerQuestionBO = new InsurerQuestion();
    // Load the request data into it
    const insurerQuestionJSON = await insurerQuestionBO.getById(id).catch(function(err) {
        log.error("question load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (insurerQuestionJSON) {
        res.send(200, insurerQuestionJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('question not found'));
    }
}

async function add(req, res, next) {

    log.debug("insurer question post " + JSON.stringify(req.body));
    //TODO Validate
    if(!req.body.text){
        return next(serverHelper.requestError("bad missing question"));
    }

    // if there is no expirationDate or effectiveDate provided, default them
    if(!req.body.hasOwnProperty("expirationDate")){
        req.body.expirationDate = "2100-01-01";
    }
    if(!req.body.hasOwnProperty("effectiveDate")){
        req.body.effectiveDate = "1980-01-01";
    }

    if(req.body && req.body.attributes && typeof req.body.attributes === 'string'){
        req.body.attributes = JSON.parse(req.body.attributes);
    }

    const insurerQuestionBO = new InsurerQuestion();
    let error = null;
    const objectJSON = await insurerQuestionBO.insertMongo(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    //update cache
    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        //do not await not need to wait for response
        questionSvc.UpdateRedisIndustryQuestionByQuestionId(insurerQuestionBO.talageQuestionId);
    }
    catch(err){
        log.error(`Error update question cache for ${insurerQuestionBO.talageQuestionId}`)
    }
    res.send(200, objectJSON);
    return next();
}

async function update(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("no id parameter"));
    }
    if(!req.body){
        return next(serverHelper.requestError("no body"));
    }

    const insurerQuestionBO = new InsurerQuestion();
    let error = null;
    let questionId = null;

    // if there is no expirationDate or effectiveDate provided, default them
    if(!req.body.hasOwnProperty("expirationDate")){
        req.body.expirationDate = "2100-01-01";
    }
    if(!req.body.hasOwnProperty("effectiveDate")){
        req.body.effectiveDate = "1980-01-01";
    }

    log.debug(JSON.stringify(req.body));
    if(req.body && req.body.attributes && typeof req.body.attributes === 'string'){
        req.body.attributes = JSON.parse(req.body.attributes);
    }
    const newJSON = await insurerQuestionBO.updateMongo(id, req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    //update cache
    if(newJSON.talageQuestionId){
        questionId = newJSON.talageQuestionId;
    }
    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        //do not await not need to wait for response
        questionSvc.UpdateRedisIndustryQuestionByQuestionId(questionId);
    }
    catch(err){
        log.error(`Error update question cache for ${questionId}`)
    }
    res.send(200, newJSON);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Insurer Question list', `${basePath}/insurer-question-sql`, findAllSql, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer Question Object', `${basePath}/insurer-question-sql/:id`, findOneSql, 'administration', 'all');
    server.addPostAuthAdmin('POST Insurer Question Object', `${basePath}/insurer-question-sql`, addSql, 'administration', 'all');
    server.addPutAuthAdmin('PUT Insurer Question Object', `${basePath}/insurer-question-sql/:id`, updateSql, 'administration', 'all');

    // MONGO
    server.addGetAuthAdmin('GET Insurer Question list', `${basePath}/insurer-question`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer Question Object', `${basePath}/insurer-question/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Insurer Question Object', `${basePath}/insurer-question`, add, 'administration', 'all');
    server.addPutAuthAdmin('PUT Insurer Question Object', `${basePath}/insurer-question/:id`, update, 'administration', 'all');
};