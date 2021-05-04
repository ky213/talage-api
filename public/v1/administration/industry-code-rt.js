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

const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const InsurerIndustryCodeBO = global.requireShared('./models/InsurerIndustryCode-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

async function findAll(req, res, next) {
    let error = null;
    const industryCodeBO = new IndustryCodeBO();
    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();

    if(req.query.unmapped){
        //get all activityCodes that are activity.
        let icQuery = {state: 1};
        const industryCodeList = await industryCodeBO.getList(icQuery).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        let notMappedList = [];
        //Build list that have nothing mapped in insurerActivityCodes collection
        for(let i = 0; i < industryCodeList.length; i++){
            const industryCodeJSON = industryCodeList[i];
            let iacQuery = {count: true, talageIndustryCodeIdList: industryCodeJSON.id};
            if(req.query.insurerId){
                try{
                    iacQuery.insurerId = parseInt(req.query.insurerId,10);
                }
                catch(err){
                    log.error("bad query");
                }
            }
            //log.debug(JSON.stringify(iacQuery))
            const respJson = await insurerIndustryCodeBO.getList(iacQuery).catch(function(err) {
                log.error("admin insurerIndustryCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count === 0){
                notMappedList.push(industryCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        req.query.state = 1; //we only want active codes.
        if(notMappedList.length > 0){
            req.query.industryCodeId = notMappedList;
        }
    }
    else if(req.query.insurerId){
        //TODO optimize by going just to IAC collection
        //get all activityCodes that are activity.
        let icQuery = {state: 1};
        const industryCodeList = await industryCodeBO.getList(icQuery).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        let mappedtoInsurerList = [];
        //Build list that have nothing mapped in insurerActivityCodes collection
        for(let i = 0; i < industryCodeList.length; i++){
            const industryCodeJSON = industryCodeList[i];
            let iacQuery = {count: true, talageIndustryCodeIdList: industryCodeJSON.id};
            if(req.query.insurerId){
                try{
                    iacQuery.insurerId = parseInt(req.query.insurerId,10);
                }
                catch(err){
                    log.error("bad query");
                }
            }
            const respJson = await insurerIndustryCodeBO.getList(iacQuery).catch(function(err) {
                log.error("admin insurerIndustryCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count > 1){
                mappedtoInsurerList.push(industryCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        req.query.state = 1; //we only want active codes.
        if(mappedtoInsurerList.length > 0){
            req.query.industryCodeId = mappedtoInsurerList;
        }
        else {
            req.query.industryCodeId = -999;
        }
    }
    const rows = await industryCodeBO.getList(req.query).catch(function(err) {
        log.error("admin agencynetwork error: " + err + __location);
        error = err;
    })
    if (error) {
        return next(error);
    }

    const countQuery = {...req.query, count: true};
    const count = await industryCodeBO.getList(countQuery).catch(function(err) {
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
        return next(serverHelper.notFoundError('Industry Code not found'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const industryCodeBO = new IndustryCodeBO();
    // Load the request data into it
    const objectJSON = await industryCodeBO.getById(id).catch(function(err) {
        log.error("industryCodeBO load error " + err + __location);
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
        return next(serverHelper.notFoundError('Industry Code not found'));
    }
}
//add
async function add(req, res, next) {
    const industryCodeBO = new IndustryCodeBO();
    let error = null;
    await industryCodeBO.saveModel(req.body).catch(function(err) {
        log.error("industryCodeBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, industryCodeBO.cleanJSON());
    return next();
}

//update
async function update(req, res, next) {
    log.debug("IndustryCode PUT:  " + JSON.stringify(req.body))
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const industryCodeBO = new IndustryCodeBO();
    let error = null;
    await industryCodeBO.saveModel(req.body).catch(function(err) {
        log.error("industryCodeBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, industryCodeBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Industry Code list', `${basePath}/industry-code`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Industry Code Object', `${basePath}/industry-code/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post Industry Code Object', `${basePath}/industry-code`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Industry Code Object', `${basePath}/industry-code/:id`, update, 'administration', 'all');
};