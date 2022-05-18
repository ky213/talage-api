/* eslint-disable valid-jsdoc */
const ApiKeyBO = global.requireShared('models/ApiKey-BO.js');
const ApiKey = new ApiKeyBO();
const serverHelper = global.requireRootPath('server.js');

/**
 * POST / route
 * @param {*} req req
 * @returns {*}
 */
async function createApiKeySet(req) {
    // Check for user permission
    if(!req.authentication.permissions.api.manage){
        return serverHelper.forbiddenError('Do not have Permission');
    }

    const userId = parseInt(req.authentication.userID, 10);

    // Check if active keys are at the limit
    const activeKeysCount = await ApiKey.getActiveKeysCount(userId);
    if(activeKeysCount >= 5) {
        throw serverHelper.requestError('Limit Reached (Limit: 5)');
    }

    // If API Keys feature is not enabled, block deletion
    const isApiKeysEnabled = await ApiKey.isApiKeysEnabled(userId);
    if(!isApiKeysEnabled){
        throw serverHelper.requestError('Feature Disabled');
    }

    return ApiKey.createApiKeySet(userId);
}

/**
 * GET / route
 * @param {*} req req
 * @returns {*}
 */
async function getApiKeysForUser(req) {
    // Check for user permission
    if(!req.authentication.permissions.api.view){
        return serverHelper.forbiddenError('Do not have Permission');
    }

    const userId = parseInt(req.authentication.userID, 10);

    // If API Keys feature is not enabled, block fetch
    const isApiKeysEnabled = await ApiKey.isApiKeysEnabled(userId);
    if(!isApiKeysEnabled){
        throw serverHelper.requestError('Feature Disabled');
    }

    return ApiKey.getApiKeysForUser(userId);
}

/**
 * DELETE / route
 * @param {*} req req
 * @returns {*}
 */
async function deleteApiKey(req) {
    // Check for user permission
    if(!req.authentication.permissions.api.manage){
        return serverHelper.forbiddenError('Do not have Permission');
    }

    const userId = parseInt(req.authentication.userID, 10);

    // If API Keys feature is not enabled, block deletion
    const isApiKeysEnabled = await ApiKey.isApiKeysEnabled(userId);
    if(!isApiKeysEnabled){
        throw serverHelper.requestError('Feature Disabled');
    }

    return ApiKey.deleteApiKey(userId, req.query.apiKey);
}

/**
 * POST /authenticate route do use wrapper.
 * @param {*} req req
 * @param {*} res res - Returns 401 if no auth
 * @returns {*}
 */
async function authenticateUser(req, res, next) {
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

const wrapper = (func) => async(req, res, next) => {
    try {
        const out = await func(req);
        res.send(200, out);
    }
    catch (ex) {
        // Handling for none Server Errors (Restify Errors)
        if(ex?.body?.code){
            log.error(`${ex.body.code}Error: ` + ex.message + __location);
            return next(ex);
        }
        log.error("API server error: " + ex + __location);
        //no raw error messages.  Potental security issues.
        res.send(500, ex);
    }
    next();
};

exports.registerEndpoint = (server, basePath) => {
    // need to return 401 on bad auth not 200.
    server.addPost('API Key Login', `${basePath}/authenticate`, authenticateUser);
    server.addPostAuth('Create API Key List', basePath, wrapper(createApiKeySet));
    server.addGetAuth('API Key List', basePath, wrapper(getApiKeysForUser));
    server.addDeleteAuth('Delete API Key', basePath, wrapper(deleteApiKey));
};