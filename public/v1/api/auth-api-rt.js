const serverHelper = global.requireRootPath('server.js');
const {'v4': uuidv4} = require('uuid');
const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const tokenSvc = global.requireShared('./services/tokensvc.js');

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

    // Add Redis only payload properties here, will not be used when signing jwt.
    const additionalPayload = {};

    payload.apiToken = true;
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
    server.addPut('PUT getToken', `${basePath}/auth`, getToken);
};