/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const TerritoryBO = global.requireShared('./models/Territory-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

//const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const territoryBO = new TerritoryBO();
    const rows = await territoryBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('No Territories not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const territoryBO = new TerritoryBO();
    // Load the request data into it
    const territoryJSON = await territoryBO.getByAbbr(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (territoryJSON) {
        res.send(200, territoryJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Territory not found'));
    }

}

async function add(req, res, next) {

    log.debug("territory post " + JSON.stringify(req.body));
    //TODO Validate
    if(!req.body.abbr){
        return next(serverHelper.requestError("bad missing abbr"));
    }
    if(!req.body.name){
        return next(serverHelper.requestError("bad missing name"));
    }
    const territoryBO = new TerritoryBO();
    let error = null;
    const newRecord = true;
    await territoryBO.saveModel(req.body,newRecord).catch(function(err) {
        log.error("territory save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, territoryBO.cleanJSON());
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
    if(!req.body.abbr){
        return next(serverHelper.requestError("missing abbr"));
    }
    let error = null;
    const updateRecord = false;
    const territoryBO = new TerritoryBO();
    await territoryBO.saveModel(req.body, updateRecord).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, territoryBO);
    return next();

}


exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Territory Outage list', `${basePath}/territory`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Territory Outage  Object', `${basePath}/territory/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Get Territory Outage list', `${basePath}/territory`, add, 'administration', 'all');
    server.addPutAuthAdmin('GET Territory Outage  Object', `${basePath}/territory/:id`, update, 'administration', 'all');

    // server.addGet('Get Territory Outage list', `${basePath}/territory`, findAll, 'administration', 'all');
    // server.addGet('GET Territory Outage  Object', `${basePath}/territory/:id`, findOne, 'administration', 'all');
    // server.addPost('Add Territory Outage', `${basePath}/territory`, add, 'administration', 'all');
    // server.addPut('Update Territory Outage  Object', `${basePath}/territory/:id`, update, 'administration', 'all');

};