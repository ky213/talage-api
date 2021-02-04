/* eslint-disable space-before-function-paren */
/* eslint-disable brace-style */
/* eslint-disable object-curly-spacing */
/* eslint-disable multiline-ternary */
/* eslint-disable array-element-newline */
/* eslint-disable prefer-const */
/**
 * Handles all tasks related to agency data
 */

"use strict";
const serverHelper = global.requireRootPath('server.js');


const ttlSeconds = 3600;

/**
 * Responds to get requests for an Quote app V2 authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function putApplicationMeta(req, res, next) {
    if(Object.keys(req.params).length === 0){
        log.error(`No Metadata provided for Application ${__location}`);
        // TODO: maybe return a 200, and do nothing
        res.send(400, { error: "No Metadata provided" });
        return next();
    }

    const redisKey = req.header('authorization').replace("Bearer ", "");
    const redisValue = await global.redisSvc.getKeyValue(redisKey);

    if(redisValue.found){
        const redisJSON = JSON.parse(redisValue.value);

        Object.keys(req.params).forEach(async key => {
            redisJSON[key] = req.params[key];
        });

        const redisSetResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(redisJSON), ttlSeconds);

        if(!redisSetResponse.saved){
            log.error(`Failed to save for redis key: ${redisKey}`);
            res.send(400, { error: "Failed to save values" });
            return next();
        }
    }else{
        log.error(`Could not find redis value for key: ${redisKey}`);
        res.send(404, { error: "Not Found" });
        return next();
    }

    res.send(200, { status: 'Ok' });
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    // TODO: this should be secured behind auth token redis check
    server.addPut('Get Token', `${basePath}/application/meta`, putApplicationMeta);
};