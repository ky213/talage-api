/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * General Liability Integration for BTIS
 */

'use strict';

const Integration = require('../Integration.js');
const moment = require('moment');
const util = require('util');

/*
* As of 08/2020
* Define how legal entities are mapped for BTIS (/GL/Common/v1/gateway/api/lookup/dropdowns/businesstypes)
* NOTE: The closest mapping for an association is a corporation
*/
const BUSINESS_ENTITIES = {
    Association: 2,
    Corporation: 2,
    'Limited Liability Company': 5,
    'Limited Partnership': 3,
    Partnership: 6,
    'Sole Proprietorship': 1
};

/*
* As of 08/2020
* This is the BTIS list of territories that offer deductibles OTHER THAN $500
* There is no lookup available to give us this list, instead each of the in appetite territories have to be checked
* here individually with an effective date:
* GL/Common/v1/gateway/api/lookup/dropdowns/deductibles/state/<state_code>/effective/<YYYY-MM-DD>/
* GL/Common/v1/gateway/api/lookup/dropdowns/deductibles/state/CA/effective/2020-08-23/
*/
const DEDUCTIBLE_TERRITORIES = [
    'AR',
    'AZ',
    'CA',
    'CO',
    'ID',
    'NM',
    'NV',
    'OK',
    'OR',
    'TX',
    'UT',
    'WA'
];

/*
* As of 08/2020
* Define how deductibles are mapped for BTIS
* Again, no way to lookup their whole list, but these are the mappings for the only deductibles we offer anyway
* GL/Common/v1/gateway/api/lookup/dropdowns/deductibles/state/<state_code>/effective/<YYYY-MM-DD>/
* GL/Common/v1/gateway/api/lookup/dropdowns/deductibles/state/CA/effective/2020-08-23/
*/
const BTIS_DEDUCTIBLE_IDS = {
    500: 2000500,
    1000: 2001000,
    1500: 2001500
};

// This is derived from their API - for now, we will just convert experience into num and if >= 10, we send "10+" instead
// const industryExperienceMap = {
//     0: "0",
//     1: "1",
//     2: "2",
//     3: "3",
//     4: "4",
//     5: "5",
//     6: "6",
//     7: "7",
//     8: "8",
//     9: "9",
//     10: "10+"
// };

// this is for question "Any prior coverage declined/cancelled/non-renewed/expired (last 3 yrs.)? (Not applicable for Missouri risks)"
// this is a checkbox question, so multiple answers can be selected
const priorCoverageMap = {
    "Non-Payment": "nonPayment",
    "Loss History": "lossHistory",
    "Agent Lost contract with prior carrier": "agentLostContract",
    "Prior Carrier no longer writes class": "priorCarrierClass",
    "Other": "other"
};

// doesn't look like the request requires this, so leaving out for now
// const entityTypeMap = {
//     {
//         "value": "Association"
//           {
//         "key": 11,
//         "value": "Common Ownership"
//         },
//           {
//         "key": 2,
//         "value": "Corporation"
//         },
//           {
//         "key": 14,
//         "value": "Government Entity"
//         },
//           {
//         "key": 7,
//         "value": "Individual"
//         },
//           {
//         "key": 12,
//         "value": "Joint Employers"
//         },
//           {
//         "key": 4,
//         "value": "Joint Venture"
//         },
//           {
//         "key": 9,
//         "value": "Labor Union"
//         },
//           {
//         "key": 5,
//         "value": "Limited Liability Company"
//         },
//           {
//         "key": 6,
//         "value": "Limited Liability Partnership"
//         },
//           {
//         "key": 3,
//         "value": "Limited Partnership"
//         },
//           {
//         "key": 1,
//         "value": "Partnership"
//         },
//           {
//         "key": 10,
//         "value": "Religious Organization"
//         },
//           {
//         "key": 13,
//         "value": "Trust or Estate"
//         }
// };

/*
* As of 08/2020
* BTIS endpoint urls
* Arguments:
* AUTH_URL: None
* LIMITS_URL:  STATE_NAME - to be replaced with business primary territory
* 				EFFECTIVE_DATE - to be replaced with policy effective date in YYYY-MM-DD format
* QUOTE_URL: None
*/
const AUTH_URL = '/v1/authentication/connect/token';
const LIMITS_URL = '/WC/v1/gateway/lookup/limits?stateName={STATE_NAME}';
const QUOTE_URL = '/Common/v1/crosssell/WC/Quote ';
const REGISTER_AGENT_URL = '/v1/authentication/api/registeragent';

