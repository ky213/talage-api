/**
 * Provides functions for authenticating users
 *
 * FROM: agency-portal/api
 */

'use strict';

/**
 * Validates that the JWT includes the parameters we are expecting
 *
 * @param {object} req - The Restify request object
 * @param {string} permission - Required permissions
 * @param {string} permissionType - Required permissions type
 * @return {string} null on success, error message on error
 */
async function validateJWT(req, permission, permissionType) {
    if (permission && permission === 'insurer-portal') {
        if (!req.authentication.permissions[permission][permissionType]) {
            return 'User does not have the correct permissions';
        }
        return null;
    }
}

module.exports = {validateJWT: validateJWT}