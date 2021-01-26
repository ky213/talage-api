const axios = require('axios');
const queryString = require("querystring");

const tokenURLTest = "https://uatauth.amtrustgroup.com/AuthServer_UserTest/OpenIdConnect/Token";
const tokenURLProduction = "https://auth.amtrustgroup.com/AuthServer/OpenIdConnect/Token";

/**
 * Simple axios wrapper
 * @param  {string} method - HTTP verb (GET, POST, ...)
 * @param  {string} url - Full URL to the endpoint
 * @param  {object} params - Query parameters
 * @param  {object | string} data - Body data
 * @param  {object} options - Extra Axios options
 * @returns {object} response headers, status, and body data
 */
async function httpRequest(method, url, params = null, data = null, options = null) {
    const requestOptions = {
        method: method,
        url: url,
        ...options
    };
    if (params) {
        requestOptions.params = params;
    }
    if (data) {
        requestOptions.data = data;
    }
    let response = null;
    try {
        // Perform the request
        response = await axios.request(requestOptions);
    }
    catch (error) {
        return {
            error: error,
            data: error.response ? error.response.data : null
        };
    }
    return {
        headers: response.headers,
        status: response.status,
        data: response.data
    };
}

/**
 * Authorize the AmTrust client and cache the token
 * @param  {string} clientId - Client ID
 * @param  {string} clientSecret - Client Secret
 * @param  {string} username - Username
 * @param  {string} password - Password
 * @param  {string} mulesoftSubscriberIdIn - Subscriber ID
 * @param  {boolean} useTestServers - Use the test servers, production otherwise
 * @returns {boolean} true if successful, false otherwise
 */
async function authorize(clientId, clientSecret, username, password, mulesoftSubscriberIdIn, useTestServers) {

    const requestData = {
        grant_type: "password",
        client_id: clientId,
        client_secret: clientSecret,
        username: username,
        password: password,
        scope: "openid profile legacy_info legacy_id",
        response_type: "token id_token",
        undefined: ""
    };
    const requestDataString = queryString.stringify(requestData);

    const requestOptions = {headers: {"Content-type": "application/x-www-form-urlencoded"}}

    const response = await httpRequest("POST", useTestServers ? tokenURLTest : tokenURLProduction, null, requestDataString, requestOptions);
    if (response.error) {
        return null;
    }
    if (response.data.error) {
        return null;
    }
    if (!response.data.access_token) {
        return null;
    }
    return response.data.access_token;
}

module.exports = {authorize: authorize};