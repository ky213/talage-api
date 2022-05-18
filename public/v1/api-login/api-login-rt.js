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
    // move to api/auth/keys
    // server.addPost('API Key Login', `${basePath}/authenticate`, authenticateUser);
    server.addPostAuth('Create API Key List', basePath, wrapper(createApiKeySet));
    server.addGetAuth('API Key List', basePath, wrapper(getApiKeysForUser));
    server.addDeleteAuth('Delete API Key', basePath, wrapper(deleteApiKey));
};