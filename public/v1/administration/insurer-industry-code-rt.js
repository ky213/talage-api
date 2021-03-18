/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerIndustryCodeMySqlBO = global.requireShared('./models/InsurerIndustryCodeMySql-BO.js');
const InsurerIndustryCodBO = global.requireShared('./models/InsurerIndustryCode-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

async function findAllSql(req, res, next) {
    let error = null;
    const insurerIndustryCodeMySqlBO = new InsurerIndustryCodeMySqlBO();

    const rows = await insurerIndustryCodeMySqlBO.getList(req.query).catch(function(err) {
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

async function findOneSql(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerIndustryCodeMySqlBO = new InsurerIndustryCodeMySqlBO();
    // Load the request data into it
    const objectJSON = await insurerIndustryCodeMySqlBO.getById(id).catch(function(err) {
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
async function addSql(req, res, next) {
    const insurerIndustryCodeMySqlBO = new InsurerIndustryCodeMySqlBO();
    let error = null;
    await insurerIndustryCodeMySqlBO.saveModel(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerIndustryCodeMySqlBO.cleanJSON());
    return next();
}

//update
async function updateSql(req, res, next) {
    log.debug("InsurerIndustryCodeMySqlBO PUT:  " + JSON.stringify(req.body))
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerIndustryCodeMySqlBO = new InsurerIndustryCodeMySqlBO();
    let error = null;
    await insurerIndustryCodeMySqlBO.saveModel(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerIndustryCodeMySqlBO.cleanJSON());
    return next();

}

// MONGO
async function findAll(req, res, next) {
    let error = null;
    const insurerIndustryCodBO = new InsurerIndustryCodBO();

    const rows = await insurerIndustryCodBO.getList(req.query).catch(function(err) {
        log.error("admin agencynetwork error: " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if (rows) {
        res.send(200, rows);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Insurer Industry Code not found'));
    }
}

async function findOne(req, res, next) {
    if (!req.params.id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerIndustryCodBO = new InsurerIndustryCodBO();
    // Load the request data into it
    const objectJSON = await insurerIndustryCodBO.getById(req.params.id).catch(function(err) {
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
    const insurerIndustryCodBO = new InsurerIndustryCodBO();
    let error = null;

    // if there is no expirationDate or effectiveDate provided, default them
    if(!req.body.hasOwnProperty("expirationDate")){
        req.body.expirationDate = "2100-01-01";
    }
    if(!req.body.hasOwnProperty("effectiveDate")){
        req.body.effectiveDate = "1980-01-01";
    }

    const objectJSON = await insurerIndustryCodBO.insertMongo(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, objectJSON);
    return next();
}

//update
async function update(req, res, next) {
    log.debug("InsurerIndustryCodBO PUT:  " + JSON.stringify(req.body))
    if (!req.params.id) {
        return next(new Error("no id"));
    }
    if(!req.body){
        return next(new Error("no body"));
    }

    // if there is no expirationDate or effectiveDate provided, default them
    if(!req.body.hasOwnProperty("expirationDate")){
        req.body.expirationDate = "2100-01-01";
    }
    if(!req.body.hasOwnProperty("effectiveDate")){
        req.body.effectiveDate = "1980-01-01";
    }

    const insurerIndustryCodBO = new InsurerIndustryCodBO();
    let error = null;
    const newJSON = await insurerIndustryCodBO.updateMongo(req.params.id, req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, newJSON);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Insurer Industry Code list', `${basePath}/insurer-industry-code-sql`, findAllSql, 'administration', 'all');
    server.addGetAuthAdmin('Get Insurer Industry Code Object', `${basePath}/insurer-industry-code-sql/:id`, findOneSql, 'administration', 'all');
    server.addPostAuthAdmin('Post Insurer Industry Code Object', `${basePath}/insurer-industry-code-sql`, addSql, 'administration', 'all');
    server.addPutAuthAdmin('Put Insurer Industry Code Object', `${basePath}/insurer-industry-code-sql/:id`, updateSql, 'administration', 'all');

    // MONGO
    server.addGetAuthAdmin('Get Insurer Industry Code list', `${basePath}/insurer-industry-code`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Insurer Industry Code Object', `${basePath}/insurer-industry-code/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post Insurer Industry Code Object', `${basePath}/insurer-industry-code`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Insurer Industry Code Object', `${basePath}/insurer-industry-code/:id`, update, 'administration', 'all');
};