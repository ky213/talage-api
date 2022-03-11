/* eslint-disable valid-jsdoc */
const ApiKeyBO = global.requireShared('models/ApiKey-BO.js');
const ApiKey = new ApiKeyBO();

/**
 * POST / route
 * @param {*} req req
 * @returns {*}
 */
async function createApiKeySet(req) {
    const userId = parseInt(req.authentication.userID, 10);
    return ApiKey.createApiKeySet(userId);
}

/**
 * GET / route
 * @param {*} req req
 * @returns {*}
 */
async function getApiKeysForUser(req) {
    const userId = parseInt(req.authentication.userID, 10);
    return ApiKey.getApiKeysForUser(userId);
}

/**
 * DELETE / route
 * @param {*} req req
 * @returns {*}
 */
async function deleteApiKey(req) {
    const userId = parseInt(req.authentication.userID, 10);
    return ApiKey.deleteApiKey(userId, req.query.apiKey);
}

/**
 * POST /authenticate route
 * @param {*} req req
 * @returns {*}
 */
async function authenticateUser(req) {
    const auth = await ApiKey.authenticate(req.body.apiKey, req.body.apiSecret);

    if (!auth.isSuccess) {
        return {status: 'failed'};
    }
    return {
        status: 'Created',
        token: auth.token
    };
}

const wrapper = (func) => async(req, res, next) => {
    try {
        const out = await func(req);
        res.send(200, out);
    }
    catch (ex) {
        log.error("API server error: " + ex + __location);
        res.send(500, ex);
    }
    next();
};

exports.registerEndpoint = (server, basePath) => {
    server.addPost('API Key Login', `${basePath}/authenticate`, wrapper(authenticateUser));
    server.addPostAuth('Create API Key List', basePath, wrapper(createApiKeySet));
    server.addGetAuth('API Key List', basePath, wrapper(getApiKeysForUser));
    server.addDeleteAuth('Delete API Key', basePath, wrapper(deleteApiKey));
};