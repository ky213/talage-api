
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const PaymentPlanBO = global.requireShared('./models/PaymentPlan-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const paymentPlanBO = new PaymentPlanBO();

    const rows = await paymentPlanBO.getList(req.query).catch(function(err) {
        log.error("admin paymentPlanBO error: " + err + __location);
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
        return next(serverHelper.notFoundError('PaymentPlan not found'));
    }


}

async function findOne(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const paymentPlanBO = new PaymentPlanBO();
    // Load the request data into it
    const objectJSON = await paymentPlanBO.getById(id).catch(function(err) {
        log.error("paymentPlanBO load error " + err + __location);
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
        return next(serverHelper.notFoundError('PaymentPlan not found'));
    }

}
//add
async function add(req, res, next) {


    const paymentPlanBO = new PaymentPlanBO();
    let error = null;
    await paymentPlanBO.saveModel(req.body).catch(function(err) {
        log.error("paymentPlanBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, paymentPlanBO.cleanJSON());
    return next();

}


//update
async function update(req, res, next) {
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    const paymentPlanBO = new PaymentPlanBO();
    let error = null;
    await paymentPlanBO.saveModel(req.body).catch(function(err) {
        log.error("paymentPlanBO save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, paymentPlanBO.cleanJSON());
    return next();

}

exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get PaymentPlan list', `${basePath}/payment-plan`, findAll, 'administration', 'all');
    server.addGetAuthAdmin('Get PaymentPlan Object', `${basePath}/payment-plan/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('Post PaymentPlan Object', `${basePath}/payment-plan`, add, 'administration', 'all');
    server.addPutAuthAdmin('Put PaymentPlan Object', `${basePath}/payment-plan/:id`, update, 'administration', 'all');


    // server.addGet('Get PaymentPlan list', `${basePath}/payment-plan`, findAll, 'administration', 'all');
    // server.addGet('Get PaymentPlan Object', `${basePath}/payment-plan/:id`, findOne, 'administration', 'all');
    // server.addPost('Post PaymentPlan Object', `${basePath}/payment-plan`, add, 'administration', 'all');
    // server.addPut('Put PaymentPlan Object', `${basePath}/payment-plan/:id`, update, 'administration', 'all');


};