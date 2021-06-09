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
        delete req.query.unmapped
        log.debug("in unmapped");
        //get all activityCodes that are activity.
        let icQuery = {};
        const industryCodeList = await industryCodeBO.getList(icQuery).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        let notMappedList = [];
        //Build list that have nothing mapped in insurerActivityCodes collection
        let iicQuery = {count: true};
        if(req.query.insurerId){
            try{
                iicQuery.insurerId = parseInt(req.query.insurerId,10);
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.insurerId
        }
        if(req.query.territory){
            try{
                iicQuery.territoryList = req.query.territory;
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.territory
        }
        for(let i = 0; i < industryCodeList.length; i++){
            const industryCodeJSON = industryCodeList[i];
            iicQuery.talageIndustryCodeIdList = industryCodeJSON.id
            //log.debug(JSON.stringify(iacQuery))
            const respJson = await insurerIndustryCodeBO.getList(iicQuery).catch(function(err) {
                log.error("admin insurerIndustryCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count === 0){
                notMappedList.push(industryCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        if(notMappedList.length > 0){
            req.query.industryCodeId = notMappedList;
        }
    }
    else if(req.query.insurerId || req.query.territory){
        //TODO optimize by going just to IAC collection
        //get all activityCodes that are activity.
        const industryCodeList = await industryCodeBO.getList({}).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        let mappedtoInsurerList = [];
        let iicQuery = {count: true};
        if(req.query.insurerId){
            try{
                iicQuery.insurerId = parseInt(req.query.insurerId,10);
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.insurerId
        }
        if(req.query.territory){
            try{
                iicQuery.territoryList = req.query.territory;
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.territory
        }
        //Build list that have nothing mapped in insurerActivityCodes collection
        for(let i = 0; i < industryCodeList.length; i++){
            const industryCodeJSON = industryCodeList[i];
            iicQuery.talageIndustryCodeIdList = industryCodeJSON.id
            const respJson = await insurerIndustryCodeBO.getList(iicQuery).catch(function(err) {
                log.error("admin insurerIndustryCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count > 1){
                mappedtoInsurerList.push(industryCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        if(mappedtoInsurerList.length > 0){
            req.query.industryCodeId = mappedtoInsurerList;
        }
        else {
            req.query.industryCodeId = -999;
        }
    }
    const industryCodeList = await industryCodeBO.getList(req.query).catch(function(err) {
        log.error("admin agencynetwork error: " + err + __location);
        error = err;
    })
    if (error) {
        return next(error);
    }
    industryCodeList.forEach((icDoc) => {
        icDoc.category = icDoc.industryCodeCategoryId;
    });

    const countQuery = {...req.query, count: true};
    const count = await industryCodeBO.getList(countQuery).catch(function(err) {
        error = err;
    });
    if (error) {
        return next(error);
    }

    if (industryCodeList) {
        res.send(200, {rows: industryCodeList, ...count});
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Industry Code not found'));
    }
}

async function findOne(req, res, next) {
    let id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const industryCodeBO = new IndustryCodeBO();
    // Load the request data into it
    const industryCodeDoc = await industryCodeBO.getById(id).catch(function(err) {
        log.error("industryCodeBO load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (industryCodeDoc) {
        industryCodeDoc.category = industryCodeDoc.industryCodeCategoryId;
        res.send(200, industryCodeDoc);
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

    res.send(200, industryCodeBO.mongoDoc);
    return next();
}

//update
async function update(req, res, next) {
    log.debug("IndustryCode PUT:  " + JSON.stringify(req.body))
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    if(req.body.category){
        req.body.industryCodeCategoryId = req.body.category
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

    res.send(200, industryCodeBO.mongoDoc);
    return next();

}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Industry Code list', `${basePath}/industry-code`, findAll, 'TalageMapper', 'all');
    server.addGetAuthAdmin('Get Industry Code Object', `${basePath}/industry-code/:id`, findOne, 'TalageMapper', 'all');
    server.addPostAuthAdmin('Post Industry Code Object', `${basePath}/industry-code`, add, 'TalageMapper', 'all');
    server.addPutAuthAdmin('Put Industry Code Object', `${basePath}/industry-code/:id`, update, 'TalageMapper', 'all');
};