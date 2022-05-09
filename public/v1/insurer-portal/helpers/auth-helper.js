const jwt = require('jsonwebtoken');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const InsurerPortalUserBO = global.requireShared('models/InsurerPortalUser-BO.js');
const InsurerPortalUserGroupBO = global.requireShared('models/InsurerPortalUserGroup-BO.js');

/**
 * Creates a JWT login token for the user with the specified email.
 *
 * NOTE: DOES NOT provide any sort of user authentication. So use with caution!
 * Login credentials should be fully validated before generating any JWT
 * tokens.
 *
 * @param {*} email The email address of the user to generate the JWT token
 * @param {*} insurerId The insurerId of the user to generate the JWT token
 *    for.
 * @returns {JWT} Newly generated JWT token
 */
async function createToken(email, insurerId) {
    const insurerPortalUserDBJson = await getUser(email);

    // Make sure we found the user
    if (!insurerPortalUserDBJson) {
        log.info(`Authentication failed - Account not found ${email} Insurer ${insurerId}` + __location);
        throw new Error('Authentication failed - Account not found ' + email);
    }

    //get Permissions from Mongo UserGroup Permission
    // if error go with mySQL permissions.
    try{
        const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
        const insurerPortalUserGroupDB = await insurerPortalUserGroupBO.getById(insurerPortalUserDBJson.insurerPortalUserGroupId);
        insurerPortalUserDBJson.permissions = insurerPortalUserGroupDB.permissions;
    }
    catch(err){
        log.error("Error get permissions from Mongo " + err + __location);
    }

    const insurerPortalUserBO = new InsurerPortalUserBO();
    try{
        await insurerPortalUserBO.updateLastLogin(insurerPortalUserDBJson.insurerPortalUserId)
    }
    catch(e) {
        log.error(e.message + __location);
    }

    // Begin constructing the payload
    const payload = {
        firstLogin: Boolean(insurerPortalUserDBJson.lastLogin),
        insurerId: insurerPortalUserDBJson.insurerId,
        permissions: insurerPortalUserDBJson.permissions,
        resetRequired: Boolean(insurerPortalUserDBJson.resetRequired),
        userID: insurerPortalUserDBJson.insurerPortalUserId
    };

    return jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: global.settings.JWT_TOKEN_EXPIRATION});
}

/**
 * Creates a JWT token for MFA validation
 *
 * @param {*} insurerPortalUserDBJson user's agencyPortalUser Doc
 * @param {*} sessionUuid tracks user's sesssion to accessCode
 *    for.
 * @returns {JWT} Newly generated JWT token for MFA validation
 */
async function createMFAToken(insurerPortalUserDBJson, sessionUuid) {
    const payload = {
        userId: insurerPortalUserDBJson.insurerPortalUserId,
        tokenId: sessionUuid,
        mfaCheck: true
    };

    return jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {expiresIn: 900});
}

/**
 * Retrieve the talage user in Mongo that corresponds to the email address
 * passed in.
 *
 * @param {*} email Email address of the user.
 * @param {*} insurerId insurerId of the user.
 * @returns {object} Talage user object in mongo
 */
async function getUser(email) {
    // This is a complete hack. Plus signs in email addresses are valid, but the Restify queryParser removes plus signs. Add them back in
    email = email.replace(' ', '+');

    // Authenticate the information provided by the user
    //TODO move to BO/Mongo
    const insurerPortalUserBO = new InsurerPortalUserBO();
    let userDoc = null;
    try {
        userDoc = await insurerPortalUserBO.getByEmail(email);
    }
    catch (e) {
        log.error(e.message + __location);
    }
    return userDoc;
}

module.exports = {
    createToken: createToken,
    createMFAToken: createMFAToken,
    getUser: getUser
};