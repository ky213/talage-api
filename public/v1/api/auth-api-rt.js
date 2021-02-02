const serverHelper = global.requireRootPath('server.js');
const {'v4': uuidv4} = require('uuid');

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
    //let error = false;

    // Query parameters user, key, and joomla_user are all optional now since the quoting engine was broken out
    const payload = {};

    // Joolma not supported anymore.
    if (req.query.joomla_user) {
        res.send(403, serverHelper.forbiddenError('forbidden user'));
        return next();
    }
    // TOOD basic Auth for apikey and apiSecret.

    // // Validate the passed-in user and key
    // if (req.query.user && req.query.key) {
    //     // Authenticate the information provided by the user
    //     const sql = `SELECT \`id\`, \`key\` FROM \`#__api_users\` WHERE \`user\` = ${db.escape(req.query.user)} LIMIT 1;`;
    //     const result = await db.query(sql).catch(function(e) {
    //         log.error(e.message);
    //         res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
    //         error = true;
    //     });
    //     if (error) {
    //         return next(false);
    //     }

    //     // Check that the key was valid
    //     if (!result.length) {
    //         log.info('Authentication failed');
    //         res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
    //         return next();
    //     }

    //     // Check the key
    //     if (!await crypt.verifyPassword(result[0].key, req.query.key)) {
    //         log.info('Authentication failed');
    //         res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
    //         return next();
    //     }
    //     payload.api_id = result[0].id;
    // }

    payload.apiToken = true;
    payload.ranValue1 = uuidv4().toString();

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



/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get Token', `${basePath}/auth`, getToken);
};