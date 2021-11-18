'use strict';

const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const moment = require('moment');


const travelersStagingHost = "swi-qa.travelers.com";
const travelersStagingBasePath = "/biswi/api/qa/qi/wc/1-0-0";
const travelersProductionHost = "swi.travelers.com";
const travelersProductionBasePath = "/biswi/api/qi/wc/1-0-0";

const travelersTalageUploadVendorCode = "TALG";

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
        const childPathList = childPath?.split('.');
        let child = object;
        for (const childName of childPathList) {
            if (!child.hasOwnProperty(childName)) {
                return null;
            }
            child = child[childName];
        }
        return child;
    }

    /**
     * Gets a list of classifications for a given location
     * @param {object} location - Location
     * @returns {object} Array of classifications with code, payroll, and full/part time employees for each
     */
    async getLocationClassificationList(location) {
        const locationClassificationList = [];
        // Aggregate activity codes for this location, summing payroll and full/part time employees
        for (const locationActivityCode of location.activityPayrollList) {
            // Find the existing entry for this activity code
            const ncciCode = await this.get_national_ncci_code_from_activity_code(location.state, locationActivityCode.activityCodeId);
            if(ncciCode){
                let locationClassification = locationClassificationList.find((lc) => lc.classCode === ncciCode.toString());
                if (!locationClassification) {
                    // Add it if it doesn't exist
                    locationClassification = {
                        classCode: ncciCode.toString(),
                        totalAnnualPayroll: 0,
                        numberFullTimeEmployees: 0,
                        numberPartTimeEmployees: 0
                    };
                    locationClassificationList.push(locationClassification);

                    // Sum the employee types
                    for (const employeeType of locationActivityCode.employeeTypeList) {
                        locationClassification.totalAnnualPayroll += employeeType.employeeTypePayroll;
                        switch (employeeType.employeeType) {
                            case "Full Time":
                            case "Owners":
                                locationClassification.numberFullTimeEmployees += employeeType.employeeTypeCount;
                                break;
                            case "Part Time":
                                locationClassification.numberPartTimeEmployees += employeeType.employeeTypeCount;
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
        }
        return locationClassificationList;
    }

    /**
     * Gets a list of locations
     * @returns {object} Array of locations
     */
    async getLocationList() {
        const locationList = [];
        for (let i = 0; i < this.applicationDocData.locations.length; i++) {
            const location = this.applicationDocData.locations[i];
            locationList.push({
                address: {
                    "address": location.address,
                    "addressLine2": location.address2 || "",
                    "city": location.city,
                    "state": location.state,
                    "zipcode": location.zipcode
                    // "phone": "1" + location.phone ?Required?
                },
                primaryLocationInd: location.primary,
                classification: await this.getLocationClassificationList(location)
            });
        }
        return locationList;
    }

    getClaims = (claims) => {
        claims = claims.filter(c => c.policyType === "WC");

        if (claims.length === 0) {
            return null;
        }

        const requestClaims = [];

        claims.forEach(claim => {
            requestClaims.push({
                "date": claim.eventDate,
                "totalPaidAmount": claim.amountPaid,
                "reservedAmount": claim.amountReserved !== null ? claim.amountReserved : 0,
                "claimStatusCode": claim.open ? "O" : "C",
                "workCompLossTypeCode": "UNK",
                "descriptionTypeCode": "43" // unknown
            });
        });

        return requestClaims;
    }


    async _insurer_price(){
        const appDoc = this.applicationDocData
        const logPrefix = `Appid: ${this.app.id} Travelers WC Pricing `


        const tomorrow = moment().add(1,'d').startOf('d');
        if(this.policy.effective_date < tomorrow){
            this.reasons.push("Insurer: Does not allow effective dates before tomorrow. - Stopped before submission to insurer");
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: false
            }
            return pricingResult;
        }


        // const defaultLimits = [
        //     "100000/500000/100000",
        //     "500000/500000/500000",
        //     "1000000/1000000/1000000",
        //     "2000000/2000000/2000000"
        // ];
        // const stateLimits = {
        //     "CA": [
        //         "1000000/1000000/1000000", "2000000/2000000/2000000"
        //     ],
        //     "NY": [
        //         "100000/500000/100000",
        //         "500000/500000/500000",
        //         "1000000/1000000/1000000",
        //         "2000000/2000000/2000000"
        //     ],
        //     "MI": [
        //         "100000/100000/100000",
        //         "100000/500000/100000",
        //         "500000/500000/500000",
        //         "1000000/1000000/1000000",
        //         "2000000/2000000/2000000"
        //     ],
        //     "OR": [
        //         "500000/500000/500000",
        //         "1000000/1000000/1000000",
        //         "2000000/2000000/2000000"
        //     ]
        // }

        // const applicationDocData = this.applicationDocData;

        // Default limits (supported by all states)
        // let applicationLimits = "1000000/1000000/1000000";
        // Find best limits
        // let carrierLimitOptions = defaultLimits;
        // if (stateLimits.hasOwnProperty(this.app.business.locations[0].state_abbr)) {
        //     carrierLimitOptions = stateLimits[this.app.business.locations[0].state_abbr];
        // }
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
            'Limited Partnership': 'LP',
            "Limited Liability Company (Member Managed)": 'LL',
            "Limited Liability Company (Manager Managed)": 'LL',
            'Partnership': 'GP',
            'Sole Proprietorship': 'SolePrp',
            'Other': 'OT'
        };
        if (!legalEntityMap.hasOwnProperty(this.app.business.locations[0].business_entity_type)) {
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: false
            }
            return pricingResult;
        }
        //Travelers does not have Insurer Industry Code records with us .  WC only.  using this.industry_code (insurer's)  lead to sic errors
        // in the submissions.
        //Look up Talage industry Code to get Sic
        let sicCode = null;
        if(appDoc.industryCode){
            const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
            const industryCodeBO = new IndustryCodeBO();
            const industryCodeJson = await industryCodeBO.getById(appDoc.industryCode);
            if(industryCodeJson){
                sicCode = industryCodeJson.sic
            }
        }


        // There are currently 4 industry codes which do not have SIC codes. Don't stop quoting. Instead, we default
        // to "0000" to continue trying to quote since Travelers allows the agent to correct the application in the DeepLink.
        if (this.industry_code.sic) {
            sicCode = this.industry_code.sic.toString().padStart(4, '0');
        }
        else {
            this.log_warn(`Appid: ${this.app.id} Travelers WC: Industry Code ${this.industry_code.id} ("${this.industry_code.description}") does not have an associated SIC code`);
            sicCode = "0000";
        }

        // Ensure we have a valid SIC code -- see sic process below
        // if (!this.industry_code.sic) {
        //     return this.client_error(`Appid: ${this.app.id} Travelers WC: Could not determine the SIC code for industry code ${this.industry_code.id}: '${this.industry_code_description}'`, __location);
        // }

        // Ensure we have valid NCCI code mappings
        for (const location of this.app.business.locations) {
            for (const activityCode of location.activity_codes) {
                const ncciCode = await this.get_national_ncci_code_from_activity_code(location.territory, activityCode.id);
                if (!ncciCode) {
                    this.log_warn(`Missing NCCI class code mapping: activityCode=${activityCode.id} territory=${location.territory}`, __location);
                    const pricingResult = {
                        gotPricing: false,
                        outOfAppetite: true,
                        pricingError: false
                    }
                    return pricingResult;
                }
                activityCode.ncciCode = ncciCode;
            }
        }

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
        }
        catch(err){
            log.error(`Appid: ${this.app.id} Travelers WC: Unable to get contact phone. error: ${err} ` + __location);
        }


        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {
            //"requestId": this.quoteId,
            //"sessionId": this.generate_uuid(),
            "policyEffectiveDate": this.policy.effective_date.format("YYYY-MM-DD"),
            "policyExpirationDate": this.policy.expiration_date.format("YYYY-MM-DD"),
            "lineOfBusinessCode": "WC",
            "SICCode": sicCode,
            //"crossSellInd": false,
            "producer": {
                "producerCode": this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                "uploadVendorCode": travelersTalageUploadVendorCode
            },
            "customer": {
                "primaryNameInsured": this.app.business.name,
                "legalEntity": legalEntityMap[appDoc.entityType],
                "address": {
                    "mailingAddress": appDoc.mailingAddress,
                    "mailingAddressLine2": appDoc.mailingAddress2 ? appDoc.mailingAddress2 : "",
                    "mailingCity": appDoc.mailingCity,
                    "mailingState": appDoc.mailingState,
                    "mailingZipcode": appDoc.mailingZipcode.slice(0,5),
                    "insuredPhoneNumber": "1" + contactPhone
                },
                "contact": {
                    "firstName": primaryContact.firstName,
                    "lastName": primaryContact.lastName,
                    "middleInitial": ""
                }
            },
            "businessInfo": {"locations": await this.getLocationList()},
            "basisOfQuotation": {
                eligibility: {},
                "yearBusinessEstablished": parseInt(this.app.business.founded.format("YYYY"),10),
                "totalAnnualWCPayroll": this.get_total_payroll()
            }
        };

        // if(this.get_years_in_business() < 4){
        //     quoteRequestData.basisOfQuotation.threeYearsManagementExperienceInd = appDoc.yearsOfExp >= 3;
        // }


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
                    log.error(`${logPrefix}The Submission to Travelers timed out` + __location);
                }
                else if(typeof error.response === 'string') {
                    response = JSON.parse(error.response);
                    log.error(`${logPrefix}The Submission to Travelers Error ${response}` + __location);
                }
                else {
                    log.error(`${logPrefix}The Submission to Travelers Error ${JSON.stringify(error.response)}` + __location);
                }

                const pricingResult = {
                    gotPricing: false,
                    outOfAppetite: false,
                    pricingError: true
                }
                return pricingResult;
            }
            catch (error2) {
                log.error(`${logPrefix}The Request to insurer had an error of ${error}` + __location);
                const pricingResult = {
                    gotPricing: false,
                    outOfAppetite: false,
                    pricingError: true
                }
                return pricingResult;
            }
        }

        // console.log("response", JSON.stringify(response, null, 4));

        // Check for internal errors where the request format is incorrect
        if (response.hasOwnProperty("statusCode") && response.statusCode === 400) {
            if(response.debugMessages && response.debugMessages[0] && response.debugMessages[0].code === 'INVALID_PRODUCER_INFORMATION'){
                log.error(`${logPrefix} Travelers returned a INVALID_PRODUCER_INFORMATION  AgencyId ${appDoc.agencyId}`)
                const pricingResult = {
                    gotPricing: false,
                    outOfAppetite: true,
                    pricingError: false
                }
                return pricingResult;
            }
            else {
                const pricingResult = {
                    gotPricing: false,
                    outOfAppetite: true,
                    pricingError: false
                }
                return pricingResult;
            }
        }

        // =========================================================================================================
        // Process the quote information response
        const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
        const respQuoteStatus = this.getChildProperty(response, "quoteStatus");
        if (!respQuoteStatus) {
            log.error(`${logPrefix}Could not locate the quote status in the response.` + __location)
            const pricingResult = {
                gotPricing: false,
                outOfAppetite: true,
                pricingError: false
            }
            return pricingResult;
        }
        // Extract all optional and required information
        const quoteStatusReasonList = this.getChildProperty(response, "quoteStatusReason") || [];
        const debugMessageList = this.getChildProperty(response, "debugMessages") || [];
        // const quoteId = this.getChildProperty(response, "eQuoteId");
        const premium = parseInt(this.getChildProperty(response, "totalAnnualPremiumSurchargeTaxAmount"), 10);
        //const validationDeepLink = this.getChildProperty(response, "validationDeeplink");
        //const employersLiabilityLimit = this.getChildProperty(response, "employersLiabilityLimit");


        // Generate a quote status reason message from quoteStatusReason and debugMessages
        let quoteStatusReasonMessage = '';
        for (const quoteStatusReason of quoteStatusReasonList) {
            quoteStatusReasonMessage += `${quoteStatusReasonMessage.length ? ", " : ""}${quoteStatusReason.description} (${quoteStatusReason.code})`;
        }
        for (const debugMessage of debugMessageList) {
            quoteStatusReasonMessage += `${quoteStatusReasonMessage.length ? ", " : ""}${debugMessage.description} (${debugMessage.code})`;
        }


        let pricingResult = {};
        let amount = 0;
        let apiResult = "";
        let piQuoteStatus = {};
        try{
            // Handle the status
            switch (respQuoteStatus) {
                case "DECLINE":
                    pricingResult = {
                        gotPricing: false,
                        outOfAppetite: true,
                        pricingError: false
                    }
                    apiResult = "piOutOfAppetite";
                    piQuoteStatus = quoteStatus.piOutOfAppetite;
                    this.reasons.push("Out of Appetite");
                    break;
                case "UNQUOTED":
                    if(premium){
                        amount = premium
                    }
                    //check of error/decline reason in response
                    const declineReasonCodes = ["UNSUPPORTED_STATE","UNABLE_TO_CLASSIFY"];
                    let declined = false;
                    for (const quoteStatusReason of quoteStatusReasonList) {
                        if(declineReasonCodes.indexOf(quoteStatusReason.code) > -1){
                            declined = true;
                        }
                    }
                    if(declined){
                        pricingResult = {
                            gotPricing: false,
                            outOfAppetite: true,
                            pricingError: false
                        }
                        apiResult = "piOutOfAppetite";
                        piQuoteStatus = quoteStatus.piOutOfAppetite;
                        this.reasons.push("quoteStatusReasonMessage");
                    }
                    else {
                        pricingResult = {
                            gotPricing: false,
                            outOfAppetite: false,
                            pricingError: true
                        }
                        apiResult = "pi_error";
                        piQuoteStatus = quoteStatus.piError;
                        this.reasons.push("quoteStatusReasonMessage");
                    }
                    break;
                case "AVAILABLE":
                    //pricingResult JSON
                    pricingResult = {
                        gotPricing: true,
                        price: premium,
                        outOfAppetite: false,
                        pricingError: false
                    }
                    amount = premium
                    piQuoteStatus = quoteStatus.priceIndication;
                    apiResult = "price_indication";

                    break;
                default:
                    pricingResult = {
                        gotPricing: false,
                        outOfAppetite: false,
                        pricingError: true
                    }
                    apiResult = "pi_error";
                    piQuoteStatus = quoteStatus.piError;
                    this.reasons.push(`UnKnown  quoteStatus ${respQuoteStatus} returned`);

                    break;
            }
        }
        catch(err){
            log.error(`${logPrefix} error quoteStatus processing ${respQuoteStatus} error ${err}` + __location);
        }
        //write quote record to db. if successful write a quote record.
        if(pricingResult.gotPricing || global.settings.ALWAYS_SAVE_PRICING_QUOTE === "YES"){
            await this.record_quote(amount, apiResult, piQuoteStatus)
        }
        //currently thinking PI error or out of market in AP Applications
        // will cause confusing and agents to stop working the application
        // SIU request - we silently fail PI request.
        // appDoc will have the pricingResult info.

        return pricingResult;


    }


    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.applicationDocData
        const logPrefix = `Appid: ${this.app.id} Travelers WC `


        const tomorrow = moment().add(1,'d').startOf('d');
        if(this.policy.effective_date < tomorrow){
            this.reasons.push("Insurer: Does not allow effective dates before tomorrow. - Stopped before submission to insurer");
            return this.return_result('autodeclined');
        }

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

        const applicationDocData = this.applicationDocData;

        // Default limits (supported by all states)
        let applicationLimits = "1000000/1000000/1000000";
        // Find best limits
        let carrierLimitOptions = defaultLimits;
        if (stateLimits.hasOwnProperty(this.app.business.locations[0].state_abbr)) {
            carrierLimitOptions = stateLimits[this.app.business.locations[0].state_abbr];
        }
        const carrierLimits = this.getBestLimits(carrierLimitOptions);
        if (carrierLimits) {
            applicationLimits = carrierLimits.join("/");
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
            'Limited Partnership': 'LP',
            "Limited Liability Company (Member Managed)": 'LL',
            "Limited Liability Company (Manager Managed)": 'LL',
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
        if(appDoc.industryCode){
            const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
            const industryCodeBO = new IndustryCodeBO();
            const industryCodeJson = await industryCodeBO.getById(appDoc.industryCode);
            if(industryCodeJson){
                sicCode = industryCodeJson.sic
            }
        }


        // There are currently 4 industry codes which do not have SIC codes. Don't stop quoting. Instead, we default
        // to "0000" to continue trying to quote since Travelers allows the agent to correct the application in the DeepLink.
        if (this.industry_code.sic) {
            sicCode = this.industry_code.sic.toString().padStart(4, '0');
        }
        else {
            this.log_warn(`Appid: ${this.app.id} Travelers WC: Industry Code ${this.industry_code.id} ("${this.industry_code.description}") does not have an associated SIC code`);
            sicCode = "0000";
        }

        // Ensure we have a valid SIC code -- see sic process below
        // if (!this.industry_code.sic) {
        //     return this.client_error(`Appid: ${this.app.id} Travelers WC: Could not determine the SIC code for industry code ${this.industry_code.id}: '${this.industry_code_description}'`, __location);
        // }

        // Ensure we have valid NCCI code mappings
        for (const location of this.app.business.locations) {
            for (const activityCode of location.activity_codes) {
                const ncciCode = await this.get_national_ncci_code_from_activity_code(location.territory, activityCode.id);
                if (!ncciCode) {
                    this.log_warn(`Missing NCCI class code mapping: activityCode=${activityCode.id} territory=${location.territory}`, __location);
                    return this.client_autodeclined(`Insurer activity class codes were not found for all activities in the application.`);
                }
                activityCode.ncciCode = ncciCode;
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
        const claimObjects = this.getClaims(applicationDocData.claims);

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
        }
        catch(err){
            log.error(`Appid: ${this.app.id} Travelers WC: Unable to get contact phone. error: ${err} ` + __location);
        }

        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {
            "requestId": this.quoteId,
            "sessionId": this.generate_uuid(),
            "policyEffectiveDate": this.policy.effective_date.format("YYYY-MM-DD"),
            "policyExpirationDate": this.policy.expiration_date.format("YYYY-MM-DD"),
            "lineOfBusinessCode": "WC",
            "SICCode": sicCode,
            "crossSellInd": false,
            "producer": {
                "producerCode": this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                "uploadVendorCode": travelersTalageUploadVendorCode
            },
            "customer": {
                // "externalCustomerId": "string",
                "primaryNameInsured": this.app.business.name,
                "tradeDBALine1": this.app.business.dba ? this.app.business.dba : "",
                "tradeDBALine2": "",
                "FEIN": appDoc.ein,
                "legalEntity": legalEntityMap[appDoc.entityType],
                "address": {
                    "mailingAddress": appDoc.mailingAddress,
                    "mailingAddressLine2": appDoc.mailingAddress2 ? appDoc.mailingAddress2 : "",
                    "mailingCity": appDoc.mailingCity,
                    "mailingState": appDoc.mailingState,
                    "mailingZipcode": appDoc.mailingZipcode.slice(0,5),
                    "insuredPhoneNumber": "1" + contactPhone
                },
                "contact": {
                    "firstName": primaryContact.firstName,
                    "lastName": primaryContact.lastName,
                    "middleInitial": ""
                },
                "insuredEmailAddress": primaryContact.email ? primaryContact.email : "",
                "insuredWebsiteUrl": this.app.business.website ? this.app.business.website : ""
            },
            "businessInfo": {"locations": await this.getLocationList()},
            "basisOfQuotation": {
                // "pricing": {
                //     "experienceMod": "string",
                //     "modStatus": "string",
                //     "riskId": "string",
                //     "experienceModEffectiveDate": "string"
                // },
                "eligibility": {"numberEmployeesPerShift": numberEmployeesPerShift},
                //     "hoursOfOperation": [
                //         "OP10PM  No later than 10 pm",
                //         "OP24HRS 24 Hours",
                //         "OP2AM No later than 2 am",
                //         "OPAFT2AM  Past 2 am",
                //         "OPMIDNT No later than Midnight"
                //     ],
                //     "deliveryProvidedInd": true,
                //     "aircraftInd": true,
                //     "towingServicesInd": true,
                "numberEmployeesPerShift": numberEmployeesPerShift,
                //     "vehicleWorkExLightMedTrucksInd": true,
                //     "ownedBusinessAutos": 0
                // },
                "yearBusinessEstablished": parseInt(this.app.business.founded.format("YYYY"),10),
                "claimCountCurrentPolicy": claimCountCurrentPolicy,
                "claimCountPriorThreePolicy": claimCountPriorThreePolicy,
                "totalAnnualWCPayroll": this.get_total_payroll(),
                "employersLiabilityLimit": applicationLimits
                // "threeYearsManagementExperienceInd": true,
                // "operateAsGeneralContractorInd": true
            }
        };

        if(this.get_years_in_business() < 4){
            quoteRequestData.basisOfQuotation.threeYearsManagementExperienceInd = appDoc.yearsOfExp >= 3;
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
                return this.client_error(`The Request to insurer had an error of ${error}`, __location, {error: error});
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
            log.error(`${logPrefix}Could not locate the quote status in the response.` + __location)
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
            const individualLimitList = employersLiabilityLimit?.split("/");
            if (individualLimitList?.length !== 3) {
                // Continue without the limits but log it
                log.error(`${logPrefix}Returned unrecognized limits of '${employersLiabilityLimit}'. Continuing.` + __location)
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
                //check of error/decline reason in response
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
                    this.log_error(`Could not locate validationDeepLink property in response.`, __location);
                }
                return this.client_quoted(quoteId, limits, premium);
            default:
                break;
        }

        // Unrecognized quote status
        log.error(`${logPrefix}Received an unknown quote status of '${quoteStatus}.` + __location);
        return this.client_error(`Received an unknown quote status of '${quoteStatus}`);
    }
};