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

const ActivityCodeBO = global.requireShared('./models/ActivityCode-BO.js');
const InsurerActivityCodeBO = global.requireShared('./models/InsurerActivityCode-BO.js');
const serverHelper = global.requireRootPath('server.js');
const ActivityCodeSvc = global.requireShared('services/activitycodesvc.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const activityCodeBO = new ActivityCodeBO();
    const insurerActivityCodeBO = new InsurerActivityCodeBO();

    if(req.query.activityCodeId && req.query.activityCodeId.indexOf(",") > -1){
        req.query.activityCodeId = req.query.activityCodeId.split(',')
    }


    if(req.query.unmapped){
        delete req.query.unmapped;
        //get all activityCodes that are activity.
        let acQuery = {};
        const activityCodeList = await activityCodeBO.getList(acQuery).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }

        let notMappedList = [];
        //Build list that have nothing mapped in insurerActivityCodes collection
        let iacQuery = {count: true};
        if(req.query.insurerId){
            try{
                iacQuery.insurerId = parseInt(req.query.insurerId,10);
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.insurerId
        }
        if(req.query.territory){
            try{
                iacQuery.territoryList = req.query.territory;
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.territory
        }
        for(let i = 0; i < activityCodeList.length; i++){
            const activityCodeJSON = activityCodeList[i];
            iacQuery.talageActivityCodeIdList = activityCodeJSON.id
            const respJson = await insurerActivityCodeBO.getList(iacQuery).catch(function(err) {
                log.error("admin insurerActivityCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count === 0){
                notMappedList.push(activityCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        if(notMappedList.length > 0){
            req.query.activityCodeId = notMappedList;
        }
        else {
            log.debug("no unmapped activity codes");
        }
    }
    else if(req.query.multipleMappings){
        delete req.query.multipleMappings;
        //TODO optimize by going just to IAC collection
        //get all activityCodes that are activity.
        let acQuery = {};
        const activityCodeList = await activityCodeBO.getList(acQuery).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        let mappedtoInsurerList = [];
        let iacQuery = {count: true};
        if(req.query.insurerId){
            try{
                iacQuery.insurerId = parseInt(req.query.insurerId,10);
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.insurerId
        }
        if(req.query.territory){
            try{
                iacQuery.territoryList = req.query.territory;
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.territory
        }
        //Build list that have nothing mapped in insurerActivityCodes collection
        for(let i = 0; i < activityCodeList.length; i++){
            const activityCodeJSON = activityCodeList[i];
            iacQuery.talageActivityCodeIdList = activityCodeJSON.id
            const respJson = await insurerActivityCodeBO.getList(iacQuery).catch(function(err) {
                log.error("admin insurerActivityCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count > 1){
                mappedtoInsurerList.push(activityCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        if(mappedtoInsurerList.length > 0){
            req.query.activityCodeId = mappedtoInsurerList;
        }
        else {
            req.query.activityCodeId = -999;
        }
    }
    else if(req.query.insurerId || req.query.territory){
        //TODO optimize by going just to IAC collection
        //get all activityCodes that are activity.
        let acQuery = {};
        const activityCodeList = await activityCodeBO.getList(acQuery).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        let mappedtoInsurerList = [];
        let iacQuery = {count: true};
        if(req.query.insurerId){
            try{
                iacQuery.insurerId = parseInt(req.query.insurerId,10);
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.insurerId
        }
        if(req.query.territory){
            try{
                iacQuery.territoryList = req.query.territory;
            }
            catch(err){
                log.error("bad query");
            }
            delete req.query.territory
        }
        //Build list that have nothing mapped in insurerActivityCodes collection
        for(let i = 0; i < activityCodeList.length; i++){
            const activityCodeJSON = activityCodeList[i];
            iacQuery.talageActivityCodeIdList = activityCodeJSON.id
            const respJson = await insurerActivityCodeBO.getList(iacQuery).catch(function(err) {
                log.error("admin insurerActivityCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count > 0){
                mappedtoInsurerList.push(activityCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        if(mappedtoInsurerList.length > 0){
            req.query.activityCodeId = mappedtoInsurerList;
        }
        else {
            req.query.activityCodeId = -999;
        }
    }

    const rows = await activityCodeBO.getList(req.query).catch(function(err) {
        error = err;
    });
    if (error) {
        return next(error);
    }

    const countQuery = {...req.query, count: true};
    const count = await activityCodeBO.getList(countQuery).catch(function(err) {
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
        return next(serverHelper.notFoundError('activity code not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const activityCodeBO = new ActivityCodeBO();
    // Load the request data into it
    const activityCodeJSON = await activityCodeBO.getById(id).catch(function(err) {
        log.error("activity code load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (activityCodeJSON) {
        res.send(200, activityCodeJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('activity code not found'));
    }
}

async function add(req, res, next) {

    log.debug("activity code post " + JSON.stringify(req.body));
    //TODO Validate
    if(!req.body.description){
        return next(serverHelper.requestError("bad missing description"));
    }
    // TODO: additional validation?
    // // allow hint to be empty string
    // if(!req.body.hint && req.body.hint !== ""){
    //     return next(serverHelper.requestError("bad missing hint"));
    // }
    const activityCodeBO = new ActivityCodeBO();
    let error = null;
    const newRecord = true;
    await activityCodeBO.saveModel(req.body,newRecord).catch(function(err) {
        log.error("activityCode save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, activityCodeBO.mongoDoc);
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
    let error = null;
    const updateRecord = false;
    const activityCodeBO = new ActivityCodeBO();
    await activityCodeBO.saveModel(req.body, updateRecord).catch(function(err) {
        log.error("activityCode load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    //update redis cache.
    ActivityCodeSvc.updateActivityCodeCacheByActivityCode(id);
    res.send(200, activityCodeBO.mongoDoc);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Activity Code list', `${basePath}/activity-code`, findAll, 'TalageMapper', 'all');
    server.addGetAuthAdmin('GET Activity Code Object', `${basePath}/activity-code/:id`, findOne, 'TalageMapper', 'all');
    server.addPostAuthAdmin('POST Activity Code Object', `${basePath}/activity-code`, add, 'TalageMapper', 'all');
    server.addPutAuthAdmin('PUT Activity Code Object', `${basePath}/activity-code/:id`, update, 'TalageMapper', 'all');
};