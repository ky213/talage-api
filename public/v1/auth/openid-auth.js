/* eslint-disable valid-jsdoc */
const serverHelper = global.requireRootPath('server.js');
const {
    createToken,
    getUser
} = require('./auth-helper');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const agencyPortalUserBO = new AgencyPortalUserBO();
const crypt = global.requireShared('./services/crypt.js');

const {Issuer} = require('openid-client');
const OpenIdAuthConfigBO = global.requireShared('models/OpenIdAuthConfig-BO.js');
const openIdAuthConfigBO = new OpenIdAuthConfigBO();

const AgencyPortalUserGroupBO = global.requireShared('models/AgencyPortalUserGroup-BO.js');
const agencyPortalUserGroup = new AgencyPortalUserGroupBO();

const _ = require('lodash');
const {generators} = require('openid-client');

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
        response_type: 'id_token'
    });
}

/**
 * REST endpoint to retrieve the OpenID Login URL.
 */
async function getLoginUrl(req, res) {
    try {
        const nonce = generators.nonce();

        const client = await getAzureClient(req.params.configId);
        const url = client.authorizationUrl({
            scope: 'User.Read openid profile email',
            response_mode: 'form_post',
            nonce: nonce
        });
        res.setCookie('talage_nonce', await crypt.encrypt(nonce), {
            maxAge: 60 * 10, // 10 minutes to login only
            httpOnly: true
        });
        res.header('Access-Control-Allow-Credentials', true);

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
    try {
        log.info(`Received OpenID callback: ${JSON.stringify(req.body, null, 2)}`);

        const config = await openIdAuthConfigBO.getById(req.params.configId);
        const client = await getAzureClient(req.params.configId);

        const cookieNonce = await crypt.decrypt(req.cookies.talage_nonce);
        const tokenSet = await client.callback(`${global.settings.API_URL}/v1/auth/openid-auth/${req.params.configId}/callback`,
            client.callbackParams(req),
            {nonce: cookieNonce});
        res.clearCookie('talage_nonce');

        const claims = tokenSet.claims();

        log.info(`Received Access Token claims (${req.params.configId}): ${JSON.stringify(claims, null, 2)}`);

        let userGroupName = _.get(claims, 'roles[0]', 'Analyst');
        // There is a special exception for Super Administrator because Azure
        // doesn't allow spaces in role names.
        if (userGroupName === 'SuperAdministrator') {
            userGroupName = 'Super Administrator';
        }
        const userGroup = _.get(await agencyPortalUserGroup.getList({name: userGroupName}), '[0]');
        log.info(`found role (agency portal user group) for user: ${userGroupName}`);
        const user = await getUser(claims.preferred_username)
        if (!user) {
            log.info(`User ${claims.preferred_username} not found for config ID: ${req.params.configId}. Creating user...`);
            const newUserJSON = {
                agencyId: config.agencyId,
                agencyNetworkId: config.agencyNetworkId,
                email: claims.preferred_username,
                password: '',
                canSign: 0,
                agencyPortalUserGroupId: userGroup.systemId,
                openidAuthConfigId: config.configId
            };
            log.info(`New user payload: ${JSON.stringify(newUserJSON, null, 2)}`);
            await agencyPortalUserBO.saveModel(newUserJSON);
        }
        else {
            // Always sync the role in OpenID with the Talage role.
            await agencyPortalUserBO.updateRole(user.agencyPortalUserId, userGroup.systemId);
            log.info(`Found user ${claims.preferred_username}! Generating JWT token...`);
        }

        const token = await createToken(claims.preferred_username);
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