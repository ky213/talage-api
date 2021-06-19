
/* eslint-disable require-jsdoc */
'use strict';


async function findAll(req, res, next) {

    const PaymentPlanSvc = global.requireShared('services/paymentplansvc.js');
    const paymentPlanList = PaymentPlanSvc.getList();
    res.send(200, paymentPlanList);
    return next();
}


exports.registerEndpoint = (server, basePath) => {

    server.addGetAuthAdmin('Get PaymentPlan list', `${basePath}/payment-plan`, findAll, 'administration', 'all');
};