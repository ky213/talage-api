'use strict';

// Require packages
const DocuSign = require('docusign-esign');
const moment = require('moment-timezone');

// Set some default constants
const jwtLife = 24 * 60; // The number of seconds we are requesting the JWT stay valid, 1 hour
const scopes = 'signature'; // The scopes of capabilities we will request from DocuSign
const tokenReplaceMinutes = 5; // The accessToken must have at least this much time left or it will be replaced

// Cached token variables
let accessToken = null;
let tokenExpirationTime = null;

const productionConfig = {
    // This is the base path needed to access authentication services at DocuSign
    authBasePath: 'account.docusign.com',

    // This is the 'User ID' of the user to be impersonated. Before you can change this value, the user must allow this app.
    impersonatedUser: '4290a4ec-b2f5-4d90-a6ce-86e532b8156d',

    // This is obtained from the DocuSign admin area under 'API and Keys'. An integration must be created in Sandbox first and then promoted to production.
    integrationKey: 'f5f51cb9-af53-4906-b970-2de1b0a17270',

    // This is obtained from the DocuSign admin area under 'API and Keys' and is only shown once when the key is created. A backup of this key is in LastPass.
    privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEApcD5zBxOPg3B8QmD30ko/PMHWDdVvTf8YqHdRlAGfJQ7olPx
dmLP4P5z3kWVElBgAUuAu2v8S8aYRrZa4WMmnWDyp59As+2P0HBFSyLp3RSjPVrD
pUjJoUbmR4C+D1PtKhp2msFykJoyWo0iB0OSIuMYHcDayb9z06pu2vvuyJ1Qez4W
NlHxFc2TNVUramD5kqRxF9JiqLxppJ07IhxJ8sQlIsbMUju6lVaUpIioTnu1qDrt
nDaaGTTfGi5v959vUCO6tim0HUZArDBVR+p5zaTqs9NKxoLnwHQbVMY7bjVaNjLd
VBdOuNvOeK8WItmWrPysoMUJ5274CoKbM10RFwIDAQABAoIBAAZs4yIO7NeJ9/0s
hcCnmN+pWh0I1BmILI/0P1wk6QN2SZOC1obk0LMjmgFBSEST+gzCzQQ27OpREgEX
u5EmI06RfgaSbVMsP9lwKLd/bHpl/Of5d0EWf75xPacC7hsxAS4TJYrdOeAyIgaR
lwKaE3WnwP0SR0jv04Eeh7qUbo63PlyBLcu5Ns3p10k1AQsCIPnSANWEjYBzNw4G
5hPaO92qUCTRmeO0hn2/nymYd/aQQcfISrlD7dXMOA6eZ2IEJkWS27tete1FNfRi
IuvsPTKjF9SszP1/BWwTBauJdhgkslS23G6g30QZ8qxTFA26z2cYXJ2OwHt4dYIX
9ajQZY0CgYEA6APd18whcWp9f2MTER8W7eJG8Mv4koWgdhpv9uqHMXhPBVmpor1F
oBVmvLeaqBHoKOen0Y19rs4OrxwU6C61baB8eWjRuFe1X+ewKrC7M6IejMjokDWh
iQ8widW3NtROV05Ax64GW8pEpVlfMrNlL+l3hCGBCop2ihS+Yenw7c0CgYEAtuOL
vsCL13mrjeV5wGh+mPhdowIzfoPf5LPZUQonvaWEgqz5nvH6d5TVtAfFYrvS2Pqc
BuP7Q7G5oAMXduoQOAcbQhXTmGq1yWFJKrxaCavsf38h+66n8Mu4ldLIhJDA7H6F
/yDSIYonbp/duyXOrQIe256eIUym6SSgbQDdNnMCgYABMlPokwLxJM105LvqcLCb
lXksMMEdcFb9hPFi4p7D4Iz3yBiZ4EQFqVaYTpIbn8wEuf0hlYs6ZZGp0YlCEUua
PyOlNKcwPjOPRRChh7vPblyd+UNJyx0EKfHkJBgHzlyBEsQ+w2UBADAOckGNb2Ns
NdYJ9mpF9aTa3XSF6MD3WQKBgGCQVlm6Olvj/wOl1RoVUjqccHxADkZPhOixWR3j
2cXVXdjNUeNtaky3RfqPW9Xcy+AKulUdDK7aaOMmnr4HqdabUfYbpiREu4T/m+03
k+alYvKSgrPrrPqD5gsdRwhPkb2MtF1Xy/svgdB0ElPdC3nns7lLz7xPR5Wz5AyJ
t0MnAoGBAKwx4cAztqWqBjrOHgi/12SLGyB5Fv6AZJkWas9cxPI2Y7eAZqjWQd87
mBDS7wv05CZ9X5Q3y8KIX7tBCUuWTdwVLxxsoxUrnnyAbb0d63gBNlhSLOHl7mWI
rbArULLxnQMywWCwDFjGpp/TOFIpu9rs07Ax/2g4xghwMcayD6py
-----END RSA PRIVATE KEY-----`
};

const stagingConfig = {
    // This is the base path needed to access authentication services at DocuSign
    authBasePath: 'account-d.docusign.com',

    // This is the 'User ID' of the user to be impersonated. Before you can change this value, the user must allow this app.
    impersonatedUser: '19b5fb30-3d75-4381-a44e-88d87c45f89a',

    // This is obtained from the DocuSign admin area under 'API and Keys'. An integration must be created in Sandbox first and then promoted to production.
    integrationKey: '3c755991-135c-44da-a91a-a2d7bb25b342',

    // This is obtained from the DocuSign admin area under 'API and Keys' and is only shown once when the key is created. A backup of this key is in LastPass.
    privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAp4MKYfTgrsnunTeUgJ6nZ5rBa+K5hxsF9v2gAQLPlrhDntDh
MXY6B3fC9oMvd6OtW0Ac6NIwXgscAqkvido/LDft/+RzMakacMa/XhFyZJs53UfD
z9il8ZDnZcQWs7IzuNnoI29x5b2I++IQQPwK7ZBv2iLDn4ab+iw5lX2jG6lf3A83
BuD7n+iKdb6+WvLIvjKGBV2sV5arOX/+z+EQyGD5nfF5GHjZMCZItq7cqZ48IYBV
MmZaF61mluc+g7lZF95p9Deb0wHeLm0yjkF8T0/OoXJJcZ7BmqeSZQbEvc5GKh9a
VrwD0MIXecvWRzfBBH5SprjADrUk6FCo/hQkKwIDAQABAoIBACdDNq7JF9TALfaZ
rWwMQ86r3kQsSzIYqmg/AD7cas23+NmDuhS+0lEnyAHBs+GF8r8doukLQxz326Pg
Be14wy/ZGCbPZBSyvyjJ3NbunfJo08JC7OmNrS+WuDYJJQ0PasIcCSYtG/QuXao0
TXz91o3iOeVWGqYMhgi4TvL0FMQJqI/GVvN+Hc2ZYWld7MOxWLlCo+ZwvGTxSTbI
yHv7BLe0KBNdx2jTf+WGfhCW+iS47d4nvRYhBtMbADfJz5lamQUAziM9Ftl07I/n
V/F0bpeDS5dd2PVmll3MmC4vMfqTZzK7ca7MBhQmLC1ZWHCd/ePGICBOs+0aF56d
7JBTJDECgYEA5BVy2q8FbgQl2v3q2dS7XPHPsNpxps9i8ztgDaGwRtavbMZvCPHA
Y7IQ4MHtDKGfvRrVoKM/ClP0jDrQ5liMxB409KVwhNFY0xbwJveKuDHyGt5QhiVU
XOhKSOj8szHuuvzNxGWDLXCGSbqtC36vXxv/Y/TcLtbi9DCTJQYiDZkCgYEAvAOx
GOZ/SZ4bdnna9Om1Sg6gLQ+DXVCk8SvOIFTQIi0kS97lEZjqJMfbDM+GhVuWZKSc
88Hdc1Oh3aEy76OuACiDBmoJ7x3cvVmE4XHgcieAJfGa2X4PxIi3v4fQzYm3jM7Y
9Ax95tJsB0i8Zux9aHYvtLU/X6Qlo7cQiljpMmMCgYB8JZCWp510/Jz+Tid+2eQB
+zzpLn2eJlPdwPvPb6rbZA+oTXoyjCQEH/A/5k55CaBA9lJBVZoCrR/3FCyQtLIq
Lab1YveT079dZqbhDuxaxhTZuxhpa/g3edi1RtwFTbB75w65T+fO2+i8SPfXweUD
B+JDLgyLEjwGXko5ZNU0QQKBgF8LVrmJvAsRHDz2ONPaWUUIw7xDvVqs69TnGhqK
BXVhcJnSIeaVcLgLOBbvycccl5hlBtrKxBIK0ybg2IkAK3P1Btd1P3Rbmj02RdBZ
6uaKRWPpESila38kxg7Sr6FX3ywVXONydSr8cJP2FxfIsVTfehpWDaVhq41pe7kU
XT6VAoGAMEzRvEHCyo6hI/GDj61nLRCfr/XNmHqZsF0HTfMI1+uEcTMFJsPmc/B7
96vS7SvCAABS9DGYrrPbChM+MRjOG37qDFRoO5dm2moBgz9ov6Mo4DWksQWBOH6m
og5Ea/XGmopM2N9R9P851BYNN8zXWFi2L16PlQ/T4nk51iXg9vI=
-----END RSA PRIVATE KEY-----`
};

