/**
 * Returns an auth token for the Agency Portal
 */

'use strict';

const crypt = global.requireShared('services/crypt.js');
const jwt = require('jsonwebtoken');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyPortalUserGroupBO = global.requireShared('models/AgencyPortalUserGroup-BO.js');

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
    const emailHash = await crypt.hash(req.body.email);
    const agencySQL = `
		SELECT
			apu.agency_network,
			apu.agency,
			apu.can_sign,
			apu.id,
			apu.last_login,
			apu.password,
			apu.reset_required,
            apu.group as apugId,
			la.version AS 'termsOfServiceVersion'
		FROM clw_talage_agency_portal_users AS apu
		LEFT JOIN clw_talage_legal_acceptances AS la ON la.agency_portal_user = apu.id
		WHERE apu.email_hash = ${db.escape(emailHash)} AND apu.state > 0
		LIMIT 1;
	`;
    const agencyPortalUserResult = await db.query(agencySQL).catch(function(e) {
        log.error(e.message + __location);
        res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
        error = true;
    });
    if (error) {
        return next(false);
    }

    // Make sure we found the user
    if (!agencyPortalUserResult || !agencyPortalUserResult.length) {
        log.info('Authentication failed - Account not found');
        log.verbose(emailHash);
        res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
        return next();
    }

    // Check the password
    if (!await crypt.verifyPassword(agencyPortalUserResult[0].password, req.body.password)) {
        log.info('Authentication failed - Bad password');
        res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
        return next();
    }

    //get Permissions from Mongo UserGroup Permission
    // if error go with mySQL permissions.
    try{
        const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();
        const agencyPortalUserGroupDB = await agencyPortalUserGroupBO.getById(agencyPortalUserResult[0].apugId);
        agencyPortalUserResult[0].permissions = agencyPortalUserGroupDB.permissions;
    }
    catch(err){
        log.error("Error get permissions from Mongo " + err + __location);
    }
    // Begin constructing the payload
    const payload = {
        agencyNetwork: false,
        agents: [],
        signatureRequired: false
    };

    // Record the time this user logged in
    const lastLoginSQL = `
		UPDATE \`#__agency_portal_users\`
		SET \`last_login\` = NOW()
		WHERE \`id\` = ${agencyPortalUserResult[0].id}
		LIMIT 1;
	`;
    db.query(lastLoginSQL).catch(function(e) {
        // If this fails, log the failure but do nothing else
        log.error(e.message);
    });

    // Check if this was an agency network
    if (agencyPortalUserResult[0].agency_network) {
        payload.agencyNetwork = agencyPortalUserResult[0].agency_network;
        //agency network ID now in payload for consistency between network and agency.
        payload.agencyNetworkId = agencyPortalUserResult[0].agency_network;
    }

    // Store a local copy of the agency network ID .
    let agencyNetworkId = payload.agencyNetwork;

    // For agency networks get the agencies they are allowed to access
    if (payload.agencyNetwork) {
        // Build and execute the query
        const agenciesSQL = `
			SELECT \`id\`
			FROM \`#__agencies\`
			WHERE \`agency_network\` = ${db.escape(payload.agencyNetwork)} AND \`state\` > 0;
		`;
        const agencies = await db.query(agenciesSQL).catch(function(e) {
            log.error(e.message + __location);
            res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
            error = true;
        });
        if (error) {
            return next(false);
        }

        // Store the agencies in the payload
        payload.agents = [];
        agencies.forEach((agency) => {
            payload.agents.push(agency.id);
        });
    }
    else{
        // Just allow access to the current agency
        payload.agents.push(agencyPortalUserResult[0].agency);

        // Add the signing authority permission to the payload
        payload.canSign = Boolean(agencyPortalUserResult[0].can_sign);

        // Determine whether or not the user needs to sign a wholesale agreement
        const wholesaleSQL = `
			SELECT
				\`agency_network\`,
				\`wholesale\` ,
				\`wholesale_agreement_signed\`
			FROM \`#__agencies\`
			WHERE \`id\` = ${db.escape(agencyPortalUserResult[0].agency)} AND \`state\` > 0
			LIMIT 1;
		`;
        const wholesaleInfo = await db.query(wholesaleSQL).catch(function(e) {
            log.error(e.message + __location);
            res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
            error = true;
        });
        if (error) {
            return next(false);
        }

        // Only agencies who have wholesale enabled and have not signed before should be required to sign
        // Only for for Digalent is the process handle in the software.
        if (wholesaleInfo[0].agency_network === 2 && wholesaleInfo[0].wholesale && !wholesaleInfo[0].wholesale_agreement_signed) {
            payload.signatureRequired = true;
        }

        // Store the agency network ID locally for later use
        agencyNetworkId = wholesaleInfo[0].agency_network;
    }


    // Add the user ID to the payload
    payload.userID = agencyPortalUserResult[0].id;
    payload.agencyNetworkId = agencyNetworkId;

    // Add the permissions to the payload
    payload.permissions = agencyPortalUserResult[0].permissions;

    // Check whether or not this is the first time the user is logging in
    payload.firstLogin = Boolean(agencyPortalUserResult[0].last_login);

    // Report back whether or not a password reset is required
    payload.resetRequired = Boolean(agencyPortalUserResult[0].reset_required);

    // Return the version of the Terms of Service
    payload.termsOfServiceVersion = agencyPortalUserResult[0].termsOfServiceVersion;

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