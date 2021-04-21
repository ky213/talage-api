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
        delete req.query.agencysearch;
        let rows = await agencyLocationBO.getSearchListForAdmin(req.query).catch(function(err) {
            error = err;
        })
        if (error) {
            return next(error);
        }
        if (rows) {
            const propertyToRemove = ["territories",
                "email",
                "agencyPortalModifiedUser",
                "additionalInfo",
                "insurers"]
            for(let agencyLocation of rows){
                //Admin is expecting agencyLocationid as integer
                agencyLocation.agencyLocationid = agencyLocation.mysqlId;
                agencyLocation.state_abbr = agencyLocation.state;

                if(agencyLocation.address){
                    agencyLocation.displayString = `${agencyLocation.name}: ${agencyLocation.address}, ${agencyLocation.city}, ${agencyLocation.state} ${agencyLocation.zipcode}`;
                }
                else if(agencyLocation.zip){
                    agencyLocation.displayString = `${agencyLocation.name}: ${agencyLocation.city}, ${agencyLocation.state} ${agencyLocation.zipcode}`
                }
                else {
                    agencyLocation.displayString = `${agencyLocation.name}: no address`
                }
                for(const removeProp of propertyToRemove){
                    if(agencyLocation[removeProp]){
                        delete agencyLocation[removeProp]
                    }
                }

            }
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
        log.error("agencyLocationBO load error " + err + __location);
        error = err;
    });
    if (error && error.message !== "not found") {
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