/**
 * Obtains a new accessToken from DocuSign using the JWT flow.
 *
 * @param {object} config - Docusign configuration
 * @returns {void}
 */
async function getNewToken(config) {
    // Initialize the DocuSign API
    const docusignApiClient = new DocuSign.ApiClient();

    // Determine which is the proper server to use for DocuSign
    docusignApiClient.setOAuthBasePath(config.authBasePath);

    // Request the JWT Token
    let result = null;
    try {
        result = await docusignApiClient.requestJWTUserToken(config.integrationKey, config.impersonatedUser, scopes, config.privateKey, jwtLife);
    }
    catch (error) {
        log.error(`Unable to authenicate to DocuSign: ${error} ${__location}`);
        if (error.response.res.text === '{"error":"consent_required"}') {
            log.error(`DocuSign consent needs to be provided. Try https://${config.authBasePath}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${config.integrationKey}&redirect_uri=https://agents.insurancewheelhouse.com`);
        }
    }
    // Store the token and expiration time locally for later use
    log.verbose('New DocuSign token was generated');
    accessToken = result.body.access_token;
    tokenExpirationTime = moment().add(result.body.expires_in, 's');
}

/**
 * This method verifies that we have a valid accessToken.
 * It should be called before any API call to DocuSign.
 * It checks that the existing access accessToken can be used.
 * If the existing accessToken is expired or doesn't exist, then
 * a new accessToken will be obtained from DocuSign by using
 * the JWT flow.
 *
 * @param {object} config - Docusign configuration
 *
 * @returns {void}
 */
