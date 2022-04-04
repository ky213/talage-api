'use strict';

const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = global.requireRootPath('server.js');

/**
 * Responds to PUT requests for changing a user's password
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function putChangePassword(req, res, next){
    // Security Note: The validateJWT function was not called here because in the password reset function a modified JWT is issued that only contains a userId

    // Make sure this user is authenticated
    // if(!Object.prototype.hasOwnProperty.call(req, 'authentication')){
    //     log.info('Forbidden: User is not authenticated' + __location);
    //     return next(serverHelper.forbiddenError('User is not authenticated'));
    // }

    // // Make sure the authentication payload has everything we are expecting
    // if(!Object.prototype.hasOwnProperty.call(req.authentication, 'userID')){
    //     log.info('Forbidden: JWT payload is missing parameters' + __location);
    //     return next(serverHelper.forbiddenError('User is not properly authenticated'));
    // }

    // Check for data
    if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }

    // Establish some variables
    let password = '';

    // Check if the request has each datatype, and if so, validate and save it locally
    if(Object.prototype.hasOwnProperty.call(req.body, 'password')){
        if(validator.password.validatePasswordRequirements(req.body.password)){
            if (!validator.password.checkBannedList(req.body.password)){
                // Hash the password
                password = await crypt.hashPassword(req.body.password);
            }
            else {
                log.error('The password contains a word or pattern that is blocked for security reasons. For more information please refer to banned-passwords.json file or contact the administrator.' + __location);
                return next(serverHelper.requestError(`Unfortunately, your password contains a word, phrase or pattern that makes it easily guessable. Please try again with a different password.`));
            }

        }
        else{
            log.warn('Password does not meet requirements' + __location);
            return next(serverHelper.requestError('Password does not meet the complexity requirements. It must be at least 8 characters and contain one uppercase letter, one lowercase letter, one number, and one special character'));
        }
    }

    // Do we have something to update?
    if(!password){
        log.warn('There is nothing to update' + __location);
        return next(serverHelper.requestError('There is nothing to update. Please check the documentation.'));
    }

    // Create and run the UPDATE query
    if(parseInt(req.authentication.userID, 10) > 0){
        const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
        const agencyPortalUserBO = new AgencyPortalUserBO();
        await agencyPortalUserBO.setPasword(parseInt(req.authentication.userID, 10), password).catch(function(err){
            log.warn(err.message + __location);
            return next(serverHelper.internalError('Unable to set new password'));
        });
    }
    else {
        //bad request.
        log.warn('Change password bad user id' + __location);
        return next(serverHelper.requestError("bad id"));
    }

    // Everything went okay, send a success response
    res.send(200, 'Account Updated');
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPutAuthNotAP('Change Password', `${basePath}/change-password`, putChangePassword);
    server.addPutAuthNotAP('Change Password (depr)', `${basePath}/changePassword`, putChangePassword);
};