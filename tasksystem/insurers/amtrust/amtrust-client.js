/* eslint-disable require-jsdoc */

var queryString = require("querystring");
const axios = require("axios")

let accessToken = "";
let credentials = null;

async function authorize(agencyNetworkId, agencyId, appAgencyLocationId) {
    accessToken = "";
    //get Amtrust insurer.
    var InsurerModel = require('mongoose').model('Insurer');
    const insurer = await InsurerModel.findOne({slug: 'amtrust'});
    if (!insurer) {
        log.error(`No Amtrust record ` + __location)
        return false;
    }

    credentials = JSON.parse(insurer.password);
    if(global.settings.ENV !== 'production'){
        credentials = JSON.parse(insurer.test_password);
    }
    const AgencyLocationMongooseModel = require('mongoose').model('AgencyLocation');
    let agencyLocationId = 1; //talage
    if(agencyId){
        const appAgencyLocDoc = await AgencyLocationMongooseModel.findOne({systemId: appAgencyLocationId}, '-__v');
        //user prime agency ??
        if(appAgencyLocDoc.useAgencyPrime === true){
            const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
            const agencyLocationBO = new AgencyLocationBO();
            const AgencyBO = global.requireShared('./models/Agency-BO.js');
            const agencyBO = new AgencyBO();
            const queryAgency = {
                "agencyNetworkId": agencyNetworkId,
                "primaryAgency": true
            }
            const agencyList = await agencyBO.getList(queryAgency);
            if(agencyList && agencyList.length > 0){
                const agencyPrime = agencyList[0];
                //get agency's prime location
                // return prime location's insurers.
                const returnChildren = false;
                const agencyLocationPrime = await agencyLocationBO.getByAgencyPrimary(agencyPrime.systemId, returnChildren);
                if(agencyLocationPrime){
                    agencyLocationId = agencyLocationPrime.systemId;
                }
            }
        }
        else {
            agencyLocationId = appAgencyLocDoc.systemId;
            //is Amtrust talageWholeSale
            const amtrustAL = appAgencyLocDoc.insurers.find((alI) => alI.insurerId === insurer.insurerId);
            if(amtrustAL?.talageWholesale){
                agencyLocationId = 1;
            }
        }
    }

    //get AgencyLocation

    const agencyLocDoc = await AgencyLocationMongooseModel.findOne({systemId: agencyLocationId}, '-__v');
    if(!agencyLocDoc){
        log.error(`Amtrust WC Importing Could not load Talage Agency Location` + __location);
        throw new Error(`Amtrust WC Importing Could not load Talage Agency Location`)
    }
    credentials = JSON.parse(insurer.password);
    if(global.settings.ENV !== 'production'){
        credentials = JSON.parse(insurer.test_password);
    }
    const amtrustAL = agencyLocDoc.insurers.find((alI) => alI.insurerId === insurer.insurerId);
    if(!amtrustAL?.agentId){
        log.error(`agencyLocationId ${agencyLocationId} missing Amtrust credentials` + __location)
        return null;
    }
    let agentUsername = '';
    let agentPassword = '';

    try{
        const agentUserNamePassword = amtrustAL.agentId.trim();
        const commaIndex = agentUserNamePassword.indexOf(',');
        if(commaIndex === -1){
            log.error(`agencyLocationId ${agencyLocationId} Amtrust credentials missing configured` + __location)
        }
        else {
            agentUsername = agentUserNamePassword.substring(0, commaIndex).trim();
            agentPassword = agentUserNamePassword.substring(commaIndex + 1).trim();
        }
    }
    catch(err){
        log.error(`Task amtrust-client error gettign agentUsername & agentPassword ${amtrustAL.agentId} for agencyLocationId ${agencyLocationId} error: ${err}` + __location)
        return null;
    }
    if(!agentUsername || !agentPassword){
        return null;
    }

    const requestData = {
        grant_type: "password",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        username: agentUsername,
        password: agentPassword,
        scope: "openid profile legacy_info legacy_id",
        response_type: "token id_token",
        undefined: ""
    };
    //const requestDataString = JSON.stringify(requestData);

    const requestDataString = queryString.stringify(requestData);

    const requestOptions = {headers: {"Content-type": "application/x-www-form-urlencoded"}}

    let authURL = "https://uatauth.amtrustgroup.com/AuthServer_UserTest/OpenIdConnect/Token";
    if(global.settings.ENV === 'production'){
        authURL = "https://auth.amtrustgroup.com/AuthServer/OpenIdConnect/Token";
    }
    const response = await makeRequest("POST", authURL, null, requestDataString, requestOptions);
    if (response.error) {
        log.error(response.error + __location);
    }
    if (response.data.error) {
        log.error(`${response.data.error} : ${response.data.error_message}` + __location);
    }
    if (!response.data?.access_token) {
        log.error(`Unable to find the access_token property` + __location);
        return null;
    }
    else {
        accessToken = response.data.access_token;
        return accessToken;
    }
}

