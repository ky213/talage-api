
/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const PolicyTypeBO = global.requireShared('./models/PolicyType-BO.js');

const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

//const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


async function findAll(req, res, next) {
    let error = null;
    const policyTypeBO = new PolicyTypeBO();

    const rows = await policyTypeBO.getList(req.query).catch(function(err) {
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
        return next(serverHelper.notFoundError('PolicyType not found'));
    }


}


exports.registerEndpoint = (server, basePath) => {

    //server.addGetAuthAdmin('Get PolicyType list', `${basePath}/policy-type`, findAll, 'administration', 'all');


    server.addGet('Get PolicyType list', `${basePath}/policy-type`, findAll, 'administration', 'all');


};