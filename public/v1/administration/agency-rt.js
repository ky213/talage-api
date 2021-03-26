
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const AgencyBO = global.requireShared('./models/Agency-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

//const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const getAgencyNetworkName = true;

async function findAll(req, res, next) {
    let error = null;
    const agencyBO = new AgencyBO();

    const noActiveStatusCheck = true;
    const rows = await agencyBO.getList(req.query, getAgencyNetworkName, noActiveStatusCheck).catch(function(err) {
        log.error("admin agency error: " + err + __location);
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
        return next(serverHelper.notFoundError('AgencyBO not found'));
    }


}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyBO = new AgencyBO();
    // Load the request data into it
    const objectJSON = await agencyBO.getById(id, getAgencyNetworkName, false).catch(function(err) {
        log.error("agencyBO load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (objectJSON) {
        res.send(200, objectJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('AgencyBO not found'));
    }

}

// Get an agency, no matter the value of the active column
async function findOneDeleted(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyBO = new AgencyBO();
    // Load the request data into it
    const objectJSON = await agencyBO.getAgencyByMysqlId(id).catch(function(err) {
        log.error("agencyBO load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
        return next(error);
    }
    // Send back a success response
    if (objectJSON) {
        res.send(200, objectJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('AgencyBO not found'));
    }

}
//add
async function add(req, res, next) {


    const agencyBO = new AgencyBO();
    let error = null;
    const agencyJSON = await agencyBO.saveModel(req.body).catch(function(err) {
        log.error("agencyBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, agencyJSON);
    return next();

}


//update
async function update(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const agencyBO = new AgencyBO();
    let error = null;
    const agencyJSON = await agencyBO.saveModel(req.body).catch(function(err) {
        log.error("agencyBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, agencyJSON);
    return next();

}

async function deleteObject(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyBO = new AgencyBO();
    await agencyBO.deleteSoftById(id).catch(function(err) {
        log.error("agencyBO delete error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();
}

async function activateObject(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyBO = new AgencyBO();
    await agencyBO.activateById(id).catch(function(err) {
        log.error("agencyBO activate error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();
}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get Agency list', `${basePath}/agency`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Agency Object', `${basePath}/agency/:id`, findOne, 'administration', 'all');
    server.addGetAuthAdmin('Get Deleted Agency Object', `${basePath}/agency/deleted/:id`, findOneDeleted, 'administration', 'all');
    server.addPostAuthAdmin('Post Agency Object', `${basePath}/agency`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put Agency Object', `${basePath}/agency/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('Delete Agency Object', `${basePath}/agency/:id`, deleteObject, 'administration', 'all');
    server.addPutAuthAdmin('Activate Agency Object', `${basePath}/agency/activate/:id`, activateObject, 'administration', 'all');

};