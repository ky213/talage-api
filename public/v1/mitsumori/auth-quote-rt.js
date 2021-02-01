const serverHelper = global.requireRootPath('server.js');
const {'v4': uuidv4} = require('uuid');

/**
 * Responds to get requests for an Quote app V2 authorization token
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

    payload.apiToken = true;
    payload.quoteApp = true;
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

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get Token', `${basePath}/auth`, getToken);
};