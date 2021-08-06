'use strict';
const questionCategorySvc = global.requireShared('services/question-category-svc.js');


/* eslint-disable require-jsdoc */
function getQuestionCategories(req, res, next){
    const questionCategories = questionCategorySvc.getList();
    res.send(200, questionCategories);
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    // TODO require Auth.
    server.addGet('Get All Industry Code Categories', `${basePath}/question-categories`, getQuestionCategories);
};