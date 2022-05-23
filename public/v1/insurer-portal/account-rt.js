
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const serverHelper = global.requireRootPath('server.js');
const crypt = global.requireShared('./services/crypt.js');
const emailsvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const validator = global.requireShared('./helpers/validator.js');
const authHelper = require('./helpers/auth-helper.js')
const InsurerPortalUserBO = global.requireShared('./models/InsurerPortalUser-BO.js');

async function changePassword(req, res, next){
    if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }
    if(!req.body.newPwd){
        log.warn('Missing \'newPwd\' from request body' + __location);
        return next(serverHelper.requestError('Missing New Password'));
    }

    if(!req.body.oldPwd){
        log.warn('Missing \'oldPwd\' from request body' + __location);
        return next(serverHelper.requestError('Missing Old Password'));
    }
    let insurerPortalUser = null;
    try {
        insurerPortalUser = await authHelper.getUser(req.authentication.email);
    }
    catch {
        log.error('Failed retrieving insurer portal user' + __location);
        return next(serverHelper.internalError('Unable to Retrieve Insurer Portal User'));
    }
    if(!insurerPortalUser) {
        log.warn('Insurer Portal User Not Found' + __location);
        return next(serverHelper.notFoundError('Insurer Portal User Not Found'));
    }
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
        log.error(e.message + __location);
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
        log.error(e.message + __location);
        return next(serverHelper.internalError('Unable to set update account details'));
    }

    // Everything went okay, send a success response
    res.send(200, 'Account Updated');
    return next();
}

async function forgotPassword(req, res, next){
    // Check for data
    if(!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0){
        log.warn('Bad Request: Missing both email and password');
        return next(serverHelper.requestError('You must supply an email address and password'));
    }

    // Make sure an email was provided
    if(!req.body.email){
        log.warn('Missing email');
        return next(serverHelper.requestError('Email address is required'));
    }

    let insurerPortalUser = null;
    try {
        insurerPortalUser = await authHelper.getUser(req.body.email);
    }
    catch {
        log.error('Failed retrieving insurer portal user' + __location);
        return next(serverHelper.internalError('Unable to Retrieve Insurer Portal User'));
    }

    // Make sure we found a result before doing more processing
    if(!insurerPortalUser){
        log.warn(`Reset Password did not find user ${req.body.email}`)
        return next(serverHelper.notFoundError('Insurer Portal User not found'));
    }

    // Create a limited life JWT
    const token = jwt.sign({'userId': insurerPortalUser.insurerPortalUserId}, global.settings.AUTH_SECRET_KEY, {'expiresIn': '15m'});
    // TODO: Set dev/prod by default?
    const portalurl = global.settings.INSURER_PORTAL_URL || 'http://localhost:8084';

    const emailData = {
        'html': `<p style="text-align:center;">A request to reset your password has been recieved. To continue the reset process, please click the button below within 15 minutes.</p><br><p style="text-align: center;"><a href="${portalurl}/#/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Reset Password</a></p>`,
        'subject': `Reset Your Insurer Portal Password`,
        'to': req.body.email
    };

    const emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, 1, "");
    if(emailResp === false){
        log.error(`Failed to send the password reset email to ${req.body.email} for Insurer Portal. Please contact the user.`);
        slack.send('#alerts', 'warning',`Failed to send the password reset email to ${req.body.email} for Insurer Portal. Please contact the user.`);
    }
    else {
        log.info('Reset Password Request Complete');
    }
    // Always send a success response. This prevents leaking information about valid email addresses in our database.
    res.send(200, {
        'code': 'Success',
        'message': 'Password Reset Started'
    });
    return next();
}

async function resetPassword(req, res, next){
    if(!req.headers.authorization) {
        log.warn("No Token Provided" + __location);
        return next(serverHelper.forbiddenError('Missing authorization'));
    }
    let tokenData = null;
    try {
        tokenData = jwt.verify(req.headers.authorization.replace('Bearer ', ''), global.settings.AUTH_SECRET_KEY);
    }
    catch (error) {
        log.error("JWT: " + error + __location);
        return next(serverHelper.forbiddenError('Invalid token'));
    }

    if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }

    if(!req.body.newPwd){
        log.warn('Missing \'newPwd\' from request body' + __location);
        return next(serverHelper.requestError('Missing New Password'));
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

    if(!tokenData.userId || isNaN(tokenData.userId || parseInt(`${tokenData.userId}`, 10) <= 0)) {
        log.warn('Change password bad user id' + __location);
        return next(serverHelper.requestError("bad id"));
    }

    try {
        const insurerPortalUserBO = new InsurerPortalUserBO();
        await insurerPortalUserBO.setPassword(parseInt(tokenData.userId, 10), password);
    }
    catch(e) {
        log.error(e.message + __location);
        return next(serverHelper.internalError('Unable to set new password'));
    }

    // Everything went okay, send a success response
    res.send(200, 'Password Updated');
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addPutInsurerPortalAuth('Update Account Details', `${basePath}/account`, updateAccount);
    server.addPutInsurerPortalAuth('Change Password', `${basePath}/account/change-password`, changePassword);
    server.addPut('Reset Password', `${basePath}/account/reset-password`, resetPassword);
    server.addPost('Forgot Password', `${basePath}/account/forgot-password`, forgotPassword);
};
