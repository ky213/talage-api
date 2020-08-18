
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerContactBO = global.requireShared('./models/InsurerContact-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const insurerContactBO = new InsurerContactBO();

    const rows = await insurerContactBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('InsurerContact not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerContactBO = new InsurerContactBO();
    // Load the request data into it
    const objectJSON = await insurerContactBO.getById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
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
        return next(serverHelper.notFoundError('InsurerContact not found'));
    }

}
//add
async function add(req, res, next) {


    const insurerContactBO = new InsurerContactBO();
    let error = null;
    await insurerContactBO.saveModel(req.body).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerContactBO.cleanJSON());
    return next();

}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerContactBO = new InsurerContactBO();
    let error = null;
    await insurerContactBO.saveModel(req.body).catch(function(err) {
        log.error("insurerContactBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerContactBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    // server.addGetAuthAdmin('Get InsurerContact list', `${basePath}/insurer-contact`, findAll, 'administration', 'all');
    // server.addGetAuthAdmin('Get InsurerContact Object', `${basePath}/insurer-contact/:id`, findOne, 'administration', 'all');
    // server.addPostAuthAdmin('Post InsurerContact Object', `${basePath}/insurer-contact`, add, 'administration', 'all');
    // server.addPutAuthAdmin('Put InsurerContact Object', `${basePath}/insurer-contact/:id`, update, 'administration', 'all');


    server.addGet('Get InsurerContact list', `${basePath}/insurer-contact`, findAll, 'administration', 'all');
    server.addGet('Get InsurerContact Object', `${basePath}/insurer-contact/:id`, findOne, 'administration', 'all');
    server.addPost('Post InsurerContact Object', `${basePath}/insurer-contact`, add, 'administration', 'all');
    server.addPut('Put InsurerContact Object', `${basePath}/insurer-contact/:id`, update, 'administration', 'all');


};