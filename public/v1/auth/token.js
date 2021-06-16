/**
 * Returns an auth token for the API system
 */

'use strict';

/**
 * Responds to get requests for an authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function getToken(req, res, next) {
    //let error = false;
    // used by Quote V1 to getting a JWT for calling API.
    // Query parameters user, key, and joomla_user are all optional now since the quoting engine was broken out
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress 
    log.debug(`GET TOKEN:  ${ip}` + __location);
    if(ip === '127.0.0.1'){
        const payload = {};

        payload.quote = true;

        // This is a valid user, generate and return a token
        const jwt = require('jsonwebtoken');
        const token = `Bearer ${jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'})}`;
        res.send(201, {
            status: 'Created',
            token: token
        });
    }
    else {
        res.send(403);
    }
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get Token', `${basePath}/token`, getToken);
    server.addGet('Get Token (depr)', `${basePath}/`, getToken);
};