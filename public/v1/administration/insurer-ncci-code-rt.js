/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerNcciCodeBO = global.requireShared('./models/InsurerNcciCode-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    const insurerNcciCodeBO = new InsurerNcciCodeBO();
    const rows = await insurerNcciCodeBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('insurer ncci code not found'));
    }
}

async function findOne(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(serverHelper.requestError("bad parameter"));
    }
    let error = null;
    const insurerNcciCodeBO = new InsurerNcciCodeBO();
    // Load the request data into it
    const activityCodeJSON = await insurerNcciCodeBO.getById(id).catch(function(err) {
        log.error("insurer ncci code load error " + err + __location);
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
        return next(serverHelper.notFoundError('insurer ncci code not found'));
    }
}

// async function add(req, res, next) {

//     log.debug("insurer ncci code code post " + JSON.stringify(req.body));
//     //TODO Validate
//     if(!req.body.description){
//         return next(serverHelper.requestError("bad missing description"));
//     }
//     // TODO: additional validation?
//     // // allow hint to be empty string
//     // if(!req.body.hint && req.body.hint !== ""){
//     //     return next(serverHelper.requestError("bad missing hint"));
//     // }
//     const insurerNcciCodeBO = new InsurerNcciCodeBO();
//     let error = null;
//     const newRecord = true;
//     await insurerNcciCodeBO.saveModel(req.body,newRecord).catch(function(err) {
//         log.error("InsurerNcciCodeBO save error " + err + __location);
//         error = err;
//     });
//     if (error) {
//         return next(error);
//     }

//     res.send(200, insurerNcciCodeBO.cleanJSON());
//     return next();
// }

// async function update(req, res, next) {
//     const id = req.params.id;
//     if (!id) {
//         return next(serverHelper.requestError("bad parameter"));
//     }
//     if(!req.body){
//         return next(serverHelper.requestError("bad put"));
//     }
//     let error = null;
//     const updateRecord = false;
//     const insurerNcciCodeBO = new InsurerNcciCodeBO();
//     await insurerNcciCodeBO.saveModel(req.body, updateRecord).catch(function(err) {
//         log.error("InsurerNcciCodeBO load error " + err + __location);
//         error = err;
//     });
//     if (error) {
//         return next(error);
//     }
//     res.send(200, insurerNcciCodeBO);
//     return next();
// }

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Insurer Ncci Code list', `${basePath}/insurer-ncci-code`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('GET Insurer Ncci Code Object', `${basePath}/insurer-ncci-code/:id`, findOne, 'administration', 'all');
    // server.addPostAuthAdmin('POST Insurer Ncci Code Object', `${basePath}/insurer-ncci-codee`, add, 'administration', 'all');
    // server.addPutAuthAdmin('PUT Insurer Ncci Code Object', `${basePath}/insurer-ncci-code/:id`, update, 'administration', 'all');
};