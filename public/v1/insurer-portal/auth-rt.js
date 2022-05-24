const crypt = global.requireShared('services/crypt.js');
const serverHelper = global.requireRootPath('server.js');

const InsurerPortalUserBO = global.requireShared('models/InsurerPortalUser-BO.js');
const AuthHelper = require('./helpers/auth-helper');

const emailsvc = global.requireShared('./services/emailsvc.js');
const mfaCodesvc = global.requireShared('./services/mfaCodeSvc.js');
const slack = global.requireShared('./services/slacksvc.js');
var uuid = require('uuid');

async function login(req, res, next){
    // Check for data
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length <= 0) {
        log.info('Bad Request: Missing both email and password');
        return next(serverHelper.requestError('You must supply an email address and password'));
    }

    // Make sure an email was provided
    if (!req.body.email) {
        log.info('Missing email' + __location);
        return next(serverHelper.requestError('Email address is required'));
    }

    // Makes sure a password was provided
    if (!req.body.password) {
        log.info('Missing password' + __location);
        return next(serverHelper.requestError('Password is required'));
    }

    // This is a complete hack. Plus signs in email addresses are valid, but the Restify queryParser removes plus signs. Add them back in
    req.body.email = req.body.email.replace(' ', '+');

    // Authenticate the information provided by the user
    const insurerPortalUserBO = new InsurerPortalUserBO();
    let insurerPortalUserDBJson = null;
    try {
        insurerPortalUserDBJson = await insurerPortalUserBO.getByEmail(req.body.email, true);
    }
    catch (e) {
        log.error(e.message + __location);
        return next(serverHelper.internalError('Error querying database. Check logs.'));
    }

    // Make sure we found the user
    if (!insurerPortalUserDBJson) {
        log.info('Authentication failed - Account not found ' + req.body.email);
        return next(serverHelper.forbiddenError('Incorrect Email or Password'));
    }

    // Check the password
    if (!crypt.verifyPassword(insurerPortalUserDBJson.password, req.body.password)) {
        log.info('Authentication failed ' + req.body.email);
        return next(serverHelper.forbiddenError('Incorrect Email or Password'));

    }

    // Create MFA Code
    const mfaCode = mfaCodesvc.generateRandomMFACode().toString();
    const sessionUuid = uuid.v4().toString();
    const jwtToken = await AuthHelper.createMFAToken(insurerPortalUserDBJson, sessionUuid);
    const token = `Bearer ${jwtToken}`;

    const redisKey = "ipusermfacode-" + insurerPortalUserDBJson.insurerPortalUserId + "-" + mfaCode;
    const ttlSeconds = 900; //15 minutes
    await global.redisSvc.storeKeyValue(redisKey, sessionUuid, ttlSeconds);

    const emailData = {
        'html': `<p style="text-align:center;">Your login code.  It expires in 15 minutes.</p><br><p style="text-align: center;"><STRONG>${mfaCode}</STRONG></p>`,
        'subject': `Your Insurer Portal Login Code `,
        'to': insurerPortalUserDBJson.email
    };
    let emailResp = null;
    try {
        emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, 1, "");
    }
    catch (e) {
        log.error(e.message + __location);
        return next(serverHelper.internalError('Error fetching mfa redis value.'));

    }
    if(!emailResp){
        log.error(`Failed to send the mfa code email to ${insurerPortalUserDBJson.email} for Insurer Portal. Please contact the user.`);
        slack.send('#alerts', 'warning',`Failed to send the mfa code email to ${insurerPortalUserDBJson.email} for Insurer Portal. Please contact the user.`);
        return next(serverHelper.internalError('Internal error when authenticating.'));
    }

    res.send(200, token);
    return next();
}

async function verify(req, res, next) {
    // Ensure we have the proper parameters
    if (!req.body || !req.body.code) {
        log.info('Bad Request: Missing parameter code ' + __location);
        return next(serverHelper.requestError('A parameter is missing for mfacheck.'));
    }

    //check code versus Redis.
    const redisKey = "ipusermfacode-" + req.authentication.userId + "-" + req.body.code;
    let redisValueRaw = null;
    try {
        redisValueRaw = await global.redisSvc.getKeyValue(redisKey);
    }
    catch (e) {
        log.error(e.message + __location);
        return next(serverHelper.internalError('Error fetching mfa redis value.'));
    }

    if (!redisValueRaw?.found) {
        log.info('Unable to find user MFA key - Data may of expired.' + __location);
        return next(serverHelper.notAuthorizedError('Invalid Access Code'));
    }
    else if(req.authentication.tokenId === redisValueRaw?.value){
        let insurerPortalUserDBJson = null;
        try {
            // for security, we delete the key. Auto-login is one-time use only
            await global.redisSvc.deleteKey(redisKey);

            //load Insurer Portal BO
            const insurerPortalUserBO = new InsurerPortalUserBO();
            insurerPortalUserDBJson = await insurerPortalUserBO.getById(req.authentication.userId)
        }
        catch(e) {
            log.error(`AP login MFA error ${e.message}` + __location);
        }

        // Make sure we found the user
        if (!insurerPortalUserDBJson) {
            log.info('Insurer Portal - Authentication failed - Account not found ' + req.body.email);
            return next(serverHelper.forbiddenError('Access Denied'));
        }

        //Setup and return JWT
        const redisKeyUser = "ipuserinfo-" + insurerPortalUserDBJson.insurerPortalUserId;
        await global.redisSvc.storeKeyValue(redisKeyUser, JSON.stringify(insurerPortalUserDBJson));

        try {
            const jwtToken = await AuthHelper.createToken(insurerPortalUserDBJson.email);
            const token = `Bearer ${jwtToken}`;
            res.send(201, token);
            return next();
        }
        catch (ex) {
            log.error(`Internal error when authenticating ${ex}` + __location);
            return next(serverHelper.internalError('Internal error when authenticating. Check logs.'));
        }

    }
    else {
        log.info('Mismatch on MFA tokenId' + __location);
        return next(serverHelper.notAuthorizedError('Invalid Access Code'));
    }
}

async function refresh(req, res, next) {
    try {
        const jwtToken = await AuthHelper.createToken(req.authentication.email);
        const token = `Bearer ${jwtToken}`;
        res.send(201, token);
        return next();
    }
    catch (ex) {
        log.error(`Internal error when authenticating ${ex}` + __location);
        return next(serverHelper.internalError('Internal error when authenticating. Check logs.'));
    }
}

async function changeInsurer(req, res, next) {
    if(!req.body.insurerId) {
        return next(serverHelper.requestError('Missing New Insurer ID'));
    }
    try {
        const jwtToken = await AuthHelper.createToken(req.authentication.email, req.body.insurerId);
        const token = `Bearer ${jwtToken}`;
        res.send(201, token);
        return next();
    }
    catch (ex) {
        log.error(`Internal error when authenticating ${ex}` + __location);
        return next(serverHelper.internalError('Internal error when authenticating. Check logs.'));
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addPost('Create Token', `${basePath}/auth`, login);
    server.addPostMFA('MFA Check', `${basePath}/auth/verify`, verify);
    server.addPutInsurerPortalAuth('Refresh Token', `${basePath}/auth`, refresh);
    server.addPutInsurerPortalAuth('Change Insurer', `${basePath}/auth/change-insurer`, changeInsurer, 'globalUser', null)
};
