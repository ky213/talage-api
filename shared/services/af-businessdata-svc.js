/**
 * Get bussiness Data from Accident Fund web service
 */

'use strict';

const axios = require('axios');

let afEndpoint = 'https://npsv.afgroup.com/TEST_HeadlessUnderwriting/api/overviewservice';
//check settings for override.

let userName="DDHUser";
let userPwd="ceXF4N2fcthou99q!";
//check settings for override.


exports.getBusinessData = async function(businessFilterJSON) {
    if(businessFilterJSON && businessFilterJSON.company_name){
       //check for company_name and state
       // Do any mapping here....
       // do any data filter and cleanup here
       const auth = "Basic " + Buffer.from(userName + ":" + userPwd).toString("base64");
       //15 second timeout.
       let requestOptions = { 
           
            auth: {
                username: userName,
                password: userPwd
              },
            timeout: 15000,
           
       }
       log.debug("AF API Request businessFilterJSON: " + JSON.stringify(businessFilterJSON))
       let error = null;
        let afResponse = null;
        try{
            afResponse = await axios.post(afEndpoint, businessFilterJSON, requestOptions);
        }
        catch(err){
            log.error('afResponse error ' + err + __location);
            error = err;
        }
        if(error){
            throw error
        }
        if(afResponse.status === 200){
            const responseData = afResponse.data;
            return responseData;
        }
        else {
            log.error("AF BusinessData API response with " + afResponse.status  + __location)
            throw new Error("AF BusinessData API responded with " + afResponse.status);
        }
    }
    else {
        throw new Error("No filter data or missing company_name or state")
    }
    return null;
};