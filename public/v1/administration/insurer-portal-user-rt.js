/* eslint-disable no-loop-func */
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerPortalUserBO = global.requireShared('./models/InsurerPortalUser-BO.js');
const crypt = global.requireShared('./services/crypt.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

async function findAll(req, res, next) {
    log.debug(`Admin users find all ${JSON.stringify(req.query)}`)
    let error = null;

    const insurerPortalUserBO = new InsurerPortalUserBO();
    const rows = await insurerPortalUserBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('Insurer Portal Users not found'));
    }
}

async function findGroupAll(req, res, next) {

    let error = null;
    const insurerPortalUserBO = new InsurerPortalUserBO();
    const rows = await insurerPortalUserBO.getGroupList().catch(function(err) {
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
        return next(serverHelper.notFoundError('Insurer Portal not found'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerPortalUserBO = new InsurerPortalUserBO();
    // Load the request data into it
    const userJSON = await insurerPortalUserBO.getById(id).catch(function(err) {
        log.error("insurerPortalUserBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if(userJSON.password){
        delete userJSON.password
    }
    // Send back a success response
    if (userJSON) {
        res.send(200, userJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Insurer Location not found'));
    }

}

async function add(req, res, next) {

    if (!req.body.insurerId) {
        return next(serverHelper.requestError('Missing insurerId'));
    }
    if (!req.body.email) {
        return next(serverHelper.requestError('Missing email'))
    }
    if (!req.body.group) {
        return next(serverHelper.requestError('Missing group'))
    }
    if (req.body.password) {
        req.body.password = await crypt.hashPassword(req.body.password);
    }
    else {
        return next(serverHelper.requestError('Missing password'));
    }

    const allowedPropsInsert = [
        'password',
        'email',
        'insurerPortalUserGroupId',
        'resetRequired',
        'timezone',
        'insurerId'
    ];
    let insertJSON = {state: 1}
    let needToUpdate = false;
    for(let i = 0; i < allowedPropsInsert.length; i++) {
        if(req.body[allowedPropsInsert[i]]){
            insertJSON[allowedPropsInsert[i]] = req.body[allowedPropsInsert[i]];
            needToUpdate = true
        }
    }

    if(needToUpdate){
        const insurerPortalUserBO = new InsurerPortalUserBO();
        let error = null;
        await insurerPortalUserBO.saveModel(insertJSON).catch(function(err) {
            log.error("insurerPortalUserBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }

        const userJSON = await insurerPortalUserBO.getById(insurerPortalUserBO.id).catch(function(err) {
            log.error("insurerPortalUserBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        if(userJSON.password){
            delete userJSON.password
        }

        res.send(200, userJSON);
        return next();
    }
    else{
        return next(serverHelper.requestError('Missing creation properties'))
    }

}


async function update(req, res, next) {

    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    if (req.body.password) {
        //process hashing
        req.body.password = await crypt.hashPassword(req.body.password);
    }
    const allowedPropsUpdate = [
        'password',
        'email',
        'insurerPortalUserGroupId',
        'requireSet',
        'resetRequired',
        'canSign',
        'timezone'
    ];
    let updateJSON = {id: id}
    let needToUpdate = false;
    for(let i = 0; i < allowedPropsUpdate.length; i++) {
        let value = req.body[allowedPropsUpdate[i]]
        if(value || value === '' || value === 0){
            updateJSON[allowedPropsUpdate[i]] = req.body[allowedPropsUpdate[i]];
            needToUpdate = true;
        }
    }

    if(needToUpdate){
        if(updateJSON.email){
            updateJSON.clear_email = req.body.email;
        }
        const insurerPortalUserBO = new InsurerPortalUserBO();
        let error = null;
        await insurerPortalUserBO.saveModel(updateJSON).catch(function(err) {
            log.error("insurerPortalUserBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        const userJSON = await insurerPortalUserBO.getById(id).catch(function(err) {
            log.error("insurerPortalUserBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }

        if(userJSON.password){
            delete userJSON.password
        }

        res.send(200, userJSON);
        return next();
    }
    else {
        return next(serverHelper.requestError('Missing updatable property'));
    }


}


async function deleteUser(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerPortalUserBO = new InsurerPortalUserBO();
    await insurerPortalUserBO.deleteSoftById(id).catch(function(err) {
        log.error("insurerPortalUserBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();

}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('Get Agency Network Users list', `${basePath}/insurer-portal/users`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Agency Network User  Object', `${basePath}/insurer-portal/user/:id`, findOne, 'administration', 'all');
    server.addGetAuthAdmin('Get Agency Network User Groups list', `${basePath}/insurer-portal/user-groups`, findGroupAll, 'administration', 'all');
    server.addPutAuthAdmin('PUT Agency Network User', `${basePath}/insurer-portal/user/:id`, update, 'administration', 'all');
    server.addPostAuthAdmin('POST Agency Network User', `${basePath}/insurer-portal/user`, add, 'administration', 'all');
    server.addDeleteAuthAdmin('Delete Agency Network User', `${basePath}/insurer-portal/user/:id`, deleteUser, 'administration', 'all');
};