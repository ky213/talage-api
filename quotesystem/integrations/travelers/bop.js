/* eslint-disable array-element-newline */
'use strict';

const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');

const travelersStagingHost = "swi-qa.travelers.com";
const travelersStagingBasePath = "/biswi/api/qa/qi/bop/1-0-0";
const travelersProductionHost = "swi.travelers.com";
const travelersProductionBasePath = "/biswi/api/qi/bop/1-0-0";

const travelersTalageUploadVendorCode = "TALG";


//constructionTypeCode; "Valid values are 1, 2, 3, 4, 5, 6 - 1 (FRAME) - 2 (JOISTED MASONRY) - 3 (NON-COMBUSTIBLE) - 4 (MASONRY NON-COMBUSTIBLE) - 5 (MODIFIED FIRE RESISTIVE) - 6 (FIRE RESISTIVE)",
const constructionMatrix = {
    "Frame": 1,
    "Joisted Masonry": 2,
    "Non Combustible": 3,
    "Masonry Non Combustible": 4,
    "Fire Resistive": 6
};


// PRFE (Property - Fire)
// PRTV (Property - Theft/Vandalism) -
// PRWD (Property Water Damage (Non-Weather)) -
// PRWR (Property Weather Related) -
// PROT (Property - Other) -
// GLPA (General Liability - Personal/Advertising Injury) -
// GLPC (General Liability - Products/Completed Operations) -
// GLPO (General Liability - Premises/Operations) -
// OTHN (Other - Hired and Non-Owned) -
// OTPL (Other - Professional Liability) -
// OTHR (Other)"
//
//
const lossCauseCodeMatrix = {
    "Fire": "PRFE",
    "Water": "PRWD",
    "Hail": "PRWR",
    "Vandalism": "PRTV",
    "Collapse": "PROT",
    "WINDSTORM": "PRWR",
    "Theft/Burglary": "PRTV",
    "Food Spoilage": "OTHR",
    "Inland Marine": "OTHR",
    "Slip/Fall - Inside": "GLPO",
    "Slip/Fall - Outside": "GLPO",
    "Products": "GLPC",
    "Personal Injury": "GLPA",
    "Property Damage": "PROT",
    "Professional Liability / Errors and Omissions": "OTPL",
    "Employee Practices": "OTHN",
    "Other": "OTHR"
}


