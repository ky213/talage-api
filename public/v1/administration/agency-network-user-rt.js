/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const AgencyPortalUserBO = global.requireShared('./models/AgencyPortalUser-BO.js');
const crypt = global.requireShared('./services/crypt.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")


async function findAll(req, res, next) {

    let error = null;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const rows = await agencyPortalUserBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('Agency Location not found'));
    }
}

async function findGroupAll(req, res, next) {

    let error = null;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const rows = await agencyPortalUserBO.getGroupList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('Agency Location not found'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    // Load the request data into it
    const userJSON = await agencyPortalUserBO.getById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (userJSON) {
        res.send(200, userJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Location not found'));
    }

}

async function add(req, res, next) {

    if (req.body.agencynetworkid) {
        req.body.agency_network = req.body.agencynetworkid;
        delete req.body.agencynetworkid
    }
    else {
        return next(serverHelper.requestError('Missing agencynetworkid'))
    }

    if (req.body.password) {
        //process hashing
        req.body.password = await crypt.hashPassword(req.body.password);

    }
    else {
        return next(serverHelper.requestError('Missing password'))
    }

    if (req.body.email) {
        //validate email
    }
    else {
        return next(serverHelper.requestError('Missing email'))
    }
    if (req.body.group) {
        //validate group
    }
    else {
        return next(serverHelper.requestError('Missing group'))
    }

    const allowedPropsInsert = ['password',
        'email',
        'group',
        'reset_required',
        'timezone',
        "agency_network"]
    let insertJSON = {state: 1}
    let needToUpdate = false;
    for(let i = 0; i < allowedPropsInsert.length; i++) {
        if(req.body[allowedPropsInsert[i]]){
            insertJSON[allowedPropsInsert[i]] = req.body[allowedPropsInsert[i]];
            needToUpdate = true
        }
    }
    if(needToUpdate){
        const agencyPortalUserBO = new AgencyPortalUserBO();
        let error = null;
        await agencyPortalUserBO.saveModel(insertJSON).catch(function(err) {
            log.error("Location load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }

        let cleanJSON = agencyPortalUserBO.cleanJSON();
        agencyPortalUserBO.cleanOuput(cleanJSON)
        res.send(200, cleanJSON);
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
    const allowedPropsUpdate = ['password',
        'email',
        'group',
        'require_set',
        'reset_required',
        'timezone']
    let updateJSON = {id: id}
    let needToUpdate = false;
    for(let i = 0; i < allowedPropsUpdate.length; i++) {
        if(req.body[allowedPropsUpdate[i]]){
            updateJSON[allowedPropsUpdate[i]] = req.body[allowedPropsUpdate[i]];
            needToUpdate = true
        }
    }

    if(needToUpdate){
        const agencyPortalUserBO = new AgencyPortalUserBO();
        let error = null;
        await agencyPortalUserBO.saveModel(updateJSON).catch(function(err) {
            log.error("Location load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        let cleanJSON = agencyPortalUserBO.cleanJSON();
        agencyPortalUserBO.cleanOuput(cleanJSON)
        res.send(200, cleanJSON);
        return next();
    }
    else {
        return next(serverHelper.requestError('Missing updatable property'))
    }


}


async function deleteObject(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyPortalUserBO = new AgencyPortalUserBO();
    await agencyPortalUserBO.deleteSoftById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();

}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('Get Agency Network Users list', `${basePath}/agency-network-user`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Agency Network User  Object', `${basePath}/agency-network-user/:id`, findOne, 'administration', 'all');
    server.addPutAuthAdmin('PUT Agency Network User', `${basePath}/agency-network-user/:id`, update, 'administration', 'all');
    server.addPostAuthAdmin('POST Agency Network User', `${basePath}/agency-network-user`, add, 'administration', 'all');
    server.addDeleteAuthAdmin('Delete Agency Network User', `${basePath}/agency-network-user/:id`, deleteObject, 'administration', 'all');
    server.addGetAuthAdmin('Get Agency Network User Groups list', `${basePath}/agency-network-user/groups`, findGroupAll, 'administration', 'all');

};