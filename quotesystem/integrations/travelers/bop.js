/* eslint-disable array-element-newline */
'use strict';

const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');

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

const quoteCoverages = [];

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


    async getClaims(claims) {
        claims = claims.filter(c => c.policyType === "BOP");

        if (claims.length === 0) {
            return null;
        }

        const requestClaims = [];
        //Claim question for cause/type (see liberty )
        for(const claim of claims){
            let causeCode = "OTHR"
            const claimQuestionIds = claim.questions.map(question => question.questionId);
            const insurerClaimQuestions = await this.getInsurerQuestionsByTalageQuestionId('claim', claimQuestionIds, ['BOP']);
            for (const question of claim.questions) {
                const insurerClaimQuestion = insurerClaimQuestions.find(icq => icq.talageQuestionId === question.questionId);
                if (insurerClaimQuestion.identifier === 'claim_lossType') {
                    causeCode = lossCauseCodeMatrix[question.answerValue.trim()];
                    if (!causeCode) {
                        causeCode = 'OTHR';
                    }
                }
            }

            requestClaims.push({
                "date": claim.eventDate,
                "totalPaidAmount": claim.amountPaid,
                "cause": causeCode
            });
        }

        return requestClaims;
    }


    async getLocationList(naicsCode) {


        const locationList = [];
        for (let i = 0; i < this.applicationDocData.locations.length; i++) {
            const location = this.applicationDocData.locations[i];

            let sprinkleredPercent = 0;
            let sprinklerSystemTypeCode = "NONE"
            if (location?.bop?.sprinklerEquipped) {
                const sprinkleredPercentQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "sprinkleredPercent");
                const sprinklerSystemTypeCodeQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "sprinklerSystemTypeCode");
                if(sprinkleredPercentQuestion){
                    sprinkleredPercent = parseInt(sprinkleredPercentQuestion.answerValue,10);
                    if(!sprinkleredPercent){
                        sprinkleredPercent = 0;
                    }
                }

                if(sprinklerSystemTypeCodeQuestion){
                    const answerParts = sprinklerSystemTypeCodeQuestion.answerValue.split("-")
                    sprinklerSystemTypeCode = answerParts[0].trim();
                }
            }
            ////"sprinklerSystemTypeCode": "Valid values are 'LS', 'AF', 'NONE' - LS (Life Safety Only) - AF (Automatic Fire Protection/Extinguishing) - NONE (None)",
            //Need question

            const locationJSON = {
                "NAICSCode": naicsCode,
                address: {
                    "address": location.address,
                    "addressLine2": location.address2 || "",
                    "city": location.city,
                    "state": location.state,
                    "zipcode": location.zipcode.slice(0,5)
                    // "phone": "1" + location.phone ?Required?
                },
                "buildings": [
                    {
                        "NAICSCode": naicsCode,
                        "annualRevenueAmount": this.applicationDocData.grossSalesAmt ? this.applicationDocData.grossSalesAmt : 0,
                        "limits": {
                            "building": location.buildingLimit ? location.buildingLimit : 0 ,
                            "BPP": location.businessPersonalPropertyLimit ? location.businessPersonalPropertyLimit : 0//,
                            //"TIB": 10000
                        },
                        "details": {
                            "numberOfStories": location.numStories,
                            "squareFootage": location.square_footage,
                            "squareFootageOccupied": location.square_footage,
                            "constructionTypeCode":   constructionMatrix[location.constructionType], //constructionMatrix
                            "constructionYear": location.yearBuilt,
                            "sprinkleredPercent": sprinkleredPercent,
                            sprinklerSystemTypeCode: sprinklerSystemTypeCode,
                            //"sprinklerSystemTypeCode": "Valid values are 'LS', 'AF', 'NONE' - LS (Life Safety Only) - AF (Automatic Fire Protection/Extinguishing) - NONE (None)",
                            "roofReplacedYear": location.bop.roofingImprovementYear
                        }
                    }
                ]
            };
            locationList.push(locationJSON);
        }
        return locationList;
    }


    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.applicationDocData
        const applicationDocData = this.applicationDocData;

        const logPrefix = `Appid: ${this.app.id} Travelers BOP `

        const supportedGenAggLimits = [1000000, 2000000, 4000000];
        const supportedPerOccLimits = [500000, 1000000, 2000000];

        // The supported property deductables
        const supportedDeductables = [
            0, 250, 500, 1000
        ];

        const supportedPropertyDeductables = [
            250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 75000
        ];

        //default to 1 mill
        let policyAggLimit = 1000000
        let policyOccurrenceLimit = 1000000

        log.debug(`policy limits ${JSON.stringify(this.policy.limits)} array ${JSON.stringify(this.policy.limitArray)}` + __location)
        const BOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP"); // This may need to change to BOPSR?
        //let limitsStr =  BOPPolicy.limits;

        //get limite parts from
        const limits = [];
        if(this.policy.limitArray[0]){
            policyOccurrenceLimit = parseInt(this.policy.limitArray[0],10);
        }
        if(this.policy.limitArray[1]){
            policyAggLimit = parseInt(this.policy.limitArray[1],10);
        }

        //best fit
        if(supportedGenAggLimits.indexOf(policyAggLimit) === -1){
            for(let i = 0; i < supportedGenAggLimits.length; i++){
                if(policyAggLimit <= supportedGenAggLimits[i]){
                    policyAggLimit = supportedGenAggLimits[i];
                    break;
                }
            }
            if(policyAggLimit > supportedGenAggLimits[supportedGenAggLimits.length - 1]){
                policyAggLimit = supportedGenAggLimits[supportedGenAggLimits.length - 1]
            }

        }
        limits[8] = policyAggLimit;
        if(supportedPerOccLimits.indexOf(policyOccurrenceLimit) === -1){
            for(let i = 0; i < supportedPerOccLimits.length; i++){
                if(policyOccurrenceLimit <= supportedPerOccLimits[i]){
                    policyOccurrenceLimit = supportedPerOccLimits[i];
                    break;
                }
            }
            if(policyOccurrenceLimit > supportedPerOccLimits[supportedPerOccLimits.length - 1]){
                policyOccurrenceLimit = supportedPerOccLimits[supportedPerOccLimits.length - 1]
            }

        }
        limits[4] = policyOccurrenceLimit
        //TODO reverse logic to get next lowest.
        let bopDeductbile = BOPPolicy.deductible ? BOPPolicy.deductible : 0;
        if(supportedDeductables.indexOf(bopDeductbile) === -1){
            for(let i = supportedDeductables.length - 1; i > -1; i--){
                if(bopDeductbile >= supportedDeductables[i]){
                    bopDeductbile = supportedDeductables[i];
                    break;
                }
            }
            if(bopDeductbile > supportedDeductables[supportedDeductables.length - 1]){
                bopDeductbile = supportedDeductables[0]
            }

        }
        limits[12] = bopDeductbile;

        //quoteLimits[11] = policyaggregateLimit;

        let bopPropertyDeductbile = BOPPolicy.deductible ? BOPPolicy.deductible : 0;
        if(supportedPropertyDeductables.indexOf(bopPropertyDeductbile) === -1){
            for(let i = supportedDeductables.length - 1; i > -1; i--){
                if(bopPropertyDeductbile >= supportedPropertyDeductables[i]){
                    bopPropertyDeductbile = supportedPropertyDeductables[i];
                    break;
                }
            }
            if(bopPropertyDeductbile > supportedPropertyDeductables[supportedPropertyDeductables.length - 1]){
                bopPropertyDeductbile = supportedPropertyDeductables[supportedPropertyDeductables.length - 1]
            }

        }


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

        let naicsCode = null;
        if(appDoc.industryCode){
            const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
            const industryCodeBO = new IndustryCodeBO();
            const industryCodeJson = await industryCodeBO.getById(appDoc.industryCode);
            if(industryCodeJson){
                naicsCode = industryCodeJson.naics
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

        //Already filtered for policyType
        const claimCountCurrentPolicy = this.policy.claims.length;
        const claimObjects = await this.getClaims(appDoc.claims, appDoc.applicationId);

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
            contactPhone = stringFunctions.santizeNumber(contactPhone, false);
            if(contactPhone.startsWith("1")){
                contactPhone = contactPhone.substring(1);
            }
        }
        catch(err){
            log.error(`${logPrefix} Unable to get contact phone. error: ${err} ` + __location);
        }
        //Get businessPrincipal
        let businessPrincipal = {};
        if(appDoc.owners && appDoc.owners.length === 1){
            businessPrincipal = appDoc.owners[0]
        }
        else if(appDoc.owners && appDoc.owners.length > 1){
            //Take 1st owner. TODO look for highest percent ownership
            businessPrincipal = appDoc.owners[0]
        }
        else if(!appDoc.owners || appDoc.owners.length === 0){
            businessPrincipal.fname = primaryContact.firstName
            businessPrincipal.lname = primaryContact.lastName
        }
        const totalNumberOfEmployees = this.get_total_employees();

        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {
            "requestId": this.quoteId,
            "sessionId": this.generate_uuid(),
            "policyEffectiveDate": this.policy.effective_date.format("YYYY-MM-DD"),
            "policyExpirationDate": this.policy.expiration_date.format("YYYY-MM-DD"),
            "lineOfBusinessCode": "BOP",
            "NAICSCode": naicsCode,
            "producer": {
                "producerCode": this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                "uploadVendorCode": travelersTalageUploadVendorCode
            },
            "customer": {
                // "externalCustomerId": "string",
                "primaryNameInsured": appDoc.businessName,
                //"tradeDBALine1": appDoc.dba ? appDoc.dba : "",
                //"tradeDBALine2": "",
                "FEIN": appDoc.ein,
                "legalEntity": legalEntityMap[appDoc.entityType],
                "address": {
                    "mailingAddress": appDoc.mailingAddress,
                    "mailingAddressLine2": appDoc.mailingAddress2 ? appDoc.mailingAddress2 : "",
                    "mailingCity": appDoc.mailingCity,
                    "mailingState": appDoc.mailingState,
                    "mailingZipcode": appDoc.mailingZipcode.slice(0,5)
                },
                "businessPrincipal": {
                    "firstName": businessPrincipal.fname,
                    "lastName": businessPrincipal.lname,
                    "middleInitial": ""
                },
                "insuredPhoneNumber": contactPhone,
                "insuredEmailAddress": this.app.business.contacts[0].email ? this.app.business.contacts[0].email : ""
                //"insuredWebsiteUrl": this.app.business.website ? this.app.business.website : ""
            },
            "businessInfo": {"locations": await this.getLocationList(naicsCode)},
            "basisOfQuotation": {
                "yearBusinessEstablished": parseInt(this.app.business.founded.format("YYYY"),10),
                totalNumberOfEmployees: totalNumberOfEmployees,
                priorYearsLossCount: claimCountCurrentPolicy,
                // "medicalPaymentsLimitAmount": "Valid values are 0, 500, 1000, 5000, 10000 - 0 - 500 - 1000 - 5000 - 10000",
                "propertyDeductibleAmount": bopPropertyDeductbile, // "Valid values are 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 75000 - 250 - 500 - 1000 - 2500 - 5000 - 10000 - 25000 - 50000 - 75000",
                "GLPropertyDamageDeductibleAmount": bopDeductbile, // "Valid values are 0, 250, 500, 1000 - 0 - 250 - 500 - 1000",
                "GLPerOccurrenceLimitAmount": policyOccurrenceLimit,
                "GLAggregateLimitAmount": policyAggLimit,
                "GLProductsCompletedOperationsLimitAmount": policyAggLimit,
                //"GLProductsCompletedOperationsLimitAmount": "Valid values are 1000000, 2000000, 4000000 - 1000000 - 2000000 - 4000000",  Same as agg limits
                "eligibility": {}
            }
        };

        const eligibilityPropList = [
            "buffetOrAllYouCanEatRestaurantInd",
            "danceFloorOrDjOrLiveEntertainmentInd",
            "homeBasedBusinessOrHabitationalOccupanciesInd",
            "industrialMachineryOrEquipmentInd",
            "occupancyRateIsBelow70PctInd",
            "occupancyRateIsBelow80PctInd",
            "openFlameFryingGrillingNoAutomaticExtinguishingSystemInd",
            "openPast2AmInd",
            "openPastMidnightInd",
            "propertyManagementInd",
            "saleRepairBulkStorageTiresInd",
            "sellServiceMotorcyclesRvsBoatsEmergencyOffRoadVehiclesInd",
            "seniorLivingFacilitiesAssistedLivingIndependentLivingInd"
        ]
        for(const insurerQuestion of this.insurerQuestionList){
            if(Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)){
                const question = this.questions[insurerQuestion.talageQuestionId];
                if(!question){
                    continue;
                }
                // limits and other things will go in a questions.
                if(eligibilityPropList.indexOf(insurerQuestion.identifier) > -1){
                    quoteRequestData.basisOfQuotation.eligibility[insurerQuestion.identifier] = question.get_answer_as_boolean()
                }
            }
        }


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
                "POST",
                true,
                true);
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
            if(response.debugMessages && response.debugMessages[0] && response.debugMessages[0].code === 'INVALID_PRODUCER_INFORMATION'){
                log.error(`${logPrefix} Travelers returned a INVALID_PRODUCER_INFORMATION  AgencyId ${appDoc.agencyId}`)
                return this.client_error(` returned a INVALID_PRODUCER_INFORMATION check Agency configuration`, __location, {debugMessages: JSON.stringify(response.debugMessages)});
            }
            else {
                return this.client_error(`The insurer returned an request error status code of ${response.statusCode}`, __location, {debugMessages: JSON.stringify(response.debugMessages)});
            }
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
        // const employersLiabilityLimit = this.getChildProperty(response, "employersLiabilityLimit");

        if(response.businessMessages && response.businessMessages.length > 0){
            for(const businessMessage of response.businessMessages){
                //quoteCoverages
                if(businessMessage.type === "BUILDING_LIMIT_ADJUSTMENT"){
                    log.debug(`${logPrefix} adjusted ${businessMessage.property}  `)
                }
                else if(businessMessage.type === "DEFAULT_VALUE_ADJUSTMENT"){
                    switch(businessMessage.property){
                        case "basisOfQuotation.GLAggregateLimitAmount":
                            limits[8] = businessMessage.appliedValue
                            break;
                        case "basisOfQuotation.GLProductsCompletedOperationsLimitAmount":
                            log.debug(`${logPrefix} adjusted basisOfQuotation.GLProductsCompletedOperationsLimitAmount  `)
                            limits[9] = businessMessage.appliedValue
                            break;
                        case "basisOfQuotation.medicalPaymentsLimitAmount":
                            limits[6] = businessMessage.appliedValue
                            break;
                        default:
                            break;
                    }

                }
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
                const declineReasonCodes = ["UNSUPPORTED_STATE","UNABLE_TO_CLASSIFY"];
                let declined = false;
                for (const quoteStatusReason of quoteStatusReasonList) {
                    if(declineReasonCodes.indexOf(quoteStatusReason.code) > -1){
                        declined = true;
                    }
                }
                if(declined){
                    return this.client_declined(quoteStatusReasonMessage);
                }
                else {
                    return this.client_error(quoteStatusReasonMessage, __location);
                }
            case "AVAILABLE":
                if (validationDeepLink) {
                    // Add the deeplink to the quote
                    this.quoteLink = validationDeepLink;
                }
                else {
                    this.log_error("Could not locate validationDeepLink property in response.", __location);
                }
                return this.client_quoted(quoteId, limits, premium, null, null, quoteCoverages);
            default:
                break;
        }

        // Unrecognized quote status
        return this.client_error(`Received an unknown quote status of '${quoteStatus}`);
    }
};