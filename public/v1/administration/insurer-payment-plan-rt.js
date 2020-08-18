
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const InsurerPaymentPlanBO = global.requireShared('./models/InsurerPaymentPlan-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const insurerPaymentPlanBO = new InsurerPaymentPlanBO();

    const rows = await insurerPaymentPlanBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('InsurerPaymentPlan not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerPaymentPlanBO = new InsurerPaymentPlanBO();
    // Load the request data into it
    const objectJSON = await insurerPaymentPlanBO.getById(id).catch(function(err) {
        log.error("insurerPaymentPlanBO load error " + err + __location);
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
        return next(serverHelper.notFoundError('InsurerPaymentPlan not found'));
    }

}
//add
async function add(req, res, next) {


    const insurerPaymentPlanBO = new InsurerPaymentPlanBO();
    let error = null;
    await insurerPaymentPlanBO.saveModel(req.body).catch(function(err) {
        log.error("insurerPaymentPlanBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerPaymentPlanBO.cleanJSON());
    return next();

}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const insurerPaymentPlanBO = new InsurerPaymentPlanBO();
    let error = null;
    await insurerPaymentPlanBO.saveModel(req.body).catch(function(err) {
        log.error("insurerPaymentPlanBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, insurerPaymentPlanBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get InsurerPaymentPlan list', `${basePath}/insurer-payment-plan`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get InsurerPaymentPlan Object', `${basePath}/insurer-payment-plan/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post InsurerPaymentPlan Object', `${basePath}/insurer-payment-plan`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put InsurerPaymentPlan Object', `${basePath}/insurer-payment-plan/:id`, update, 'administration', 'all');


    // server.addGet('Get InsurerPaymentPlan list', `${basePath}/insurer-payment-plan`, findAll, 'administration', 'all');
    // server.addGet('Get InsurerPaymentPlan Object', `${basePath}/insurer-payment-plan/:id`, findOne, 'administration', 'all');
    // server.addPost('Post InsurerPaymentPlan Object', `${basePath}/insurer-payment-plan`, add, 'administration', 'all');
    // server.addPut('Put InsurerPaymentPlan Object', `${basePath}/insurer-payment-plan/:id`, update, 'administration', 'all');


};