async function populateConfigToken(config) {
    // Check if we have an existing token
    if (!accessToken || !tokenExpirationTime) {
        log.verbose('No DocuSign token exists. Getting a new one.');
        await getNewToken(config);
        return accessToken;
    }

    // Check if we need a new token
    if (tokenExpirationTime.subtract(tokenReplaceMinutes, 'm').isBefore(moment())) {
        log.verbose('Docusign token is expired or close to expiring. Getting a new one');
        await getNewToken(config);
        return accessToken;
    }

    return accessToken;
}

/**
 * This method configures the DocuSign API, ensuring it has a token and the correct paths
 *
 * @returns {object} - A reference to the DocuSign API class
 */
async function createDocusignAPIClient() {
    // Initialize the API
    const docusignApiClient = new DocuSign.ApiClient();

    // Load the DocuSign configuration object
    const config = global.settings.ENV === 'production' ? productionConfig : stagingConfig;

    // Determine which is the proper server to use for DocuSign
    docusignApiClient.setOAuthBasePath(config.authBasePath);

    // Get the token
    const token = await populateConfigToken(config);

    // Set the token to be sent with each API request
    docusignApiClient.addDefaultHeader('Authorization', `Bearer ${token}`);
    let accountId = null;
    try {
        // Get our user info
        const userInfo = await docusignApiClient.getUserInfo(token);
        // Grab the account ID and store it globally
        accountId = userInfo.accounts[0].accountId;
        // Set the path used for API requests
        docusignApiClient.setBasePath(`${userInfo.accounts[0].baseUri}/restapi`);
    }
    catch (error) {
        log.error('Unable to get User Info from DocuSign.' + error + __location);
        log.verbose(error);
    }

    // Return a reference to the DocuSign API that can be used for further API calls
    return {
        accountId: accountId,
        docusignApiClient: docusignApiClient
    };
}

