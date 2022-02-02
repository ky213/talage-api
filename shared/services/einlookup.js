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
    const hipaaEinUrl = `https://www.hipaaspace.com/api/ein/search?token=${global.settings.HIPAA_TOKEN}&rt=json`
    if(!companyInfoJSON || !companyInfoJSON.name || !companyInfoJSON.state){
        throw new Error("You must enter at least a company name and state");
    }
    let requestUrl = hipaaEinUrl;

    requestUrl += "&q=" + encodeURI(companyInfoJSON.name);

    let hipaaResponse = null;
    try {
        hipaaResponse = await axios.get(requestUrl);
    }
    catch (error) {
        // Return a connection error
        throw new Error(`Hipaa connection error: ${error}`);
    }
    // Ensure we have a successful HTTP status code
    if (hipaaResponse.status !== 200) {
        throw new Error(`Hipaa returned error status ${hipaaResponse.status}`);
    }
    if (hipaaResponse.data?.EIN) {
        return hipaaResponse.data.EIN;
    }
    else {
        throw new Error(`Unexpected Hipaa response ${hipaaResponse}  ${JSON.stringify(hipaaResponse.data)}`);
    }
}

module.exports = {performCompanyLookup: performCompanyLookup};
