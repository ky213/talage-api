
const axios = require('axios');
var parser = require('xml2json');
const _ = require('lodash');

const ApplicationBO = global.requireShared('./models/Application-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const IndustryCodeSvc = global.requireShared('services/industrycodesvc.js');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');

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
        // url = `https://resteai.nexsure.com`

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
    //log.debug(`GETTING Nexsure AuthToken` + __location)
    let authUrl = null;
    if (global.settings.ENV === 'production') {
        authUrl = `https://resteai.nexsure.com/auth/gettoken`
    }
    else {
        authUrl = `https://resteaiqa0.nexsure.com/auth/gettoken`
        // authUrl = `https://resteai.nexsure.com/auth/gettoken`

    }

    const query = {
        agencyId: agencyId,
        amsType: "Nexsure",
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
        //log.debug(`authUrl ${authUrl} body ${JSON.stringify(body)}` + __location);
        const url = require('url');
        const params = new url.URLSearchParams(body);

        let respToken = null;
        try {
            const result = await axios.post(`${authUrl}`, params.toString(), requestOptions);
            respToken = result.data?.access_token;
        }
        catch (err) {
            log.error(`Nexsure Auth failed ${err} - ${authUrl} ${JSON.stringify(requestOptions)} ${params.toString()}` + __location);
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
 * Nexsure client name search
 * @param  {integer} agencyId - agencyId
 * @param  {string} companyName - search string
 * @param  {string} territory - State abbr for search)
 * @returns {object} Array of client records
 */
async function clientSearch(agencyId, companyName, territory){
    if(!companyName){
        return [];
    }
    if(!territory){
        return [];
    }
    log.debug(`Nexsure clientSearch companyName ${companyName}  territory ${territory}` + __location)
    const authToken = await auth(agencyId).catch(function(err){
        log.error(`error getting Nexsure Auth Token ${err}` + __location)
    });
    if(authToken){
        const path = "/clients/getclientlist?searchType=1";

        const requestOptions = {headers: {'Content-Type': 'application/x-www-form-urlencoded'}};

        const body = {
            "clientName": _.escape(companyName.trim()),
            "returnContentType": "application/json"
        }

        const url = require('url');
        const params = new url.URLSearchParams(body);
        const response = await httpRequest("POST",path, authToken, null, params.toString(), requestOptions);
        if (response.error) {
            log.error(`Nexsure clientSearch error ${response.error} on companyname ${companyName}` + __location)
            return null;
        }
        if (!response.data) {
            log.info(`Nexsure clientSearch no response.data in response ${response}  on companyname ${companyName} ` + __location)
            return null;
        }
        if (response.data.error) {
            log.error(`Nexsure clientSearch error ${response.data.error}  on companyname ${companyName}` + __location)
            return null;
        }

        if (!response.data.Clients) {
            log.debug(`Nexsure client search got not hits` + __location)
            //not found case
            return [];
        }
        //log.debug(`ClientSearch Nexsure response ${JSON.stringify(response.data)}` + __location)
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
        log.error(`Failed to get Nexsure AuthToken ` + __location)
        return [];
    }
}

// eslint-disable-next-line require-jsdoc
function processSearchClient(client,territory){
    const returnClient = {}
    let location = {};
    if(client.Locations){
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
    }
    else if(!territory || client?.LocState === territory){
        log.debug(`processing clientlist search results`)
        returnClient.clientId = client.ClientId
        returnClient.clientName = client.ClientName
        returnClient.clientName = client.ClientType
        returnClient.ClientStage = client.ClientStage
        returnClient.address1 = client.LocAddress1
        returnClient.city = client.LocCity
        returnClient.state = client.LocState
        returnClient.zipcode = client.LocZipCode
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
    appJson.additionalInfo.source = "Nexsure";
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
            log.error(`Nexsure create App error lookup IC ${err} ` + __location);
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
    let nexsureLocArray = [];
    if(Array.isArray(clientObject.Locations)){
        nexsureLocArray = clientObject.Locations
    }
    else {
        nexsureLocArray.push(clientObject.Locations)
    }
    for(const nsLoc of nexsureLocArray){

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
 * Create application from Nexsure clientIdh
 * @param  {integer} agencyId - agencyId
 * @param  {string} clientId - Nexsure ClientId
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
        log.error(`error getting Nexsure Auth Token ${err}` + __location)
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
            log.error(`Nexsure getclientbyid error ${response.error}` + __location)
            return null;
        }
        if (response.data.error) {
            log.error(`Nexsure getclientbyid error ${response.data.error}` + __location)
            return null;
        }
        if (!response.data.Client) {
            log.error(`Nexsure getclientbyid no response.data.Client in response ` + __location)
            log.error(`ClientSearch Nexsure no Client response ${JSON.stringify(response.data)}` + __location)
            return null;
        }
        //log.debug(`ClientSearch Nexsure response ${JSON.stringify(response.data)}` + __location)
        const appId = await createApplication(agencyId, response.data.Client, agencyPortalUserId, agencyLocationId)

        return appId;
    }
    else{
        return null;
    }
}

/**
 * Create application from Nexsure clientIdh
 * @param  {integer} agencyId - agencyId
 * @param  {string} clientId - Nexsure ClientId
 * @param  {integer} appDoc - applicationDoc new client source Doc
 * @param  {integer} processBound - if true quote and app will be get marked bound, if necessary manual quote will be added
 * @returns {object} Array of policy records converted to use Talage InsurerId and quoteId
 */
async function getPoliciesByClientId(agencyId, clientId, appDoc, processBound = false){

    let policies = [];

    if(!clientId || !agencyId){
        return policies;
    }
    const authToken = await auth(agencyId).catch(function(err){
        log.error(`error getting Nexsure Auth Token ${err}` + __location)
    });
    if(authToken){
        const requestJson = {
            "SearchType": 1,
            "ClientID": clientId,
            "PolicyStatus": "In Force"
        }
        //log.debug(`policy parameters ${JSON.stringify(requestJson)}`)
        // EffDateFrom: appDoc.createdAt.toISOString()
        //"EffDateFrom": "2022-01-01T00:45:37.277Z",
        //match to Talage insurers
        const path = "/policy/policysearchwithdetails?page=1&resultsPerPage=20&returnContentType=application/json";

        const requestOptions = {headers: {'Content-Type': 'application/json'}};
        const response = await httpRequest("POST",path, authToken, null, requestJson, requestOptions);
        if (response.error) {
            log.error(`Nexsure getPoliciesByClientId error ${response.error}` + __location)
            return null;
        }
        if (response.data.error) {
            log.error(`Nexsure getPoliciesByClientId error ${response.data.error}` + __location)
            return null;
        }
        if (!response.data.Policies?.Policy) {
            log.error(`Nexsure getPoliciesByClientId no response.data.Policies.Policy in response ` + __location)
            log.error(`ClientSearch Nexsure no Client response ${JSON.stringify(response.data)}` + __location)
            return null;
        }
        const returnedJSON = response.data;
        if(returnedJSON.Policies?.Policy){
            if(Array.isArray(returnedJSON.Policies.Policy)){
                policies = returnedJSON.Policies.Policy
            }
            else {
                policies = [returnedJSON.Policies.Policy]
            }

            const insurerBO = new InsurerBO();
            const insurerList = await insurerBO.getList({active: true}).catch(function(err) {
                log.error("Insurer load error " + err + __location);
            });
            //load ams
            const query = {"amsType" : "Nexsure"}
            const AmsModel = global.mongoose.Ams;
            const amsJson = await AmsModel.findOne(query, '-__v').lean();
            if(amsJson){
                let insurerId = 0;
                for(const amsPolicy of policies){

                    if(amsPolicy.BillingCarrier?.CarrierName){
                        // eslint-disable-next-line guard-for-in
                        for(const insurerName in amsJson.insurerMap){
                            if(insurerId === 0 && amsPolicy.BillingCarrier.CarrierName.indexOf(insurerName) > -1){
                                insurerId = amsJson.insurerMap[insurerName];
                            }
                        }
                        if(insurerId === 0 && insurerList){
                            for(const insurerDB of insurerList){
                                if(insurerId === 0 && amsPolicy.BillingCarrier.CarrierName.indexOf(insurerDB.name) > -1){
                                    insurerId = insurerDB.insurerId
                                    break;
                                }
                            }
                        }

                    }
                    if(insurerId > 0){
                        amsPolicy.insurerId = insurerId;
                        // add insurerId
                        if(processBound){
                            //mark quote if necessary
                        }
                    }
                    else {
                        log.error(`Nexsure getPoliciesByClientId unknown carrier ${amsPolicy.BillingCarrier.CarrierName} ` + __location)
                    }
                }
            }
        }
        else {
            log.error(`Nexsure getPoliciesByClientId no response.data.Policies.Policy in response ` + __location)
        }
    }
    return policies;
}


/**
 * Create application from Nexsure clientIdh
 * @param  {integer} agencyId - agencyId
 * @param  {integer} appDoc - applicationDoc new client source Doc
 * @param  {integer} quoteDoc - (optional) quoteDoc to create a policy from from.
 * @returns {string} clientId of new Nexsure policy records
 */
async function createClientFromAppDoc(agencyId, appDoc, quoteDoc){
    const newClientJSON = {};
    if(!appDoc){
        return {message: "no application doc found"};
    }
    if(appDoc.amsInfo?.clientId){
        return {clientId: appDoc.amsInfo.clientId}
    }
    if(appDoc.primaryState || appDoc.mailingState){
        const appStateCd = appDoc.primaryState ? appDoc.primaryState : appDoc.mailingState
        log.info(`calling Nexsure create client client search check for appId ${appDoc.applicationId}` + __location)
        const oldClientList = await clientSearch(agencyId, appDoc.businessName, appStateCd);
        if(oldClientList?.length > 0){
            const clientId = oldClientList[0].clientId;
            newClientJSON.clientId = clientId;
            log.info(`calling Nexsure create client found existing client ${clientId} for appId ${appDoc.applicationId}` + __location)
            try{
                const applicationBO = new ApplicationBO();
                const amsJSON = {amsInfo : {
                    "amsType" : "Nexsure",
                    clientId: clientId
                }};
                await applicationBO.updateMongo(appDoc.applicationId, amsJSON);
            }
            catch(err){
                log.error(`Nexsure createClientFromAppDoc updating App Doc error ${err}` + __location)
            }
            return newClientJSON;
        }
    }

    const authToken = await auth(agencyId).catch(function(err){
        log.error(`error getting Nexsure Auth Token ${err}` + __location)
    });
    if(authToken){
        let primaryContact = appDoc.contacts.find((c) => c.priamry === true)
        if(!primaryContact){
            if(appDoc.contacts.length === 1){
                primaryContact = appDoc.contacts[0];
            }
            else {
                primaryContact = {};
            }
        }

        let primarylocation = appDoc.locations.find((l) => l.priamry === true)
        if(!primarylocation){
            if(appDoc.locations.length === 1){
                primarylocation = appDoc.locations[0];
            }
            else {
                primarylocation = {};
            }
        }

        const jsonClient = {"Client": {
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
            "ClientType": {"$t": "Commercial"},
            "ClientStage": {"$t": "Client"},
            "ClientNames": [
                {
                    "Name": {"$t": `${_.escape(appDoc.businessName)}`},
                    "IsPrimaryName": {"$t": "true"},
                    "IsDBAName": {"$t": "false"},
                    "GrossReceipts": {"$t": `${appDoc.grossSalesAmt ? appDoc.grossSalesAmt.toString() : "0"}`},
                    "FEIN": {"$t": `${appDoc.ein ? appDoc.ein.toString() : ""}`}
                }
            ],
            "Contacts": {
                "FirstName": {"$t": `${primaryContact.firstName ? primaryContact.firstName : " unkn"}`},
                "LastName": {"$t": `${primaryContact.lastName ? primaryContact.lastName : " unkn"}`},
                "Phone": [
                    {
                        "PhoneNumber": {"$t": `${primaryContact.phone ? primaryContact.phone.replace(/[^0-9]/ig, '') : " unkn"}`},
                        "Description": {"$t": "Cell Phone"},
                        "IsPrimaryPhone": {"$t": "true"},
                        "PhoneType": {"$t": "Cell"}
                    }
                ],
                "Email": {"$t": `${primaryContact.email ? primaryContact.email : "unkn"}`},
                "IsPrimary": {"$t": "true"}
            },
            "Locations": {
                "Address": [
                    {
                        "AddressType": {"$t": "Physical"},
                        "StreetAddress1": {"$t": `${primarylocation.address ? primarylocation.address : ""}`},
                        //"StreetAddress2": {"$t": `${primarylocation.address2 ? primarylocation.address2 : ""}`},
                        "City": {"$t": `${primarylocation.city ? primarylocation.city : ""}`},
                        "State": {"$t": `${primarylocation.state ? primarylocation.state : ""}`},
                        "ZipCode": {"$t": `${primarylocation.zipcode ? primarylocation.zipcode : ""}`}
                    }, {
                        "AddressType": {"$t": "Mailing"},
                        "StreetAddress1": {"$t": `${appDoc.mailingAddress ? appDoc.mailingAddress : ""}`},
                        //"StreetAddress2": {"$t": `${appDoc.mailingAddress2 ? appDoc.mailingAddress2 : ""}`},
                        "City": {"$t": `${appDoc.mailingCity ? appDoc.mailingCity : ""}`},
                        "State": {"$t": `${appDoc.mailingState ? appDoc.mailingState : ""}`},
                        "ZipCode": {"$t": `${appDoc.mailingZipcode ? appDoc.mailingZipcode : ""}`}
                    }
                ],
                "IsPrimaryLocation": {"$t": "true"}
            },
            "Assignments": {
                "IsPrimary": {"$t": "true"},
                "Branch": {
                    "BranchID": {"$t": "1"},
                    "BranchName": {"$t": "Talage, Inc."}
                },
                "Department": {
                    "DepartmentID": {"$t": "1"},
                    "DepartmentName": {"$t": "Commercial Lines"}
                }
            }
        }};
        const clientXML = parser.toXml(jsonClient);
        //log.debug(`client XML to Nexsure` + __location);
        //log.debug(clientXML);
        log.info(`calling Nexsure create client for appId ${appDoc.applicationId}` + __location)
        //Send to Nexsure
        const path = "/clients/addnewclient";

        const requestOptions = {headers: {'Content-Type': 'application/x-www-form-urlencoded'}};

        const body = {
            "inputXml": clientXML,
            "returnContentType": "application/json"
        }

        const url = require('url');
        const params = new url.URLSearchParams(body);
        const response = await httpRequest("POST",path, authToken, null, params.toString(), requestOptions);
        if (response.error) {
            log.error(`Nexsure createClientFromAppDoc error ${response.error} - ${JSON.stringify(response.data)} ` + __location)
            newClientJSON.message = response.error
            return newClientJSON;
        }
        if (response.data.error) {
            log.error(`Nexsure createClientFromAppDoc error ${response.data.error} - ${JSON.stringify(response.data)}` + __location)
            newClientJSON.message = response.data.error
            return newClientJSON;
        }
        if (!response.data.Client) {
            log.error(`Nexsure createClientFromAppDoc no response.data.Client in response ` + __location)
            log.error(`ClientSearch Nexsure no Client response ${JSON.stringify(response.data)}` + __location)
            newClientJSON.message = "No Client Id returned"
            return newClientJSON;
        }
        const returnedJSON = response.data;
        log.info(`Nexsure response ${JSON.stringify(returnedJSON)}` + __location)
        if(returnedJSON.Client.ClientID){
            newClientJSON.clientId = returnedJSON.Client.ClientID
            try{
                const applicationBO = new ApplicationBO();
                const amsJSON = {amsInfo : {
                    "amsType" : "Nexsure",
                    clientId: newClientJSON.newClientId
                }};
                await applicationBO.updateMongo(appDoc.applicationId, amsJSON);
            }
            catch(err){
                log.error(`Nexsure createClientFromAppDoc updating App Doc error ${err}` + __location)
            }
            //update
            if(quoteDoc){
                //create policy
                try{
                    //  ads
                }
                catch(err){
                    log.error(`Nexsure createClientFromAppDoc error ${err}` + __location)
                }
            }


        }
        else if(returnedJSON.message) {
            newClientJSON.message = returnedJSON.message
        }

    }
    else {
        newClientJSON.message = "Nexsure Auth failed."
    }
    return newClientJSON;
}

/**
 * Create application from Nexsure clientIdh
 * @param  {integer} agencyId - agencyId
 * @param  {string} clientId - Nexsure ClientId
 * @param  {integer} quoteDoc - (optional) quoteDoc to create a policy from from.
 * @returns {string} clientId of new Nexsure policy records
 */
async function createPolicyFromQuoteDoc(agencyId, clientId, quoteDoc){
    if(!quoteDoc){
        return null;
    }

    const authToken = await auth(agencyId).catch(function(err){
        log.error(`error getting Nexsure Auth Token ${err}` + __location)
    });
    if(authToken){


        if(quoteDoc){
            //create policy

        }

    }
    return null;
}


module.exports = {
    auth: auth,
    clientSearch: clientSearch,
    createApplicationFromClientId: createApplicationFromClientId,
    getPoliciesByClientId: getPoliciesByClientId,
    createClientFromAppDoc: createClientFromAppDoc,
    createPolicyFromQuoteDoc: createPolicyFromQuoteDoc
};