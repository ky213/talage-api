/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
//const moment = require("moment")

async function findAll(req, res, next) {
    let error = null;
    const agencyLocationBO = new AgencyLocationBO();
    if(req.query.agencysearch === "1"){
        const rows = await agencyLocationBO.getSearchListForAdmin(req.query).catch(function(err) {
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
    else {
        res.send(400,{"error": "Invalid parameters"});
        return next(serverHelper.notFoundError('Invalid parameters'));
    }
}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyLocationBO = new AgencyLocationBO();
    // Load the request data into it
    const agencyLocationJSON = await agencyLocationBO.getById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (agencyLocationJSON) {
        res.send(200, agencyLocationJSON);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Location not found'));
    }

}


exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('Get Agency Location list', `${basePath}/agency-location`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get Agency Location Object', `${basePath}/agency-location/:id`, findOne, 'administration', 'all');

    // server.addGet('Get Agency Location list', `${basePath}/agency-location`, findAll, 'administration', 'all');
    // server.addGet('Get Agency Location Object', `${basePath}/agency-location/:id`, findOne, 'administration', 'all');

};