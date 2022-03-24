/* eslint-disable require-jsdoc */
const axios = require('axios');
const moment = require('moment');

const openCorporateUrl = `https://api.opencorporates.com/v0.4/companies`
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
        OpenCorporateResponse = await axios.get(`${openCorporateUrl}/search`, requestOptions);
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
    let businessData = [];

    if(OpenCorporateResponse.data?.results?.total_count === 1 && OpenCorporateResponse.data?.results?.companies[0]?.company?.company_number){
        log.debug('Hard match for Open Corporate');
        try {
            companyInfo = OpenCorporateResponse.data?.results?.companies[0]?.company;
            businessData = await handleHardHitMatch(companyInfo);
        }
        catch (error) {
            log.error(`OpenCorporates Error ${error}` + __location)
            return null;
        }
    }
    else if(OpenCorporateResponse.data?.results?.total_count > 1) {
        log.debug('Multiple matches for open corporate');
        const companies = OpenCorporateResponse.data?.results?.companies;
        businessData = await handleMultipleMatches(companyInfo, companies, requestOptions);
    }

    return businessData;

    // Generate the generic company info structure
    //const company = {};
    // modify company Info instead of making a new company object
    /* if (companyInfo){
        if(companyInfo.incorporation_date){
            log.debug(`OpenCorp Hit Founded Date for ${companyInfo.businessName}`);
            const foundedDate = moment(companyInfo.incorporation_date,"YYYY-M-D");
            companyInfo.founded = foundedDate;
        }
        if(companyInfo.identifiers?.length > 0){
            const feinIdentifier = companyInfo.identifiers.find((item) => item.identifier.identifier_system_code === "us_fein");
            if(feinIdentifier && feinIdentifier.identifier?.uid){
                log.debug(`OpenCorp Hit FEIN for ${companyInfo.businessName}`);
                companyInfo.ein = feinIdentifier.identifier.uid;
            }
        }
        companyInfo.businessName = companyInfo.name ? companyInfo.name : '';
    }*/
}

async function handleHardHitMatch(companyInfo, requestOptions) {
    try {
        const companies = [];
        const companyUrl = `${openCorporateUrl}/${companyInfo.jurisdiction_code}/${companyInfo.company_number}`;
        const openCorporateResponse = await axios.get(companyUrl, requestOptions);
        companyInfo = openCorporateResponse?.data?.results?.company;
        if (companyInfo) {
            companies.push(companyInfo);
        }

        return companies
    }
    catch (error) {
        log.error(`OpenCorporates Error ${error}` + __location)
        // Return a connection error
        //return {error: `OpenCorporate connection error: ${error}`};
        return null;
    }
}

async function handleMultipleMatches(companyInfo, companies, requestOptions) {
    const openCorporateCompanies = await Promise.all(companies.map(async company => {
        try {
            const companyUrl = `${openCorporateUrl}/${companyInfo.jurisdiction_code}/${companyInfo.company_number}`;
            // log.debug(`Opencorporates ${companyUrl} ` + __location)
            const openCorporateResponse = await axios.get(companyUrl, requestOptions);
            companyInfo = openCorporateResponse?.data?.results?.company
        }
        catch (error) {
            log.error(`OpenCorporates ${error} for ${company.name}` + __location)
        }
    }));

    return openCorporateCompanies;
}


module.exports = {performCompanyLookup: performCompanyLookup}