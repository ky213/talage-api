/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerQuestionBO = global.requireShared('./models/InsurerQuestion-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const insurerQuestionBO = new InsurerQuestionBO();
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
    const insurerQuestionBO = new InsurerQuestionBO();
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

    const insurerQuestionBO = new InsurerQuestionBO();
    let error = null;
    const newRecord = true;
    console.log(req.body);
    await insurerQuestionBO.saveModel(req.body, newRecord).catch(function(err) {
        log.error("insurer question save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerQuestionBO.cleanJSON());
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
    const insurerQuestionBO = new InsurerQuestionBO();
    await insurerQuestionBO.saveModel(req.body, updateRecord).catch(function(err) {
        log.error("insurer question load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, insurerQuestionBO);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Insurer Question list', `${basePath}/insurer-question`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer Question Object', `${basePath}/insurer-question/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Insurer Question Object', `${basePath}/insurer-question`, add, 'administration', 'all');
    server.addPutAuthAdmin('PUT Insurer Question Object', `${basePath}/insurer-question/:id`, update, 'administration', 'all');
};