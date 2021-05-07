/* eslint-disable guard-for-in */
/**
 * Worker's Compensation for Acuity
 *
 * This integration file has answers to the following questions hard-coded in:
 * - Any bankruptcies, tax, or credit liens in the past 5 years? (NO) - Derived from our disqualification question
 * - Insured handles, treats, stores or transports hazardous material? (NO) - Derived from our disqualification question
 * - Up to how many stories does the insured work? (1) - Derived from our disqualification question
 * - Any employees work underground? (NO) - Derived from our disqualification question
 * - Gaming devices on premises? (NO) - Per Adam
 * - Insurer operates any business not insured by Acuity? (NO) - Per Adam
 */

'use strict';

const moment = require('moment');

const Integration = require('../Integration.js');
const amtrustClient = require('./amtrust-client.js');
global.requireShared('./helpers/tracker.js');

const amtrustTestHost = "utgateway.amtrustgroup.com";
const amtrustTestBasePath = "/DigitalAPI_Usertest";

const amtrustProductionHost = "gateway.amtrustgroup.com";
const amtrustProductionBasePath = "/DigitalAPI";

module.exports = class AcuityWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    /**
     * Formats a phone number as an AmTrust expected phone number
     * @param  {number} phoneNumber - The phone number
     * @returns {string} Formatted phone number of XXX-XXX-XXXX
     */
    formatPhoneNumber(phoneNumber) {
        const phoneNumberString = phoneNumber.toString();
        return `${phoneNumberString.substring(0, 3)}-${phoneNumberString.substring(3, 6)}-${phoneNumberString.substring(6, 10)}`;
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
            if (!child || !child.hasOwnProperty(childName)) {
                return null;
            }
            child = child[childName];
        }
        return child;
    }

    /**
     * Gets an array of class codes to payroll/employee counts for use in an AmTrust quote
     * @param  {object} classCodeMap - Map of state -> amtrust code : payroll, employee counts
     * @returns {object} Formatted class code list
     */
    async getClassCodeList() {
        // First we need to group the AmTrust class codes by state and class code.
        const amtrustClassCodeList = [];
        for (const location of this.app.applicationDocData.locations) {
            for (const activityPayroll of location.activityPayrollList) {
                // Commented out because we are testing with the national NCCI codes instead of the mapped insurer class codes
                if(!activityPayroll.activityCodeId){
                    activityPayroll.activityCodeId = activityPayroll.ncciCode;
                }
                const insurerClassCode = this.insurer_wc_codes[location.state + activityPayroll.activityCodeId];
                if (insurerClassCode) {
                    let amtrustClassCode = amtrustClassCodeList.find((acc) => acc.ncciCode === insurerClassCode && acc.state === location.state);
                    if (!amtrustClassCode) {
                        amtrustClassCode = {
                            ncciCode: insurerClassCode,
                            state: location.state,
                            payroll: 0,
                            fullTimeEmployees: 0,
                            partTimeEmployees: 0
                        };
                        amtrustClassCodeList.push(amtrustClassCode);
                    }
                    for (const employeeType of activityPayroll.employeeTypeList) {
                        amtrustClassCode.payroll += employeeType.employeeTypePayroll;
                        switch (employeeType.employeeType) {
                            case "Full Time":
                                amtrustClassCode.fullTimeEmployees += employeeType.employeeTypeCount;
                                break;
                            case "Part Time":
                                amtrustClassCode.partTimeEmployees += employeeType.employeeTypeCount;
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
        }

        // Build the class code list to return
        const classCodeList = [];
        for (const amtrustClassCode of amtrustClassCodeList) {
            classCodeList.push({
                "ClassCode": amtrustClassCode.ncciCode.substring(0, amtrustClassCode.ncciCode.length - 2),
                "ClassCodeDescription": amtrustClassCode.ncciCode.substring(amtrustClassCode.ncciCode.length - 2, amtrustClassCode.ncciCode.length),
                "State": amtrustClassCode.state,
                "Payroll": amtrustClassCode.payroll,
                "FullTimeEmployees": amtrustClassCode.fullTimeEmployees,
                "PartTimeEmployees": amtrustClassCode.partTimeEmployees
            });
        }

        return classCodeList;
    }

    /**
     * Gets a list of additional locations
     * @returns {object} Array of additional locations
     */
    getAdditionalLocationList() {
        const additionalLocationList = [];
        for (let i = 0; i < this.app.business.locations.length; i++) {
            const location = this.app.business.locations[i];
            additionalLocationList.push({
                "Address1": location.address,
                "Address2": location.address2 ? location.address2 : "",
                "City": location.city,
                "State": location.state_abbr,
                "Zip": location.zip,
                "TotalEmployeeNumber": location.full_time_employees + location.part_time_employees
            });
        }
        return additionalLocationList;
    }

    getOfficers(officerInformationList) {
        const officersList = [];
        for (const owner of this.app.applicationDocData.owners) {
            const state = this.app.applicationDocData.mailingState;
            let officerType = null;
            let endorsementId = null;
            let formType = null;
            for (const officerInformation of officerInformationList) {
                if (officerInformation.State === state) {
                    officerType = officerInformation.OfficerType;
                    const endorsementList = this.getChildProperty(officerInformation, "EndorsementInformation.Endorsements");
                    if (endorsementList) {
                        for (const endorsement of endorsementList) {
                            if (owner.ownership >= endorsement.MinOwnershipPercentage && owner.ownership <= endorsement.MaxOwnershipPercentage) {
                                formType = endorsement.FormType;
                                endorsementId = endorsement.Id;
                                break;
                            }
                        }
                    }
                }
            }
            if (!officerType || !endorsementId || !formType) {
                return null;
            }
            officersList.push({
                "Name": `${owner.fname} ${owner.lname}`,
                "EndorsementId": endorsementId,
                "Type": officerType,
                "State": state,
                "OwnershipPercent": owner.ownership,
                "FormType": formType,
                "OfficerDateOfBirth": moment(owner.birthdate).format("MM/DD/YYYY"),
                "OfficeHeld": owner.officerTitle
            });
        }
        return officersList;
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
            this.log_error(`Error sending quote: ${error}`, __location);
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

    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {

        const appDoc = this.app.applicationDocData

        // These are the limits supported AMTrust
        const carrierLimits = ['100000/500000/100000',
            '500000/500000/500000',
            '1000000/1000000/1000000'];

        const mapCarrierLimits = {
            '100000/500000/100000': '100/500/100',
            '500000/500000/500000': '500/500/500',
            '1000000/1000000/1000000': '1000/1000/1000',
            '1500000/1500000/1500000': '1500/1500/1500',
            '2000000/2000000/2000000': '2000/2000/2000'
        }

        let amTrustLimits = mapCarrierLimits[this.app.policies[0].limits];
        const limits = this.getBestLimits(carrierLimits);
        if (limits) {
            const amtrustBestLimits = limits.join("/");
            const amtrustLimitsSubmission = mapCarrierLimits[amtrustBestLimits];
            if(amtrustLimitsSubmission){
                amTrustLimits = amtrustLimitsSubmission;
            }
            else {
                amTrustLimits = '100/500/100';
            }
        }
        else {
            log.warn(`Appid: ${this.app.id} AmTrust WC autodeclined: no limits  ${this.insurer.name} does not support the requested liability limits ` + __location);
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // Load the API credentials
        let credentials = null;
        try {
            credentials = JSON.parse(this.password);
        }
        catch (error) {
            return this.client_error("Could not load AmTrust API credentials", __location);
        }
        let agentId = this.app.agencyLocation.insurers[this.insurer.id].agencyId.trim();
        const agentUserNamePassword = this.app.agencyLocation.insurers[this.insurer.id].agentId.trim();

        // Ensure the agent ID is a number (required for the API request)
        try {
            agentId = parseInt(agentId, 10);
        }
        catch (error) {
            return this.client_error(`Invalid AmTrust agent ID '${agentId}'`, __location, {error: error});
        }
        if (agentId === 0) {
            return this.client_error(`Invalid AmTrust agent ID '${agentId}'`, __location);
        }

        // Split the comma-delimited username,password field.
        const commaIndex = agentUserNamePassword.indexOf(',');
        if (commaIndex <= 0) {
            return this.client_error(`AmTrust username and password are not comma-delimited. commaIndex ${commaIndex} `, __location);
        }
        const agentUsername = agentUserNamePassword.substring(0, commaIndex).trim();
        const agentPassword = agentUserNamePassword.substring(commaIndex + 1).trim();

        // Authorize the client
        const accessToken = await amtrustClient.authorize(credentials.clientId, credentials.clientSecret, agentUsername, agentPassword, credentials.mulesoftSubscriberId, this.insurer.useSandbox);
        if (!accessToken) {
            return this.client_error("Authorization with AmTrust server failed", __location);
        }

        // =========================================================================================================
        // Validation

        // Per AmTrust e-mail from 2/4/2021, Partnerships in CA require at least 2 partners/owners
        if (this.app.business.locations[0].business_entity_type === "Partnership" &&
            this.app.business.locations[0].state_abbr === "CA" &&
            this.app.business.owners.length < 2) {
            return this.client_declined("AmTrust requires partnerships in CA to have at least 2 partners.");
        }

        // Ensure we have a supported legal entity.
        // The map values were pulled from https://anypoint.mulesoft.com/exchange/portals/amtrust-financial-service-9/acf997e3-018a-45c2-bbfa-52d79acf6edb/digitalapi/minor/1.0/console/method/%235970/
        const amtrustLegalEntityMap = {
            'Association': 4,
            'Corporation': 3,
            'Limited Liability Company': 12,
            'Limited Partnership': 7,
            'Partnership': 2,
            'Sole Proprietorship': 1
            // 'Other': null <- Not supported
        };
        if (!amtrustLegalEntityMap.hasOwnProperty(this.app.business.locations[0].business_entity_type)) {
            return this.client_error(`The business entity type '${this.app.business.locations[0].business_entity_type}' is not supported by this insurer.`, __location);
        }

        // Format the FEIN
        const fein = appDoc.ein.replace(/\D/g, '');

        // Check the status of the FEIN.
        const einCheckResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, '/api/v2/fein/validation', {fein: fein});
        if (einCheckResponse) {
            // Don't stop quoting if the EIN check fails.
            const feinErrors = this.getChildProperty(einCheckResponse, "Errors.Fein");
            if (feinErrors && feinErrors.includes("This FEIN is not available for this product.")) {
                return this.client_declined("The EIN is blocked");
            }
        }

        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {"Quote": {
            "EffectiveDate": this.policy.effective_date.format("MM/DD/YYYY"),
            "Fein": fein,
            "PrimaryAddress": {
                "Line1": this.app.business.locations[0].address + (this.app.business.locations[0].address2 ? ", " + this.app.business.locations[0].address2 : ""),
                "City": this.app.business.locations[0].city,
                "State": this.app.business.locations[0].state_abbr,
                "Zip": this.app.business.locations[0].zip
            },
            "MailingAddress": {
                "Line1": this.app.business.mailing_address + (this.app.business.mailing_address2 ? ", " + this.app.business.mailing_address2 : ""),
                "City": this.app.business.mailing_city,
                "State": this.app.business.mailing_state_abbr,
                "Zip": this.app.business.mailing_zipcode
            },
            "BusinessName": this.app.business.name,
            "ContactInformation": {
                "FirstName": this.app.business.contacts[0].first_name,
                "LastName": this.app.business.contacts[0].last_name,
                "Email": this.app.business.contacts[0].email,
                "Phone": this.formatPhoneNumber(this.app.business.contacts[0].phone),
                "AgentContactId": agentId
            },
            "NatureOfBusiness": this.industry_code.description,
            "LegalEntity": amtrustLegalEntityMap[this.app.business.locations[0].business_entity_type],
            "YearsInBusiness": this.get_years_in_business(),
            "IsNonProfit": false,
            "IsIncumbentAgent": false,
            //"IsIncumbantAgent": false,
            // "ExpiredPremium": 10000,
            "CompanyWebsiteAddress": this.app.business.website,
            "ClassCodes": await this.getClassCodeList()
        }};

        // Add the unemployment number if required
        const requiredUnemploymentNumberStates = ["MN",
            "HI",
            "RI",
            "ME"];
        if (requiredUnemploymentNumberStates.includes(this.app.business.locations[0].state_abbr)) {
            if (this.app.business.locations[0].unemployment_number === 0) {
                return this.client_error("AmTrust requires an unemployment number if located in MN, HI, RI, or ME.", __location);
            }
            quoteRequestData.Quote.UnemploymentId = this.app.business.locations[0].unemployment_number.toString();
        }

        // Add the rating zip if any location is in California
        let ratingZip = null;
        let ratingZipPayroll = 0;
        for (const location of this.app.business.locations) {
            if (location.state_abbr === "CA") {
                let locationPayroll = 0;
                for (const activityCode of location.activity_codes) {
                    locationPayroll += activityCode.payroll;
                }
                if (locationPayroll > ratingZipPayroll) {
                    ratingZip = location.zipcode;
                    ratingZipPayroll = locationPayroll;
                }
            }
        }
        if (ratingZip) {
            quoteRequestData.Quote.RatingZip = ratingZip;
        }

        // =========================================================================================================
        // Create the additional information request
        let additionalInformationRequestData = {};
        if(this.app.business && this.app.business.owners[0] && this.app.business.locations[0]){
            additionalInformationRequestData = {"AdditionalInsureds": [{
                "Name": this.app.business.owners[0].fname + " " + this.app.business.owners[0].lname ,
                "TaxId": fein,
                "State": this.app.business.locations[0].state_abbr,
                "LegalEntity": amtrustLegalEntityMap[this.app.business.locations[0].business_entity_type],
                "DbaName": this.app.business.dba,
                "AdditionalLocations": this.getAdditionalLocationList()
            }]};

        }
        // console.log("questionRequestData", JSON.stringify(questionRequestData, null, 4));

        // =========================================================================================================
        // Send the requests
        const successfulStatusCodes = [200, 201];

        // Send the quote request
        const quoteResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, '/api/v2/quotes', quoteRequestData);
        if (!quoteResponse) {
            return this.client_error("The insurer's server returned an unspecified error when submitting the quote information.", __location);
        }
        // console.log("quoteResponse", JSON.stringify(quoteResponse, null, 4));
        let statusCode = this.getChildProperty(quoteResponse, "StatusCode");
        if (!statusCode || !successfulStatusCodes.includes(statusCode)) {
            if (quoteResponse.error) {
                return this.client_error(quoteResponse.error, __location, {statusCode: statusCode})
            }
            else {
                return this.client_error("The insurer's server returned an unspecified error when submitting the quote information.", __location, {statusCode: statusCode});
            }
        }

        // Check if the quote has been declined. If declined, subsequent requests will fail.
        let quoteEligibility = this.getChildProperty(quoteResponse, "Data.Eligibility.Eligibility");
        if (quoteEligibility === "Decline") {
            // A decline at this stage is based on the class codes; they are out of appetite.
            return this.client_autodeclined_out_of_appetite();
        }

        // Extract the quote ID
        const quoteId = this.getChildProperty(quoteResponse, "Data.AccountInformation.QuoteId");
        if (!quoteId) {
            return this.client_error(`Could not find the quote ID in the response.`, __location);
        }

        // ************ SEND LIMITS - Must use the quoteReponse.data to send limits.
        //   Anything not in the update PUT will be deleted.  per AMtrust docs
        //
        // ***************************************************************
        //
        //

        //Get available limites

        const quoteAvailableLlimitesResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/available-liability-limits`);
        if (!quoteAvailableLlimitesResponse) {
            return this.client_error("The insurer's server returned an unspecified error when get the quote available limits information.", __location);
        }
        const availableLimitsArray = quoteAvailableLlimitesResponse.Data;
        if(availableLimitsArray && availableLimitsArray.length > 0){
            if(availableLimitsArray.indexOf(amTrustLimits) === -1){
                //not in array.  select last postion is array. assuming it it the biggest
                amTrustLimits = availableLimitsArray[availableLimitsArray.length - 1]
            }
        }

        //LiabilityLimits
        // eslint-disable-next-line prefer-const
        let amTrustApplicationJSON = quoteResponse.Data;
        amTrustApplicationJSON.LiabilityLimits = amTrustLimits;

        const quoteUpdateResponse = await this.amtrustCallAPI('PUT', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}`, amTrustApplicationJSON);
        if (!quoteUpdateResponse) {
            return this.client_error("The insurer's server returned an unspecified error when submitting the quote update information.", __location);
        }

        // ==============================================================================================================

        // Get the required questions list to ensure we are submitting the correct questions and to resolve question IDs
        const requiredQuestionList = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/questions`);
        // If this fails, we can still quote (referred)
        if (requiredQuestionList) {
            // =========================================================================================================
            // Create the questions request
            const questionRequestData = [];
            for (const questionId in this.questions) {
                const question = this.questions[questionId];
                // Get the answer
                let answer = null;
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    log.error(`AMtrust WC (application ${this.app.id}): Could not determine question ${question_id} answer: ${error} ${__location}`);
                    //return this.client_error('Could not determine the answer for one of the questions', __location, {questionId: questionId});
                }
                // This question was not answered
                if (!answer) {
                    continue;
                }
                for (const requiredQuestion of requiredQuestionList.Data) {
                    if (requiredQuestion.Question.trim() === question.text) {
                        questionRequestData.push({
                            QuestionId: requiredQuestion.Id,
                            AnswerValue: answer
                        });
                    }
                }
            }
            // Send the question request
            if (questionRequestData.length > 0) {
                // console.log("questionRequest", questionRequestData);
                await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/questions-answers`, questionRequestData);
                // We can still quote if this fails. Continue...
                // console.log("questionResponse", JSON.stringify(questionResponse, null, 4));
            }
        }

        // Get the available officer information
        const officerInformation = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/officer-information`);
        // console.log("officerInformation", JSON.stringify(officerInformation, null, 4));
        if (officerInformation && officerInformation.Data) {
            // Populate the officers
            const officers = this.getOfficers(officerInformation.Data)
            if (officers) {
                additionalInformationRequestData.Officers = officers;
            }
        }
        // console.log("additionalInformationRequestData", JSON.stringify(additionalInformationRequestData, null, 4));

        // Send the additional information request
        const additionalInformationResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}/additional-information`, additionalInformationRequestData);
        if (!additionalInformationResponse) {
            return this.client_error("The insurer's server returned an unspecified error when submitting the additional quote information.", __location);
        }
        // console.log("additionalInformationResponse", JSON.stringify(additionalInformationResponse, null, 4));
        statusCode = this.getChildProperty(additionalInformationResponse, "StatusCode");
        if (!statusCode || !successfulStatusCodes.includes(statusCode)) {
            if (additionalInformationResponse.Message) {
                return this.client_error(additionalInformationResponse.Message, __location, {statusCode: statusCode});
            }
            else if (quoteResponse.error) {
                return this.client_error(quoteResponse.error, __location, {statusCode: statusCode})
            }
            else {
                return this.client_error("The insurer's server returned an unspecified error when submitting the additional quote information.", __location, {statusCode: statusCode});
            }
        }

        // Get the quote information
        const quoteInformationResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}?loadQuestions=true`);
        if (!quoteInformationResponse) {
            return this.client_error("The insurer's server returned an unspecified error when retrieving the final quote information.", __location, {statusCode: statusCode});
        }
        // console.log("quoteInformationResponse", JSON.stringify(quoteInformationResponse, null, 4));

        // =========================================================================================================
        // Process the quote information response

        // Extract the limits
        const quoteLimits = {};
        const quoteLimitPerAccident = this.getChildProperty(quoteInformationResponse, "PremiumDetails.LimitPerAccident");
        if (quoteLimitPerAccident) {
            quoteLimits[1] = quoteLimitPerAccident;
        }
        const quoteLimitDiseaseEachEmployee = this.getChildProperty(quoteInformationResponse, "PremiumDetails.BodilyInjuryFromDiseasePerEmployeeLimit");
        if (quoteLimitDiseaseEachEmployee) {
            quoteLimits[2] = quoteLimitDiseaseEachEmployee;
        }
        const quoteLimitDiseasePolicyLimit = this.getChildProperty(quoteInformationResponse, "PremiumDetails.BodilyInjuryFromDiseasePolicyLimit");
        if (quoteLimitDiseasePolicyLimit) {
            quoteLimits[3] = quoteLimitDiseasePolicyLimit;
        }

        // Extract other information
        const quotePremium = this.getChildProperty(quoteInformationResponse, "PremiumDetails.PriceIndication");
        const quoteLink = this.getChildProperty(quoteInformationResponse, "AccountInformation.AccountUrl");

        // Return the quote
        quoteEligibility = this.getChildProperty(quoteInformationResponse, "Eligibility.Eligibility");
        if (!quoteEligibility) {
            return this.client_error(`The quote elibility could not be found for quote ${quoteId}.`);
        }
        // need to check if Refer has paymentPlans.
        if(quoteEligibility === 'BindEligible'){
            try{
                const quoteAvailablePaymentPlansResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}/paymentPlans`);
                if(quoteAvailablePaymentPlansResponse && quoteAvailablePaymentPlansResponse.Data){
                    // eslint-disable-next-line prefer-const
                    let paymentPlanList = quoteAvailablePaymentPlansResponse.Data
                    // eslint-disable-next-line prefer-const
                    let directPlans = paymentPlanList.Direct;
                    if(directPlans){
                        for (let i = 0; i < directPlans.length; i++) {
                            // eslint-disable-next-line prefer-const
                            let paymentPlan = directPlans[i];
                            paymentPlan.paymentPlanId = paymentPlan.PaymentPlanId;
                            paymentPlan.paymentPlanDescription = paymentPlan.PaymentPlanDescription;
                        }
                    }
                    this.insurerPaymentPlans = directPlans;
                }
                else {
                    log.error(`Appid: ${this.app.id} AmTrust WC did not get payment plans QuoteId: ${quoteId} ` + __location);
                }
            }
            catch(err){
                log.error(`Appid: ${this.app.id} AmTrust WC error getting payment plans ${err}` + __location);
            }
        }


        switch (quoteEligibility) {
            case "BindEligible":
                this.isBindable = true
                if (quoteLink) {
                    this.quoteLink = quoteLink;
                }
                //Get Quote PDF.
                //getQuoteLetter
                await this.getQuoteLetter(quoteId,accessToken, credentials)

                return this.client_quoted(quoteId, quoteLimits, quotePremium);
            case "Refer":
                if (quoteLink) {
                    this.quoteLink = quoteLink;
                }
                return this.client_referred(quoteId, quoteLimits, quotePremium);
            case "Decline":
                // There is no decline reason in their response
                return this.client_declined("The insurer has declined to offer you coverage at this time");
            default:
                break;
        }

        // Unregnized quote statue
        return this.client_error(`AmTrust returned an unknown eligibility type of '${quoteEligibility}`);
    }

    async getQuoteLetter(quoteId,accessToken, credentials){
        //this.quote_letter.data;
        try{
            const quoteDocBytes = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v1/print/${quoteId}`);
            if (quoteDocBytes) {
                this.quote_letter.data = quoteDocBytes;
            }
        }
        catch(err){
            log.error(`Appid: ${this.app.id} AMTrust WC: Error getting quote doc ${err} ` + __location)
        }
        return;

    }
};

