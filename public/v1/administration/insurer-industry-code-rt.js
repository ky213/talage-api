/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerIndustryCodeBO = global.requireShared('./models/InsurerIndustryCode-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

async function findAll(req, res, next) {
    let error = null;
    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();

    const rows = await insurerIndustryCodeBO.getList(req.query).catch(function(err) {
        log.error("admin agencynetwork error: " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if (rows) {
        res.send(200, {rows});
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Insurer Industry Code not found'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();
    // Load the request data into it
    const objectJSON = await insurerIndustryCodeBO.getById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
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
        return next(serverHelper.notFoundError('Insurer Industry Code not found'));
    }
}
//add
async function add(req, res, next) {
    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();
    let error = null;
    await insurerIndustryCodeBO.saveModel(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerIndustryCodeBO.cleanJSON());
    return next();
}

//update
async function update(req, res, next) {
    log.debug("InsurerIndustryCodeBO PUT:  " + JSON.stringify(req.body))
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();
    let error = null;
    await insurerIndustryCodeBO.saveModel(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerIndustryCodeBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Insurer Industry Code list', `${basePath}/insurer-industry-code`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Insurer Industry Code Object', `${basePath}/insurer-industry-code/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post Insurer Industry Code Object', `${basePath}/insurer-industry-code`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Insurer Industry Code Object', `${basePath}/insurer-industry-code/:id`, update, 'administration', 'all');
};