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
        // HACK: for testing we are using the national NCCI codess until we get the class code map back
        this.requiresInsurerActivityCodes = true;
        // this.requiresInsurerActivityCodes = false;
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
        // The resulting map:
        // { "NV" : { "816000" : {payroll: 10000, fullTimeEmployees: 3, partTimeEmployees: 1}}}
        const amtrustClassCodeMap = {}
        for (const location of this.app.business.locations) {
            let firstAmTrustClassCode = null;
            for (const activityCode of location.activity_codes) {
                // HACK: commented out because we are testing with the national NCCI codes instead of the mapped insurer class codes
                const amtrustClassCode = this.insurer_wc_codes[location.state_abbr + activityCode.id];
                // const amtrustClassCode = await this.get_national_ncci_code_from_activity_code(location.state_abbr, activityCode.id) + "00";
                if (firstAmTrustClassCode === null) {
                    firstAmTrustClassCode = amtrustClassCode;
                }
                if (!amtrustClassCode) {
                    return this.client_error("Could not locate AmTrust class code for a required activity code", __location, {
                        state: location.state_abbr,
                        activityCode: activityCode.id
                    });
                }
                if (!amtrustClassCodeMap.hasOwnProperty(location.state_abbr)) {
                    amtrustClassCodeMap[location.state_abbr] = {};
                }
                if (!amtrustClassCodeMap[location.state_abbr].hasOwnProperty(amtrustClassCode)) {
                    amtrustClassCodeMap[location.state_abbr][amtrustClassCode] = {
                        payroll: 0,
                        fullTimeEmployees: 0,
                        partTimeEmployees: 0
                    };
                }
                amtrustClassCodeMap[location.state_abbr][amtrustClassCode].payroll += activityCode.payroll;
            }
            if (firstAmTrustClassCode) {
                amtrustClassCodeMap[location.state_abbr][firstAmTrustClassCode].fullTimeEmployees += location.full_time_employees;
                amtrustClassCodeMap[location.state_abbr][firstAmTrustClassCode].partTimeEmployees += location.part_time_employees;
            }
        }
        // Build the class code list to return
        const classCodeList = [];
        for (const state of Object.keys(amtrustClassCodeMap)) {
            for (const classCode of Object.keys(amtrustClassCodeMap[state])) {
                classCodeList.push({
                    "ClassCode": classCode.substring(0, classCode.length - 2),
                    "ClassCodeDescription": classCode.substring(classCode.length - 2, classCode.length),
                    "State": state,
                    "Payroll": amtrustClassCodeMap[state][classCode].payroll,
                    "FullTimeEmployees": amtrustClassCodeMap[state][classCode].fullTimeEmployees,
                    "PartTimeEmployees": amtrustClassCodeMap[state][classCode].partTimeEmployees
                });
            }
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
        let agentId = null;
        try {
            agentId = parseInt(this.app.agencyLocation.insurers[this.insurer.id].agent_id, 10);
        }
        catch (error) {
            return this.client_error(`Invalid agent ID of '${this.app.agencyLocation.insurers[this.insurer.id].agent_id}'`, __location, {error: error});
        }
        if (agentId === 0) {
            return this.client_error(`Invalid agent ID of '${this.app.agencyLocation.insurers[this.insurer.id].agent_id}'`, __location);
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
                "AgentContactId": agentId
            },
            "NatureOfBusiness": this.app.business.industry_code_description,
            "LegalEntity": amtrustLegalEntityMap[this.app.business.locations[0].business_entity_type],
            "YearsInBusiness": this.get_years_in_business(),
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
                return this.client_error("AmTrusts requires an unemployment number if located in MN, HI, RI, or ME.", __location);
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

        console.log("quoteRequestData", JSON.stringify(quoteRequestData, null, 4));

        // =========================================================================================================
        // Create the additional information request

        const additionalInformationRequestData = {"AdditionalInsureds": [{
            "Name": this.app.business.owners[0].fname + " " + this.app.business.owners[0].lname ,
            "TaxId": this.app.business.locations[0].identification_number,
            "State": this.app.business.locations[0].state_abbr,
            "LegalEntity": amtrustLegalEntityMap[this.app.business.locations[0].business_entity_type],
            "DbaName": this.app.business.dba,
            "AdditionalLocations": this.getAdditionalLocationList()
        }]};

        console.log("additionalInformationRequestData", JSON.stringify(additionalInformationRequestData, null, 4));

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
                            if (amtrustQuestionId.code === requestClassCode.State + requestClassCode.ClassCode) {
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
        console.log("questionRequestData", JSON.stringify(questionRequestData, null, 4));

        // =========================================================================================================
        // Send the requests

        // Send the quote request
        const quoteResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, '/api/v2/quotes', quoteRequestData);
        if (!quoteResponse) {
            return this.client_error(`The quote could not be submitted to the insurer.`);
        }
        let statusCode = this.getChildProperty(quoteResponse, "StatusCode");
        if (!statusCode || statusCode !== 201) {
            return this.client_error(`The quote could not be submitted to the insurer.`, __location, {statusCode: statusCode});
        }
        console.log("quoteResponse", JSON.stringify(quoteResponse, null, 4));

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

        // Send the question request
        const questionResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v1/quotes/${quoteId}/questions-answers`, questionRequestData);
        if (!questionResponse) {
            return this.client_error(`The quote questions for quote ${quoteId} could not be submitted to the insurer.`, __location);
        }
        statusCode = this.getChildProperty(questionResponse, "StatusCode");
        if (!statusCode || statusCode !== 200) {
            return this.client_error(`The quote questions for quote ${quoteId} could not be submitted to the insurer.`, __location, {statusCode: statusCode});
        }
        console.log("questionResponse", JSON.stringify(questionResponse, null, 4));

        // Send the additional information request
        const additionalInformationResponse = await this.amtrustCallAPI('POST', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}/additional-information`, additionalInformationRequestData);
        if (!additionalInformationResponse) {
            return this.client_error(`The additional information for quote ${quoteId} could not be submitted to the insurer.`, __location);
        }
        statusCode = this.getChildProperty(additionalInformationResponse, "StatusCode");
        if (!statusCode || statusCode !== 200) {
            return this.client_error(`The quote questions for quote ${quoteId} could not be submitted to the insurer.`, __location, {statusCode: statusCode});
        }
        console.log("additionalInformationResponse", JSON.stringify(additionalInformationResponse, null, 4));

        // Get the quote information
        const quoteInformationResponse = await this.amtrustCallAPI('GET', accessToken, credentials.mulesoftSubscriberId, `/api/v2/quotes/${quoteId}`);
        if (!quoteInformationResponse) {
            return this.client_error(`The quote information for quote ${quoteId} could not be retrieved from the insurer.`, __location);
        }
        console.log("quoteInformationResponse", JSON.stringify(quoteInformationResponse, null, 4));

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

        // Extract the premium
        const quotePremium = this.getChildProperty(quoteInformationResponse, "PremiumDetails.PriceIndication");

        // Return the quote
        quoteEligibility = this.getChildProperty(quoteInformationResponse, "Eligibility.Eligibility");
        if (!quoteEligibility) {
            return this.client_error(`The quote elibility could not be found for quote ${quoteId}.`);
        }
        switch (quoteEligibility) {
            case "BindEligible":
                return this.client_quoted(quoteId, quoteLimits, quotePremium);
            case "Refer":
                return this.client_referred(quoteId, quoteLimits, quotePremium);
            case "Decline":
                // There is no decline reason in their schema that I can see. The only declines I get are after the initial
                // quote submission, not after additionalInformation or questions are sent. If we get here and get a decline,
                // then I need to look at the response to see if they actually provide a decline reason. -SF
                this.log_error("Notify Scott to look at this application to possibly extract a decline reason.", __location);
                return this.client_declined("The insurer has declined to offer you coverage at this time");
            default:
                break;
        }

        // Unregnized quote statue
        return this.client_error(`Received an unknown eligibility type of '${quoteStatus}`);
    }
};