/* eslint-disable valid-jsdoc */
const serverHelper = global.requireRootPath('server.js');
const {
    createToken,
    getUser
} = require('./auth-helper');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

const {Issuer} = require('openid-client');
const OpenIdAuthConfigBO = global.requireShared('models/OpenIdAuthConfig-BO.js');
const openIdAuthConfigBO = new OpenIdAuthConfigBO();

/**
 * Returns the "client" from the openid-client library for the specified
 * openidAuthConfig.
 */
async function getAzureClient(openidAuthConfigId) {
    const config = await openIdAuthConfigBO.getById(openidAuthConfigId);
    if (!config) {
        log.error(`Config does not exist: ${openidAuthConfigId} ${__location}`);
        throw new Error(`Config does not exist: ${openidAuthConfigId} ${__location}`);
    }

    const azureIssuer = await Issuer.discover(config.discoverUrl);
    return new azureIssuer.Client({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uris: [`${global.settings.API_URL}/v1/auth/openid-auth/${openidAuthConfigId}/callback`],
        response_type: 'token'
    });
}

/**
 * REST endpoint to retrieve the OpenID Login URL.
 */
async function getLoginUrl(req) {
    try {
        const client = await getAzureClient(req.params.configId);
        const url = client.authorizationUrl({
            scope: 'User.Read openid profile email',
            response_mode: 'form_post'
        });
        log.info(`User login for client ${req.params.configId} goes to ${url}`);
        return {url: url};
    }
    catch (ex) {
        log.error(`OpenID client might be down. Error thrown: ${ex} ${__location}`);
        throw ex;
    }
}

/**
 * REST endpoint to retrieve the OpenID Callback URL.
 */
async function callback(req, res, next) {
    log.info(`Received OpenID callback: ${JSON.stringify(req.body, null, 2)}`);
    const config = await openIdAuthConfigBO.getById(req.params.configId);
    const client = await getAzureClient(req.params.configId);
    const params = client.callbackParams(req);
    const jwtBlob = params.access_token.split('.')[1].replace('-', '+').replace('_', '/');
    const externalJwt = JSON.parse(Buffer.from(jwtBlob, 'base64').toString());
    log.info(`Received Access Token payload (${req.params.configId}): ${JSON.stringify(externalJwt, null, 2)}`);

    const userInfo = await client.userinfo(req.body.access_token);
    log.info(`Received from OpenID Userinfo endpoint for user (${req.params.configId}) ${externalJwt.unique_name}: ${JSON.stringify(userInfo, null, 2)}`);
    if (!await getUser(externalJwt.unique_name)) {
        log.info(`User ${externalJwt.unique_name} not found for config ID: ${req.params.configId}. Creating user...`);
        const newUserJSON = {
            agencyId: config.agencyId,
            agencyNetworkId: config.agencyNetworkId,
            email: externalJwt.unique_name,
            password: '',
            canSign: 0,
            agencyPortalUserGroupId: 5,
            openidAuthConfigId: config.configId
        };
        log.info(`New user payload: ${JSON.stringify(newUserJSON, null, 2)}`);
        const agencyPortalUserBO = new AgencyPortalUserBO();
        await agencyPortalUserBO.saveModel(newUserJSON);
    }
    else {
        log.info(`Found user ${externalJwt.unique_name}! Generating JWT token...`);
    }

    try {
        const token = await createToken(externalJwt.unique_name);
        return res.redirect(`${global.settings.PORTAL_URL}/openid/${req.params.configId}/callback?token=${token}`, next);
    }
    catch (ex) {
        log.error("OpenID callback error: " + ex + __location);

        res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
        return next();
    }
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
    server.addPost('OpenID Login', `${basePath}/openid-auth/:configId/get-url`, wrapper(getLoginUrl));
    server.addPost('OpenID Callback', `${basePath}/openid-auth/:configId/callback`, callback);
};