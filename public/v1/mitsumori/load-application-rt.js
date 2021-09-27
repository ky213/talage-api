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

    const redisResp = await global.redisSvc.getKeyValue(redisKey);
    if(redisResp.found){
        const redisValueJSON = JSON.parse(redisResp.value);
        if(redisValueJSON && redisValueJSON?.applicationId){
            const token = await createApplicationToken(req, redisValueJSON.applicationId);
            res.send(200, {
                token,
                applicationId: redisValueJSON.applicationId
            });
        }
        else {
            log.error(`getApplicationFromHash Could not find Hash redis value for key: ${redisKey}` + __location);
            res.send(404, {error: "Not Found"});
            return next();

        }
    }
    else{
        log.error(`getApplicationFromHash Could not find Hash redis value for key: ${redisKey}` + __location);
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
    server.addPut("Put Hash Load Application", `${basePath}/load-application`, getApplicationFromHash);
}