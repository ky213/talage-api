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
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const AuthHelper = require('./auth-helper');
const emailsvc = global.requireShared('./services/emailsvc.js');
const mfaCodesvc = global.requireShared('./services/mfaCodeSvc.js');
const slack = global.requireShared('./services/slacksvc.js');
var uuid = require('uuid');

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

    // Require MFA...
    // load AgencyNetwork
    let requireMFA = true;
    const agencyNetworkBO = new AgencyNetworkBO();
    try{
        const agencyNetworkJSON = await agencyNetworkBO.getById(agencyPortalUserDBJson.agencyNetworkId);
        if(agencyNetworkJSON?.featureJson?.requireMFA === false){
            requireMFA = false;
        }
    }
    catch(err){
        log.error("AP Auth MFA requirement check agencyNetworkBO load error " + err + __location);
    }
    log.debug(`AP Auth requireMFA ${requireMFA}` + __location);
    if(requireMFA){
        // Create MFA Code
        const mfaCode = mfaCodesvc.generateRandomMFACode().toString();
        const sessionUuid = uuid.v4().toString();
        const jwtToken = await AuthHelper.createMFAToken(agencyPortalUserDBJson, sessionUuid);
        const token = `Bearer ${jwtToken}`;

        const redisKey = "apusermfacode-" + agencyPortalUserDBJson.agencyPortalUserId + "-" + mfaCode;
        const ttlSeconds = 900; //15 minutes
        await global.redisSvc.storeKeyValue(redisKey, sessionUuid, ttlSeconds);

        // Send Email
        //just so getEmailContent works.
        const agencyNetworkEnvSettings = await agencyNetworkBO.getEnvSettingbyId(agencyPortalUserDBJson.agencyNetworkId).catch(function(err){
            log.error(`Unable to get email content for Agency Portal User. agency_network: ${agencyPortalUserDBJson.agencyNetworkId}.  error: ${err}` + __location);
        });

        let brand = "wheelhouse"
        if(agencyNetworkEnvSettings){
            brand = agencyNetworkEnvSettings.emailBrand.toLowerCase();
        }

        if(brand){
            brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
        }
        else {
            log.error(`Email Brand missing for agencyNetworkId ${agencyPortalUserDBJson.agencyNetworkId} ` + __location);
        }

        const emailData = {
            'html': `<p style="text-align:center;">Your login code.  It expires 15 minutes.</p><br><p style="text-align: center;"><STRONG>${mfaCode}</STRONG></p>`,
            'subject': `Your ${brand} Login Code `,
            'to': agencyPortalUserDBJson.email
        };

        const emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, agencyPortalUserDBJson.agencyNetworkId, "");
        if(emailResp === false){
            log.error(`Failed to send the mfa code email to ${agencyPortalUserDBJson.email}. Please contact the user.`);
            slack.send('#alerts', 'warning',`Failed to send the mfa code email to ${agencyPortalUserDBJson.email}. Please contact the user.`);
            res.send(500, serverHelper.internalError('Internal error when authenticating.'));
            return next(false);
        }

        res.send(200, {
            status: 'MFA',
            token: token,
            mfaRequired: true
        });
        return next();
    }
    else {
        const redisKey = "apuserinfo-" + agencyPortalUserDBJson.agencyPortalUserId;
        await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(agencyPortalUserDBJson));


        try {
            const jwtToken = await AuthHelper.createToken(req.body.email, req.body.agencyNetworkId);
            const token = `Bearer ${jwtToken}`;
            res.send(201, {
                status: 'Created',
                token: token,
                loginComplete: true
            });
            return next();
        }
        catch (ex) {
            log.error(`Internal error when authenticating ${ex}` + __location);
            res.send(500, serverHelper.internalError('Internal error when authenticating. Check logs.'));
            return next(false);
        }
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
        log.info('Bad Request: Missing request body' + __location);
        return next(serverHelper.requestError('An error occurred while attempting to auto login'));
    }

    // Make sure a hash key was provided
    if (!req.body.hash) {
        log.warn('Missing hash for auto login' + __location);
        res.send(400, serverHelper.requestError('An error occurred while attempting to auto login'));
        return next();
    }

    // Attempt to get the User ID from redis using the provided hash
    const redisValueRaw = await global.redisSvc.getKeyValue(`apu-${req.body.hash}`);

    if (!redisValueRaw.found) {
        log.info('Unable to find user - Data may of expired.' + __location);
        res.send(404, serverHelper.requestError('No data found, auto-login session may have expired'));
        return next();
    }

    // for security, we delete the key. Auto-login is one-time use only
    await global.redisSvc.deleteKey(`apu-${req.body.hash}`);

    let redisValueJSON = null;
    try {
        redisValueJSON = JSON.parse(redisValueRaw.value);
    }
    catch (e) {
        log.error(`An error occurred parsing redis value: ${e}. Unable to authenticate for auto login.` + __location);
        res.send(400, serverHelper.requestError('The server encountered an error and is unable to auto login'));
        return next();
    }

    const agencyPortalUserBO = new AgencyPortalUserBO();
    let agencyPortalUserDBJSON = null;
    try {
        agencyPortalUserDBJSON = await agencyPortalUserBO.getById(redisValueJSON.agencyPortalUserId);
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
        const jwtToken = await AuthHelper.createToken(agencyPortalUserDBJSON.email, req.body.agencyNetworkId);
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

/**
 * Updates (refreshes) an existing token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} Returns an updated authorization token
 */
async function mfacheck(req, res, next) {
    // Ensure we have the proper parameters
    if (!req.body || !req.body.mfaCode) {
        log.info('Bad Request: Missing parameter mfaCode ' + __location);
        return next(serverHelper.requestError('A parameter is missing for mfacheck.'));
    }

    //check code versus Redis.
    const redisKey = "apusermfacode-" + req.authentication.userId + "-" + req.body.mfaCode;
    const redisValueRaw = await global.redisSvc.getKeyValue(redisKey);
    if (!redisValueRaw.found) {
        log.info('Unable to find user MFA key - Data may of expired.' + __location);
        return next(serverHelper.notAuthorizedError('Not Authorized'));
    }
    else if(req.authentication.tokenId === redisValueRaw.value){
        // for security, we delete the key. Auto-login is one-time use only
        await global.redisSvc.deleteKey(redisKey);

        //load Agency Portal BO
        const agencyPortalUserBO = new AgencyPortalUserBO();
        const agencyPortalUserDBJson = await agencyPortalUserBO.getById(req.authentication.userId).catch(function(e) {
            log.error(`AP login MFA error ${e.message}` + __location);
        });

        // Make sure we found the user
        if (!agencyPortalUserDBJson) {
            log.info('Authentication failed - Account not found ' + req.body.email);
            res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
            return next();
        }

        //Setup and return JWT
        const redisKeyUser = "apuserinfo-" + agencyPortalUserDBJson.agencyPortalUserId;
        await global.redisSvc.storeKeyValue(redisKeyUser, JSON.stringify(agencyPortalUserDBJson));


        try {
            const jwtToken = await AuthHelper.createToken(agencyPortalUserDBJson.email, agencyPortalUserDBJson.agencyNetworkId);
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
    else {
        log.info('Missmatch on MFA tokenId' + __location);
        return next(serverHelper.notAuthorizedError('Not Authorized'));
    }
}


/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addPost('Create Token', `${basePath}/agency-portal`, createTokenEndpoint);
    server.addPost('Create Token for Auto Login', `${basePath}/agency-portal-auto`, createAutoLoginToken);
    server.addPut('Refresh Token', `${basePath}/agency-portal`, updateToken);
    server.addPostMFA('MFA Check', `${basePath}/agency-portal/mfacheck`, mfacheck);
};
exports.createToken = AuthHelper.createToken;