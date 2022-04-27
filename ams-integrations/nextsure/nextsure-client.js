
const axios = require('axios');

const ApplicationBO = global.requireShared('./models/Application-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const IndustryCodeSvc = global.requireShared('services/industrycodesvc.js');

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
 * Nextsure client name search
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


// eslint-disable-next-line require-jsdoc
async function createApplication(agencyId,clientObject, agencyPortalUserId, agencyLocationId){
    let applicationId = null;
    const appJson = {};
    appJson.additionalInfo = {};
    //load agencyBO to get agency Network
    const agencyBO = new AgencyBO();
    const agencyDB = await agencyBO.getById(parseInt(agencyId, 10));

    appJson.agencyId = agencyId
    appJson.agencyNetworkId = agencyDB.agencyNetworkId
    if(agencyLocationId){
        //TODO validate agencyLocationId is for agencyId
        appJson.agencyLocationId = agencyLocationId;
    }
    else {
        //get agency's primary location
        const agencyLocationBO = new AgencyLocationBO();
        const locationPrimaryJSON = await agencyLocationBO.getByAgencyPrimary(agencyId).catch(function(err) {
            log.error(`Error getting Agency Primary Location ${agencyId} ` + err + __location);
        });
        if(locationPrimaryJSON && locationPrimaryJSON.systemId){
            appJson.agencyLocationId = locationPrimaryJSON.systemId;
        }
        else {
            log.error(`Error getting Agency Primary Location ${agencyId} no primary found` + __location);
            return null;
        }
    }
    appJson.additionalInfo.source = "Nextsure";
    appJson.additionalInfo.ClientID = clientObject.ClientID;

    //client names
    let clientNameJson = null;
    if(Array.isArray(clientObject.ClientNames)){
        clientNameJson = clientObject.ClientNames.find((obj) => obj.IsPrimaryName === "true")
    }
    else {
        clientNameJson = clientObject.ClientNames
    }
    appJson.businessName = clientNameJson.Name ? clientNameJson.Name.trim() : "";
    appJson.ein = clientNameJson.FEIN ? clientNameJson.FEIN.replace(`-`) : "";
    if(clientNameJson.NAICSICCodes?.NaicsCode){
        //look up Talage industry code by NaicsCode
        try{
            const icList = await IndustryCodeSvc.GetIndustryCodesByNaics(clientNameJson.NAICSICCodes.NaicsCode)
            if(icList?.length > 0){
                appJson.industryCode = icList[0].industryCodeId.toString();
            }
        }
        catch(err){
            log.error(`Nextsure create App error lookup IC ${err} ` + __location);
        }
    }
    //DBA?
    //Contacts
    let contactJson = null;
    if(Array.isArray(clientObject.Contacts)){
        contactJson = clientObject.Contacts.find((obj) => obj.IsPrimary === "true")
    }
    else {
        contactJson = clientObject.Contacts
    }
    const appContactJson = {};
    appContactJson.email = contactJson.Email
    appContactJson.firstName = contactJson.FirstName
    appContactJson.firstName = contactJson.LastName
    appContactJson.phone = contactJson.phone?.PhoneNumber
    appContactJson.primary = true;
    appJson.contacts = [];
    appJson.contacts.push(appContactJson);


    appJson.locations = [];
    let nextSureLocArray = [];
    if(Array.isArray(clientObject.Locations)){
        nextSureLocArray = clientObject.Locations
    }
    else {
        nextSureLocArray.push(clientObject.Locations)
    }
    for(const nsLoc of nextSureLocArray){

        for(const address of nsLoc.Address){
            if(address.AddressType === "Physical"){
                const newAppLoc = {
                    address: address.StreetAddress1 ? address.StreetAddress1 : null,
                    address2: address.StreetAddress2 ? address.StreetAddress2 : null,
                    city: address.City ? address.City : null,
                    state: address.State ? address.State : null,
                    zipcode: address.ZipCode ? address.ZipCode : null,
                    primary: nsLoc.IsPrimaryLocation === "true"
                }
                appJson.locations.push(newAppLoc);
                if(newAppLoc.primary){
                    appJson.primaryState = newAppLoc.state;
                }
            }
            else if(address.AddressType === "Mailing"){
                appJson.mailingAddress = address.StreetAddress1 ? address.StreetAddress1 : null
                appJson.mailingAddress2 = address.StreetAddress2 ? address.StreetAddress2 : null
                appJson.mailingCity = address.City ? address.City : null
                appJson.mailingState = address.State ? address.State : null
                appJson.mailingZipcode = address.ZipCode ? address.ZipCode : null

            }
        }


    }

    appJson.agencyPortalCreatedUser = agencyPortalUserId
    appJson.agencyPortalCreated = true;
    const applicationBO = new ApplicationBO();

    const newAppDoc = await applicationBO.insertMongo(appJson);
    applicationId = newAppDoc.applicationId;
    return applicationId
}


/**
 * Create application from Nextsure clientIdh
 * @param  {integer} agencyId - agencyId
 * @param  {string} clientId - Nextsure ClientId
 * @param  {integer} agencyPortalUserId - agencyPortalUserId for new app creation)
 * @param  {integer} agencyLocationId - Optional agencyLocationId for new app)
 * @returns {object} Array of client records
 */
async function createApplicationFromClientId(agencyId, clientId, agencyPortalUserId, agencyLocationId){
    if(!agencyId){
        log.error(`createApplicationFromClient agencyId not supplied`)
        return null
    }
    if(!clientId){
        log.error(`createApplicationFromClient clientId not supplied`)
        return null
    }

    const authToken = await auth(agencyId).catch(function(err){
        log.error(`error getting Nextsure Auth Token ${err}` + __location)
    });
    if(authToken){
        const path = "/clients/getclientbyid";

        const requestOptions = {headers: {'Content-Type': 'application/x-www-form-urlencoded'}};

        const body = {
            "clientId": clientId,
            "loadPolicies": true,
            "includeHistory": false,
            "returnContentType": "application/json"
        }

        const url = require('url');
        const params = new url.URLSearchParams(body);
        const response = await httpRequest("POST",path, authToken, null, params.toString(), requestOptions);
        if (response.error) {
            log.error(`Nextsure getclientbyid error ${response.error}` + __location)
            return null;
        }
        if (response.data.error) {
            log.error(`Nextsure getclientbyid error ${response.data.error}` + __location)
            return null;
        }
        if (!response.data.Client) {
            log.error(`Nextsure getclientbyid no response.data.Client in response ` + __location)
            log.error(`ClientSearch NextSure no Client response ${JSON.stringify(response.data)}` + __location)
            return null;
        }
        //log.debug(`ClientSearch NextSure response ${JSON.stringify(response.data)}` + __location)
        const appId = await createApplication(agencyId, response.data.Client, agencyPortalUserId, agencyLocationId)

        return appId;
    }
    else{
        return null;
    }
}

module.exports = {
    auth: auth,
    clientSearch: clientSearch,
    createApplicationFromClientId: createApplicationFromClientId
};