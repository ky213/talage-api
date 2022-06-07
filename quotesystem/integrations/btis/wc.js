/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * BTIS Workers' Comp Integration
 */

'use strict';

const Integration = require('../Integration.js');
const moment = require('moment');
const axios = require('axios');
const htmlentities = require('html-entities').Html5Entities;
const {convertToDollarFormat} = global.requireShared("./helpers/stringFunctions.js");


// this is for question "Any prior coverage declined/cancelled/non-renewed/expired (last 3 yrs.)? (Not applicable for Missouri risks)"
// this is a checkbox question, so multiple answers can be selected
// eslint-disable-next-line no-unused-vars
const priorCoverageMap = {
    "Non-Payment": "nonPayment",
    "Loss History": "lossHistory",
    "Agent Lost contract with prior carrier": "agentLostContract",
    "Prior Carrier no longer writes class": "priorCarrierClass",
    "Other": "other"
};

// This is a list of all entity types BITS supports. Unfortunately, they don't have an "other" option, and don't support all of our entity types
// NOTE: The map property is a many to one mapping of our entity types to their entity type
const entityTypes = [
    {
        key: 8,
        value: "Association",
        map: ["Association"]
    },
    {
        key: 11,
        value: "Common Ownership",
        map: []
    },
    {
        key: 2,
        value: "Corporation",
        map: ["Corporation", "Non Profit Corporation"]
    },
    {
        key: 14,
        value: "Government Entity",
        map: []
    },
    {
        key: 7,
        value: "Individual",
        map: []
    },
    {
        key: 12,
        value: "Joint Employers",
        map: []
    },
    {
        key: 4,
        value: "Joint Venture",
        map: []
    },
    {
        key: 9,
        value: "Labor Union",
        map: []
    },
    {
        "key": 5,
        "value": "Limited Liability Company",
        map: ["Limited Liability Company"]
    },
    {
        "key": 6,
        "value": "Limited Liability Partnership",
        map: []
    },
    {
        "key": 3,
        "value": "Limited Partnership",
        map: ["Limited Partnership"]
    },
    {
        "key": 1,
        "value": "Partnership",
        map: ["Partnership"]
    },
    {
        "key": 10,
        "value": "Religious Organization",
        map: []
    },
    {
        "key": 13,
        "value": "Trust or Estate",
        map: []
    }
];

// const skippedQuestionIds = [
//     "parent_18"
// ];

const AUTH_URL = '/v1/authentication/connect/token';
const LIMITS_URL = '/WC/v1/gateway/lookup/limits?stateName=STATE_NAME';
const QUOTE_URL = '/Common/v1/crosssell/WC/Quote ';

