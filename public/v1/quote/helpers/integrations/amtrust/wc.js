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

let amtrustWCQuestionIds = null;

module.exports = class AcuityWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityCodes = true;
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
            if (!child.hasOwnProperty(childName)) {
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
                const insurerClassCode = this.insurer_wc_codes[location.state + activityPayroll.ncciCode];
                // const ncciCode = await this.get_national_ncci_code_from_activity_code(location.state, activityPayroll.ncciCode) + "00";
                // if (!ncciCode) {
                //     return this.client_error("Could not locate AmTrust class code for a required activity code", __location, {
                //         state: location.state_abbr,
                //         activityCode: activityPayroll.id
                //     });
                // }
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

    getOfficers() {
        const officersList = [];
        for (const owner of this.app.applicationDocData.owners) {
            officersList.push({
                "Name": `${owner.fname} ${owner.lname}`,
                "EndorsementId": "N/A",
                "Type": "Officers",
                "State": this.app.applicationDocData.mailingState,
                "OwnershipPercent": owner.ownership,
                "FormType": owner.include ? "I" : "E",
                "OfficerDateOfBirth": moment(owner.birthdate).format("MM/DD/YYYY")
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
                verb);
        }
        catch (error) {
            this.log_error(`Error sending quote: ${error}`, __location);
            return null;
        }
        return response;
    }

    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {

        // Load the API credentials
        let credentials = null;
        try {
            credentials = JSON.parse(this.password);
        }
        catch (error) {
            return this.client_error("Could not load AmTrust API credentials", __location);
        }

        // Authorize the client
        const accessToken = await amtrustClient.authorize(credentials.clientId, credentials.clientSecret, credentials.username, credentials.password, credentials.mulesoftSubscriberId, this.insurer.useSandbox);
        if (!accessToken) {
            return this.client_error("Authorization with AmTrust server failed", __location);
        }

        // =========================================================================================================
        // Validation

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

        // Ensure we can parse the agency ID since they expect it as a number
        let agencyId = null;
        try {
            agencyId = parseInt(this.app.agencyLocation.insurers[this.insurer.id].agency_id, 10);
        }
        catch (error) {
            return this.client_error(`Invalid agent ID of '${this.app.agencyLocation.insurers[this.insurer.id].agency_id}'`, __location, {error: error});
        }
        if (agencyId === 0) {
            return this.client_error(`Invalid agent ID of '${this.app.agencyLocation.insurers[this.insurer.id].agency_id}'`, __location);
        }

        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {"Quote": {
            "EffectiveDate": this.policy.effective_date.format("MM/DD/YYYY"),
            "Fein": this.app.business.locations[0].identification_number,
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
                "AgentContactId": agencyId
            },
            "NatureOfBusiness": this.industry_code.description,
            "LegalEntity": amtrustLegalEntityMap[this.app.business.locations[0].business_entity_type],
            "YearsInBusiness": this.get_years_in_business(),
            "IsNonProfit": false,
            "IsIncumbantAgent": false,
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

        // console.log("quoteRequestData", JSON.stringify(quoteRequestData, null, 4));

        // =========================================================================================================
        // Create the additional information request

        const additionalInformationRequestData = {
            "Officers": this.getOfficers(),
            "AdditionalInsureds": [{
                "Name": this.app.business.owners[0].fname + " " + this.app.business.owners[0].lname ,
                "TaxId": this.app.business.locations[0].identification_number,
                "State": this.app.business.locations[0].state_abbr,
                "LegalEntity": amtrustLegalEntityMap[this.app.business.locations[0].business_entity_type],
                "DbaName": this.app.business.dba,
                "AdditionalLocations": this.getAdditionalLocationList()
            }]
        };

        // console.log("additionalInformationRequestData", JSON.stringify(additionalInformationRequestData, null, 4));

        // =========================================================================================================
        // Create the questions request

        // Load question IDs
        if (amtrustWCQuestionIds === null) {
            amtrustWCQuestionIds = require('./amtrust-wc-question-id-map.js');
        }
        const questionRequestData = [];
        for (const questionId in this.questions) {
            if (this.questions.hasOwnProperty(questionId)) {
                const question = this.questions[questionId];
                // Get the answer
                let answer = null;
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    return this.client_error('Could not determine the answer for one of the questions', __location, {questionId: questionId});
                }

                // This question was not answered
                if (!answer) {
                    continue;
                }

                if (!this.question_identifiers.hasOwnProperty(questionId)) {
                    // return this.('Could not determine the insurer question ID for one of the questions', __location, {questionId: questionId});
                }
                const insurerQuestionId = this.question_identifiers[questionId];
                for (const requestClassCode of quoteRequestData.Quote.ClassCodes) {
                    if (amtrustWCQuestionIds.hasOwnProperty(insurerQuestionId)) {
                        const amtrustQuestionIdCodeList = amtrustWCQuestionIds[insurerQuestionId];
                        for (const amtrustQuestionId of amtrustQuestionIdCodeList) {
                            const existingQuestionRequestData = questionRequestData.find((qrd) => qrd.QuestionId === amtrustQuestionId.questionId);
                            if (amtrustQuestionId.code === requestClassCode.State + requestClassCode.ClassCode && !existingQuestionRequestData) {
                                questionRequestData.push({
                                    QuestionId: amtrustQuestionId.questionId,
                                    AnswerValue: answer
                                });
                            }
                        }
                    }
                }
            }
        }
        // console.log("questionRequestData", JSON.stringify(questionRequestData, null, 4));

        // =========================================================================================================
        // Send the requests
        const successfulStatusCodes = [200, 201];

        // Send the quote request
        const quoteResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, '/api/v2/quotes', quoteRequestData);
        if (!quoteResponse) {
            return this.client_error(`The quote could not be submitted to the insurer.`);
        }
        let statusCode = this.getChildProperty(quoteResponse, "StatusCode");
        if (!statusCode || !successfulStatusCodes.includes(statusCode)) {
            return this.client_error(`The quote could not be submitted to the insurer.`, __location, {statusCode: statusCode});
        }
        // console.log("quoteResponse", JSON.stringify(quoteResponse, null, 4));

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

        // Get the ***
        // const endorsementsAvailable = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/endorsements/available`, questionRequestData);
        // console.log("endorsementsAvailable", endorsementsAvailable);
        // return null;

        // Send the additional information request
        const additionalInformationResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}/additional-information`, additionalInformationRequestData);
        if (!additionalInformationResponse) {
            return this.client_error(`The additional information for quote ${quoteId} could not be submitted to the insurer.`, __location);
        }
        statusCode = this.getChildProperty(additionalInformationResponse, "StatusCode");
        if (!statusCode || !successfulStatusCodes.includes(statusCode)) {
            return this.client_error(`The quote questions for quote ${quoteId} could not be submitted to the insurer.`, __location, {statusCode: statusCode});
        }
        // console.log("additionalInformationResponse", JSON.stringify(additionalInformationResponse, null, 4));

        // Get the required questions list to ensure we are submitting the correct questions
        // const requiredQuestionsResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/questions`, questionRequestData);
        // console.log("requiredQuestionsResponse", requiredQuestionsResponse);

        // Send the question request
        if (questionRequestData.length > 0) {
            const questionResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/questions-answers`, questionRequestData);
            if (!questionResponse) {
                return this.client_error(`The quote questions for quote ${quoteId} could not be submitted to the insurer.`, __location);
            }
            statusCode = this.getChildProperty(questionResponse, "StatusCode");
            if (!statusCode || !successfulStatusCodes.includes(statusCode)) {
                // return this.client_error(`The quote questions for quote ${quoteId} could not be submitted to the insurer.`, __location, {statusCode: statusCode});
                this.log_warn(`The quote questions for quote ${quoteId} could not be submitted to the insurer.`, __location);
            }
            // console.log("questionResponse", JSON.stringify(questionResponse, null, 4));
        }

        // Get the quote information
        const quoteInformationResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}`);
        if (!quoteInformationResponse) {
            return this.client_error(`The quote information for quote ${quoteId} could not be retrieved from the insurer.`, __location);
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
        switch (quoteEligibility) {
            case "BindEligible":
                if (quoteLink) {
                    this.quoteLink = quoteLink;
                }
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
};