/* eslint-disable object-shorthand */


"use strict";
const serverHelper = require("../../../server.js");
const tokenSvc = global.requireShared('./services/tokensvc.js');

const getApplicationFromHash = async(req, res, next) => {
    if (!req.body || !req.body.hash) {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }

    const redisKey = req.body.hash;


    // TODO: TEST CODE, REMOVE ME
    // await global.redisSvc.storeKeyValue(redisKey, JSON.stringify({applicationId: "e144c0cb-1daa-49f2-bae1-310cde71e32b"}), 60 * 60 * 60); // 1 hour (for now)


    const redisValue = await global.redisSvc.getKeyValue(redisKey);
    if(redisValue.found){
        const redisJSON = JSON.parse(redisValue.value);
        const token = await createApplicationToken(req, redisJSON.applicationId);
        res.send(200, {
            token,
            applicationId: redisJSON.applicationId
        });
    }
    else{
        log.error(`Could not find redis value for key: ${redisKey}`);
        res.send(404, {error: "Not Found"});
        return next();
    }
}

const createApplicationToken = async(req, appId) => {
    const newToken = await tokenSvc.createApplicationToken(req, appId);
    return newToken;
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addPutAuthQuoteApp("Put Hash Load Application", `${basePath}/load-application`, getApplicationFromHash);
}