/* eslint-disable object-shorthand */
/* eslint-disable no-loop-func */
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const CodeGroupBO = global.requireShared('./models/CodeGroup-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const codeGroupBO = new CodeGroupBO();

    const codeGroupList = await codeGroupBO.getList(req.query).catch(function(err) {
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, codeGroupList);
    return next();
}

async function add(req, res, next) {
    log.debug("Code Group post " + JSON.stringify(req.body));
    //TODO Validate
    if(!req.body.name){
        return next(serverHelper.requestError("bad missing name"));
    }
    // TODO: additional validation?
    // // allow hint to be empty string
    // if(!req.body.hint && req.body.hint !== ""){
    //     return next(serverHelper.requestError("bad missing hint"));
    // }
    const codeGroupBO = new CodeGroupBO();
    let error = null;
    const codeGroupAdded = await codeGroupBO.saveModel(req.body).catch(function(err) {
        log.error("codeGroup save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, codeGroupAdded);
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

    // make sure we update the one asked to update
    req.body.codeGroupId = id;
    let error = null;
    const codeGroupBO = new CodeGroupBO();
    const codeGroupUpdated = await codeGroupBO.saveModel(req.body).catch(function(err) {
        log.error("codeGroup load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, codeGroupUpdated);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Code Group List', `${basePath}/code-group`, findAll, 'administration', 'all');
    server.addPostAuthAdmin('POST Code Group Object', `${basePath}/code-group`, add, 'administration', 'all');
    server.addPutAuthAdmin('PUT Code Group Object', `${basePath}/code-group/:id`, update, 'administration', 'all');
};