/**
 * Create a DocuSign envelopes API object
 *
 * @returns {object} - A reference to the DocuSign Envelopes API class
 */
async function createDocusignEnvelopesAPI() {
    // Before we do anything, get a reference to the DocuSign API
    const {
        accountId, docusignApiClient
    } = await createDocusignAPIClient();

    // Get a reference to the Envelopes API
    const envelopesApi = new DocuSign.EnvelopesApi(docusignApiClient);

    return {
        accountId: accountId,
        envelopesApi: envelopesApi
    };
}

exports.userHasSigned = async function(user, envelopeID) {
    // Before we do anything, get a reference to the DocuSign API
    const {
        accountId, envelopesApi
    } = await createDocusignEnvelopesAPI();

    let result = null;
    let userSigned = false;
    try {
        result = await envelopesApi.listRecipients(accountId, envelopeID);
        result.signers.forEach((signer) => {
            if (signer.clientUserId === user.toString() && signer.status === 'completed') {
                userSigned = true;
            }
        });
    }
    catch (error) {
        log.error(`Could not retrieve envelope ${envelopeID} recipients for envelope ID ${envelopeID}: ${error} ${__location}`);
        return false;
    }
    return userSigned;
};

/**
 * Create a signing request URL and an envelopeID
 *
 * @param {string} user - user ID
 * @param {string} name - user name
 * @param {string} email - user email address
 * @param {string} envelopeID - previous envelope ID (can be null)
 * @param {string} template - template ID
 * @param {string} returnUrl - return URL
 *
 * @returns {Object} envelopeId, signingURL
 */
async function createSigningRequestURLActual(user, name, email, envelopeID, template, returnUrl) {
    const {
        accountId, envelopesApi
    } = await createDocusignEnvelopesAPI(user, name, email, template);

    // Create a Template Role that matches the one in our template
    const role = new DocuSign.TemplateRole();
    role.clientUserId = user;
    role.roleName = 'Producer';
    role.name = name;
    role.email = email;

    // envelopeID = null;

    // Create an Envelope from the Template in our account
    const envelope = new DocuSign.EnvelopeDefinition();
    envelope.templateId = template;
    envelope.templateRoles = [role];
    envelope.status = 'sent';
    if (envelopeID === null) {
        try {
            const envelopeSummary = await envelopesApi.createEnvelope(accountId, {envelopeDefinition: envelope});
            envelopeID = envelopeSummary.envelopeId;
        }
        catch (error) {
            log.error(`Unable to create DocuSign envelope for envelope ID ${envelopeID}: ${error} ${__location}`);
            return null;
        }
    }

    // Create the recipient view
    const viewRequest = new DocuSign.RecipientViewRequest();

    // Set the url where you want the recipient to go once they are done signing
    viewRequest.returnUrl = returnUrl;

    // Indicate how we authenticated the user
    viewRequest.authenticationMethod = 'email';

    // Recipient information must match embedded recipient info
    viewRequest.clientUserId = user;
    viewRequest.email = email;
    viewRequest.userName = name;

    // Call the CreateRecipientView API
    let viewResults = null;
    try {
        viewResults = await envelopesApi.createRecipientView(accountId, envelopeID, {recipientViewRequest: viewRequest});
    }
    catch (error) {
        log.error(`Unable to create DocuSign view for envelope ID ${envelopeID}: ${error} ${__location}`);
        return null;
    }

    return {
        envelopeId: envelopeID,
        signingUrl: viewResults.url
    };
}

exports.createSigningRequestURL = async function(user, name, email, envelopeID, template, returnUrl) {

    // We try to create the signing request URL with the passed-in envelope ID
    let result = await createSigningRequestURLActual(user, name, email, envelopeID, template, returnUrl);
    if (result === null) {
        // If that fails, then for some reason Docusign does not recognize the envelope ID
        // so we retry with envelope ID = null to force it to generate a new one.
        result = await createSigningRequestURLActual(user, name, email, null, template, returnUrl);
    }
    return result;
};