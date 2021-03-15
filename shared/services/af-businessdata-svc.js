/**
 * Get bussiness Data from Accident Fund web service
 */

'use strict';

const axios = require('axios');
let enableAfDataCall = true;

let afEndpoint = 'https://psv.afgroup.com/HeadlessUnderwriting/api/overviewservice';
let userName = "DDHUser";
let userPwd = "MwNk51WAgHtDWVWoBe!";


if(global.settings.ENV !== 'production'){
    afEndpoint = 'https://npsv.afgroup.com/TEST_HeadlessUnderwriting/api/overviewservice';
    userName = "DDHUser";
    userPwd = "ceXF4N2fcthou99q!";
}
if(global.settings.AF_DATA_CALL_ENABLED && global.settings.AF_DATA_CALL_ENABLED !== "YES"){
    enableAfDataCall = false;
}

if(global.settings.AF_DATA_ENDPOINT){
    afEndpoint = global.settings.AF_DATA_ENDPOINT
}

if(global.settings.AF_DATA_USER){
    userName = global.settings.AF_DATA_USER
}

if(global.settings.AF_DATA_PWD){
    userPwd = global.settings.AF_DATA_PWD
}
//check settings for override.


exports.getBusinessData = async function(businessFilterJSON) {
    if(enableAfDataCall && businessFilterJSON && businessFilterJSON.company_name){
        //check for company_name and state
        // Do any mapping here....
        // do any data filter and cleanup here
        //const auth = "Basic " + Buffer.from(userName + ":" + userPwd).toString("base64");
        //15 second timeout.
        const requestOptions = {

            auth: {
                username: userName,
                password: userPwd
            },
            timeout: 25000

        }
        log.info("AF API Request businessFilterJSON: " + JSON.stringify(businessFilterJSON))
        let error = null;
        let afResponse = null;
        try{
            afResponse = await axios.post(afEndpoint, businessFilterJSON, requestOptions);
        }
        catch(err){
            log.error(`afResponse error endpoint ${afEndpoint} data: ${JSON.stringify(businessFilterJSON)} ` + err + __location);
            error = err;
        }
        if(error){
            throw error
        }
        if(afResponse && afResponse.status === 200){
            const responseData = afResponse.data;
            return responseData;
        }
        else {
            log.error(`AF BusinessData API endpoint ${afEndpoint} response with ` + afResponse.status + __location)
            throw new Error("AF BusinessData API responded with " + afResponse.status);
        }
    }
    else {
        throw new Error("No filter data or missing company_name or state")
    }
};