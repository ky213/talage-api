
const axios = require('axios');

/**
 * Simple axios wrapper
 * @param  {string} method - HTTP verb (GET, POST, ...)
 * @param  {string} path - path from base URL
 * @param  {string} authToken - JWT for request
 * @param  {object} params - Query parameters
 * @param  {object | string} data - Body data
 * @param  {object} options - Extra Axios options
 * @returns {object} response headers, status, and body data
 */
async function httpRequest(method, path, authToken, params = null, data = null, options = null) {

    let url = '';
    if (global.settings.ENV === 'production') {
        url = `https://resteai.nexsure.com`
    }
    else {
        url = `https://resteaiqa0.nexsure.com`
    }

    url += path;
    if(!options){
        options = {};
    }

    if(!options.headers){
        options.headers = {};
    }
    options.headers.Authorization = `Bearer ${authToken}`

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
 * Simple axios wrapper for auth
 * @param  {integer} agencyId - agencyId
 * @returns {object} token
 */
async function auth(agencyId){
    //Basic Auth should be calculated with username and password set
    // in the admin for the insurer
    // Basic Auth setup moved to Auth function
    log.debug(`GETTING Nextsure AuthToken` + __location)
    let authUrl = null;
    if (global.settings.ENV === 'production') {
        authUrl = `https://resteai.nexsure.com/auth/gettoken`
    }
    else {
        authUrl = `https://resteaiqa0.nexsure.com/auth/gettoken`
    }

    const query = {
        agencyId: agencyId,
        amsType: "Nextsure",
        active: true
    }
    const AgencyAmsCredModel = global.mongoose.AgencyAmsCred;
    const agencyAmsCredJson = await AgencyAmsCredModel.findOne(query, '-__v').lean();
    if(agencyAmsCredJson){
        const requestOptions = {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
        const body = {
            "IntegrationKey": agencyAmsCredJson.apiKey,
            "IntegrationLogin": agencyAmsCredJson.username,
            "IntegrationPwd": agencyAmsCredJson.password
        }
        const url = require('url');
        const params = new url.URLSearchParams(body);

        let respToken = null;
        try {
            const result = await axios.post(`${authUrl}`, params.toString(), requestOptions);
            respToken = result.data?.access_token;
        }
        catch (err) {
            log.error(`Nextsure Auth failed ${err} - ${authUrl} ${JSON.stringify(requestOptions)} ${params.toString()}` + __location);
            return null
        }
        return respToken;
    }
    else {
        log.warn(`No agencyAmsCred record for ${agencyId}`)
        return null;
    }
}

/**
 * Simple axios wrapper for auth
 * @param  {integer} agencyId - agencyId
 * @param  {string} companyName - search string
 * @param  {string} territory - State abbr for search)
 * @returns {object} Array of client records
 */
async function clientSearch(agencyId, companyName, territory){
    const authToken = await auth(agencyId).catch(function(err){
        log.error(`error getting Nextsure Auth Token ${err}` + __location)
    });
    if(authToken){
        const path = "/clients/getclientbyname?searchType=1";

        const requestOptions = {headers: {'Content-Type': 'application/x-www-form-urlencoded'}};

        const body = {
            "clientName":companyName,
            "returnContentType": "application/json"
        }

        const url = require('url');
        const params = new url.URLSearchParams(body);
        const response = await httpRequest("POST",path, authToken, null, params.toString(), requestOptions);
        if (response.error) {
            log.error(`Nextsure clientSearch error ${response.error}` + __location)
            return null;
        }
        if (response.data.error) {
            log.error(`Nextsure clientSearch error ${response.data.error}` + __location)
            return null;
        }
        if (!response.data.Clients) {
            log.error(`Nextsure clientSearch no response.data.Clients in response ` + __location)
            log.error(`ClientSearch NextSure no Clients response ${JSON.stringify(response.data)}` + __location)
            return null;
        }
        //log.debug(`ClientSearch NextSure response ${JSON.stringify(response.data)}` + __location)
        //deterimine if more than one client returned
        const clientArray = [];
        if(Array.isArray(response.data.Clients.Client)){
            for(const client of response.data.Clients.Client){
                const returnClient = processSearchClient(client, territory);
                if(returnClient?.clientId){
                    clientArray.push(returnClient);
                }
            }
        }
        else {
            const client = response.data.Clients.Client
            const returnClient = processSearchClient(client, territory);
            if(returnClient?.clientId){
                clientArray.push(returnClient);
            }
        }
        return clientArray;
    }
    else {
        log.error(`Failed to get Nextsure AuthToken ` + __location)
        return [];
    }
}

// eslint-disable-next-line require-jsdoc
function processSearchClient(client,territory){
    const returnClient = {}
    let location = {};
    if(Array.isArray(client.Locations)){
        location = client.Locations.find((loc) => loc.IsPrimaryLocation === "true")
    }
    else {
        location = client.Locations
    }

    if(location?.Address){
        const primaryAddress = location.Address.find((addr) => addr.AddressType === "Physical")
        if(!territory || primaryAddress?.State === territory){
            returnClient.clientId = client.ClientID
            let clientName = null;
            if(Array.isArray(client.ClientNames)){
                clientName = client.ClientNames.find((obj) => obj.IsPrimaryName === "true")
            }
            else {
                clientName = client.ClientNames
            }
            returnClient.clientName = clientName?.Name
            returnClient.address1 = primaryAddress.StreetAddress1
            returnClient.city = primaryAddress.City
            returnClient.state = primaryAddress.State
            returnClient.zipcode = primaryAddress.ZipCode
        }
    }

    return returnClient
}


// async function getClient(agencyId, clientId){


//     return null;
// }


// async function createApplicationFromClient(agencyId, clientId){


//     return null;
// }

module.exports = {
    auth: auth,
    clientSearch: clientSearch
};