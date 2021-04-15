const serverHelper = global.requireRootPath('server.js');
const {'v4': uuidv4} = require('uuid');
const tokenSvc = global.requireShared('./services/tokensvc.js');
const moment = require('moment');

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
    // Add Redis only payload properties here, will not be used when signing jwt.
    const additionalPayload = {};

    payload.apiToken = true;
    payload.quoteApp = true;
    const rawJwt = await tokenSvc.createNewToken(payload, additionalPayload);
    const token = `Bearer ${rawJwt}`;

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