/*
* As of 10/2020
* Our BTIS service channel designations for retrieving agency credentials
* Used in the request to the BTIS registeragent endpoint
*/
const SANDBOX_SERVICE_CHANNEL_ID = 12;
const PRODUCTION_SERVICE_CHANNEL_ID = 86;

module.exports = class BtisGL extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
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

        // let service_channel = null;

        // Determine which URL to use
        if (this.insurer.useSandbox) {
            host = 'https://api-azure-staging.btisinc.com';
            // service_channel = SANDBOX_SERVICE_CHANNEL_ID;
        }
        else {
            host = 'https://api-azure.btisinc.com  ';
            // service_channel = PRODUCTION_SERVICE_CHANNEL_ID;
        }

        const WCPolicy = appDoc.policies.find(policy => policy.policyType === "WC");
        if (!WCPolicy) {
            errorMessage = `Unable to find a WC policy for the submission. `;
            log.error(`${logPrefix}${errorMessage}` + __location);
            this.reasons.push(errorMessage);
            return this.client_error(errorMessage, __location);
        }

        // let token_request_data = null;
        // let agency_credentials_response = null

        // if('11' in this.app.agencyLocation.insurers && this.app.agencyLocation.insurers['11'].agencyId && this.app.agencyLocation.insurers['11'].agentId){

        //     const credentials_request_data = JSON.stringify({
        //         agency_code: this.app.agencyLocation.insurers['11'].agencyId,
        //         contact_email: this.app.agencyLocation.insurers['11'].agentId,
        //         service_channel_id: service_channel
        //     });

        //     try{
        //         agency_credentials_response = await this.send_json_request(host, REGISTER_AGENT_URL, credentials_request_data)
        //     }
        //     catch(error){
        //         errorMessage = `${error} ${error.response ? error.response : ""}`
        //         this.reasons.push(`Failed to retrieve credentials from BTIS for agency: ${this.app.agencyLocation.agency}.  ${errorMessage} `);
        //         return this.return_error('error', `${logPrefix}Failed to retrieve credentials from BTIS for agency: ${this.app.agencyLocation.agency}. ` + errorMessage + __location);
        //     }

        //     log.debug(agency_credentials_response + __location);

        //     token_request_data = JSON.stringify({
        //         client_id: agency_credentials_response.client_id,
        //         client_secret: agency_credentials_response.client_secret,
        //         grant_type: 'client_credentials'
        //     })

        // }
        // else{
        //     // Get a token from their auth server
        //     token_request_data = JSON.stringify({
        //         client_id: this.username,
        //         client_secret: this.password,
        //         grant_type: 'client_credentials'
        //     });
        // }

        const authBody = {
            grant_type: "client_credentials",
            client_secret: this.password,
            client_id: this.username
        };

        let token_response = null;
        try {
            // Send request
            token_response = await this.send_json_request(host, AUTH_URL, authBody);

        }
        catch (e) {
            errorMessage = `${e} ${e.response ? e.response : ""}`
            this.reasons.push(`Error retrieving auth token from BTIS: ${e}. ${errorMessage}`);
            return this.client_error(`${logPrefix}Failed to retrieve auth token from BTIS: ${e.message}. ` + __location);
        }

        // Check the response is what we're expecting
        if (!token_response.success || !token_response.token) {
            this.reasons.push('BTIS auth returned an unexpected response or error.');
            if(token_response.message && token_response.message.length > 0){
                errorMessage = token_response.message;
            }
            this.reasons.push(`BTIS auth returned an unexpected response or error - unable to authenticate.`);
            return this.client_error(`${logPrefix}BTIS auth returned an unexpected response or error. ${errorMessage}. ` + __location);
        }

        // format the token the way BTIS expects it
        const token = {'x-access-token': token_response.token};

        /*
        * DEDUCTIBLE
        * Set a default for the deductible to $500 (available for all territories)
        * Then check to see if higher deductibles are offered, if they are find an exact match
        * or default to $1500
        */
        // NOTE: For WC, doesn't look like this is needed
        // let deductibleId = BTIS_DEDUCTIBLE_IDS[500];
        // let requestDeductible = 1500;
        // // If deductibles other than $500 are allowed, check the deductible and return the appropriate BTIS ID
        // if (DEDUCTIBLE_TERRITORIES.includes(this.app.business.primary_territory)) {
        //     if(BTIS_DEDUCTIBLE_IDS[this.policy.deductible]){
        //         deductibleId = BTIS_DEDUCTIBLE_IDS[this.policy.deductible];
        //         requestDeductible = this.policy.deductible;
        //     }
        //     else{
        //         // Default to 1500 deductible
        //         deductibleId = BTIS_DEDUCTIBLE_IDS[1500];
        //     }
        // }

        /*
        * LIMITS
        * BTIS allows submission without a limits id, so log a warning and keep going if the limits couldn't be retrieved
        * As of 08/2020, their system defaults a submission without a limits ID to:
        * $1M Occurrence, $2M Aggregate
        */

        // Prep limits URL arguments
        const limitsURL = LIMITS_URL.replace('STATE_NAME', this.app.business.primary_territory).replace('EFFECTIVE_DATE', this.policy.effective_date.format('YYYY-MM-DD'));

        let carrierLimitsList = null;
        let btisLimitsId = null;

        try {
            carrierLimitsList = await this.send_json_request(host, limitsURL, null, token);
        }
        catch (e) {
            this.reasons.push('Limits could not be retrieved from BTIS, defaulted to $1M Occurrence, $2M Aggregate.');
            log.warn(`${logPrefix}Failed to retrieve limits from BTIS: ${e.message}` + __location);
        }

        // If we successfully retrieved limit information from the carrier, process it to find the limit ID
        if (carrierLimitsList) {
            // Filter out all carriers except victory (victory and clearspring have the same limit IDs so we only need victory)
            carrierLimitsList = carrierLimitsList.filter(limit => limit.carrier === 'victory')

            // Get the limit that most closely fits the user's request that the carrier supports
            const bestLimit = this.getBestLimits(carrierLimitsList.map(function(limit) {
                return limit.value.replace(/,/g, '');
            }));

            if(bestLimit){
                // Determine the BTIS ID of the bestLimit
                btisLimitsId = carrierLimitsList.find(limit => bestLimit.join('/') === limit.value.replace(/,/g, '')).key;
            }
        }

        /*
        * INSURED INFORMATION
        * Retreive the insured information and format it to BTIS specs
        */
        const insuredInformation = appDoc.contacts.find(contact => contact.primary);
        let insuredPhoneNumber = insuredInformation.phone.toString();
        // Format phone number to: (xxx)xxx-xxxx
        insuredPhoneNumber = `(${insuredPhoneNumber.substring(0, 3)})${insuredPhoneNumber.substring(3, 6)}-${insuredPhoneNumber.substring(insuredPhoneNumber.length - 4)}`;

        /*
        * BUSINESS ENTITY
        * Check to make sure BTIS supports the applicant's entity type, if not autodecline
        */
        if (!(this.app.business.entity_type in BUSINESS_ENTITIES)) {
            this.reasons.push(`BTIS does not support business entity type: ${this.app.business.entity_type}`);
            return this.return_result('autodeclined');
        }

        /*
        * BUSINESS HISTORY
        * BTIS Lookup here: /GL/Common/v1/gateway/api/lookup/dropdowns/businesshistory/
        * As of 08/2020
        * 0 = New in business
        * 1 = 1 year in business
        * 2 = 2 years in business
        * 3 = 3 years in business
        * 4 = 4 years in business
        * 5 = 5+ years in business
        */
        let businessHistoryId = moment().diff(this.app.business.founded, 'years');
        if(businessHistoryId > 5){
            businessHistoryId = 5;
        }

        /*
        * PRIMARY ADDRESS
        * Retrieve the business' primary address. Primary address is always stored in the first element of locations.
        */
        const primaryAddress = appDoc.locations.find(location => location.primary);

        /*
        * BTIS QUALIFYING STATEMENTS
        * Retrieve the BTIS qualifying statement ids and map them to our ids, if unsuccessful we have
        * to quit as they are required for BTIS.
        * questionIdsObject: key - talage ID
        *                    value - BTIS ID
        */
        let questionIdsObject = null;
        try{
            questionIdsObject = await this.get_question_identifiers();
        }
        catch(error){
            this.reasons.push('Unable to get BTIS question identifiers required for application submission.');
            return this.return_error('error', `${logPrefix}Unable to get BTIS question identifiers required for application submission` + error + __location);
        }

        // Loop through and process each BTIS qualifying statement/question
        let subcontractorCosts = 0;
        let constructionExperience = 0;
        const qualifyingStatements = [];
        for (const question_id in this.questions) {
            if(this.questions[question_id]){
                const question = this.questions[question_id];
                // Make sure we have a BTIS qualifying statement ID
                if (questionIdsObject[question.id]) {
                    // If the question is a special case (manually added in the question importer) handle it,
                    // otherwise push it onto the qualifying statements
                    switch(questionIdsObject[question.id]){
                        // What is your annual cost of sub-contracted labor?
                        case '1000':
                            subcontractorCosts = question.answer ? question.answer : 0;
                            break;
                        // How many years of construction experience do you have?
                        case '1001':
                            constructionExperience = question.answer ? question.answer : 0;
                            break;
                        default:
                            qualifyingStatements.push({
                                QuestionId: parseInt(questionIdsObject[question.id], 10),
                                Answer: question.get_answer_as_boolean()
                            });
                    }
                }
            }
        }

        /*
        * PERFORM NEW RESIDENTIAL WORK
        * Question text: Can you confirm that you haven't done any work involving apartment conversions,
        * construction work involving condominiums, town homes, or time shares in the past 10 years?
        * NOTE: Because of the negative in the question text, we have to flip the user's answer because
        * why would we make this simple BTIS, why you gotta put negatives in your questions
        * ADDITIONAL NOTE: BTIS asks for this info in the body of their application AS WELL as in their
        * qualifying statements so we need to isolate this answer from the qualifying statements separately
        */

        // Get the talage ID of BTIS qualifying statement number 2
        const talageIdNewResidentialWork = Object.keys(questionIdsObject).find(talageId => questionIdsObject[talageId] === '2');
        let performNewResidentialWork = false;
        if(this.questions[talageIdNewResidentialWork]){
            performNewResidentialWork = !this.questions[talageIdNewResidentialWork].get_answer_as_boolean();
        }
        else {
            log.warn(`${logPrefix} missing BTIS question (BTIS ID: 2) appId: ` + this.app.id + __location);
        }

        /*
        * GROSS RECEIPTS
        * BTIS qulaifying statement id 1 asks: Are your gross receipts below $1,500,000 in each of the past 2 years?
        * We ask for and store gross sales in the applicaiton so this qualifying statement needs to be processed separately
        */
        qualifyingStatements.push({
            QuestionId: 1,
            Answer: this.policy.gross_sales < 1500000
        });

        /*
        * BTIS APPLICAITON
        * Build the expected data object for BTIS
        */
        const data = {
            submission: {
                AgentContactId: 1, // TODO
                AgencyId: 1, // TODO
                ProposedEffectiveDate: moment(WCPolicy.effectiveDate).format("M/D/YYYY"),
                ProposedExpirationDate: "1/9/2022",
                LimitId: btisLimitsId,
                ProgramCode: "QMWC",
                Applicant: {
                    InsuredFirstName: insuredInformation.firstName,
                    InsuredLastName: insuredInformation.lastName,
                    LegalEntityName: appDoc.businessName,
                    LegalEntity: 2, // TODO
                    FEIN: appDoc.ein
                },
                YearBusinessStarted: 2010,
                YearsOfIndustryExperience: 10,
                DescriptionOfOperations: "cutting hear",
                BlanketWaiverSubrogation: false,
                ContractorLicense: "1231231",
                MCP65OrDMVLicense: "123123123",
                ExperienceMod: 1.0,
                Line1: "200 South Virginia St",
                City: "Reno",
                State: "NV",
                Zip: "89501",
                EmployeeSinceEstablishment: true,
                NoOfPriorCoverage: 1,
                ClaimCount: 0
            },
            contact: {
                FirstName: insuredInformation.firstName,
                LastName: insuredInformation.lastName,
                PhoneNumber: insuredPhoneNumber// TODO: check if it needs to be this format - "1-415-239-1756"
            },
            owners: { // TODO: This isn't an array, do they only allow a single owner?
                FirstName: "John",
                LastName: "Doe",
                Title: "CEO", // TODO: Do they have a map for this? Or is this free-form?
                OwnershipPct: 100,
                IsIncluded: false
            },
            LocationsClassifications: { // TODO: This isn't an array, do they only allow single location?
                Location: {
                    IsPrimary: true,
                    FEIN: "231245676",
                    ExperienceMod: 1.0,
                    Line1: "200 South Virginia St",
                    City: "Reno",
                    State: "NV",
                    Zip: "89501",
                    EmployeeSinceEstablishment: true,
                    NoOfPriorCoverage: 1,
                    ClaimCount: 0
                },
                Classifications: {
                    ClassCode: 8808,
                    "Description Banks": "Banks",
                    Payroll: 100000,
                    NumberOfFullTimeEmployees: 3,
                    NumberOfPartTimeEmployees: 1
                }
            }
        };//,
        //     carriers: ["AMTRUSTWC", "GREATAMERICAN"]
        // }

        // Send JSON to the insurer
        let quoteResult = null;
        try{
            quoteResult = await this.send_json_request(host, QUOTE_URL, JSON.stringify(data), token, 'POST');
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