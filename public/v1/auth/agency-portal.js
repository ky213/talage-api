/**
 * Returns an auth token for the Agency Portal
 */

'use strict';

const crypt = global.requireShared('services/crypt.js');
const jwt = require('jsonwebtoken');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const {createToken} = require('./auth-helper');

/**
 * Responds to get requests for an authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token using username/password credentials
 */
async function createTokenEndpoint(req, res, next){
    let error = false;

    // Check for data
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        log.info('Bad Request: Missing both email and password');
        return next(serverHelper.requestError('You must supply an email address and password'));
    }

    // Make sure an email was provided
    if (!req.body.email) {
        log.info('Missing email' + __location);
        res.send(400, serverHelper.requestError('Email address is required'));
        return next();
    }

    // Makes sure a password was provided
    if (!req.body.password) {
        log.info('Missing password' + __location);
        res.send(400, serverHelper.requestError('Password is required'));
        return next();
    }

    // This is a complete hack. Plus signs in email addresses are valid, but the Restify queryParser removes plus signs. Add them back in
    req.body.email = req.body.email.replace(' ', '+');

    // Authenticate the information provided by the user
    //TODO move to BO/Mongo
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const agencyPortalUserDBJson = await agencyPortalUserBO.getByEmailAndAgencyNetworkId(req.body.email, true, req.body.agencyNetworkId).catch(function(e) {
        log.error(e.message + __location);
        res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
        error = true;
    });
    if (error) {
        return next(false);
    }

    // Make sure we found the user
    if (!agencyPortalUserDBJson) {
        log.info('Authentication failed - Account not found ' + req.body.email);
        res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
        return next();
    }

    // Check the password
    if (!crypt.verifyPassword(agencyPortalUserDBJson.password, req.body.password)) {
        log.info('Authentication failed');
        res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
        return next();

    }

    const redisKey = "apuserinfo-" + agencyPortalUserDBJson.agencyPortalUserId;
    await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(agencyPortalUserDBJson));


    try {
        const jwtToken = await createToken(req.body.email, req.body.agencyNetworkId);
        const token = `Bearer ${jwtToken}`;
        res.send(201, {
            status: 'Created',
            token: token
        });
        return next();
    }
    catch (ex) {
        log.error(`Internal error when authenticating ${ex}` + __location);
        res.send(500, serverHelper.internalError('Internal error when authenticating. Check logs.'));
        return next(false);
    }
}

/**
 * Responds to get requests for an authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token using hash key to look up valid auto login in redis
 */
async function createAutoLoginToken(req, res, next){
    // Check for data
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        log.info('Bad Request: Missing both email and password');
        return next(serverHelper.requestError('You must supply an email address and password'));
    }

    // Make sure a hash key was provided
    if (!req.body.hash) {
        log.info('Missing hash for auto login' + __location);
        res.send(400, serverHelper.requestError('No hash key provided for auto login'));
        return next();
    }

    // Attempt to get the User ID from redis using the provided hash
    const apuId = await global.redisSvc.getKeyValue(`apu-${req.body.hash}`);

    if (!apuId) {
        log.info('Unable to find user - Data may of expired.' + __location);
        res.send(404, serverHelper.requestError('No data found, auto-login session may have expired'));
        return next();
    }
    else {
        // for security, we delete the key. Auto-login is one-time use only
        await global.redisSvc.deleteKey(`apu-${req.body.hash}`);
    }

    const agencyPortalUserBO = new AgencyPortalUserBO();
    let agencyPortalUserDBJSON = null;
    try {
        agencyPortalUserDBJSON = await agencyPortalUserBO.getById(apuId.apUserId);
    }
    catch (e) {
        log.error(e.message + __location);
        res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
        return next(false);
    }

    // Make sure we found the user
    if (!agencyPortalUserDBJSON) {
        log.info('Authentication failed - Account not found ' + req.body.email);
        res.send(401, serverHelper.invalidCredentialsError('Invalid API Auto Login Credentials'));
        return next();
    }

    try {
        const jwtToken = await createToken(agencyPortalUserDBJSON.email);
        const token = `Bearer ${jwtToken}`;
        res.send(201, {
            status: 'Created',
            token: token
        });
        return next();
    }
    catch (e) {
        log.error(`An error occurred creating access token: ${e}.` + __location);
        res.send(500, serverHelper.internalError('Internal error when authenticating. Check logs.'));
        return next(false);
    }
}

/**
 * Updates (refreshes) an existing token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} Returns an updated authorization token
 */
async function updateToken(req, res, next) {
    // Ensure we have the proper parameters
    if (!req.body || !req.body.token) {
        log.info('Bad Request: Missing "token" parameter when trying to refresh the token ' + __location);
        return next(serverHelper.requestError('A parameter is missing when trying to refresh the token.'));
    }

    // Ensure it is a valid JWT and that it hasn't expired.
    let token = null;
    try {
        token = jwt.verify(req.body.token, global.settings.AUTH_SECRET_KEY);
    }
    catch (error) {
        log.error("JWT: " + error + __location);
        return next(serverHelper.forbiddenError('Invalid token'));
    }

    // Valid JWT. Preserve the content except for the issued at and expiration timestamps
    delete token.iat;
    delete token.exp;

    // Sign the JWT with new timestamps
    token = `Bearer ${jwt.sign(token, global.settings.AUTH_SECRET_KEY, {expiresIn: global.settings.JWT_TOKEN_EXPIRATION})}`;

    // Send it back
    res.send(201, {
        status: 'Created',
        token: token
    });
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addPost('Create Token', `${basePath}/agency-portal`, createTokenEndpoint);
    server.addPost('Create Token for Auto Login', `${basePath}/agency-portal-auto`, createAutoLoginToken);
    server.addPut('Refresh Token', `${basePath}/agency-portal`, updateToken);
};
exports.createToken = createToken;