/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * BTIS Workers' Comp Integration
 */

'use strict';

const Integration = require('../Integration.js');
const moment = require('moment');
const util = require('util');
const axios = require('axios');
const htmlentities = require('html-entities').Html5Entities;

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
            let formattedString = authBody;
            const formattedJSONString = this.get_formatted_json_string(authBody);
            if (formattedJSONString) {
                formattedString = formattedJSONString;
            }

            // Send request
            this.log += `--------======= Sending ${authHeaders} =======--------<br><br>`;
            this.log += `URL: ${host}${AUTH_URL} - POST<br><br>`;
            this.log += `<pre>${htmlentities.encode(formattedString)}</pre><br><br>`;
            token_response = await axios.post(host + AUTH_URL, JSON.stringify(authBody), authHeaders);
        }
        catch (e) {
            errorMessage = `${e} ${e.response ? e.response : ""}`
            this.reasons.push(`Error retrieving auth token from BTIS: ${e}. ${errorMessage}`);
            return this.client_error(`${logPrefix}Failed to retrieve auth token from BTIS: ${e.message}. ` + __location);
        }

        // Check the response is what we're expecting
        if (!token_response.data.success || !token_response.data.token) {
            this.reasons.push('BTIS auth returned an unexpected response or error.');
            if(token_response.data.message && token_response.data.message.length > 0){
                errorMessage = token_response.data.message;
            }
            this.reasons.push(`BTIS auth returned an unexpected response or error - unable to authenticate.`);
            return this.client_error(`${logPrefix}BTIS auth returned an unexpected response or error. ${errorMessage}. ` + __location);
        }

        // format the token the way BTIS expects it
        const token = {headers: {'x-access-token': token_response.data.token}};

        // Prep limits URL arguments
        const limitsURL = LIMITS_URL.replace('STATE_NAME', this.app.business.primary_territory);

        let carrierLimitsList = null;
        let btisLimitsId = null;

        try {
            // Send request
            this.log += `--------======= Sending ${token} =======--------<br><br>`;
            this.log += `URL: ${host}${limitsURL} - GET<br><br>`;
            carrierLimitsList = await axios.get(host + limitsURL, token);
        }
        catch (e) {
            this.reasons.push('Limits could not be retrieved from BTIS, defaulted to $1M Occurrence, $2M Aggregate.');
            log.warn(`${logPrefix}Failed to retrieve limits from BTIS: ${e.message}` + __location);
        }

        // If we successfully retrieved limit information from the carrier, process it to find the limit ID
        if (carrierLimitsList && carrierLimitsList.data) {
            carrierLimitsList = carrierLimitsList.data;

            // Get the limit that most closely fits the user's request that the carrier supports
            const bestLimit = this.getBestLimits(carrierLimitsList.map(function(limit) {
                return limit.text.replace(/,/g, '');
            }));

            if(bestLimit){
                // Determine the BTIS ID of the bestLimit
                btisLimitsId = carrierLimitsList.find(limit => bestLimit.join('/') === limit.text.replace(/,/g, '')).limits.limitId;
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
            yearsOfExperience = appDoc.yearsOfExp >= 10 ? "10+" : `${appDoc.yearsOfExp}`;
        }

        /*
        * BTIS APPLICAITON
        * Build the expected data object for BTIS
        */
        const data = {
            submission: {
                SubmissionId: "",
                SourceId: null,
                AgentContactId: null,
                AgencyId: null,
                ProposedEffectiveDate: moment(WCPolicy.effectiveDate).format('YYYY-MM-DDTHH:MM:SS'),
                ProposedExpirationDate: moment(WCPolicy.expirationDate).format('YYYY-MM-DDTHH:MM:SS'),
                LimitId: btisLimitsId,
                ProgramCode: "QMWC",
                Applicant: {
                    InsuredFirstName: insuredInformation.firstName,
                    InsuredLastName: insuredInformation.lastName,
                    LegalEntityName: appDoc.businessName,
                    LegalEntity: entityTypeId,
                    DBA: appDoc.dba ? appDoc.dba : "",
                    FEIN: appDoc.ein,
                    YearBusinessStarted: moment(appDoc.founded).format('YYYY'),
                    YearsOfIndustryExperience: yearsOfExperience,
                    Website: null,
                    DescriptionOfOperations: this.get_operation_description(),
                    ExperienceMod: appDoc.experience_modifier,
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

        console.log(JSON.stringify(data, null, 4));
        return this.client_error("testing");

        // Send JSON to the insurer
        const quoteHeaders = {headers: {'Content-Type': 'application/json'}};

        let quoteResult = null;
        try{
            let formattedString = data;
            const formattedJSONString = this.get_formatted_json_string(data);
            if (formattedJSONString) {
                formattedString = formattedJSONString;
            }

            // Send request
            this.log += `--------======= Sending application/json =======--------<br><br>`;
            this.log += `URL: ${host}${QUOTE_URL} - POST<br><br>`;
            this.log += `<pre>${htmlentities.encode(formattedString)}</pre><br><br>`;
            quoteResult = await axios.post(host + QUOTE_URL, JSON.stringify(data), quoteHeaders);
        }
        catch(error){
            log.error(`${logPrefix} Quote Endpoint Returned Error ${util.inspect(error, false, null)}` + __location);
            const errorString = JSON.stringify(error);
            if(errorString.indexOf("No Carrier found for passed state and class code") > -1){
                this.reasons.push('BTIS response with: No Carrier found for passed state and class code ');
                return this.return_result('declined');
            }
            else {
                errorMessage = `${error} ${error.response ? error.response : ""}`
                this.reasons.push('Problem connecting to insurer BTIS ' + errorMessage);
                return this.return_result('autodeclined');
            }
        }

        quoteResult = quoteResult.data;

        //BTIS put each potential carrier in it own Property
        // With Multi-Carrier we will just to the lowest quote back.
        // but it will come in the that carriers node.
        // For backward compatible clearspring should be checked last.
        // eslint-disable-next-line array-element-newline
        const carrierNodeList = ["cna", "hiscox", "cbic", "clearspring", "victory"];
        let lowestQuote = 999999;
        let gotQuote = false;
        let gotRefferal = false;
        let gotSuccessFalse = false;
        for(let i = 0; i < carrierNodeList.length; i++){
            const currentCarrier = carrierNodeList[i]
            // clearspring - The result can be under either clearspring or victory, checking for success
            if (quoteResult[currentCarrier] && quoteResult[currentCarrier].success === true) {
                let makeItTheQuote = false;
                const quoteInfo = quoteResult[currentCarrier];

                // Get the quote amount
                if(quoteInfo.quote && quoteInfo.quote.results
                    && quoteInfo.quote.results.total_premium
                    ){
                        if(parseInt(quoteInfo.quote.results.total_premium,10) < lowestQuote){
                            this.amount = parseInt(quoteInfo.quote.results.total_premium,10);
                            lowestQuote = quoteInfo.quote.results.total_premium;
                            makeItTheQuote = true;
                        }
                }
                else{
                    log.error(`${logPrefix} Integration Error: Quote structure changed. Unable to get quote amount from insurer. ` + __location);
                    this.reasons.push('A quote was generated but our API was unable to isolate it.');
                    //return this.return_error('error');
                }
                if(makeItTheQuote){
                    //Get the quote link
                    this.quoteLink = quoteInfo.bridge_url ? quoteInfo.bridge_url : null;
                    gotQuote = true;
                    // Get the quote limits
                    if(quoteInfo.quote.criteria && quoteInfo.quote.criteria.limits){
                        const limitsString = quoteInfo.quote.criteria.limits.replace(/,/g, '');
                        const limitsArray = limitsString.replace(/,/g, "").split('/');
                        this.limits = {
                            '4': parseInt(limitsArray[0],10),
                            '8': parseInt(limitsArray[1],10),
                            '9': parseInt(limitsArray[2],10)
                        }
                        this.limits[4] = parseInt(limitsArray[0],10);
                        this.limits[8] = parseInt(limitsArray[1],10);
                        this.limits[9] = parseInt(limitsArray[2],10);
                        this.limits[12] = requestDeductible;
                    }
                    else{
                        if(this.reasons.includes('The subcontractor costs are above the maximum allowed') || subcontractorCosts > 100_000){
                            this.reasons = ['The subcontractor costs are above the maximum allowed ($100,000)']
                            return this.return_result('declined')
                        }

                        log.error(`${logPrefix} Integration Error: Quote structure changed. Unable to find limits.  ${JSON.stringify(quoteInfo)}` + __location);
                        this.reasons.push('Quote structure changed. Unable to find limits.');
                    }
                    // Return the quote
                    //TODO once fully on multi carrier API we can break out of the loop after an success === true
                    break;
                }
            //  return this.return_result('referred_with_price');
            }
            // Checking for referral with reasons
            else if(quoteResult[currentCarrier] && quoteResult[currentCarrier].success === false && gotQuote === false){
                const declinedInfo = quoteResult[currentCarrier];
                if(declinedInfo.referral_reasons){
                    declinedInfo.referral_reasons.forEach((reason) => {
                        this.reasons.push(reason);
                    });
                    gotRefferal = true
                }
                else if(gotRefferal === false) {
                    gotSuccessFalse = true;
                }
            }
            //error is not processed Until we understand how it works in multicarrier response.

        }
        if(gotQuote){
            return this.return_result('referred_with_price');
        }
        else if(gotRefferal){
            return this.return_result('referred');
        }
        else if(gotSuccessFalse){
            //return this.return_result('referred');
            return this.return_result('declined');
        }
        else{
            //
            // If we made it this far, they declined
            this.reasons.push(`BTIS has indicated it will not cover ${this.app.business.industry_code_description.replace('&', 'and')} in territory ${primaryAddress.territory} at this time.`);
            return this.return_result('declined');
        }
    }
 }