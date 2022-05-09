
const axios = require('axios');


/**
 * Simple axios wrapper for auth
 * @param  {object} integrationObj - integeration or bind Object, ...)
 * @returns {object} token
 */
async function auth(integrationObj){
    //Basic Auth should be calculated with username and password set
    // in the admin for the insurer
    // Basic Auth setup moved to Auth function
    log.debug(`GETTING Employers AuthToken` + __location)
    let authUrl = null;
    if (integrationObj.insurer.useSandbox) {
        authUrl = `https://login-qa.employers.com/oauth2/aust5ytu6oItkVVB10h7/v1/token?grant_type=client_credentials`
    }
    else {
        authUrl = `https://login.employers.com/oauth2/aus1jorolt7R7kGUF0h8/v1/token?grant_type=client_credentials`
    }

    let basicAuthUserName = null;
    let basicAuthPassword = null
    //Check Insurer setting exist otherwise default to poduction - BP
    if(integrationObj.username){
        basicAuthUserName = integrationObj.username
    }
    if(integrationObj.password){
        basicAuthPassword = integrationObj.password
    }

    log.debug(`Basic Auth: ${basicAuthUserName}:${basicAuthPassword}`)
    const basicAuth = Buffer.from(`${basicAuthUserName}:${basicAuthPassword}`).toString('base64')
    log.debug(`Basic Auth Calcu: ${basicAuth}`)
    const headers = {headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
    }}
    const body = {"scope":"das"}
    let respToken = null;
    try {
        const result = await axios.post(`${authUrl}`, body, headers);
        respToken = result.data.access_token;
    }
    catch (err) {
        log.error(`Employers Auth failed ` + __location);
        return null
    }
    return respToken;
}

module.exports = {auth: auth};