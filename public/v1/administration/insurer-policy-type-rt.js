
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerPolicyTypeBO = global.requireShared('./models/InsurerPolicyType-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const insurerPolicyTypeBO = new InsurerPolicyTypeBO();

    const rows = await insurerPolicyTypeBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('InsurerPolicyType not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
    // Load the request data into it
    const objectJSON = await insurerPolicyTypeBO.getById(id).catch(function(err) {
        log.error("insurerPolicyTypeBO load error " + err + __location);
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
        return next(serverHelper.notFoundError('InsurerPolicyType not found'));
    }

}
//add
async function add(req, res, next) {


    const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
    let error = null;
    await insurerPolicyTypeBO.saveModel(req.body).catch(function(err) {
        log.error("insurerPolicyTypeBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerPolicyTypeBO.cleanJSON());
    return next();

}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerPolicyTypeBO = new InsurerPolicyTypeBO();
    let error = null;
    await insurerPolicyTypeBO.saveModel(req.body).catch(function(err) {
        log.error("insurerPolicyTypeBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerPolicyTypeBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    // server.addGetAuthAdmin('Get InsurerPolicyType list', `${basePath}/insurer-policy-type`, findAll, 'administration', 'all');
    // server.addGetAuthAdmin('Get InsurerPolicyType Object', `${basePath}/insurer-policy-type/:id`, findOne, 'administration', 'all');
    // server.addPostAuthAdmin('Post InsurerPolicyType Object', `${basePath}/insurer-policy-type`, add, 'administration', 'all');
    // server.addPutAuthAdmin('Put InsurerPolicyType Object', `${basePath}/insurer-policy-type/:id`, update, 'administration', 'all');


    server.addGet('Get InsurerPolicyType list', `${basePath}/insurer-policy-type`, findAll, 'administration', 'all');
    server.addGet('Get InsurerPolicyType Object', `${basePath}/insurer-policy-type/:id`, findOne, 'administration', 'all');
    server.addPost('Post InsurerPolicyType Object', `${basePath}/insurer-policy-type`, add, 'administration', 'all');
    server.addPut('Put InsurerPolicyType Object', `${basePath}/insurer-policy-type/:id`, update, 'administration', 'all');


};