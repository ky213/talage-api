/* eslint-disable object-shorthand */
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const QuestionBO = global.requireShared('./models/Question-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const questionBO = new QuestionBO();

    const rows = await questionBO.getList(req.query).catch(function(err) {
        log.error("admin agencynetwork error: " + err + __location);
        error = err;
    })
    if (error) {
        return next(error);
    }

    const countQuery = {...req.query, count: true};
    const count = await questionBO.getList(countQuery).catch(function(err) {
        error = err;
    });
    if (error) {
        return next(error);
    }

    if (rows) {
        res.send(200, {rows, ...count});
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
    const questionBO = new QuestionBO();
    // Load the request data into it
    const questionJSON = await questionBO.getById(id).catch(function(err) {
        log.error("question load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (questionJSON) {
        res.send(200, questionJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('question not found'));
    }
}

async function add(req, res, next) {

    log.debug("question post " + JSON.stringify(req.body));
    //TODO Validate
    if(!req.body.question){
        return next(serverHelper.requestError("bad missing question"));
    }
    // allow hint to be empty string
    if(!req.body.hint && req.body.hint !== ""){
        return next(serverHelper.requestError("bad missing hint"));
    }
    const questionBO = new QuestionBO();
    let error = null;
    const newRecord = true;
    await questionBO.saveModel(req.body,newRecord).catch(function(err) {
        log.error("question save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, questionBO.cleanJSON());
    return next();
}

async function update(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    if(!req.body){
        return next(serverHelper.requestError("bad put"));
    }
    let error = null;
    const updateRecord = false;
    const questionBO = new QuestionBO();
    await questionBO.saveModel(req.body, updateRecord).catch(function(err) {
        log.error("question load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, questionBO);
    //update cache
    const questionSvc = global.requireShared('./services/questionsvc.js');
    try{
        //do not await not need to wait for response
        questionSvc.UpdateRedisIndustryQuestionByQuestionId(questionBO.id);
    }
    catch(err){
        log.error(`Error update question cache for ${questionBO.id}`)
    }

    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Question list', `${basePath}/question`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Question Object', `${basePath}/question/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Question Object', `${basePath}/question`, add, 'administration', 'all');
    server.addPutAuthAdmin('PUT Question Object', `${basePath}/question/:id`, update, 'administration', 'all');
};