/**
 * Provides functions for authenticating Insurer Portal users
 *
 */

/**
 * Validates that the JWT includes the parameters we are expecting
 *
 * @param {object} req - The Restify request object
 * @param {string} permission - Required permissions
 * @param {string} permissionType - Required permissions type
 * @return {string} null on success, error message on error
 */
async function validateJWT(req, permission, permissionType) {
    // Check and validate JWT Content
    if(!req.authentication.insurerId ||
        !req.authentication.userId ||
        !req.authentication.userMongoId ||
        !req.authentication.insurerPortalUserGroupId) {
        return 'Invalid Token';
    }
    // Verify if a valid user
    let userDoc = null;
    try {
        const portalUserQueryOptions = {
            _id: req.authentication.userMongoId,
            insurerId: req.authentication.insurerId,
            insurerPortalUserGroupId: req.authentication.insurerPortalUserGroupId
        };
        const InsurerPortalUserBO = global.requireShared('models/InsurerPortalUser-BO.js');
        const insurerPortalUserBO = new InsurerPortalUserBO();
        userDoc = await insurerPortalUserBO.getById(req.authentication.userId, portalUserQueryOptions);
    }
    catch (e) {
        return 'Server Error'
    }
    if(!userDoc) {
        return 'Access Denied';
    }

    // Get Valid User Portal Groupd and verify the permission
    let userGroupDoc = null;
    try {
        const InsurerPortalUserGroupBO = global.requireShared('models/InsurerPortalUserGroup-BO.js');
        const insurerPortalUserGroupBO = new InsurerPortalUserGroupBO();
        userGroupDoc = await insurerPortalUserGroupBO.getById(req.authentication.insurerPortalUserGroupId);
    }
    catch (e) {
        return 'Server Error'
    }
    if(!userGroupDoc) {
        return 'Access Denied';
    }
    if (permission && !userGroupDoc.permissions[permission][permissionType]) {
        return 'User does not have the correct permissions';
    }
    return null;
}

module.exports = {validateJWT: validateJWT}
