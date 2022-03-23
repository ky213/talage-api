/* eslint-disable require-jsdoc */
const axios = require('axios');

const openCorporateUrl = `https://api.opencorporates.com/v0.4/companies/search`

const apiToken = "WmeTyxCt74Lb40UTnfG9";


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


    const qparms = {
        api_token: apiToken,
        "q": companyInfoJSON.name,
        "jurisdiction_code": "us_" + companyInfoJSON.state.toLowerCase()
    }

    const requestOptions = {params: qparms}

    // log.debug(`Got OpenCorporate request - ${JSON.stringify(requestOptions)} `);
    let OpenCorporateResponse = null;
    try {
        OpenCorporateResponse = await axios.get(openCorporateUrl, requestOptions);
        // log.debug(`Got OpenCorporate result - ${JSON.stringify( OpenCorporateResponse.data)} `);
    }
    catch (error) {
        // Return a connection error
        return {error: `OpenCorporate connection error: ${error}`};
    }
    // Ensure we have a successful HTTP status code
    if (OpenCorporateResponse.status !== 200) {
        log.error(`OpenCorporate returned error status ${OpenCorporateResponse.status}`)
        return null;
    }
    if (!OpenCorporateResponse.data) {
        log.error(`OpenCorporate no data returned`)
        return null;
    }
    let companyInfo = null;

    if(OpenCorporateResponse.data?.results?.total_count === 1 && OpenCorporateResponse.data?.results?.companies[0]?.company?.company_number){
        try {
            companyInfo = OpenCorporateResponse.data?.results?.companies[0]?.company;
            const companyUrl = `https://api.opencorporates.com/companies/${companyInfo.jurisdiction_code}/${companyInfo.company_number}`;
            //log.debug(`Opencorporates ${companyUrl} ` + __location)
            OpenCorporateResponse = await axios.get(companyUrl, requestOptions);
            companyInfo = OpenCorporateResponse?.data?.results?.company
        }
        catch (error) {
            log.error(`OpenCorporates Error ${error}` + __location)
            // Return a connection error
            //return {error: `OpenCorporate connection error: ${error}`};
            return null;
        }
    }
    else if(OpenCorporateResponse.data?.results?.total_count > 1) {
        for(const testCompany of OpenCorporateResponse.data?.results?.companies){
            if(!companyInfo && testCompany.company?.inactive === false){
                companyInfo = testCompany.company;
                if(companyInfo.company_number){
                    try {
                        const companyUrl = `https://api.opencorporates.com/companies/${companyInfo.jurisdiction_code}/${companyInfo.company_number}`;
                        // log.debug(`Opencorporates ${companyUrl} ` + __location)
                        OpenCorporateResponse = await axios.get(companyUrl, requestOptions);
                        companyInfo = OpenCorporateResponse?.data?.results?.company
                        break;
                    }
                    catch (error) {
                        log.error(`OpenCorporates Error ${error}` + __location)
                        // Return a connection error
                        //return {error: `OpenCorporate connection error: ${error}`};
                        return null;
                    }

                }
            }
        }
    }
    return companyInfo;
}


module.exports = {performCompanyLookup: performCompanyLookup}