/* eslint-disable object-shorthand */
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerActivityCodeBO = global.requireShared('./models/InsurerActivityCode-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

// MONGO
async function findAll(req, res, next) {
    let error = null;
    //a little validation on req.query

    if(req.query.insurerId){
        const testInteger = Number(req.query.insurerId);
        if(!Number.isInteger(testInteger)){
            res.send(400,`Bad InsurerId`);
            return next(serverHelper.requestError('Bad InsurerId'));

        }

    }
    if(req.query.talageActivityCodeIdList){
        if(Array.isArray(req.query.talageActivityCodeIdList)){
            for(const talageActivityCodeId of req.query.talageActivityCodeIdList){
                const testInteger = Number(talageActivityCodeId);
                if(!Number.isInteger(testInteger)){
                    res.send(400,`Bad talageActivityCodeIdList`);
                    return next(serverHelper.requestError('Bad talageActivityCodeIdList'));
                }
            }
        }
        else {
            const testInteger = Number(req.query.talageActivityCodeIdList);
            if(!Number.isInteger(testInteger)){
                res.send(400,`Bad talageActivityCodeIdList`);
                return next(serverHelper.requestError('Bad talageActivityCodeIdList'));

            }
        }
    }


    const insurerActivityCodeBO = new InsurerActivityCodeBO();

    const rows = await insurerActivityCodeBO.getList(req.query).catch(function(err) {
        log.error("admin insurerActivityCode error: " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    const countQuery = {...req.query, count: true};
    const count = await insurerActivityCodeBO.getList(countQuery).catch(function(err) {
        log.error("admin insurerActivityCode error: " + err + __location);
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
        return next(serverHelper.notFoundError('Insurer Activity Code not found'));
    }
}

async function findOne(req, res, next) {
    if (!req.params.id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerActivityCodeBO = new InsurerActivityCodeBO();
    // Load the request data into it
    const objectJSON = await insurerActivityCodeBO.getById(req.params.id).catch(function(err) {
        log.error("insurerActivityCodeBO load error " + err + __location);
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
        return next(serverHelper.notFoundError('Insurer Activity Code not found'));
    }
}
//add
async function add(req, res, next) {
    const insurerActivityCodeBO = new InsurerActivityCodeBO();
    let error = null;

    // if there is no expirationDate or effectiveDate provided, default them
    if(!req.body.hasOwnProperty("expirationDate")){
        req.body.expirationDate = "2100-01-01";
    }
    if(!req.body.hasOwnProperty("effectiveDate")){
        req.body.effectiveDate = "1980-01-01";
    }

    const objectJSON = await insurerActivityCodeBO.insertMongo(req.body).catch(function(err) {
        log.error("insurerActivityCodeBO load error " + err + __location);
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
    //log.debug("InsurerActivityCodeBO PUT:  " + JSON.stringify(req.body))
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

    const insurerActivityCodeBO = new InsurerActivityCodeBO();
    let error = null;
    const newJSON = await insurerActivityCodeBO.updateMongo(req.params.id, req.body).catch(function(err) {
        log.error("insurerActivityCodeBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, newJSON);
    return next();
}

exports.registerEndpoint = (server, basePath) => {

    // MONGO
    server.addGetAuthAdmin('Get Insurer Activity Code list', `${basePath}/insurer-activity-code`, findAll, 'TalageMapper', 'all');
    server.addGetAuthAdmin('Get Insurer Activity Code Object', `${basePath}/insurer-activity-code/:id`, findOne, 'TalageMapper', 'all');
    server.addPostAuthAdmin('Post Insurer Activity Code Object', `${basePath}/insurer-activity-code`, add, 'TalageMapper', 'all');
    server.addPutAuthAdmin('Put Insurer Activity Code Object', `${basePath}/insurer-activity-code/:id`, update, 'TalageMapper', 'all');
};