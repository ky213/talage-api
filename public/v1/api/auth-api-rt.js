const serverHelper = global.requireRootPath('server.js');
const {'v4': uuidv4} = require('uuid');
const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');

/**
 * Responds to get requests for an API authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function getToken(req, res, next) {
    let error = false;

    // Query parameters user, key, and joomla_user are all optional now since the quoting engine was broken out
    const payload = {};

    // TOOD basic Auth for apikey and apiSecret.

    //check for Agency Portal user access
    // Validate the passed-in user and key
    if (req.body && req.body.user && req.body.password) {
        // Authenticate the information provided by the user
        const sql = `SELECT id, password FROM clw_talage_agency_portal_users WHERE clear_email = ${db.escape(req.body.user)} LIMIT 1;`;
        const result = await db.query(sql).catch(function(e) {
            log.error(e.message);
            res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
            error = true;
        });
        if (error) {
            return next(false);
        }

        // Check that the key was valid
        if (!result.length) {
            log.info('Authentication failed - No DB record' + __location);
            res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
            return next();
        }

        // Check the key
        if (!await crypt.verifyPassword(result[0].password, req.body.password)) {
            log.info('Authentication failed - No Password chck' + __location);
            res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
            return next();
        }
        // TODO check API access and Application manage rights

        payload.userId = result[0].id;
    }
    else {
        log.info('Authentication failed - Bad Request ' + __location);
        res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
        return next();
    }

    payload.apiToken = true;
    payload.ranValue1 = uuidv4().toString();
    payload.createdAt = moment();

    // This is a valid user, generate and return a token
    const jwt = require('jsonwebtoken');
    const userJwt = jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'});
    const token = `Bearer ${userJwt}`;

    //store in Redis...
    //Add Redis only payload properties here.

    try{
        const ttlSeconds = 3600;
        const redisResponse = await global.redisSvc.storeKeyValue(userJwt, JSON.stringify(payload),ttlSeconds)
        if(redisResponse && redisResponse.saved){
            log.debug("Saved JWT to Redis " + __location);
        }
    }
    catch(err){
        log.error("Error save JWT to Redis JWT " + err + __location);
    }

    res.send(201, {
        status: 'Created',
        token: token
    });
    return next();
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
    // eslint-disable-next-line prefer-const
    let payload = req.userTokenData;
    payload.applicationId = applicationId;
    payload.createdAt = moment();
    const jwt = require('jsonwebtoken');
    const userJwt = jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'});
    const token = `Bearer ${userJwt}`;

    try{
        const ttlSeconds = 3600;
        const redisResponse = await global.redisSvc.storeKeyValue(userJwt, JSON.stringify(payload),ttlSeconds)
        if(redisResponse && redisResponse.saved){
            log.debug("Saved JWT to Redis " + __location);
        }
    }
    catch(err){
        log.error("Error save JWT to Redis JWT " + err + __location);
    }


    return token;

}
//AddApplicationToToken
/**
 * Create new JWT with ApplicationId added to payload.
 *
 * @param {object} req - Request object
 * @param {uuid} applicationId - new ApplicationId
 *
 * @returns {object} res - Returns an authorization token
 */
exports.AddApplicationToToken = async function(req, applicationId) {
    // eslint-disable-next-line prefer-const
    //get existing redis value

    if(req.jwtToken){
        let userTokenData = {};
        try{
            const redisResponse = await global.redisSvc.getKeyValue(req.jwtToken)
            if(redisResponse && redisResponse.found && redisResponse.value){
                userTokenData = JSON.parse(redisResponse.value)
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
                const redisResponse = await global.redisSvc.storeKeyValue(req.jwtToken, JSON.stringify(userTokenData),ttlSeconds)
                if(redisResponse && redisResponse.saved){
                    log.debug("Update Redis JWT for new application " + __location);
                }
            }
            catch(err){
                log.error("Error updating Redis JWT for new application" + err + __location);
            }
        }
        else{
            log.error("Missing Redis userTokenData " + __location)
        }
    }
    else {
        log.error("Missing req.jwtToken " + __location)
    }

    return true;

}


/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get Token', `${basePath}/auth`, getToken);
    server.addPut('PUT getToken', `${basePath}/auth`, getToken);
};