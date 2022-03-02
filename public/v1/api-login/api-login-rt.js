/* eslint-disable valid-jsdoc */
const serverHelper = global.requireRootPath('server.js');
const ApiKeyBO = global.requireShared('models/ApiKey-BO.js');
const ApiKey = new ApiKeyBO();

async function createApiKeySet(req) {
    const userId = parseInt(req.authentication.userID, 10);
    return await ApiKey.createApiKeySet(userId);
}

async function getApiKeysForUser(req) {
    const userId = parseInt(req.authentication.userID, 10);
    return ApiKey.getApiKeysForUser(userId);
}

async function deleteApiKey(req) {
    return ApiKey.deleteApiKey(req.body.apiKey);
}

async function authenticateUser(req) {
    const auth = await ApiKey.authenticate(req.body.apiKey, req.body.apiSecret);

    if (!auth.isSuccess) {
        return { status: 'failed' };
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
    server.addDeleteAuth('Delete API Key', `${basePath}/list`, wrapper(deleteApiKey));
};