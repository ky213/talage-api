/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const QuestionAnswerBO = global.requireShared('./models/QuestionAnswer-BO.js');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const questionAnswerBO = new QuestionAnswerBO();
    const rows = await questionAnswerBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('question answer not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const questionAnswerBO = new QuestionAnswerBO();
    // Load the request data into it
    const questionAnswerJSON = await questionAnswerBO.getById(id).catch(function(err) {
        log.error("question answer load error " + err + __location);
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
        return next(serverHelper.notFoundError('question answer not found'));
    }
}

async function add(req, res, next) {
    log.debug("question answer post " + JSON.stringify(req.body));
    // Validate
    if(!req.body.question){
        return next(serverHelper.requestError("bad missing question"));
    }
    if(!req.body.answer){
        return next(serverHelper.requestError("bad missing answer"));
    }
    const questionAnswerBO = new QuestionAnswerBO();
    let error = null;
    const newRecord = true;
    await questionAnswerBO.saveModel(req.body,newRecord).catch(function(err) {
        log.error("question answer save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, questionAnswerBO.cleanJSON());
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
    const questionAnswerBO = new QuestionAnswerBO();
    await questionAnswerBO.saveModel(req.body, updateRecord).catch(function(err) {
        log.error("question answer load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, questionAnswerBO);
    return next();
}

async function deleteObject(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const questionAnswerBO = new QuestionAnswerBO();
    await questionAnswerBO.deleteSoftById(id).catch(function(err) {
        log.error("question answer load error " + err + __location);
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
    server.addGetAuthAdmin('GET Question Answer list', `${basePath}/question-answer`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Question Answer Object', `${basePath}/question-answer/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Question Answer Object', `${basePath}/question-answer`, add, 'administration', 'all');
    server.addPutAuthAdmin('PUT Question Answer Object', `${basePath}/question-answer/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('DELETE Question Answer', `${basePath}/question-answer/:id`, deleteObject, 'administration', 'all');
};