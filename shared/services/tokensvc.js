const tracker = global.requireShared('./helpers/tracker.js');
const utility = global.requireShared('./helpers/utility.js');
const moment = require('moment');

/**
 * Create new JWT with ApplicationId added to payload.
 *
 * @param {object} req - Request object
 * @param {uuid} applicationId - new ApplicationId
 *
 * @returns {object} res - Returns an authorization token
 */
exports.createApplicationToken = async function(req, applicationId) {
    // eslint-disable-next-line prefer-const
    let payload = req.userTokenData;
    payload.applicationId = applicationId;
    payload.createdAt = moment();
    const jwt = require('jsonwebtoken');
    const userJwt = jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'});
    const token = `Bearer ${userJwt}`;

    try{
        const ttlSeconds = 3600;
        const redisResponse = await global.redisSvc.storeKeyValue(userJwt, JSON.stringify(payload), ttlSeconds);
        if(redisResponse && redisResponse.saved){
            log.debug("Saved JWT to Redis " + __location);
        }
    }
    catch(err){
        log.error("Error save JWT to Redis JWT " + err + __location);
    }

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
            const redisResponse = await global.redisSvc.getKeyValue(req.jwtToken)
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
                const ttlSeconds = 3600;
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
        log.error("Missing req.jwtToken " + __location)
    }

    return true;
}

/**
 * Copy the redis data and create a new access token (key)
 *
 * @param {object} token - The existing token
 *
 * @returns {object} - Returns an authorization token
 */
exports.refreshToken = async function(token) {
    // us the token to look up redis data, create a new token and copy it to that location

}