// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const {'v4': uuidv4} = require('uuid');
const moment = require('moment');

// 1 hour
const ttlSeconds = 3600;
// 30 minutes - 2 entries max
const refreshThresholdSeconds = 1300;

/**
 * Create new JWT with a redis entry under that key
 *
 * @param {object} payload - Payload data to be signed with the jwt
 * @param {object} additionalPayload - Payload data to be added after the signing of the jwt
 *
 * @returns {object} userJwt - Returns the raw jwt
 */
exports.createNewToken = async function(payload, additionalPayload) {
    let jwtPayload = null;

    try{
        if(typeof payload === 'object'){
            jwtPayload = JSON.parse(JSON.stringify(payload));
        }
        else if(typeof payload === 'string'){
            jwtPayload = JSON.parse(payload);
        }
    }
    catch(err){
        log.error(`createNewToken error copying payload ${err}` + __location);
    }
    if(!jwtPayload){
        jwtPayload = {};
    }

    jwtPayload.ranValue1 = uuidv4().toString();
    jwtPayload.createdAt = moment();

    // Generate and return a token
    const jwt = require('jsonwebtoken');
    const userJwt = jwt.sign(jwtPayload, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'});

    let redisPayload = null;

    try{
        redisPayload = JSON.parse(JSON.stringify(jwtPayload));
    }
    catch(err){
        log.error(`createNewToken error copying jwtPayload ${err}` + __location);
    }
    if(!redisPayload){
        redisPayload = jwtPayload
    }
    else{
        //For Refreshing token. Next to know exactly what was the JWT payload.
        redisPayload.jwtPayload = jwtPayload;
    }
    // add the additional payload after generating the token
    try{
        if(additionalPayload){
            redisPayload = Object.assign(additionalPayload, redisPayload);
            if(!redisPayload.jwtPayload){
                log.error(`Error Missing  redisPayload.jwtPayload ${JSON.stringify(redisPayload)}` + __location);
                //redisPayload.jwtPayload = jwtPayload;
            }
        }
    }
    catch(err){
        log.error("Error adding additionalPayload to Redis JWT " + err + __location);
    }


    try{
        const redisResponse = await global.redisSvc.storeKeyValue(userJwt, JSON.stringify(redisPayload), ttlSeconds);
        if(redisResponse && redisResponse.saved){
            log.debug("Saved JWT to Redis " + __location);
        }
    }
    catch(err){
        log.error("Error save JWT to Redis JWT " + err + __location);
    }

    return userJwt;
}

/**
 * Create new JWT with ApplicationId added to payload.
 *
 * @param {object} req - Request object
 * @param {uuid} applicationId - new ApplicationId
 *
 * @returns {object} res - Returns an authorization token
 */
exports.createApplicationToken = async function(req, applicationId) {
    if(!req.userTokenData){
        req.userTokenData = {};
    }
    const payload = req.userTokenData;
    payload.apiToken = true;
    payload.quoteApp = true;
    payload.applicationId = applicationId;
    const rawJwt = await this.createNewToken(payload);
    const token = `Bearer ${rawJwt}`;

    return token;
}

/**
 * Create new JWT with ApplicationId added to payload.
 *
 * @param {object} req - Request object
 * @param {uuid} applicationId - new ApplicationId
 *
 * @returns {Boolean} true
 */
exports.addApplicationToToken = async function(req, applicationId) {
    // eslint-disable-next-line prefer-const
    // get existing redis value

    if(req.jwtToken){
        let userTokenData = {};
        try{
            const redisResponse = await global.redisSvc.getKeyValue(req.jwtToken);
            if(redisResponse && redisResponse.found && redisResponse.value){
                userTokenData = JSON.parse(redisResponse.value);
            }
        }
        catch(err){
            log.error("Checking validateAppApiJWT JWT " + err + __location);
        }
        if(userTokenData){
            if(!userTokenData.applications){
                userTokenData.applications = [];
            }
            // eslint-disable-next-line prefer-const
            userTokenData.applications.push(applicationId);
            userTokenData.updatedAt = moment();
            try{
                const redisResponse = await global.redisSvc.storeKeyValue(req.jwtToken, JSON.stringify(userTokenData), ttlSeconds);
                if(redisResponse && redisResponse.saved){
                    log.debug("Update Redis JWT for new application " + __location);
                }
            }
            catch(err){
                log.error("Error updating Redis JWT for new application" + err + __location);
            }
        }
        else{
            log.error("Missing Redis userTokenData " + __location);
        }
    }
    else {
        log.error("Missing req.jwtToken " + __location);
    }

    return true;
}

/**
 * Copy the redis data and create a new access token (key)
 *
 * @param {object} req - The request to extract the token from
 *
 * @returns {object} - Returns an authorization token
 */
exports.refreshToken = async function(req) {

    const redisResponse = await global.redisSvc.getKeyValue(req.jwtToken);
    if(redisResponse && redisResponse.found && redisResponse.value){
        //TODO  Leaks info into JWT.
        let redisData = null
        try{
            redisData = JSON.parse(redisResponse.value);
        }
        catch(err){
            log.error(`refreshToken error parseing redis jwt ${err}` + __location);
        }
        if(!redisData){
            return null;
        }
        const userTokenData = redisData.jwtPayload
        if(userTokenData){
            const duration = moment.duration(moment().diff(moment(userTokenData.createdAt)));
            const seconds = duration.asSeconds();

            // check created date and make sure we exceed the threshold
            if(seconds > refreshThresholdSeconds){
                // TODO: the optional data needs to be separated from the token data, for now use all the data to generate the token
                const userToken = await this.createNewToken(userTokenData, redisData);
                return `Bearer ${userToken}`;
            }
            else {
                log.debug(`Skipping refreshToken to do refreshThresholdSeconds ${refreshThresholdSeconds}` + __location)
            }
        }
        else if(redisData?.createdAt){
            const duration = moment.duration(moment().diff(moment(redisData.createdAt)));
            const seconds = duration.asSeconds();

            // check created date and make sure we exceed the threshold
            if(seconds > refreshThresholdSeconds){
                // TODO: the optional data needs to be separated from the token data, for now use all the data to generate the token
                const userToken = await this.createNewToken(userTokenData, redisData);
                return `Bearer ${userToken}`;
            }
            else {
                log.debug(`Skipping refreshToken to do refreshThresholdSeconds ${refreshThresholdSeconds}` + __location)
            }

        }
        else {
            log.error(`refreshToken missing Redis  userTokenData ${redisResponse.value}` + __location);
        }
    }
    else {
        log.error(`refreshToken NOT Found in Redis` + __location);
    }
    return null;
}