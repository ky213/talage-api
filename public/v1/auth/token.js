/**
 * Returns an auth token for the API system
 */

'use strict';

const crypt = global.requireShared('services/crypt.js');
const serverHelper = require('../../../server.js');

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
    let error = false;

    // Query parameters user, key, and joomla_user are all optional now since the quoting engine was broken out
    const payload = {};

    // Joolma not supported anymore.
    if (req.query.joomla_user) {
        res.send(403, serverHelper.badRequestError('Invalid Joomla! User'));
        return next();
    }

    // Validate the passed-in user and key
    if (req.query.user && req.query.key) {
        // Authenticate the information provided by the user
        const sql = `SELECT \`id\`, \`key\` FROM \`#__api_users\` WHERE \`user\` = ${db.escape(req.query.user)} LIMIT 1;`;
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
            log.info('Authentication failed');
            res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
            return next();
        }

        // Check the key
        if (!await crypt.verifyPassword(result[0].key, req.query.key)) {
            log.info('Authentication failed');
            res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
            return next();
        }
        payload.api_id = result[0].id;
    }

    payload.quote = true;

    // This is a valid user, generate and return a token
    const jwt = require('jsonwebtoken');
    const token = `Bearer ${jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: '1h'})}`;
    res.send(201, {
        status: 'Created',
        token: token
    });
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get Token', `${basePath}/token`, getToken);
    server.addGet('Get Token (depr)', `${basePath}/`, getToken);
};