
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const AgencyEmailBO = global.requireShared('./models/AgencyEmail-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
var AgencyEmail = require('mongoose').model('AgencyEmail');
//const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

async function findAll(req, res, next) {
    let error = null;
    const agencyEmailBO = new AgencyEmailBO();

    const rows = await agencyEmailBO.getList(req.query).catch(function(err) {
        log.error("admin agencyEmailBO error: " + err + __location);
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
        return next(serverHelper.notFoundError('AgencyEmailBO not found'));
    }


}

async function findOne(req, res, next) {
    const id = req.params.id;
    //TODO check it is a uuid.
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const agencyEmailBO = new AgencyEmailBO();
    // Load the request data into it
    const objectJSON = await agencyEmailBO.getById(id).catch(function(err) {
        log.error("agencyEmailBO load error " + err + __location);
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
        const blankCustomeEmails = {
            "agencyMySqlId": id,
            "abandoned_applications_customer": {
                "message": "",
                "subject": ""
            },
            "abandoned_quotes_agency": {
                "message": "",
                "subject": ""
            },
            "abandoned_quotes_customer": {
                "message": "",
                "subject": ""
            },
            "daily_digest": {
                "message": "",
                "subject": ""
            },
            "onboarding": {
                "message": "",
                "subject": ""
            },
            "new_agency_user": {
                "message": "",
                "subject": ""
            },
            "new_agency_network_user": {
                "message": "",
                "subject": ""
            },
            "no_quotes_agency": {
                "message": "",
                "subject": ""
            },
            "no_quotes_customer": {
                "message": "",
                "subject": ""
            },
            "policy_purchase_agency": {
                "message": "",
                "subject": ""
            },
            "policy_purchase_customer": {
                "message": "",
                "subject": ""
            },
            "talage_wholesale": {
                "message": "",
                "subject": ""
            }
        }
        res.send(200,blankCustomeEmails);
        return next();
        //return next(serverHelper.notFoundError('AgencyEmailBO not found'));
    }

}
//add
async function add(req, res, next) {

    log.debug("EmailAgency POST " + JSON.stringify(req.body));
    const agencyEmailBO = new AgencyEmailBO();
    let error = null;
    const agencyEmailJSON = await agencyEmailBO.saveModel(req.body).catch(function(err) {
        log.error("agencyEmailBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, agencyEmailJSON);
    return next();

}


//update
async function update(req, res, next) {
    log.debug("EmailAgency PUT " + JSON.stringify(req.body));
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const agencyEmailBO = new AgencyEmailBO();
    let error = null;
    const agencyEmailJSON = await agencyEmailBO.saveModel(req.body).catch(function(err) {
        log.error("agencyEmailBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, agencyEmailJSON);
    return next();

}

// async function deleteObject(req, res, next) {
//     const id = req.params.id;
//     if (!id) {
//         return next(new Error("bad parameter"));
//     }
//     let error = null;
//     const agencyEmailBO = new AgencyEmailBO();
//     await agencyEmailBO.deleteSoftById(id).catch(function(err) {
//         log.error("agencyEmailBO delete error " + err + __location);
//         error = err;
//     });
//     if (error) {
//         return next(error);
//     }
//     res.send(200, {"success": true});
//     return next();

// }

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get AgencyEmail list', `${basePath}/agencyemail`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get AgencyEmail Object', `${basePath}/agencyemail/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post AgencyEmail Object', `${basePath}/agencyemail`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put AgencyEmail Object', `${basePath}/agencyemail/:id`, update, 'administration', 'all');
    // server.addDeleteAuthAdmin('Delete AgencyEmail  Object', `${basePath}/agencyemail/:id`, deleteObject, 'administration', 'all');

};