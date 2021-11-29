const jwt = require('jsonwebtoken');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const AgencyPortalUserGroupBO = global.requireShared('models/AgencyPortalUserGroup-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');

/**
 * Retrieve the talage user in Mongo that corresponds to the email address
 * passed in.
 *
 * @param {*} email Email address of the user.
 * @param {*} agencyNetworkId agencyNetworkId of the user.
 * @returns {object} Talage user object in mongo
 */
async function getUser(email, agencyNetworkId) {
    // This is a complete hack. Plus signs in email addresses are valid, but the Restify queryParser removes plus signs. Add them back in
    email = email.replace(' ', '+');

    // Authenticate the information provided by the user
    //TODO move to BO/Mongo
    const agencyPortalUserBO = new AgencyPortalUserBO();
    try {
        return await agencyPortalUserBO.getByEmailAndAgencyNetworkId(email, true, agencyNetworkId);
    }
    catch (e) {
        log.error(e.message + __location);
    }
    return null;
}

/**
 * Creates a JWT login token for the user with the specified email.
 *
 * NOTE: DOES NOT provide any sort of user authentication. So use with caution!
 * Login credentials should be fully validated before generating any JWT
 * tokens.
 *
 * @param {*} email The email address of the user to generate the JWT token
 * @param {*} agencyNetworkId The agencyNetworkId of the user to generate the JWT token
 *    for.
 * @returns {JWT} Newly generated JWT token
 */
async function createToken(email, agencyNetworkId) {
    const agencyPortalUserDBJson = await getUser(email, agencyNetworkId);

    // Make sure we found the user
    if (!agencyPortalUserDBJson) {
        log.info('Authentication failed - Account not found ' + email);
        throw new Error('Authentication failed - Account not found ' + email);
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
    const agencyPortalUserBO = new AgencyPortalUserBO();
    await agencyPortalUserBO.updateLastLogin(agencyPortalUserDBJson.agencyPortalUserId).catch(function(e) {
        log.error(e.message + __location);
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
    const agencyBO = new AgencyBO();
    // For agency networks get the agencies they are allowed to access
    if (payload.isAgencyNetworkUser) {
        // Store the agencies in the payload
        //no longer used.
        payload.agents = [-1];
        // agencyJSONList.forEach((agencyJSON) => {
        //     payload.agents.push(agencyJSON.systemId);
        // });
    }
    else {
        // Just allow access to the current agency
        payload.agents.push(agencyPortalUserDBJson.agencyId);

        // Add the signing authority permission to the payload
        payload.canSign = Boolean(agencyPortalUserDBJson.canSign);

        // Determine whether or not the user needs to sign a wholesale agreement
        let agency = null;

        // Load the request data into it
        agency = await agencyBO.getById(agencyPortalUserDBJson.agencyId);

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
    payload.userID = agencyPortalUserDBJson.agencyPortalUserId;

    // Add the permissions to the payload
    payload.permissions = agencyPortalUserDBJson.permissions;

    // Check whether or not this is the first time the user is logging in
    payload.firstLogin = Boolean(agencyPortalUserDBJson.lastLogin);

    // Report back whether or not a password reset is required
    payload.resetRequired = Boolean(agencyPortalUserDBJson.resetRequired);

    // Return the version of the Terms of Service
    payload.termsOfServiceVersion = agencyPortalUserDBJson.termsOfServiceVersion;
    if (payload.termsOfServiceVersion === 0) {
        payload.termsOfServiceVersion = null
    }

    // This is a valid user, generate and return a token
    log.debug("payload: " + JSON.stringify(payload))

    return jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: global.settings.JWT_TOKEN_EXPIRATION});
}

module.exports = {
    getUser: getUser,
    createToken: createToken
};