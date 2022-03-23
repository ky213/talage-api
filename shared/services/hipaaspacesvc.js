const axios = require('axios');

/**
 * Lookup a company's EIN number based on information passed in.
 *
 * companyInfoJSON should be in this format:
 *   const companyInfoJSONExample = {
 *      name: "Acme Inc",
 *      streetAddress: "300 South Wells",
 *      city: "Reno",
 *      state: "NV",
 *      zipCode: "89502"
 *   }
 * @param {*} companyInfoJSON see above
 * @returns {void}
 */
async function performCompanyLookup(companyInfoJSON) {
    const hipaaEinUrl = `https://www.hipaaspace.com/api/ein/search?token=522322F9F8B14101B719E129F7025811AA2D9661E9B04FC5B9AB0E92A1C5C31E&rt=json`
    if(!companyInfoJSON || !companyInfoJSON.name || !companyInfoJSON.state){
        throw new Error("You must enter at least a company name and state");
    }
    let requestUrl = hipaaEinUrl;
    let responseHits = [];
    requestUrl += "&q=" + encodeURI(companyInfoJSON.name);

    let hipaaResponse = null;
    try {
        hipaaResponse = await axios.get(requestUrl);
        //hipaaResponse needs to be filter to the state.
        if(hipaaResponse.data?.EIN){
            responseHits = hipaaResponse.data?.EIN.filter(obj => obj.BUSINESS_ADDRESS_STATE === companyInfoJSON.state);
        }
    }
    catch (error) {
        // Return a connection error
        throw new Error(`Hipaa connection error: ${error}`);
    }
    // Ensure we have a successful HTTP status code
    if (hipaaResponse.status !== 200) {
        throw new Error(`Hipaa returned error status ${hipaaResponse.status}`);
    }
    if (hipaaResponse.data?.EIN && responseHits) {
        return responseHits.map(hit => ({
            ein: `${hit.IRS_NUMBER.substr(0,2)}-${hit.IRS_NUMBER.substr(2)}`,
            businessName: hit.CONFORMED_NAME,
            address: `${hit.BUSINESS_ADDRESS_STREET1 || hit.MAIL_ADDRESS_STREET1 || ''} ${hit.BUSINESS_ADDRESS_STREET2 || hit.MAIL_ADDRESS_STREET2 || ''}`,
            city: hit.BUSINESS_ADDRESS_CITY || hit.MAIL_ADDRESS_CITY || '',
            state: hit.BUSINESS_ADDRESS_STATE || hit.MAIL_ADDRESS_STATE || '',
            zipCode: hit.BUSINESS_ADDRESS_ZIP || hit.MAIL_ADDRESS_ZIP || ''
        }));
    }
    else {
        throw new Error(`Unexpected Hipaa response ${hipaaResponse}  ${JSON.stringify(hipaaResponse.data)}`);
    }
}

module.exports = {performCompanyLookup: performCompanyLookup};