async function callAPI(method, endpoint, queryParameters = null, data = null) {
    if(!accessToken){
        return null;
    }

    const requestOptions = {headers: {
        "Content-type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "subscriber_id": credentials.mulesoftSubscriberId
    }}
    let baseAPIURL = "https://utgateway.amtrustgroup.com/DigitalAPI_Usertest";
    if(global.settings.ENV === 'production'){
        baseAPIURL = "https://gateway.amtrustgroup.com/DigitalAPI";
    }
    //log.debug(`Amtrust importer calling ${baseAPIURL + endpoint}` + __location);
    const response = await makeRequest(method, baseAPIURL + endpoint, queryParameters, data ? JSON.stringify(data) : null, requestOptions);
    return response.data;
}

async function getClassCodes(state) {
    const result = await callAPI("GET", `/api/v1/state-classes-eligibility/classCodes/${state}`);
    if (!result || typeof result === "string" || !result.Data) {
        log.warn(`Could not retrieving class codes for ${state}`);
        if(typeof result?.error === 'string'){
            log.warn(`Request error ${result.error} not retrieving class codes for ${state}` + __location);
        }
        else if(typeof result?.error === 'object'){
            log.warn(`Request error ${JSON.stringify(result.error)} not retrieving class codes for ${state}` + __location);
        }
        else if(result){
            log.warn(`Request error ${JSON.stringify(result)} not retrieving class codes for ${state}` + __location);
        }
        return null;
    }
    return result.Data;
}

async function getQuestions(state, classCodeList) {
    const requestData = {ClassCodeList: []};
    for (const classCode of classCodeList) {
        requestData.ClassCodeList.push({
            ClassCode: classCode,
            LocState: state
        });
    }
    const result = await callAPI("POST", "/api/v1/questions", null, requestData);
    if (!result || result.StatusCode !== 200) {
        log.warn(`Could not retrieving Questions for ${state} classCode=${classCodeList}` + __location);
        return null;
    }
    return result.Questions ? result.Questions : [];
}

async function makeRequest(method, url, params = null, data = null, options = null) {
    // console.log("makeRequest request", { method, url, params, data, options });

    const requestOptions = {
        method: method,
        url: url,
        ...options
    };
    //timeout: 60000
    if (params) {
        requestOptions.params = params;
    }
    if (data) {
        requestOptions.data = data;
    }
    // console.log(requestOptions);
    let response = null;
    try {
        // Perform the request
        response = await axios.request(requestOptions);
    }
    catch (error) {
        if(error.response){
            log.error(`AmTrust Error: ${error.response.status} ${error.response.statusText} ${method} url ${url} params ${params} data ${data}` + __location);
        }
        return {
            error: error,
            data: error.response ? error.response.data : null
        };
    }
    // console.log("httpRequest response status", response.status);
    // console.log("httpRequest response headers", response.headers);
    // console.log("httpRequest response data", response.data);
    // console.log("httpRequest response error", response.error);
    return {
        headers: response.headers,
        status: response.status,
        data: response.data,
        error: response.error
    };
}

module.exports = {
    authorize: authorize,
    getClassCodes: getClassCodes,
    getQuestions: getQuestions,
    callAPI: callAPI
};