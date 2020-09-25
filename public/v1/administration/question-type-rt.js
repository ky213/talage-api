/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const QuestionTypeBO = global.requireShared('./models/QuestionType-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const questionTypeBO = new QuestionTypeBO();
    const rows = await questionTypeBO.getList(req.query).catch(function(err) {
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
    const questionTypeBO = new QuestionTypeBO();
    // Load the request data into it
    const questionTypeJSON = await questionTypeBO.getById(id).catch(function(err) {
        log.error("question load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (questionTypeJSON) {
        res.send(200, questionTypeJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Territory not found'));
    }
}

// async function add(req, res, next) {

//     log.debug("question post " + JSON.stringify(req.body));
//     //TODO Validate
//     if(!req.body.abbr){
//         return next(serverHelper.requestError("bad missing abbr"));
//     }
//     if(!req.body.name){
//         return next(serverHelper.requestError("bad missing name"));
//     }
//     const questionTypeBO = new QuestionTypeBO();
//     let error = null;
//     const newRecord = true;
//     await questionTypeBO.saveModel(req.body,newRecord).catch(function(err) {
//         log.error("territory save error " + err + __location);
//         error = err;
//     });
//     if (error) {
//         return next(error);
//     }

//     res.send(200, questionTypeBO.cleanJSON());
//     return next();
// }

// async function update(req, res, next) {
//     const id = req.params.id;
//     if (!id) {
//         return next(serverHelper.requestError("bad parameter"));
//     }
//     if(!req.body){
//         return next(serverHelper.requestError("bad put"));
//     }
//     if(!req.body.abbr){
//         return next(serverHelper.requestError("missing abbr"));
//     }
//     let error = null;
//     const updateRecord = false;
//     const questionTypeBO = new QuestionTypeBO();
//     await questionTypeBO.saveModel(req.body, updateRecord).catch(function(err) {
//         log.error("Location load error " + err + __location);
//         error = err;
//     });
//     if (error) {
//         return next(error);
//     }
//     res.send(200, questionTypeBO);
//     return next();
// }

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Question Type list', `${basePath}/question-type`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Question Type Object', `${basePath}/question-type/:id`, findOne, 'administration', 'all');
    // server.addPostAuthAdmin('POST Question Object', `${basePath}/question`, add, 'administration', 'all');
    // server.addPutAuthAdmin('PUT Question Object', `${basePath}/question/:id`, update, 'administration', 'all');
};