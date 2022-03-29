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
        log.error("You must enter at least a company name and state");
        return null;
    }

    const qparms = {
        api_token: apiToken,
        "q": `${companyInfoJSON.name}*`,
        "jurisdiction_code": "us_" + companyInfoJSON.state.toLowerCase(),
        "inactive": false,
        "per_page": 5,
        "page": 1
    }

    if(companyInfoJSON.streetAddress){
        qparms.registred_address = companyInfoJSON.streetAddress.toLowerCase()
    }

    const requestOptions = {params: qparms}

    // log.debug(`Got OpenCorporate request - ${JSON.stringify(requestOptions)} `);
    let openCorporateResponse = null;
    try {
        openCorporateResponse = await axios.get(`${openCorporateUrl}/search`, requestOptions);
    }
    catch (error) {
        log.error(`Not able to search companies. OpenCorporates data connection error: ${error}`)
        return null;
    }
    // Ensure we have a successful HTTP status code
    if (openCorporateResponse.status !== 200) {
        log.error(`OpenCorporates returned error status ${openCorporateResponse.status}`);
        return null;
    }
    if (!openCorporateResponse.data) {
        log.error('OpenCorporate no data returned');
        return null;
    }

    let businessData = [];

    if(openCorporateResponse.data?.results?.total_count === 1 && openCorporateResponse.data?.results?.companies[0]?.company?.company_number){
        log.debug('Hard hit for Open Corporates');
        try {
            const company = openCorporateResponse.data?.results?.companies[0]?.company;
            const companyDetails = await getCompanyDetails(company, requestOptions);
            businessData.push(companyDetails);
        }
        catch (error) {
            log.error(`OpenCorporates Error ${error}` + __location);
        }
    }
    //else if(openCorporateResponse.data?.results?.total_count <= 5 && openCorporateResponse.data?.results?.total_count !== 0) {
    else if (openCorporateResponse.data?.results?.total_count > 0){
        log.debug('Multiple matches for Open Corporates');
        try {
            const companies = openCorporateResponse.data?.results?.companies;
            for (const testCompany of companies){
                const company = testCompany.company;
                const companyDetails = await getCompanyDetails(company, requestOptions);
                businessData.push(companyDetails);
            }
        }
        catch(error) {
            log.error(`OpenCorporates Error ${error}` + __location)
        }
    }

    if (companyInfoJSON.city && companyInfoJSON.city.length > 0){
        businessData = filterCompaniesByCity(businessData, companyInfoJSON.city);
    }

    if (companyInfoJSON.zipCode && companyInfoJSON.zipCode.length > 0){
        businessData = filterCompaniesByZipCode(businessData, companyInfoJSON.zipCode);
    }

    return businessData;
}

async function getCompanyDetails(companyInfo, requestOptions) {
    if (companyInfo.jurisdiction_code && companyInfo.company_number){
        try {
            const companyUrl = `${openCorporateUrl}/${companyInfo.jurisdiction_code}/${companyInfo.company_number}`;
            const openCorporateResponse = await axios.get(companyUrl, requestOptions);
            const companyDetails = openCorporateResponse?.data?.results?.company;
            if (companyDetails) {
                if(companyDetails.incorporation_date){
                    log.debug(`OpenCorp Hit Founded Date for ${companyDetails.name}`);
                    const foundedDate = moment(companyDetails.incorporation_date).tz("America/Los_Angeles").format("YYYY-MM-DD");
                    companyDetails.founded = foundedDate;
                }
                else {
                    //should try to get it from Fernis
                    companyDetails.founded = '';
                }

                if(companyDetails.identifiers?.length > 0){
                    const feinIdentifier = companyDetails.identifiers.find((item) => item.identifier.identifier_system_code === "us_fein");
                    if(feinIdentifier && feinIdentifier.identifier?.uid){
                        log.debug(`OpenCorp Hit FEIN for ${companyDetails.name}`);
                        companyDetails.ein = feinIdentifier.identifier.uid;
                    }
                }
                else {
                    // should try to get it from HIPAA
                    companyDetails.ein = '';
                }

                if(companyDetails.data?.most_recent?.length > 0){
                    const mostRecentCompanyData = companyDetails.data?.most_recent;
                    if (mostRecentCompanyData[0].datum?.data_type === 'CompanyAddress'){
                        log.debug(`OpenCorp Hit Address for ${companyDetails.name}`);
                        const dataId = mostRecentCompanyData[0].datum?.id;
                        await getCompanyAddress(dataId, companyDetails);
                    }
                }
            }
            return companyDetails;
        }
        catch (error) {
            log.error(`OpenCorporates Error ${error}` + __location)
        }
    }
    else {
        log.error(`At least jurisdiction code and company number needs to be set. ${__location}`)
    }
}

async function getCompanyAddress(dataId, companyDetails){
    const companyDataUrl = `https://api.opencorporates.com/v0.4/data/${dataId}`;
    try {
        const qparams = {api_token: apiToken};
        const companyDataResponse = await axios.get(companyDataUrl, {params: qparams});

        if (companyDataResponse.data?.results?.datum?.attributes){
            const attributes = companyDataResponse.data.results.datum.attributes
            companyDetails.address = attributes.street_address;
            companyDetails.city = attributes.locality;
            companyDetails.state = attributes.region;
            companyDetails.zipCode = attributes.postal_code;
        }
    }
    catch(error){
        log.error(`Not able to get data for Address. OpenCorporates data connection error: ${error}`);
    }
}

function filterCompaniesByCity(companies, city){
    if (city && city.length > 0){
        const businessData = companies.filter(data => city === data.city);
        return businessData;
    }
    else{
        log.warn('There is no city on the request params');
        return companies;
    }
}

function filterCompaniesByZipCode(companies, zipCode){
    if (zipCode && zipCode?.length > 0){

        const businessData = companies.filter(company => zipCode === company.zipCode);
        return businessData;
    }
    else{
        log.warn('There is no city on the request params');
        return companies;
    }
}

module.exports = {performCompanyLookup: performCompanyLookup}