const axios = require('axios');
const moment = require('moment');

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
    const openCorporateUrl = `https://api.opencorporates.com/v0.4/companies/search`
    if(!companyInfoJSON || !companyInfoJSON.name || !companyInfoJSON.state){
        throw new Error("You must enter at least a company name and state");
    }
    let requestUrl = openCorporateUrl;
    const responseHits = [];
    requestUrl = `?q= + ${encodeURI(companyInfoJSON.name)}&jurisdiction_code=us_${companyInfoJSON.state.toLowerCase()}`;

    let openCorporateResponse = null;
    try {
        openCorporateResponse = await axios.get(requestUrl);
        let companyInfo = {};
        const currCompanyAppJSON = {
            ein: '',
            businessName: '',
            address: '',
            city: '',
            state: '',
            zipCode: '',
            founded: ''
        }
        if(openCorporateResponse.data?.company?.incorporation_date){
            companyInfo = openCorporateResponse.data?.company;
            log.debug(`OpenCorp Hit Founded Date for ${companyInfoJSON.name}`)
            currCompanyAppJSON.founded = moment(companyInfo.incorporation_date,"YYYY-M-D")
            //foundedDateHit++;
        }
        if(companyInfo.identifiers?.length > 0){
            const feinIdentifier = companyInfo.identifiers.find((item) => item.identifier.identifier_system_code === "us_fein");
            if(feinIdentifier && feinIdentifier.identifier?.uid){
                log.debug(`OpenCorp Hit FEIN for ${currCompanyAppJSON.businessName}`)
                currCompanyAppJSON.ein = feinIdentifier.identifier.uid
                //fienHit++;
            }
        }
    }
    catch (error) {
        // Return a connection error
        throw new Error(`Hipaa connection error: ${error}`);
    }
    // Ensure we have a successful HTTP status code
    if (openCorporateResponse.status !== 200) {
        throw new Error(`Hipaa returned error status ${openCorporateResponse.status}`);
    }
    if (openCorporateResponse.data?.EIN && responseHits) {
        return responseHits;
    }
    else {
        throw new Error(`Unexpected Hipaa response ${openCorporateResponse}  ${JSON.stringify(openCorporateResponse.data)}`);
    }
}

module.exports = {performCompanyLookup: performCompanyLookup};
