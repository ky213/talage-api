/* eslint-disable require-jsdoc */
const axios = require('axios');
const Querystring = require('querystring');

let authToken = null;

const fenrisAuthUrl = `https://auth-fenrisd.auth.us-east-1.amazoncognito.com/oauth2/token`
const fenrisUrl = `https://api.fenrisd.com/services/smb/v1/search`

const clientId = "6d9rg13ecnppujbs107rtarp41";
//&q=Workforce Brokers LLC

async function getAuthToken(){

    const basicAuthUserName = '6d9rg13ecnppujbs107rtarp41';
    const basicAuthPassword = '10gbrsoal7val1op2ktqpshd53ad4usrvpjh49ejilpm61o5lo69'; //production

    //log.debug(`Basic Auth: ${basicAuthUserName}:${basicAuthPassword}`)
    const basicAuth = Buffer.from(`${basicAuthUserName}:${basicAuthPassword}`).toString('base64')

    const headers = {headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
    }}
    const authBody = Querystring.stringify({
        client_id: clientId,
        grant_type: "client_credentials"
    });

    try {
        const result = await axios.post(fenrisAuthUrl, authBody, headers);
        authToken = result.data.access_token;
    }
    catch (err) {
        log.debug(`Fenris Error: Could Not Authorize: ${err}`);
        return `Fenris Error: Could Not Authorize: ${err}`;
    }

}

async function performCompanyLookup(companyInfoJSON) {
    // const companyInfoJSONExample = {
    //     name: "Acme Inc",
    //     streetAddress: "300 South Wells",
    //     city: "Reno",
    //     state: "NV",
    //     zipCode: "89502"
    // }
    if(!companyInfoJSON || !companyInfoJSON.name || !companyInfoJSON.state){
        return null;
    }

    //Auth request
    if(!authToken){
        await getAuthToken();
    }

    if(!authToken){
        log.error(`Auth Token Failure`)
        return null;
    }

    const reqBody = {
        "names": [
            companyInfoJSON.name
        ],
        "address": {
            "addressLine1": companyInfoJSON.streetAddress,
            "city": companyInfoJSON.city,
            "zipCode": companyInfoJSON.zipCode,
            "state": companyInfoJSON.state
        }
    }
    const headers = {headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${authToken.trim()}`
    }}

    let fenrisResponse = null;
    try {
        fenrisResponse = await axios.post(fenrisUrl, reqBody, headers);
    }
    catch (error) {
        // Return a connection error
        return {error: `Fenris connection error: ${error}`};
    }
    // Ensure we have a successful HTTP status code
    if (fenrisResponse.status !== 200) {
        log.error(`Fenris returned error status ${fenrisResponse.status}`)
        return null;
    }
    if (fenrisResponse.data?.status === "Success") {
        log.debug(`Got Fenris hit - ${companyInfoJSON.name}`);
        return fenrisResponse.data;
    }
    else {
        // log.info(`No hit from Fenris response for ${companyInfoJSON.name} in ${companyInfoJSON.state}`)
        return null;
    }


}


module.exports = {performCompanyLookup: performCompanyLookup}