// Uses Acuity WC as a proxy to utilize existing NCCI activity codes
module.exports = class BtisWC extends Integration {

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
     * Requests a quote from BTIS and returns. This request is not intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {
        const appDoc = this.applicationDocData
        const logPrefix = `Appid: ${this.app.id} BTIS WC: `
        let errorMessage = '';
        let host = '';

        // Ensure we have valid NCCI code mappings
        for (const location of appDoc.locations) {
            for (const activityCode of location.activityPayrollList) {
                const ncciCode = await this.get_national_ncci_code_from_activity_code(location.state, activityCode.activityCodeId);
                if (!ncciCode) {
                    errorMessage = `Error: Missing NCCI class code mapping: activityCode=${activityCode.activityCodeId}, territory=${location.state}. `;
                    log.error(`${logPrefix}${errorMessage}`, __location);
                    return this.client_autodeclined(errorMessage);
                }
                activityCode.ncciCode = ncciCode;
            }
        }

        // Determine which URL to use
        if (this.insurer.useSandbox) {
            host = 'https://api-azure-staging.btisinc.com';
        }
        else {
            host = 'https://api-azure.btisinc.com  ';
        }

        const WCPolicy = appDoc.policies.find(policy => policy.policyType === "WC");
        if (!WCPolicy) {
            errorMessage = `Unable to find a WC policy for the submission. `;
            log.error(`${logPrefix}${errorMessage}` + __location);
            this.reasons.push(errorMessage);
            return this.client_error(errorMessage, __location);
        }

        const authBody = {
            grant_type: "client_credentials",
            client_secret: this.password,
            client_id: this.username
        };

        const authHeaders = {headers: {'Content-Type': 'application/json'}};

        let token_response = null;
        try {
            // Send request
            this.logRequest('application/json', host + AUTH_URL, 'POST', authBody);
            token_response = await axios.post(host + AUTH_URL, JSON.stringify(authBody), authHeaders);
        }
        catch (e) {
            this.logResponse('Authentication', e);
            errorMessage = `${e} ${e.response ? e.response : ""}`
            this.reasons.push(`Error retrieving auth token from BTIS: ${e}. ${errorMessage}`);
            return this.client_error(`${logPrefix}Failed to retrieve auth token from BTIS: ${e.message}. ` + __location);
        }

        this.logResponse('Authentication', token_response?.data);

        // Check the response is what we're expecting
        if (!token_response?.data?.success || !token_response?.data?.token) {
            this.reasons.push('BTIS auth returned an unexpected response or error.');
            if(token_response.data.message && token_response.data.message.length > 0){
                errorMessage = token_response.data.message;
            }
            this.reasons.push(`BTIS auth returned an unexpected response or error - unable to authenticate.`);
            return this.client_error(`${logPrefix}BTIS auth returned an unexpected response or error. ${errorMessage}. ` + __location);
        }

        // format the token the way BTIS expects it
        const token = {headers: {
            'Content-Type': 'application/json',
            'x-access-token': token_response.data.token
        }};

        // Prep limits URL arguments
        const limitsURL = LIMITS_URL.replace('STATE_NAME', this.app.business.primary_territory);

        let carrierLimitsList = null;
        let btisLimit = null
        let limitErrorOccurred = false;
        try {
            // Send request
            this.logRequest('x-access-token', host + limitsURL, 'GET');
            carrierLimitsList = await axios.get(host + limitsURL, token);
        }
        catch (e) {
            // Passing limit id is not required, default to null if not provided
            limitErrorOccurred = true;
            this.logResponse('Limits', e);
            log.warn(`${logPrefix}Failed to retrieve limits from BTIS: ${e.message}. Not providing limits in request.` + __location);
        }

        if (!limitErrorOccurred) {
            this.logResponse('Limits', carrierLimitsList?.data);
        }

        let limitId = null;

        // If we successfully retrieved limit information from the carrier, process it to find the limit ID
        if (carrierLimitsList && carrierLimitsList.data) {
            carrierLimitsList = carrierLimitsList.data;

            // Get the limit that most closely fits the user's request that the carrier supports
            const bestLimit = this.getBestLimits(carrierLimitsList.map(function(limit) {
                return limit.text.replace(/,/g, '');
            }));

            if(bestLimit){
                // Determine the BTIS ID of the bestLimit
                btisLimit = carrierLimitsList.find(limit => bestLimit.join('/') === limit.text.replace(/,/g, ''));
                limitId = btisLimit?.limits?.limitId;
            }
        }

        /*
        * INSURED INFORMATION
        * Retreive the insured information and format it to BTIS specs
        */
        const insuredInformation = appDoc.contacts.find(contact => contact.primary);
        let insuredPhoneNumber = insuredInformation.phone.toString();
        // Format phone number to: "(999) 888-7777"
        insuredPhoneNumber = `(${insuredPhoneNumber.substring(0, 3)}) ${insuredPhoneNumber.substring(3, 6)}-${insuredPhoneNumber.substring(insuredPhoneNumber.length - 4)}`;

        /*
        * BUSINESS ENTITY
        * Check to make sure BTIS supports the applicant's entity type, if not autodecline
        */
        const entityTypeId = entityTypes.find(entityType => entityType.map.includes(appDoc.entityType))?.key;
        if (!entityTypeId) {
            errorMessage = `BTIS does not support the selected business entity type ${appDoc.entityType}.`;
            log.error(`${logPrefix}${errorMessage} ` + __location);
            this.reasons.push(errorMessage);
            return this.client_autodeclined(errorMessage);
        }

        const acordQuestions = this.insurerQuestionList.filter(insurerQuestion => !insurerQuestion.identifier.includes("child_"));
        const explanationQuestions = this.insurerQuestionList.filter(insurerQuestion => insurerQuestion.identifier.includes("child_"));
        const appQuestions = [];

        // first, create the acord questions in the format BTIS is expecting
        for (const insurerQuestion of acordQuestions) {
            if (!insurerQuestion.talageQuestionId) {
                continue;
            }

            const question = this.questions[insurerQuestion.talageQuestionId];
            if (!question) {
                log.warn(`${logPrefix}Unable to find Talage question with ID ${insurerQuestion.talageQuestionId}. Skipping...`);
                continue;
            }

            let answer = '';
            try {
                answer = this.determine_question_answer(question);
            }
            catch (e) {
                log.error(`${logPrefix}Could not determine acord question ${question.id} answer: ${e}. Skipping... ` + __location);
                continue;
            }

            if (!answer) {
                continue;
            }

            if (insurerQuestion.identifier === "parent_18") {
                continue;
            }

            appQuestions.push({
                QuestionId: insurerQuestion.identifier,
                Answer: answer,
                explanation: null
            });
        }

        // then, add the explanations to the appropriate questions
        for (const insurerQuestion of explanationQuestions) {
            if (!insurerQuestion.talageQuestionId) {
                continue;
            }

            const question = this.questions[insurerQuestion.talageQuestionId];

            let answer = '';
            try {
                answer = this.determine_question_answer(question);
            }
            catch (e) {
                log.error(`${logPrefix}Could not determine explanation question ${question.id} answer: ${e}. Skipping... ` + __location);
                continue;
            }

            if (!answer) {
                continue;
            }

            const parentQuestionId = insurerQuestion.identifier.replace("child_", "");
            const acordQuestion = appQuestions.find(q => q.QuestionId === parentQuestionId);

            if (!acordQuestion) {
                log.warn(`${logPrefix}Unable to find parent question ${parentQuestionId} for explanation question ${question.id}. Skipping... ` + __location)
                continue;
            }

            acordQuestion.explanation = answer;
        }


        const primaryAddress = appDoc.locations.find(location => location.primary);

        let yearsOfExperience = 0;
        if (appDoc.yearsOfExp) {
            yearsOfExperience = appDoc.yearsOfExp >= 10 ? 10 : appDoc.yearsOfExp;
        }
        else {
            const years = moment().diff(moment(appDoc.founded), 'year');
            yearsOfExperience = years >= 10 ? 10 : years;
        }

        /*
        * BTIS APPLICAITON
        * Build the expected data object for BTIS
        */
        const data = {
            submission: {
                SubmissionId: this.generate_uuid(),
                SourceId: null,
                AgentContactId: null,
                AgencyId: null,
                ProposedEffectiveDate: moment(WCPolicy.effectiveDate).format('YYYY-MM-DDTHH:MM:SS'),
                ProposedExpirationDate: moment(WCPolicy.expirationDate).format('YYYY-MM-DDTHH:MM:SS'),
                LimitId: limitId,
                ProgramCode: "QMWC",
                Applicant: {
                    InsuredFirstName: insuredInformation.firstName,
                    InsuredLastName: insuredInformation.lastName,
                    LegalEntityName: appDoc.businessName,
                    LegalEntity: entityTypeId,
                    DBA: appDoc.dba ? appDoc.dba : "Not Provided",
                    FEIN: appDoc.ein ? appDoc.ein : null,
                    YearBusinessStarted: moment(appDoc.founded).format('YYYY'),
                    YearsOfIndustryExperience: yearsOfExperience,
                    Website: null,
                    DescriptionOfOperations: this.get_operation_description(),
                    ExperienceMod: appDoc.experience_modifier ? appDoc.experience_modifier : null,
                    MailingAddress: {
                        Line1: primaryAddress.address,
                        Line2: null,
                        City: primaryAddress.city,
                        State: primaryAddress.state,
                        Zip: primaryAddress.zipcode.substring(0, 5)
                    },
                    UnemploymentNumber: "",
                    PriorCoverageHistory: null,
                    ClaimCount: appDoc.claims.length,
                    IsEmployeeWorking: false,
                    ContractorLicense: null,
                    MCP65OrDMVLicense: null,
                    BlanketWaiverSubrogation: false
                },
                Contact: {
                    FirstName: insuredInformation.firstName,
                    MiddleName: "",
                    LastName: insuredInformation.lastName,
                    Email: insuredInformation.email,
                    Phones: [
                        {
                            PhoneNumber: insuredPhoneNumber,
                            PhoneType: ""
                        }
                    ]
                },
                Owners: appDoc.owners.map(owner => ({
                    FirstName: owner.fname,
                    LastName: owner.lname,
                    Title: owner.officerTitle,
                    OwnershipPct: owner.ownership,
                    IsIncluded: owner.include,
                    DoB: null,
                    Classifications: []
                })),
                LocationsClassifications: appDoc.locations.map(location => ({
                    Location: {
                        IsPrimary: true,
                        FEIN: appDoc.ein,
                        ExperienceMod: appDoc.experience_modifier,
                        Line1: location.address,
                        Line2: null,
                        City: location.city,
                        State: location.state,
                        Zip: location.zipcode.substring(0, 5)
                    },
                    Classifications: location.activityPayrollList.map(activity => {
                        const fte = activity.employeeTypeList.find(employee => employee.employeeType === "Full Time");
                        const pte = activity.employeeTypeList.find(employee => employee.employeeType === "Part Time");

                        return {
                            ClassCode: activity.ncciCode,
                            Payroll: activity.payroll,
                            NumberOfFullTimeEmployees: fte ? fte.employeeTypeCount : 0,
                            NumberOfPartTimeEmployees: pte ? pte.emplyeeTypeCount : 0
                        };
                    })
                })),
                InsuranceHistory: [],
                ClassSpecificResponses: [],
                CarrierQuotes: [],
                KeyValues: {},
                PaymentPlanResponses: [],
                Comments: "",
                AcordResponses: appQuestions
            },
            carriers: [
                "CLEARSPRING"
            ]
        };

        // Send JSON to the insurer
        let quoteResult = null;
        try {
            // Send request
            this.logRequest('application/json', host + QUOTE_URL, 'POST', data);
            quoteResult = await axios.post(host + QUOTE_URL, JSON.stringify(data), token);
        }
        catch (error) {
            this.logResponse('Quote', error?.response?.data);
            errorMessage = `Encountered error(s) while attempting to quote: `;
            if (error?.response?.data) {
                const e = error.response.data;
                if (e?.Status) {
                    errorMessage += `Error ${e.Status}: ${e.StatusDescription}`;
                    if (Array.isArray(e.Error)) {
                        e.Error.forEach(innerError => {
                            errorMessage += ` Error ${innerError.Code}: ${innerError.Description}.`;
                        });
                    }
                }
                else {
                    for (const [key, value] of Object.entries(e)) {
                        errorMessage += ` ${key}: ${value} `;
                    }
                }
            }
            else {
                errorMessage += `No error details were provided.`;
            }

            log.error(`${logPrefix}${errorMessage} ` + __location);
            return this.client_error(errorMessage, __location);
        }

        quoteResult = quoteResult?.data;
        this.logResponse('Quote', quoteResult);

        if (`${quoteResult.Status}` !== "200") {
            errorMessage = `Returned status ${quoteResult.Status}: ${quoteResult.StatusDescription}. `;
            log.error(`${logPrefix}${errorMessage}` + __location);
            return this.client_error(errorMessage, __location);
        }

        const quote = quoteResult?.Response?.Premium.find(q => q.Carrier === "CLEARSPRING");

        if (!quote) {
            errorMessage = `No quote found for Clearspring. `;
            log.error(`${logPrefix}${errorMessage}` + __location);
            return this.client_error(errorMessage, __location);
        }

        // quote response properties
        const quoteNumber = quoteResult?.Response?.QuoteNumber;
        const premium = quote?.Price;
        const quoteCoverages = [];

        let coverageSort = 0;
        Object.keys(btisLimit.limits).forEach(key => {
            if (key !== "limitId") {
                quoteCoverages.push({
                    description: key,
                    value: convertToDollarFormat(btisLimit.limits[key], true),
                    sort: coverageSort++,
                    category: "BTIS Workers' Compensation Limits"
                });
            }
        });

        // store line items in quote additional info, if they exist
        const lineItems = quote?.CarrierResponse?.quote?.results?.line_items?.WC;
        if (lineItems) {
            this.additionalInfo = {lineItems: []};
            lineItems.forEach(item => this.additionalInfo.lineItems.push(item));
        }

        if (quoteResult?.Error) {
            this.reasons.push(quoteResult.Error);
        }

        if (quoteResult?.Response?.Message) {
            this.reasons.push(quoteResult.Response.Message);
        }

        if (!quote?.CarrierResponse) {
            if (Array.isArray(quote?.Error)) {
                errorMessage = `BTIS returned the following error(s): `;
                quote.Error.forEach(error => errorMessage += ` ${error}.`);
            }
            else {
                errorMessage = `No submission status was returned, but no errors were reported by BTIS. `;
            }
            log.error(`${logPrefix}${errorMessage}` + __location);
            return this.client_error(errorMessage, __location);
        }
        else if (Array.isArray(quote?.Errors)) {
            quote.Errors.forEach(error => this.reasons.push(error));
        }

        // Currently, BTIS only returns a quoted submission status
        switch (quote?.CarrierResponse?.SubmissionStatus) {
            case "Quoted":
                if (premium) {
                    return this.client_quoted(quoteNumber, [], premium, null, null, quoteCoverages);
                }
                else {
                    return this.client_referred(quoteNumber, [], null, null, null, quoteCoverages);
                }
            default:
                errorMessage = `Unhandled submission status ${quote?.CarrierResponse?.SubmissionStatus} was returned. `;
                log.error(`${logPrefix}${errorMessage}` + __location);
                // even if we got an unknown status, if premium was returned, return as quoted
                if (premium) {
                    return this.client_quoted(quoteNumber, [], premium, null, null, quoteCoverages);
                }
                // else return an error
                return this.client_error(errorMessage, __location);
        }
    }

    logRequest(header, url, method, data = {}) {
        this.log += `--------======= Sending ${header} =======--------<br><br>`;
        this.log += `URL: ${url} - ${method}<br><br>`;
        if (method.toUpperCase() !== 'GET') {
            this.log += `<pre>${htmlentities.encode(JSON.stringify(data, null, 4))}</pre><br><br>`;
        }
    }

    logResponse(header, data) {
        this.log += `--------======= ${header} Response =======--------<br><br>`;
        this.log += `<pre>${htmlentities.encode(JSON.stringify(data, null, 4))}</pre><br><br>`;
    }
}
