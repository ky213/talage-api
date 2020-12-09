/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const IndustryCodeCategoryBO = global.requireShared('./models/IndustryCodeCategory-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

async function findAll(req, res, next) {
    let error = null;
    const industryCodeCategoryBO = new IndustryCodeCategoryBO();

    const rows = await industryCodeCategoryBO.getList(req.query).catch(function(err) {
        log.error("admin agencynetwork error: " + err + __location);
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
        return next(serverHelper.notFoundError('Industry Code Category not found'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const industryCodeCategoryBO = new IndustryCodeCategoryBO();
    // Load the request data into it
    const objectJSON = await industryCodeCategoryBO.getById(id).catch(function(err) {
        log.error("Industry Code Category Category load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (objectJSON) {
        res.send(200, objectJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Industry Code Category not found'));
    }
}
//add
async function add(req, res, next) {
    const industryCodeCategoryBO = new IndustryCodeCategoryBO();
    let error = null;
    await industryCodeCategoryBO.saveModel(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, industryCodeCategoryBO.cleanJSON());
    return next();
}

//update
async function update(req, res, next) {
    log.debug("IndustryCodeCategory PUT:  " + JSON.stringify(req.body))
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const industryCodeCategoryBO = new IndustryCodeCategoryBO();
    let error = null;
    await industryCodeCategoryBO.saveModel(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, industryCodeCategoryBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Industry Code Category list', `${basePath}/industry-code`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Industry Code Category Object', `${basePath}/industry-code/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post Industry Code Category Object', `${basePath}/industry-code`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Industry Code Category Object', `${basePath}/industry-code/:id`, update, 'administration', 'all');

    // server.addGet('Get Industry Code Category list', `${basePath}/agency-network`, findAll, 'administration', 'all');
    // server.addGet('Get Industry Code Category Object', `${basePath}/agency-network/:id`, findOne, 'administration', 'all');
    // server.addPost('Post Industry Code Category Object', `${basePath}/agency-network`, add, 'administration', 'all');
    // server.addPut('Put Industry Code Category Object', `${basePath}/agency-network/:id`, update, 'administration', 'all');

};