
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerTerritoryBO = global.requireShared('./models/InsurerTerritory-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const insurerTerritoryBO = new InsurerTerritoryBO();

    const rows = await insurerTerritoryBO.getList(req.query).catch(function(err) {
        log.error("admin insurercontact error: " + err + __location);
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
        return next(serverHelper.notFoundError('InsurerTerritory not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerTerritoryBO = new InsurerTerritoryBO();
    // Load the request data into it
    const objectJSON = await insurerTerritoryBO.getById(id).catch(function(err) {
        log.error("insurerTerritoryBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (objectJSON) {
        res.send(200, objectJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('InsurerTerritory not found'));
    }

}
//add
async function add(req, res, next) {


    const insurerTerritoryBO = new InsurerTerritoryBO();
    let error = null;
    await insurerTerritoryBO.saveModel(req.body).catch(function(err) {
        log.error("insurerTerritoryBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerTerritoryBO.cleanJSON());
    return next();

}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerTerritoryBO = new InsurerTerritoryBO();
    let error = null;
    await insurerTerritoryBO.saveModel(req.body).catch(function(err) {
        log.error("insurerTerritoryBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerTerritoryBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get InsurerTerritory list', `${basePath}/insurer-territory`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get InsurerTerritory Object', `${basePath}/insurer-territory/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post InsurerTerritory Object', `${basePath}/insurer-territory`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put InsurerTerritory Object', `${basePath}/insurer-territory/:id`, update, 'administration', 'all');


    // server.addGet('Get InsurerTerritory list', `${basePath}/insurer-territory`, findAll, 'administration', 'all');
    // server.addGet('Get InsurerTerritory Object', `${basePath}/insurer-territory/:id`, findOne, 'administration', 'all');
    // server.addPost('Post InsurerTerritory Object', `${basePath}/insurer-territory`, add, 'administration', 'all');
    // server.addPut('Put InsurerTerritory Object', `${basePath}/insurer-territory/:id`, update, 'administration', 'all');


};