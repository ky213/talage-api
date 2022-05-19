const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = global.requireRootPath('server.js');
const authHelper = require('./helpers/auth-helper.js')
const InsurerPortalUserBO = global.requireShared('./models/InsurerPortalUser-BO.js');
const _ = require('lodash');

async function changePassword(req, res, next){
    if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }
    if(!req.body.oldPwd){
        log.warn('Missing \'oldPwd\' from request body' + __location);
        return next(serverHelper.requestError('Missing Old Password'));
    }
    if(!req.body.newPwd){
        log.warn('Missing \'newPwd\' from request body' + __location);
        return next(serverHelper.requestError('Missing New Password'));
    }

    const insurerPortalUser = await authHelper.getUser(req.authentication.email);
    // Check the password
    if (!crypt.verifyPassword(insurerPortalUser.password, req.body.oldPwd)) {
        log.warn('Old Password does not match the current password' + __location);
        return next(serverHelper.invalidCredentialsError('Wrong Old Password'));
    }

    let password = '';

    if(validator.password.isPasswordValid(req.body.newPwd)){
        if (!validator.password.isPasswordBanned(req.body.newPwd)){
            password = await crypt.hashPassword(req.body.newPwd);
        }
        else {
            log.warn('The password contains a word or pattern that is blocked for security reasons. For more information please refer to banned-passwords.json file.' + __location);
            return next(serverHelper.requestError(`Unfortunately, your password contains a word, phrase or pattern that makes it easily guessable. Please try again with a different password.`));
        }
    }
    else{
        log.warn('Password does not meet requirements' + __location);
        return next(serverHelper.requestError('Password does not meet the complexity requirements. It must be at least 8 characters and contain one uppercase letter, one lowercase letter, one number, and one special character'));
    }

    // Do we have something to update?
    if(!password){
        log.warn('There is nothing to update' + __location);
        return next(serverHelper.requestError('There is nothing to update. Please check the documentation.'));
    }

    if(!req.authentication.userId || isNaN(req.authentication.userId || parseInt(`${req.authentication.userId}`, 10) <= 0)) {
        log.warn('Change password bad user id' + __location);
        return next(serverHelper.requestError("bad id"));
    }

    try {
        const insurerPortalUserBO = new InsurerPortalUserBO();
        await insurerPortalUserBO.setPassword(parseInt(req.authentication.userId, 10), password);
    }
    catch(e) {
        log.warn(e.message + __location);
        return next(serverHelper.internalError('Unable to set new password'));
    }

    // Everything went okay, send a success response
    res.send(200, 'Password Updated');
    return next();
}

async function updateAccount(req, res, next){
    if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }
    if(!req.body.firstName){
        log.warn('Missing \'firstName\' from request body' + __location);
        return next(serverHelper.requestError('Missing First Name'));
    }
    if(!req.body.lastName){
        log.warn('Missing \'lastName\' from request body' + __location);
        return next(serverHelper.requestError('Missing Last Name'));
    }

    try {
        const insurerPortalUserBO = new InsurerPortalUserBO();
        const payload = {
            id: req.authentication.userId,
            firstName: _.startCase(_.lowerCase(req.body.firstName)),
            lastName: _.startCase(_.lowerCase(req.body.lastName))
        };
        await insurerPortalUserBO.saveModel(payload);
    }
    catch(e) {
        log.warn(e.message + __location);
        return next(serverHelper.internalError('Unable to set update account details'));
    }

    // Everything went okay, send a success response
    res.send(200, 'Account Updated');
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPutInsurerPortalAuth('Update Account Details', `${basePath}/account`, updateAccount);
    server.addPutInsurerPortalAuth('Change Password', `${basePath}/account/change-password`, changePassword);
    // server.addPutInsurerPortalAuth('Reset Password', `${basePath}/account/reset-password`, resetPassword);
    // server.addPutInsurerPortalAuth('Forgot Password', `${basePath}/account/forgot-password`, forgotPassword);
};
