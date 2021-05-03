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
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const activityCodeBO = new ActivityCodeBO();
    const insurerActivityCodeBO = new InsurerActivityCodeBO();

    if(req.query.unmapped){
        //get all activityCodes that are activity.
        let acQuery = {state: 1}
        const activityCodeList = await activityCodeBO.getList(acQuery).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        let notMappedList = [];
        //Build list that have nothing mapped in insurerActivityCodes collection
        for(let i = 0; i < activityCodeList.length; i++){
            const activityCodeJSON = activityCodeList[i];
            let iacQuery = {countOnly: true, talageActivityCodeIdList: activityCodeJSON.id}
            if(req.query.insurerId){
                try{
                    iacQuery.insurerId = parseInt(req.query.insurerId,10);
                }
                catch(err){
                    log.error("bad query")
                }
            }
            //log.debug(JSON.stringify(iacQuery))
            const respJson = await insurerActivityCodeBO.getList(iacQuery).catch(function(err) {
                log.error("admin insurerActivityCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count === 0){
                notMappedList.push(activityCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        req.query.state = 1 //we only want active codes.
        if(notMappedList.length > 0){
            req.query.activityCodeId = notMappedList
        }
        else {
            log.debug("no unmapped activity codes")
        }
    }
    else if(req.query.insurerId){
        //TODO optimize by going just to IAC collection
        //get all activityCodes that are activity.
        let acQuery = {state: 1}
        const activityCodeList = await activityCodeBO.getList(acQuery).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        let mappedtoInsurerList = [];
        //Build list that have nothing mapped in insurerActivityCodes collection
        for(let i = 0; i < activityCodeList.length; i++){
            const activityCodeJSON = activityCodeList[i];
            let iacQuery = {countOnly: true, talageActivityCodeIdList: activityCodeJSON.id}
            if(req.query.insurerId){
                try{
                    iacQuery.insurerId = parseInt(req.query.insurerId,10);
                }
                catch(err){
                    log.error("bad query")
                }
            }
            const respJson = await insurerActivityCodeBO.getList(iacQuery).catch(function(err) {
                log.error("admin insurerActivityCodeBO error: " + err + __location);
                error = err;
            });

            if(respJson.count > 1){
                mappedtoInsurerList.push(activityCodeJSON.id);
            }
        }
        //filter user query on the notMappedList.
        req.query.state = 1 //we only want active codes.
        if(mappedtoInsurerList.length > 0){
            req.query.activityCodeId = mappedtoInsurerList
        }
        else {
            log.debug("no unmapped activity codes")
        }

    }

    const rows = await activityCodeBO.getList(req.query).catch(function(err) {
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

    res.send(200, activityCodeBO.cleanJSON());
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
    res.send(200, activityCodeBO);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Activity Code list', `${basePath}/activity-code`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Activity Code Object', `${basePath}/activity-code/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Activity Code Object', `${basePath}/activity-code`, add, 'administration', 'all');
    server.addPutAuthAdmin('PUT Activity Code Object', `${basePath}/activity-code/:id`, update, 'administration', 'all');
};