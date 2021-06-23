/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';


const QuestionTypeSvc = global.requireShared('./services/questiontypesvc.js');
// Load the request data into it
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    const questionTypeList = QuestionTypeSvc.getList()
    if (questionTypeList) {

        res.send(200, questionTypeList);
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

    // Load the request data into it
    const questionTypeJSON = QuestionTypeSvc.getById(id);
    // Send back a success response
    if (questionTypeJSON) {
        res.send(200, questionTypeJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Question Type not found'));
    }
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Question Type list', `${basePath}/question-type`, findAll, 'TalageMapper', 'all');
    server.addGetAuthAdmin('GET Question Type Object', `${basePath}/question-type/:id`, findOne, 'TalageMapper', 'all');
};