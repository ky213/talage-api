'use strict';

const axios = require('axios');

//const request = require('request');
const smartyestreetsAuthId = "6caa9f26-70cf-5443-1857-84566734eab9";
const smartyestreetsAuthToken = "IMdKxY0M3wKJzAms36ZY";

const smartStreetUrl = `https://us-zipcode.api.smartystreets.com/lookup?auth-id=${smartyestreetsAuthId}&auth-token=${smartyestreetsAuthToken}`

exports.checkAddress = async function(streetAddress, city, state, zipCode) {
    let requestUrl = smartStreetUrl;
    // Build the request
    if (streetAddress) {
        requestUrl += "&street=" + encodeURI(streetAddress);
    }
    if (city) {
        requestUrl += "&city=" + encodeURI(city)
    }
    if (state) {
        requestUrl += "&state=" + encodeURI(state)
    }
    if (zipCode) {
        requestUrl += "&zipcode=" + encodeURI(zipCode)
    }
    let smartystreetsResponse = null;
    try {
        smartystreetsResponse = await axios.get(requestUrl);
    }
    catch (error) {
        // Return a connection error
        return {error: `SmartyStreets connection error: ${error}`};
    }
    // Ensure we have a successful HTTP status code
    if (smartystreetsResponse.status !== 200) {
        return {error: `SmartyStreets returned error status ${smartystreetsResponse.status}`};
    }
    if (smartystreetsResponse.data.length > 0) {
        // Get the first address response
        const addressData = smartystreetsResponse.data[0];
        if (addressData.hasOwnProperty("status")) {
            // If there is a "status" property, return the error in the "reason" property
            return {
                error: "SmartyStreets could not validate the address",
                errorReason: addressData.reason
            };
        }
        if (addressData.zipcodes.length > 0) {
            // Return the first address record
            return {addressInformation: addressData.zipcodes[0]};
        }
    }
    // We received an unexpected error. Log it as an error.
    log.error(`SmartyStreets returned an unrecognized response: ${JSON.stringify(smartystreetsResponse.data, null, 4)} ${__location}`);
    return {error: `SmartyStreets returned an unrecognized response: ${JSON.stringify(smartystreetsResponse.data, null, 4)}`};
};

exports.checkZipCode = async function(zipCode){
    if(zipCode && zipCode.length){
        // const regexCheck = /^(\d{5})(?:-?(\d{4}))?$/gm
        // if(regexCheck.test(zipCode)){
        // regex check
        const zipUrl = smartStreetUrl + `&zipcode=${zipCode}`
        //  log.debug("zipUrl: " + zipUrl)
        let error = null;
        let smartstreetResponse = null;
        try{
            smartstreetResponse = await axios.get(zipUrl);
        }
        catch(err){
            log.error('SmartyStreets error ' + err + __location);
            error = err;
        }
        if(error){
            throw error
        }
        if(smartstreetResponse.status === 200){
            const responseData = smartstreetResponse.data[0];
            if(responseData.status === "invalid_zipcode"){
                responseData.error = "invalid_zipcode";
                return responseData;
            }
            else if(responseData.zipcodes){
                const zipresponse = responseData.zipcodes[0];
                zipresponse.city = zipresponse.default_city;
                return zipresponse;
            }
            else {
                log.error("Unexpected response from SmartyStreets " + JSON.stringify(smartstreetResponse) + __location);
                //throw new Error("Unexpected response from SmartyStreets ");
                const errorResponse = {error: "Unexpected response from SmartyStreets "};
                return errorResponse;
            }
        }
        else {
            log.error("SmartyStreets response with " + smartstreetResponse.status + __location)
            throw new Error("SmartyStreets responded with " + smartstreetResponse.status);
        }
        // }
        // else {
        //     throw new Error("SmartyStreetSvc: bad zipCode format provided " + zipCode);
        // }
    }
    else {
        throw new Error("SmartyStreetSvc: no zipCode provided");
    }


}