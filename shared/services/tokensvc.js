const tracker = global.requireShared('./helpers/tracker.js');
const utility = global.requireShared('./helpers/utility.js');
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
    const jwtPayload = JSON.parse(JSON.stringify(payload));
    jwtPayload.ranValue1 = uuidv4().toString();
    jwtPayload.createdAt = moment();

    // Generate and return a token
    const jwt = require('jsonwebtoken');
    const userJwt = jwt.sign(jwtPayload, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'});

    let redisPayload = jwtPayload;
    // add the additional payload after generating the token
    if(additionalPayload){
        redisPayload = Object.assign(jwtPayload, additionalPayload);
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
    const payload = req.userTokenData;
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
        const userTokenData = JSON.parse(redisResponse.value);
        const duration = moment.duration(moment().diff(moment(userTokenData.createdAt)));
        const seconds = duration.asSeconds();

        // check created date and make sure we exceed the threshold
        if(seconds > refreshThresholdSeconds){
            // TODO: the optional data needs to be separated from the token data, for now use all the data to generate the token
            const userToken = await this.createNewToken(userTokenData);
            return `Bearer ${userToken}`;
        }
    }
    return null;
}