module.exports = class AcuityWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = false;
        this.requiresInsurerActivityCodes = false;
    }

    /**
     * Gets a child property from an object
     * @param  {object} object - the parent object
     * @param  {string} childPath - period-delimited child name ("Quote.Result.Status")
     * @returns {object} The child object or null if it could not be found
     */
    getChildProperty(object, childPath) {
        const childPathList = childPath.split('.');
        let child = object;
        for (const childName of childPathList) {
            if (!child.hasOwnProperty(childName)) {
                return null;
            }
            child = child[childName];
        }
        return child;
    }

    async getLocationList(sicCode, naicsCode) {


        const locationList = [];
        for (let i = 0; i < this.applicationDocData.locations.length; i++) {
            const location = this.applicationDocData.locations[i];

            let sprinkleredPercent = 0;
            if (location?.bop?.sprinklerEquipped) {
                sprinkleredPercent = 100;
            }
            ////"sprinklerSystemTypeCode": "Valid values are 'LS', 'AF', 'NONE' - LS (Life Safety Only) - AF (Automatic Fire Protection/Extinguishing) - NONE (None)",
            //Need question

            const locationJSON = {
                "SICCode": sicCode,
                "NAICSCode": naicsCode,
                address: {
                    "address": location.address,
                    "addressLine2": location.address2 || "",
                    "city": location.city,
                    "state": location.state,
                    "zipcode": location.zipcode
                    // "phone": "1" + location.phone ?Required?
                },
                "buildings": [
                    {
                        "SICCode": sicCode,
                        "NAICSCode": naicsCode,
                        "annualRevenueAmount": this.applicationDocData.grossSalesAmt,
                        "limits": {
                            "building": location.buildingLimit,
                            "BPP": location.businessPersonalPropertyLimit,
                            "TIB": 10000
                        },
                        "details": {
                            "numberOfStories": location.numStories,
                            "squareFootage": location.square_footage,
                            "squareFootageOccupied": location.square_footage,
                            "constructionTypeCode":   constructionMatrix[location.constructionType], //constructionMatrix
                            "constructionYear": location.yearBuilt,
                            "sprinkleredPercent": sprinkleredPercent,
                            //"sprinklerSystemTypeCode": "Valid values are 'LS', 'AF', 'NONE' - LS (Life Safety Only) - AF (Automatic Fire Protection/Extinguishing) - NONE (None)",
                            "roofReplacedYear": location.bop.roofingImprovementYear
                        }
                    }
                ]
            };
            // if(naicsCode){
            //     locationJSON.NAICSCode = naicsCode
            // }
            // else if(sicCode){
            //     locationJSON.SICCode = sicCode
            // }
            locationList.push(locationJSON);
        }
        return locationList;
    }

    getClaims = (claims) => {
        claims = claims.filter(c => c.policyType === "BOP");

        if (claims.length === 0) {
            return null;
        }

        const requestClaims = [];
        //Claim question for cause/type (see liberty )
        claims.forEach(claim => {
            let causeCode = "OTHR"
            const claimTypeQuestion = claim.questions.find(question => question.insurerQuestionIdentifier === 'claim_lossType');
            if (claimTypeQuestion) {
                causeCode = lossCauseCodeMatrix[claimTypeQuestion.answerValue.trim()];
                if (!causeCode) {
                    causeCode = 'OTHR';
                }
            }
            requestClaims.push({
                "date": claim.eventDate,
                "totalPaidAmount": claim.amountPaid,
                "cause": causeCode
            });
        });

        return requestClaims;
    }

    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.applicationDocData
        //const applicationDocData = this.applicationDocData;

        const defaultLimits = [
            "100000/500000/100000",
            "500000/500000/500000",
            "1000000/1000000/1000000",
            "2000000/2000000/2000000"
        ];
        const stateLimits = {
            "CA": [
                "1000000/1000000/1000000", "2000000/2000000/2000000"
            ],
            "NY": [
                "100000/500000/100000",
                "500000/500000/500000",
                "1000000/1000000/1000000",
                "2000000/2000000/2000000"
            ],
            "MI": [
                "100000/100000/100000",
                "100000/500000/100000",
                "500000/500000/500000",
                "1000000/1000000/1000000",
                "2000000/2000000/2000000"
            ],
            "OR": [
                "500000/500000/500000",
                "1000000/1000000/1000000",
                "2000000/2000000/2000000"
            ]
        }
        const supportedGenAggLimits = [1000000, 2000000, 4000000];
        const supportedPerOccLimits = [500000, 1000000, 2000000];

        // The supported property deductables
        const supportedDeductables = [
            500,
            1000,
            2500,
            5000
        ];

        //default to 1 mill
        let policyAggLimit = 1000000
        let policyOccurrenceLimit = 1000000
        log.debug(`policy limits ${JSON.stringify(this.policy.limits)}` + __location)

        const BOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP"); // This may need to change to BOPSR?
        let limitsStr =  BOPPolicy.limits;
        // skip first character, look for first occurance of non-zero number
        const indexes = [];
        for (let i = 1; i < limitsStr.length; i++) {
            if (limitsStr[i] !== "0") {
                indexes.push(i);
            }
        }

        //get limite parts from 
        const limits = [];
        policyOccurrenceLimit = this.policy.limits[0];
        policyAggLimit = this.policy.limits[1];

        //best fit

        // limits.push(limitsStr.substring(0, indexes[0])); // per occ
        // limits.push(limitsStr.substring(indexes[0], indexes[1])); // gen agg
        limits.push(limitsStr.substring(indexes[1], limitsStr.length)); // agg

        
        
        // const carrierLimits = this.getBestLimits(carrierLimitOptions);
        // if (carrierLimits) {
        //     applicationLimits = carrierLimits.join("/");
        // }

        // =========================================================================================================
        // Validation

        // Ensure we have a supported legal entity.
        const legalEntityMap = {
            'Association': 'AS',
            'Corporation': 'CP',
            "Corporation (C-Corp)": 'CP',
            "Corporation (S-Corp)": 'CP',
            'Limited Liability Company': 'LL',
            "Limited Liability Company (Member Managed)": 'LL',
            "Limited Liability Company (Manager Managed)": 'LL',
            'Limited Partnership': 'LP',
            'Partnership': 'GP',
            'Sole Proprietorship': 'SolePrp',
            'Other': 'OT'
        };
        if (!legalEntityMap.hasOwnProperty(this.app.business.locations[0].business_entity_type)) {
            return this.client_error(`The business entity type '${this.app.business.locations[0].business_entity_type}' is not supported by this insurer.`, __location);
        }
        //Travelers does not have Insurer Industry Code records with us .  WC only.  using this.industry_code (insurer's)  lead to sic errors
        // in the submissions.
        //Look up Talage industry Code to get Sic
        let sicCode = null;
        let naicsCode = null;
        if(appDoc.industryCode){
            const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
            const industryCodeBO = new IndustryCodeBO();
            const industryCodeJson = await industryCodeBO.getById(appDoc.industryCode);
            if(industryCodeJson){
                sicCode = industryCodeJson.sic
                naicsCode = industryCodeJson.naics
                if(naicsCode){
                    //if have naics use it only do not send both naics and sic. ok to send with out either
                    sicCode = null;
                }
            }
        }

        let numberEmployeesPerShift = 1;
        let shiftEmployeeQuestionHit = false
        for (const question of Object.values(this.questions)) {
            const questionAnswer = this.determine_question_answer(question);
            if (questionAnswer) {
                switch (this.question_identifiers[question.id]) {
                    case "numberEmployeesPerShift":
                        try{
                            numberEmployeesPerShift = parseInt(questionAnswer, 10);
                            shiftEmployeeQuestionHit = true;
                        }
                        catch(err){
                            log.error(`Appid: ${this.app.id} Travelers WC: Unable to parse Employee per Shift answer ${questionAnswer}: ${err} ` + __location);
                        }
                        break;
                    default:
                        break;
                }
            }
        }
        if(shiftEmployeeQuestionHit === false || !numberEmployeesPerShift){
            numberEmployeesPerShift = this.get_total_employees();
        }

        const claims = this.claims_to_policy_years();
        const claimCountCurrentPolicy = claims[1].count;
        const claimCountPriorThreePolicy = claims[2].count + claims[3].count + claims[4].count;
        const claimObjects = this.getClaims(appDoc.claims);

        let primaryContact = appDoc.contacts.find(c => c.primary);
        if(!primaryContact && appDoc.contacts.length > 0){
            primaryContact = appDoc.contacts[0]
        }
        else if (!primaryContact){
            primaryContact = {};
        }
        let contactPhone = '';
        try{
            contactPhone = primaryContact.phone.toString()
        }
        catch(err){
            log.error(`Appid: ${this.app.id} Travelers WC: Unable to get contact phone. error: ${err} ` + __location);
        }
        //Get businessPrincipal
        let businessPrincipal = {};
        if(appDoc.owners && appDoc.owners.length === 1){
            businessPrincipal = appDoc.owners[0]
        }
        else if(!appDoc.owners && appDoc.owners.length === 0){
            businessPrincipal.fname = primaryContact.firstName
            businessPrincipal.lname = primaryContact.lasstName
        }
        else {
            //Take 1st owner. TODO look for highest percent ownership
            businessPrincipal = appDoc.owners[0]
        }

        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {
            "requestId": this.quoteId,
            "sessionId": this.generate_uuid(),
            "policyEffectiveDate": this.policy.effective_date.format("YYYY-MM-DD"),
            "policyExpirationDate": this.policy.expiration_date.format("YYYY-MM-DD"),
            "lineOfBusinessCode": "BOP",
            "SICCode": sicCode,
            "NAICSCode": naicsCode,
            "producer": {
                "producerCode": this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                "uploadVendorCode": travelersTalageUploadVendorCode
            },
            "customer": {
                // "externalCustomerId": "string",
                "primaryNameInsured": appDoc.businessName,
                "tradeDBALine1": appDoc.dba ? appDoc.dba : "",
                "tradeDBALine2": "",
                "FEIN": appDoc.ein,
                "legalEntity": legalEntityMap[appDoc.entityType],
                "address": {
                    "mailingAddress": appDoc.mailingAddress,
                    "mailingAddressLine2": appDoc.mailingAddress ? appDoc.mailingAddress : "",
                    "mailingCity": appDoc.mailingCity,
                    "mailingState": appDoc.mailingState,
                    "mailingZipcode": appDoc.mailingZipcode.slice(0,5),
                    "insuredPhoneNumber": "1" + contactPhone
                },
                "businessPrincipal": {
                    "firstName": businessPrincipal.fname,
                    "lastName": businessPrincipal.lname,
                    "middleInitial": ""
                },
                "insuredEmailAddress": this.app.business.contacts[0].email ? this.app.business.contacts[0].email : "",
                "insuredWebsiteUrl": this.app.business.website ? this.app.business.website : ""
            },
            "businessInfo": {"locations": await this.getLocationList(sicCode, naicsCode)},
            "basisOfQuotation": {
                // "pricing": {
                //     "experienceMod": "string",
                //     "modStatus": "string",
                //     "riskId": "string",
                //     "experienceModEffectiveDate": "string"
                // },
                "yearBusinessEstablished": parseInt(this.app.business.founded.format("YYYY"),10),
                "claimCountCurrentPolicy": claimCountCurrentPolicy,
                //"priorPolicyExpirationDate": ,
                "totalAnnualWCPayroll": this.get_total_payroll(),
                "employersLiabilityLimit": applicationLimits,
                // "threeYearsManagementExperienceInd": true,
                // "operateAsGeneralContractorInd": true
                "priorPolicyExpirationDate": "2020-01-01",
                "medicalPaymentsLimitAmount": "Valid values are 0, 500, 1000, 5000, 10000 - 0 - 500 - 1000 - 5000 - 10000",
                "propertyDeductibleAmount": "Valid values are 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 75000 - 250 - 500 - 1000 - 2500 - 5000 - 10000 - 25000 - 50000 - 75000",
                "GLPropertyDamageDeductibleAmount": "Valid values are 0, 250, 500, 1000 - 0 - 250 - 500 - 1000",
                "GLPerOccurrenceLimitAmount": "Valid values are 500000, 1000000, 2000000 - 500000 - 1000000 - 2000000",
                "GLAggregateLimitAmount": "Valid values are 1000000, 2000000, 4000000 - 1000000 - 2000000 - 4000000",
                "GLProductsCompletedOperationsLimitAmount": "Valid values are 1000000, 2000000, 4000000 - 1000000 - 2000000 - 4000000",
                "eligibility": {}
            }
        };
        //question checks
            //loop insurerQuestion add what is present
        // "buffetOrAllYouCanEatRestaurantInd": true,
        // "danceFloorOrDjOrLiveEntertainmentInd": false,
        // "homeBasedBusinessOrHabitationalOccupanciesInd": false,
        // "industrialMachineryOrEquipmentInd": false,
        // "occupancyRateIsBelow70PctInd": false,
        // "occupancyRateIsBelow80PctInd": false,
        // "openFlameFryingGrillingNoAutomaticExtinguishingSystemInd": false,
        // "openPast2AmInd": false,
        // "openPastMidnightInd": false,
        // "propertyManagementInd": false,
        // "saleRepairBulkStorageTiresInd": false,
        // "sellServiceMotorcyclesRvsBoatsEmergencyOffRoadVehiclesInd": false,
        // "seniorLivingFacilitiesAssistedLivingIndependentLivingInd": false

        // if(haveQuestion){
        //      //get talageAnser
        //      quoteRequestData.basisOfQuotation.eligibility[identifer] = this.convertToBoolean(answer))
        // }

        if (claimObjects) {
            quoteRequestData.losses = claimObjects;
        }

        // Flag if this is a test transaction
        if (this.insurer.useSandbox) {
            quoteRequestData.testTransaction = true;
        }

        // =========================================================================================================
        // Send the request
        const host = this.insurer.useSandbox ? travelersStagingHost : travelersProductionHost;
        const basePath = this.insurer.useSandbox ? travelersStagingBasePath : travelersProductionBasePath;
        let response = null;
        try {
            response = await this.send_json_request(host, basePath + "/quote",
                JSON.stringify(quoteRequestData),
                {"Authorization": 'Basic ' + Buffer.from(this.username + ":" + this.password).toString('base64')},
                "POST");
        }
        catch (error) {
            try {
                if(error.indexOf("ETIMEDOUT") > -1){
                    return this.client_error(`The Submission to Travelers timed out`, __location, {error: error});
                }
                else {
                    response = JSON.parse(error.response);
                }
            }
            catch (error2) {
                return this.client_error(`The Requeset to insurer had an error of ${error}`, __location, {error: error});
            }
        }

        // console.log("response", JSON.stringify(response, null, 4));

        // Check for internal errors where the request format is incorrect
        if (response.hasOwnProperty("statusCode") && response.statusCode === 400) {
            return this.client_error(`The insurer returned an internal error status code of ${response.statusCode}`, __location, {debugMessages: JSON.stringify(response.debugMessages)});
        }

        // =========================================================================================================
        // Process the quote information response

        const quoteStatus = this.getChildProperty(response, "quoteStatus");
        if (!quoteStatus) {
            return this.client_error(`Could not locate the quote status in the response.`, __location);
        }
        // Extract all optional and required information
        const quoteStatusReasonList = this.getChildProperty(response, "quoteStatusReason") || [];
        const debugMessageList = this.getChildProperty(response, "debugMessages") || [];
        const quoteId = this.getChildProperty(response, "eQuoteId");
        const premium = this.getChildProperty(response, "totalAnnualPremiumSurchargeTaxAmount");
        const validationDeepLink = this.getChildProperty(response, "validationDeeplink");
        const employersLiabilityLimit = this.getChildProperty(response, "employersLiabilityLimit");

        // Process the limits
        const limits = [];
        if (employersLiabilityLimit) {
            const individualLimitList = employersLiabilityLimit.split("/");
            if (individualLimitList.length !== 3) {
                // Continue without the limits but log it
                this.log_error(`Returned unrecognized limits of '${employersLiabilityLimit}'. Continuing.`);
            }
            else {
                limits[1] = individualLimitList[0];
                limits[2] = individualLimitList[1];
                limits[3] = individualLimitList[2];
            }
        }

        // Generate a quote status reason message from quoteStatusReason and debugMessages
        let quoteStatusReasonMessage = '';
        for (const quoteStatusReason of quoteStatusReasonList) {
            quoteStatusReasonMessage += `${quoteStatusReasonMessage.length ? ", " : ""}${quoteStatusReason.description} (${quoteStatusReason.code})`;
        }
        for (const debugMessage of debugMessageList) {
            quoteStatusReasonMessage += `${quoteStatusReasonMessage.length ? ", " : ""}${debugMessage.description} (${debugMessage.code})`;
        }

        // Handle the status
        switch (quoteStatus) {
            case "DECLINE":
                return this.client_declined(quoteStatusReasonMessage);
            case "UNQUOTED":
                return this.client_error(quoteStatusReasonMessage, __location);
            case "AVAILABLE":
                if (validationDeepLink) {
                    // Add the deeplink to the quote
                    this.quoteLink = validationDeepLink;
                }
                else {
                    this.log_error("Could not locate validationDeepLink property in response.", __location);
                }
                return this.client_quoted(quoteId, limits, premium);
            default:
                break;
        }

        // Unrecognized quote status
        return this.client_error(`Received an unknown quote status of '${quoteStatus}`);
    }
};