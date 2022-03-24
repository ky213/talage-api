const moment = require('moment');

const Integration = require('../Integration.js');
const amtrustClient = require('./amtrust-client.js');
global.requireShared('./helpers/tracker.js');
// const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
// const {Sleep} = global.requireShared('./helpers/utility.js');
// const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');

const amtrustTestHost = "utgateway.amtrustgroup.com";
const amtrustTestBasePath = "/digital-bop";

const amtrustProductionHost = "gateway.amtrustgroup.com";
const amtrustProductionBasePath = "/digital-bop";

module.exports = class AMTrustBOP extends Integration {

    credentials = null;


    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {

        this.usePolciyBOPindustryCode = true;
        this.requiresInsurerIndustryCodes = true;


    }

    /**
     * Calls the AmTrust API
     * @param  {string} verb - HTTP verb (GET, POST, ...)
     * @param  {string} accessToken - Access token from authorization
     * @param  {string} subscriberId - Mulesoft subscriber ID
     * @param  {string} path - Endpoint path
     * @param  {object} dataObject - Body data object to send
     * @returns {object} Response body data
     */
    async amtrustCallAPI(verb, accessToken, subscriberId, path, dataObject = null) {
        let host = null;
        let basePath = null;
        if (this.insurer.useSandbox) {
            host = amtrustTestHost;
            basePath = amtrustTestBasePath;
        }
        else {
            host = amtrustProductionHost;
            basePath = amtrustProductionBasePath;
        }
        let response = null;
        try {
            response = await this.send_json_request(host,
                basePath + path,
                dataObject ? JSON.stringify(dataObject) : null,
                {
                    "Authorization": `Bearer ${accessToken}`,
                    "subscriber_id": subscriberId
                },
                verb, true, true);
        }
        catch (error) {
            this.log_error(`Error sending Amtrust Request ${path}: ${error}`, __location);
            return null;
        }
        if (typeof response === "string" && response.startsWith("BadRequest:")) {
            const jsonStartIndex = response.indexOf('{"');
            if (jsonStartIndex >= 0) {
                try {
                    response = JSON.parse(response.substring(jsonStartIndex, response.indexOf('"}') + 2));
                    response.StatusCode = 400;
                }
                catch (e) {
                    response = null;
                }
            }
        }
        return response;
    }

    async getAccessToken(logPrefix){
        // Load the API credentials

        try {
            this.credentials = JSON.parse(this.password);
        }
        catch (error) {
            log.error(`${logPrefix} Could not load AmTrust API credentials ${error}` + __location);
            return null;
        }
        log.info(`${logPrefix} AmTrust AL insurer ${JSON.stringify(this.app.agencyLocation.insurers[this.insurer.id])}` + __location)
        const agentUserNamePassword = this.app.agencyLocation.insurers[this.insurer.id].agentId.trim();


        // Split the comma-delimited username,password field.
        const commaIndex = agentUserNamePassword.indexOf(',');
        if (commaIndex <= 0) {
            log.error(`${logPrefix} AmTrust username and password are not comma-delimited. commaIndex ${commaIndex} ` + __location);
            return null;
        }
        const agentUsername = agentUserNamePassword.substring(0, commaIndex).trim();
        const agentPassword = agentUserNamePassword.substring(commaIndex + 1).trim();

        // Authorize the client
        const accessToken = await amtrustClient.authorize(this.credentials.clientId, this.credentials.clientSecret, agentUsername, agentPassword, this.credentials.mulesoftSubscriberId, this.insurer.useSandbox);
        if (!accessToken) {
            log.error(`${logPrefix} Authorization with AmTrust server failed ` + __location);
            return null;
        }
        return accessToken;
    }


    async _insurer_price(){

        // const appDoc = this.app.applicationDocData
        const logPrefix = `Appid: ${this.app.id} AmTrust BOP Pricing `

        const accessToken = await this.getAccessToken(logPrefix);
        if(!accessToken){
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: true
            }
            return pricingResult;
        }


        //TODO Pricing

        const pricingResult = {
            gotPricing: false,
            outOfAppetite: true,
            pricingError: true
        }
        return pricingResult;

    }

    //***************** QUOTING *******************************************************************************

    /**
	 * Requests a quote from AMTrust and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {

        const appDoc = this.applicationDocData
        const applicationDocData = this.app.applicationDocData
        //User Amtrust quick quote?
        const logPrefix = `Appid: ${this.app.id} AmTrust BOP Quoting `

        let agentId = this.app.agencyLocation.insurers[this.insurer.id].agencyId.trim();
        // Ensure the agent ID is a number (required for the API request)
        try {
            agentId = parseInt(agentId, 10);
        }
        catch (error) {
            log.error(`${logPrefix} error parsing AgentId ${error}` + __location)
            return this.client_error(`Invalid AmTrust agent ID '${agentId}'`, __location, {error: error});
        }
        if (!agentId || agentId === 0) {
            log.error(`${logPrefix} Invalid AmTrust agent ID '${agentId}'` + __location);
            return this.client_error(`Invalid AmTrust agent ID '${agentId}'`, __location);
        }

        const accessToken = await this.getAccessToken(logPrefix);
        if(!accessToken){
            return this.client_error(`${logPrefix} failed to get accessToken`, __location);
        }
        //Multiple Location Error - Stop quoting.
        if(appDoc.locations.length > 1){
            log.warn(`${logPrefix} autodeclined do to multiple locations` + __location)
            return this.client_autodeclined(`Amtrust BOP only supports one location `, __location);
        }


        // Get primary location
        let primaryLocation = appDoc.locations.find(location => location.primary);
        if(!primaryLocation && appDoc.locations.length === 1){
            primaryLocation = appDoc.locations[0]
            log.info(`${logPrefix}  Setting Primary location to the ONLY location \n ${JSON.stringify(primaryLocation)}` + __location)
        }
        else if(!primaryLocation) {
            return this.client_error("Missing a location being marked as the primary location");
        }
        const primaryAddressLine = primaryLocation?.address + (primaryLocation?.address2 ? ", " + primaryLocation?.address2 : "");
        const mailingAddressLine = this.app.business.mailing_address + (this.app.business.mailing_address2 ? ", " + this.app.business.mailing_address2 : "");
        const BOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP");
        const primaryContact = applicationDocData.contacts.find(c => c.primary);

        //TODO legalEntity Type map
        const amtrustLegalEntityMap = {
            'Association': "Organization including a Corporation",
            'Corporation': "Organization including a Corporation",
            'Corporation (C-Corp)': "Organization including a Corporation",
            'Corporation (S-Corp)': "Organization including a Corporation",
            "Non Profit Corporation": "Organization including a Corporation",
            "Limited Liability Company (Member Managed)": "Limited Liability Company",
            "Limited Liability Company (Manager Managed)": "Limited Liability Company",
            'Limited Liability Company': "Limited Liability Company",
            'Limited Partnership': "Partnership",
            'Partnership': "Partnership",
            'Sole Proprietorship': "Individual",
            'Other': "Other"
        };

        // existing question answers don't map 1:1 to what Markel expects
        const constructionTypeMatrix = {
            "Fire Resistive": 6,
            "Frame": 1,
            "Joisted Masonry": 2,
            "Masonry Non Combustible": 4,
            "Non Combustible": 4
        };


        //         constructionCategoryCode - 1 --> Frame
        // constructionCategoryCode - 2 --> Joisted Masonry
        // constructionCategoryCode - 3 --> Noncombustible
        // constructionCategoryCode - 4 --> Masonry Noncombustible
        // constructionCategoryCode - 5 --> Modified Fire Resistive
        // constructionCategoryCode - 6 --> Fire Resistive

        //
        //Amtrust - Roof Type
        //         Asphalt Shingles
        // Built-up Roofing
        // Clay Tiles
        // Concrete Paver
        // Metal Roof Panels
        // Rubber Membrane
        // Stone Ballast

        // TODO From question...
        // const roofConstructionMatrix = {
        //     "Asphalt Shingles": "Asphalt Shingles",
        //     "Built Up (with gravel)": "Built-up Roofing",
        //     "Built Up Without Gravel (Smooth Surface)": "Built-up Roofing",
        //     "Clay or Concrete Tile": "Clay Tiles",
        //     //"Foam (sprayed on)": "FOAM",
        //     //"Metal": "Metal Roof Panels",
        //     //"Modified Bitumen": "MODBITUMEN",
        //     "Single Ply Membrane (ballasted with smooth stone or paving blocks)": "Rubber Membrane",
        //     "Single Ply Membrane (EPDM, Rubber)": "Rubber Membrane",
        //     "Single Ply Membrane (PVC, TPO)": "Rubber Membrane"
        //     //,
        //     //"Wood Shingles/Shakes": "WOODSS",
        //     //"Unknown": "UNKNOWN"
        // };

        //requestJSON
        let hasCentralStationFireAlarm = false
        if(BOPPolicy.fireAlarmType === "Central Station Without Key" || BOPPolicy.fireAlarmType === "Police/Fire Connected"){
            hasCentralStationFireAlarm = true;
        }

        const requestJSON = {
            "businessName": applicationDocData.businessName,
            "fein": applicationDocData.ein,
            "primaryContactInformation": {
                "name": `${primaryContact.firstName} ${primaryContact.LastName}` ,
                "phoneNumber": primaryContact.phone,
                "email": primaryContact.email
            },
            "primaryAddress": {
                "Line1": primaryAddressLine.slice(0,50),
                "City": primaryLocation.city,
                "territory": primaryLocation.state,
                "postalCode": primaryLocation.zipcode.slice(0,5)
            },
            "mailingAddress": {
                "Line1":  mailingAddressLine.slice(0,50),
                "City": applicationDocData.mailingCity,
                "territory": applicationDocData.mailingState,
                "postalCode": applicationDocData.mailingZipcode.slice(0,5)
            },
            "effectiveDate": moment(BOPPolicy.effectiveDate).format("YYYY-MM-DD"),
            "agentContactId": agentId,
            "legalEntity": amtrustLegalEntityMap.hasOwnProperty(appDoc.entityType) ? amtrustLegalEntityMap[appDoc.entityType] : "Other",
            "classCode": {
                "classCodeId": parseInt(this.insurerIndustryCode.code, 10),
                "personalPropertyCoverage": {
                    "coverageLimit": primaryLocation.businessPersonalPropertyLimit,
                    "valuation": "Replacement Cost"
                },
                "buildingCoverage": {
                    "coverageLimit": primaryLocation.buildingLimit,
                    "valuation": "Actual Cash Value"
                }
            },
            "annualSales": appDoc.grossSalesAmt,
            "constructionCategoryCode": constructionTypeMatrix[primaryLocation.constructionType],
            "totalSquareFootage": primaryLocation.square_footage, //TODO question
            "totalSquareFootageOccupied": primaryLocation.square_footage,
            "totalStories": primaryLocation.numStories,
            "highestStoryOccupied": primaryLocation.numStories, //TODO NEED Question
            "roofType": "Clay Tiles",
            "yearBuilt": {
                "yearBuilt": primaryLocation.yearBuilt,
                "yearRoofUpdated": primaryLocation.bop.roofingImprovementYear,
                "yearElectricalUpdated": primaryLocation.bop.wiringImprovementYear,
                "yearPlumbingUpdated": primaryLocation.bop.plumbingImprovementYear,
                "yearHeatingUpdated": primaryLocation.bop.heatingImprovementYear
            },
            "hasCentralStationFireAlarm": hasCentralStationFireAlarm,
            "hasCentralStationBurglarAlarm": true, //TODO Need Question
            "isSprinkleredBuilding": primaryLocation.bop.sprinklerEquipped
        }
        if(applicationDocData.website){
            requestJSON.companyWebsite = applicationDocData.website
        }

        const createQuoteMethod = 'POST';
        const createRoute = '/api/v1/quotes/rate'
        const quoteResponse = await this.amtrustCallAPI(createQuoteMethod, accessToken, this.credentials.mulesoftSubscriberId, createRoute, requestJSON);
        if (!quoteResponse) {
            log.error(`${logPrefix} returned no response on Quote Post` + __location)
            return this.client_error("The Amtrust server returned an unexpected empty response when submitting the quote information.", __location);
        }
        let quoteId = null;

        if(quoteResponse?.data){
            quoteId = quoteResponse.data.accountInformation?.quoteId;
            // TO BE MOVE to after questions snet - No question sent..  we do not have question list from Amtrust yet 2/5/2022.
            if(quoteResponse.data.premiumDetails){
                // "premiumDetails": {
                //     "priceIndication": 500.0,
                //     "generalLiabilityLimits": "1,000/2,000/2,000,000",
                //     "medicalPayments": "5,000",
                //     "damagesToPremisesLiabilityLimit": "50,000",
                //     "businessPersonalProperty": "17",
                //     "propertyDeductible": "None",
                //     "expansionEndorsement": "Basic"
                // },
                const quotePremium = quoteResponse.data.premiumDetails.priceIndication

                if(quoteResponse.data.isOK && quoteResponse.data.messages?.length > 0){
                    for(const message of quoteResponse.data.messages){
                        if(message.messageCode === 'Deeplink'){
                            this.quoteLink = message.title;
                            break;
                        }
                    }
                }

                const quoteLimits = {}
                quoteLimits[6] = quoteResponse.data.premiumDetails.medicalPayments;
                let coverageSort = 0;

                const glCoverage = {
                    description: 'General Liability Limits',
                    value: quoteResponse.data.premiumDetails.generalLiabilityLimits,
                    sort: coverageSort++,
                    category: 'General Limits',
                    insurerIdentifier: "generalLiabilityLimits"
                };
                this.quoteCoverages.push(glCoverage);

                const premiseCoverage = {
                    description: 'Damages To Premises Liability Limit',
                    value: quoteResponse.data.premiumDetails.damagesToPremisesLiabilityLimit,
                    sort: coverageSort++,
                    category: 'Liability Coverages',
                    insurerIdentifier: "damagesToPremisesLiabilityLimit"
                };
                this.quoteCoverages.push(premiseCoverage);

                const bppCoverage = {
                    description: 'Business Personal Property Liability Limit',
                    value: quoteResponse.data.premiumDetails.businessPersonalProperty,
                    sort: coverageSort++,
                    category: 'Liability Coverages',
                    insurerIdentifier: "bppCoverage"
                };
                this.quoteCoverages.push(bppCoverage);

                const medicalCoverage = {
                    description: 'Medical Payments',
                    value: quoteResponse.data.premiumDetails.medicalPayments,
                    sort: coverageSort++,
                    category: 'Liability Coverages',
                    insurerIdentifier: "medicalPayments"
                };
                this.quoteCoverages.push(medicalCoverage);

                const deductibleCoverage = {
                    description: 'Property Deductible',
                    value: quoteResponse.data.premiumDetails.propertyDeductible,
                    sort: coverageSort++,
                    category: 'Liability Coverages',
                    insurerIdentifier: "propertyDeductible"
                };
                this.quoteCoverages.push(deductibleCoverage);

                //Per AMTRUST referred Only until Amtrust implements Questions in the API.
                return this.client_price_indication(quoteId, quoteLimits, quotePremium);

            }
            else {
                //declined
                return this.client_declined("The insurer has declined to offer you coverage at this time");
            }

        }
        else {
            log.error(`${logPrefix} expected response structure from Amtrust on Quote Post` + __location)
            return this.client_error("The Amtrust server returned an unexpected response when submitting the quote information.", __location);
        }


        //TODO underwriting Questions Per Amtrust On Hold for now (March 4, 2022)


    }

}