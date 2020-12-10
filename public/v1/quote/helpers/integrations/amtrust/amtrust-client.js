const axios = require('axios');
const queryString = require("querystring");

const baseAPIURLTest = "https://utgateway.amtrustgroup.com/DigitalAPI_Usertest";
const baseAPIURLProduction = "https://gateway.amtrustgroup.com/DigitalAPI";

let accessToken = "";
let mulesoftSubscriberId = "";
let baseAPIURL = null;

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

    baseAPIURL = useTestServers ? baseAPIURLTest : baseAPIURLProduction;
    mulesoftSubscriberId = mulesoftSubscriberIdIn;

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

    const response = await httpRequest("POST", "https://uatauth.amtrustgroup.com/AuthServer_UserTest/OpenIdConnect/Token", null, requestDataString, requestOptions);
    if (response.error) {
        return null;
    }
    if (response.data.error) {
        return null;
    }
    if (!response.data.access_token) {
        return null;
    }
    accessToken = response.data.access_token;
    return accessToken;
}

/**
 * Call an AmTrust API endpoint
 * @param  {string} method - HTTP verbs GET, POST, PUT, ...
 * @param  {string} endpoint - Endpoint path to call
 * @param  {string} queryParameters - Query parameters to append to the URL
 * @param  {string} data - Body data
 * @returns {object} response data
 */
async function callAPI(method, endpoint, queryParameters = null, data = null) {
    const requestOptions = {headers: {
        "Content-type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "subscriber_id": mulesoftSubscriberId
    }}
    const response = await httpRequest(method, baseAPIURL + endpoint, queryParameters, data ? JSON.stringify(data) : null, requestOptions);
    return response.data;
}

/**
 * Gets the legal entities for a state on the given effective date
 * @param  {string} state - Two character state abbreviation
 * @param  {string} effectiveDate - Date formatted as YYYY-MM-DD
 * @returns {void}
 */
async function getLegalEntities(state, effectiveDate) {
    await callAPI("GET", `/api/v2/states/${state}/effectiveDate/${effectiveDate}/legalEntities/available`);
    // console.log("getLegalEntities", response);
    // This is unused but remains "just in case"
}

module.exports = {
    authorize: authorize,
    getLegalEntities: getLegalEntities
};