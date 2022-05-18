/* eslint-disable valid-jsdoc */
const serverHelper = global.requireRootPath('server.js');
// const {'v4': uuidv4} = require('uuid');
// const moment = require('moment');
const crypt = global.requireShared('./services/crypt.js');
const tokenSvc = global.requireShared('./services/tokensvc.js');
const ApiKeyBO = global.requireShared('models/ApiKey-BO.js');
const ApiKey = new ApiKeyBO();

/**
 * Responds to get requests for an API authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function getToken(req, res, next) {
    let error = false;

    // Query parameters user, key, and joomla_user are all optional now since the quoting engine was broken out
    const payload = {};
    // Add Redis only payload properties here, will not be used when signing jwt.
    const additionalPayload = {};

    // TOOD basic Auth for apikey and apiSecret.

    //check for Agency Portal user access
    // Validate the passed-in user and key
    if (req.body && req.body.user && req.body.password) {
        // Authenticate the information provided by the user


        const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
        const agencyPortalUserBO = new AgencyPortalUserBO();
        const agencyPortalUserJSON = await agencyPortalUserBO.getByEmailAndAgencyNetworkId(req.body.user, true, req.body.agencyNetworkId).catch(function(err){
            log.error(err + __location);
            res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
            error = true;
        });

        if (error) {
            return next(false);
        }

        // Check that the key was valid
        if (!agencyPortalUserJSON) {
            log.info('Authentication failed - No DB record' + __location);
            res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
            return next();
        }
        //Check AgencyNetwork has API Access.
        let agencyNetworkHasApiAccess = false;
        const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
        const agencyNetworkBO = new AgencyNetworkBO()
        try{
            const agencyNetworkJSON = await agencyNetworkBO.getById(agencyPortalUserJSON.agencyNetworkId);
            if(agencyNetworkJSON?.featureJson?.enableApiAccess === true){
                agencyNetworkHasApiAccess = true;
            }
        }
        catch(err){
            log.error(`API Auth GetToken agencyNetworkBO DB access error ${error}` + __location);
        }

        if(agencyNetworkHasApiAccess !== true){
            log.error(`Authentication failed - No API Access AGencyNetwork ${agencyPortalUserJSON.agencyNetworkId} agencyPortalUserId ${agencyPortalUserJSON.agencyPortalUserId}  `);
            res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
            return next();

        }
        // Check the key
        if (!crypt.verifyPassword(agencyPortalUserJSON.password, req.body.password)) {
            log.info('Authentication failed');
            res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
            return next();
        }
        // TODO Application manage rights

        payload.userId = agencyPortalUserJSON.agencyPortalUserId;

        additionalPayload.agencyId = agencyPortalUserJSON.agencyId
        additionalPayload.agencyNetworkId = agencyPortalUserJSON.agencyNetworkId
        additionalPayload.isAgencyNetworkUser = agencyPortalUserJSON.isAgencyNetworkUser
        additionalPayload.agencyPortalUserGroupId = agencyPortalUserJSON.agencyPortalUserGroupId
        // Rights/permissions
        try{
            const AgencyPortalUserGroupBO = global.requireShared('models/AgencyPortalUserGroup-BO.js');
            const agencyPortalUserGroupBO = new AgencyPortalUserGroupBO();
            const agencyPortalUserGroupDB = await agencyPortalUserGroupBO.getById(agencyPortalUserJSON.agencyPortalUserGroupId);
            additionalPayload.permissions = agencyPortalUserGroupDB.permissions;
        }
        catch(err){
            log.error("Error get permissions from Mongo " + err + __location);
        }
    }
    else {
        log.info('Authentication failed - Bad Request ' + __location);
        res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
        return next();
    }

    payload.apiToken = true;
    const rawJwt = await tokenSvc.createNewToken(payload, additionalPayload);
    const token = `Bearer ${rawJwt}`;

    res.send(201, {
        status: 'Created',
        token: token
    });
    return next();
}


/**
 * POST /authenticate route do use wrapper.
 * @param {*} req req
 * @param {*} res res - Returns 401 if no auth
 * @returns {*}
 */
async function authenticateApiKeys(req, res, next) {
    const responseJSON = {status: 'failed'}
    let error = null
    try{
        const keyId = req.body.apiKey ? req.body.apiKey : req.query.apiKey;

        if(keyId){
            // If API Keys feature is not enabled, block user authentication
            const isApiKeysEnabled = await ApiKey.isApiKeysEnabled(null, keyId);
            if(isApiKeysEnabled) {
                const auth = await ApiKey.authenticate(keyId, req.body.apiSecret);
                if (auth.isSuccess) {
                    responseJSON.status = 'Created'
                    responseJSON.token = auth.token
                }
            }
        }
    }
    catch(err){
        error = err;
        log.error(`ApiKey Error ${err}` + __location)
        responseJSON.status = "Server 500 during auth"
    }
    if(error){
        res.send(500, responseJSON);
    }
    else if(responseJSON.status === "Created"){
        res.send(200, responseJSON);
    }
    else {
        res.send(401, responseJSON);
    }
    next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGet('Get Token', `${basePath}/auth`, getToken);
    server.addPut('PUT getToken', `${basePath}/auth`, getToken);
    server.addPost('POST getToken', `${basePath}/auth`, getToken);
    server.addPost('POST getToken', `${basePath}/auth/keys`, authenticateApiKeys);
};