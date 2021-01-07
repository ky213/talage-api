
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerBO = global.requireShared('./models/Insurer-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const insurerBO = new InsurerBO();
    if(req.query && req.query.agencysearch){
        delete req.query.agencysearch
    }

    const rows = await insurerBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('Insurer not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerBO = new InsurerBO();
    // Load the request data into it
    const insurerJSON = await insurerBO.getById(id).catch(function(err) {
        log.error("Insurer load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (insurerJSON) {
        res.send(200, insurerJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Insurer not found'));
    }

}
//add
async function add(req, res, next) {


    const insurerBO = new InsurerBO();
    let error = null;
    await insurerBO.saveModel(req.body).catch(function(err) {
        log.error("Insurer load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerBO.cleanJSON());
    return next();

}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerBO = new InsurerBO();
    let error = null;
    await insurerBO.saveModel(req.body).catch(function(err) {
        log.error("Insurer load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerBO.cleanJSON());
    return next();

}

//
// Return Insurer List used for selecting a Insurer
//
// @param {object} req - HTTP request object
// @param {object} res - HTTP response object
// @param {function} next - The next function to execute
//
// @returns {void}
//
async function getSelectionList(req, res, next) {
    //log.debug('getSelectionList: ' + JSON.stringify(req.body))
    let error = false;

    // Initialize an agency object
    const insurerBO = new InsurerBO();

    // Load the request data into it
    const insurerList = await insurerBO.getList({active: true}).catch(function(err) {
        log.error("Insurer load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    res.send(200, insurerList);
    return next();
}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get Insurer list', `${basePath}/insurer`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Insurer Object', `${basePath}/insurer/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post Insurer Object', `${basePath}/insurer`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Insurer Object', `${basePath}/insurer/:id`, update, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer List for Selection', `${basePath}/insurer/selectionlist`, getSelectionList, 'administration', 'all');

    // server.addGet('Get Insurer list', `${basePath}/insurer`, findAll, 'administration', 'all');
    // server.addGet('Get Insurer Object', `${basePath}/insurer/:id`, findOne, 'administration', 'all');
    // server.addPost('Post Insurer Object', `${basePath}/insurer`, add, 'administration', 'all');
    // server.addPut('Put Insurer Object', `${basePath}/insurer/:id`, update, 'administration', 'all');
    // server.addGet('GET Insurer List for Selection', `${basePath}/insurer/selectionlist`, getSelectionList);

};