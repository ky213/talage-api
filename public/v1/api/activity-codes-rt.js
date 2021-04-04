/**
 * Gets all activity codes
 */

'use strict';

const util = require('util');
const wrap = global.requireShared('helpers/wrap.js');
const ActivityCodeSvc = global.requireShared('services/activitycodesvc.js');

/**
 * Responds to post requests for all activity codes related to a given territory
 *
 * @param {object} req - Expects {territory: 'NV', industry_code: 2880}
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an array of objects containing activity codes [{"id": 2866}]
 */
const GetActivityCodes = wrap(async(req, res, next) => {
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: You must supply an industry code and territory' + __location);
        res.send(400, {
            message: 'You must supply an industry code and territory',
            status: 'error'
        });
        return next();
    }

    log.verbose(util.inspect(req.query));

    // Validate the parameters
    if (!req.query.industry_code) {
        log.info('Bad Request: You must supply an industry code');
        res.send(400, {
            message: 'You must supply an industry code',
            status: 'error'
        });
        return next();
    }
    if (!req.query.territory) {
        log.info('Bad Request: You must supply a territory');
        res.send(400, {
            message: 'You must supply a territory',
            status: 'error'
        });
        return next();
    }

    const territory = req.query.territory;
    const industry_code = parseInt(req.query.industry_code, 10);
    // Get activity codes by territory, filtered by industry code
    let error = null;
    const codes = await ActivityCodeSvc.GetActivityCodes(territory,industry_code).catch((err) => {
        log.error(err + __location);
        error = err;
    });
    if(error){
        res.send(500, {
            message: 'Internal Server Error',
            status: 'error'
        });
        return next(false);
    }

    if (codes && codes.length) {
        res.send(200, codes);
        return next();
    }
    log.info('No Codes Available');
    res.send(404, {
        message: 'No Codes Available',
        status: 'error'
    });
    return next(false);
});

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppApi('Get Activity Codes', `${basePath}/activity-codes`, GetActivityCodes);
};