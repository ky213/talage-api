/* eslint-disable valid-jsdoc */
const serverHelper = global.requireRootPath('server.js');
const ApiKeyBO = global.requireShared('models/ApiKey-BO.js');
const ApiKey = new ApiKeyBO();

async function createApiKeySet(req) {
    const userId = parseInt(req.authentication.userID, 10);

    return await ApiKey.createApiKeySet(userId);
}

async function getApiKeysForUser(user) {

}

async function deleteApiKey(req) {

}

async function authenticateUser(req) {
    
}

const wrapper = (func) => async(req, res, next) => {
    try {
        const out = await func(req);
        res.send(200, out);
    }
    catch (ex) {
        console.log(ex);
        log.error("API server error: " + ex + __location);
        res.send(500, ex);
    }
    next();
};

exports.registerEndpoint = (server, basePath) => {
    server.addPostAuth('API Key Login', `${basePath}/authenticate`, wrapper(authenticateUser));
    server.addPostAuth('Create API Key List', basePath, wrapper(createApiKeySet));
    server.addGetAuth('API Key List', basePath, wrapper(getApiKeysForUser));
    server.addDeleteAuth('Delete API Key', `${basePath}/list`, wrapper(deleteApiKey));
};