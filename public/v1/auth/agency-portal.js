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
const AgencyPortalUserGroupBO = global.requireShared('models/AgencyPortalUserGroup-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

/**
 * Responds to get requests for an authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function createToken(req, res, next){
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
    const agencyPortalUserDBJson = await agencyPortalUserBO.getByEmail(req.body.email).catch(function(e) {
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
    if (!await crypt.verifyPassword(agencyPortalUserDBJson.password, req.body.password)) {
        log.info('Authentication failed - Bad password');
        res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
        return next();
    }

    //get Permissions from Mongo UserGroup Permission
    // if error go with mySQL permissions.
    try{
        const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();
        const agencyPortalUserGroupDB = await agencyPortalUserGroupBO.getById(agencyPortalUserDBJson.agencyPortalUserGroupId);
        agencyPortalUserDBJson.permissions = agencyPortalUserGroupDB.permissions;
    }
    catch(err){
        log.error("Error get permissions from Mongo " + err + __location);
    }
    // Begin constructing the payload
    const payload = {
        agencyNetwork: false,
        agents: [],
        signatureRequired: false,
        //undo double use of agency_network.
        isAgencyNetworkUser: false
    };
    await agencyPortalUserBO.updateLastLogin(agencyPortalUserDBJson.agencyPortalUserId).catch(function(e) {
        log.error(e.message + __location);
        res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
        error = true;
    });


    payload.isAgencyNetworkUser = false;
    // Check if this was an agency network
    if (agencyPortalUserDBJson.agency_network) {
        payload.agencyNetwork = agencyPortalUserDBJson.agencyNetworkId;
        //agency network ID now in payload for consistency between network and agency.
        payload.agencyNetworkId = agencyPortalUserDBJson.agencyNetworkId;

        payload.isAgencyNetworkUser = true;
    }

    // Store a local copy of the agency network ID .
    //let agencyNetworkId = payload.agencyNetwork;
    const agencyBO = new AgencyBO();
    // For agency networks get the agencies they are allowed to access
    if (payload.isAgencyNetworkUser) {
        let agencyJSONList = null;
        try{

            // Load the request data into it
            agencyJSONList = await agencyBO.getByAgencyNetwork(payload.agencyNetworkId);
        }
        catch(err){
            log.error("agencyBO.getByAgencyNetwork load error " + err + __location);
            error = serverHelper.internalError('Error querying database. Check logs.');
        }

        if (error) {
            res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
            return next(false);
        }

        // Store the agencies in the payload
        payload.agents = [];
        agencyJSONList.forEach((agencyJSON) => {
            payload.agents.push(agencyJSON.systemId);
        });
    }
    else{
        // Just allow access to the current agency
        payload.agents.push(agencyPortalUserDBJson.agencyId);

        // Add the signing authority permission to the payload
        payload.canSign = Boolean(agencyPortalUserDBJson.canSign);

        // Determine whether or not the user needs to sign a wholesale agreement
        let agency = null;
        try{
            // Load the request data into it
            agency = await agencyBO.getById(agencyPortalUserDBJson.agencyId);
        }
        catch(err){
            log.error("agencyBO.getByAgencyNetwork load error " + err + __location);
            error = serverHelper.internalError('Error querying database. Check logs.');
        }
        if (error) {
            return next(false);
        }

        if(agency){
            // Only agencies who have wholesale enabled and have not signed before should be required to sign
            // Only for for Digalent is the process handle in the software.
            if (agency.agencyNetworkId === 2 && agency.wholesale && !agency.wholesaleAgreementSigned) {
                payload.signatureRequired = true;
            }

            // Store the agency network ID locally for later use
            payload.agencyNetworkId = agency.agencyNetworkId;
        }

    }


    // Add the user ID to the payload
    payload.userID = agencyPortalUserDBJson.id;

    // Add the permissions to the payload
    payload.permissions = agencyPortalUserDBJson.permissions;

    // Check whether or not this is the first time the user is logging in
    payload.firstLogin = Boolean(agencyPortalUserDBJson.lastLogin);

    // Report back whether or not a password reset is required
    payload.resetRequired = Boolean(agencyPortalUserDBJson.resetRequired);

    // Return the version of the Terms of Service
    payload.termsOfServiceVersion = agencyPortalUserDBJson.termsOfServiceVersion;
    if(payload.termsOfServiceVersion === 0){
        payload.termsOfServiceVersion = null
    }

    // This is a valid user, generate and return a token
    try{
        log.debug("payload: " + JSON.stringify(payload))
    }
    catch(err){
        log.error(err);
    }
    const token = `Bearer ${jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: global.settings.JWT_TOKEN_EXPIRATION})}`;
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
    server.addPost('Create Token', `${basePath}/agency-portal`, createToken);
    server.addPut('Refresh Token', `${basePath}/agency-portal`, updateToken);
};