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
const DEDUCTIBLE_TERRITORIES = ['AR',
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
    'WA'];

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
}

/*
 * As of 08/2020
 * Specially handled questions. BTIS requires subcontractor costs and whether or not the applicant performs new residential work
 * The question ids in our system are set below in case they change in the future
 */
const NEW_RESIDENTIAL_WORK = 948;

/*
 * As of 08/2020
 * BTIS endpoint urls
 * Arguments:
 * AUTH_URL: None
 * LIMITS_URL:  STATE_NAME - to be replaced with business primary territory
 * 				EFFECTIVE_DATE - to be replaced with policy effective date in YYYY-MM-DD format
 * VALIDATE_URL: None
 * SUBMIT_URL: None
 */
const AUTH_URL = '/v1/authentication/connect/token';
const LIMITS_URL = '/GL/Common/v1/gateway/api/lookup/dropdowns/limits/state/STATE_NAME/effective/EFFECTIVE_DATE/';
const QUOTE_URL = '/GL/Common/v1/gateway/api/quote';

module.exports = class BtisGL extends Integration {

    /**
	 * Requests a quote from BTIS and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    _insurer_quote() {

        // Build the Promise
        return new Promise(async(fulfill) => {
            let errorMessage = null;
            let host = '';

            // Determine which URL to use
            if (this.insurer.useSandbox) {
                host = 'api-sandbox.btisinc.com';
            }
            else {
                host = 'api.btisinc.com';
            }

            // Get a token from their auth server
            const token_request_data = JSON.stringify({
                client_id: this.username,
                client_secret: this.password,
                grant_type: 'client_credentials'
            });

            let token_response = null;
            try{
                // Send request
                token_response = await this.send_json_request(host, AUTH_URL, token_request_data)

            }
            catch(error){
                log.error('Failed to retrieve auth from BTIS: ' + error.message + __location);
                fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
                return;
            }

            // Check the response is what we're expecting
            if(!token_response.success || token_response.success !== true || !token_response.token){
                errorMessage = 'BTIS auth returned an unexpected response or error';
                if(token_response.message && token_response.message.length > 0){
                    errorMessage += ': ' + token_response.message;
                }
                log.error(errorMessage + __location);
                fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
                return;
            }

            // format the token the way BTIS expects it
            const token = {'x-access-token': token_response.token};

            /*
			 * DEDUCTIBLE
			 * Set a default for the deductible to $500 (available for all territories)
			 * Then check to see if higher deductibles are offered, if they are find an exact match
			 * or default to $1500
			 */
            let deductibleId = BTIS_DEDUCTIBLE_IDS[500];

            // If deductibles other than $500 are allowed, check the deductible and return the appropriate BTIS ID
            if (DEDUCTIBLE_TERRITORIES.includes(this.app.business.primary_territory)) {
                if(BTIS_DEDUCTIBLE_IDS[this.policy.deductible]){
                    deductibleId = BTIS_DEDUCTIBLE_IDS[this.policy.deductible];
                }
                else{
                    // Default to 1500 deductible
                    deductibleId = BTIS_DEDUCTIBLE_IDS[1500];
                }
            }

            /*
			 * LIMITS
			 * BTIS allows submission without a limits id, so log a warning an keep going if the limits couldn't be retrieved
			 * As of 08/2020, their system defaults a submission without a limits ID to:
			 * $1M Occurrence, $2M Aggregate
			 */

            // Prep limits URL arguments
            const limitsURL = LIMITS_URL.replace('STATE_NAME', this.app.business.primary_territory).replace('EFFECTIVE_DATE', this.policy.effective_date.format('YYYY-MM-DD'));

            let carrierLimitsList = null;
            let btisLimitsId = null;
            let bestLimit = null;

            try{
                carrierLimitsList = await this.send_json_request(host, limitsURL, null, token);
            }
            catch(error){
                log.warn('Failed to retrieve limits from BTIS: ' + error.message + __location);
            }

            // If we successfully retrieved limit information from the carrier, process it to find the limit ID
            if(carrierLimitsList){

                // Filter out all carriers except victory (victory and clearspring have the same limit IDs so we only need victory)
                carrierLimitsList = carrierLimitsList.filter(limit => limit.carrier === 'victory')

                // Get the limit that most closely fits the user's request that the carrier supports
                bestLimit = this.getBestLimits(carrierLimitsList.map(function(limit) {
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
            const insuredInformation = this.app.business.contacts[0];
            let insuredPhoneNumber = insuredInformation.phone.toString();
            // Format phone number to: (xxx)xxx-xxxx
            insuredPhoneNumber = `(${insuredPhoneNumber.substring(0, 3)})${insuredPhoneNumber.substring(3, 6)}-${insuredPhoneNumber.substring(insuredPhoneNumber.length - 4)}`;

            /*
			 * BUSINESS ENTITY
			 * Check to make sure BTIS supports the applicant's entity type, if not, return
			 */
            if (!(this.app.business.entity_type in BUSINESS_ENTITIES)) {
                log.error(`BTIS GL Integration File: BTIS does not support ${this.app.business.entity_type}` + __location);
                fulfill(this.return_error('error', "We have no idea what went wrong, but we're on it"));
                return;
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
			 * NOTE: For some reason, 0 is not allowed
			 */

            let businessHistoryId = moment().diff(this.app.business.founded, 'years');
            if(businessHistoryId > 5){
                businessHistoryId = 5;
            }

            /*
			 * PRIMARY ADDRESS
			 * Retrieve the business' primary address. Primary address is always stored in the first element of locations.
			 */
            const primaryAddress = this.app.business.locations[0];

            /*
			 * BTIS QUALIFYING STATEMENTS
			 * Retrieve the BTIS qualifying statement ids and map them to our ids, if unsuccessful we have
			 * to quit as they are required for BTIS
			 */
            let question_identifiers = null;
            try{
                question_identifiers = await this.get_question_identifiers();
            }
            catch(error){
                log.error(`BTIS GL is unable to get question identifiers. ${error}` + __location);
                fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
            }

            // Loop through and process each BTIS qualifying statement/question
            let subcontractorCosts = 0;
            let constructionExperience = 0;
            const qualifyingStatements = [];
            for (const question_id in this.questions) {
                if(this.questions[question_id]){
                    const question = this.questions[question_id];
                    if (question_identifiers[question.id]) {
                        // If the question is a special case handle it, otherwise push it onto the qualifying statements
                        switch(question_identifiers[question.id]){
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
                                    QuestionId: parseInt(question_identifiers[question.id], 10),
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
			 */
            let performNewResidentialWork = false;
            if(this.questions[NEW_RESIDENTIAL_WORK]){
                performNewResidentialWork = !this.questions[NEW_RESIDENTIAL_WORK].get_answer_as_boolean();
            }
            else {
                log.warn(`BTIS GL missing question ${NEW_RESIDENTIAL_WORK} appId: ` + this.app.id + __location);
            }

            /*
			 * GROSS RECEIPTS
			 * BTIS qulaifying statement id 1 asks: Are your gross receipts below $1,500,000 in each of the past 2 years?
			 * We ask for and store gross sales in the applicaiton so the question needs to be processed separately
			 */
            qualifyingStatements.push({
                QuestionId: 1,
                Answer: this.policy.gross_sales < 1500000
            });

            /*
			 * BTIS APPLICAITON
			 * Build the expected data object for BTIS
			 * Anything commented out is information that we do not collect AND is not required for submission
			 */
            const data = {
                ProposedEffectiveDate: this.policy.effective_date.format('YYYY-MM-DD'),
                DeductibleId: deductibleId,
                LimitsId: btisLimitsId,
                ProvideSpanishInspection: false,

                InsuredInformation: {
                    FirstName: insuredInformation.first_name,
                    LastName: insuredInformation.last_name,
                    Email: insuredInformation.email,
                    PhoneNumber: insuredPhoneNumber,
                    CellularNumber: insuredPhoneNumber
                },

                BusinessInformation:{
                    DBA: this.app.business.dba ? this.app.business.dba : this.app.business.name,
                    BusinessEntityTypeId: BUSINESS_ENTITIES[this.app.business.entity_type],
                    PartnerNames: '',
                    BusinessExperienceId: businessHistoryId,
                    ConstructionExperienceId: constructionExperience,
                    BusinessHistoryId: businessHistoryId,
                    NumberOfOwners: this.app.business.num_owners,
                    NumberOfFullTimeEmployees: this.get_total_full_time_employees(),
                    NumberOfPartTimeEmployees: this.get_total_part_time_employees(),
                    EmployeePayroll: this.get_total_payroll(),
                    LaborerPayroll: 0,
                    SubcontractorCosts: subcontractorCosts,
                    PerformNewResidentialWork: performNewResidentialWork,
                    DescriptionOfOperations: this.get_operation_description(),

                    PrimaryAddress: {
                        Line1: primaryAddress.address,
                        Line2: primaryAddress.address2,
                        City: primaryAddress.city,
                        State: primaryAddress.territory,
                        Zip: primaryAddress.zip.toString()
                    },

                    MailingAddress: {
                        Line1: this.app.business.mailing_address,
                        Line2: this.app.business.mailing_address2,
                        City: this.app.business.mailing_city,
                        State: this.app.business.mailing_territory,
                        Zip: this.app.business.mailing_zip.toString()
                    },

                    GrossReceipts:[
                        {
                            Type: 'OneYearGrossReceipts',
                            Amount: this.policy.gross_sales.toString()
                        }
                    ],

                    InsuranceHistory: []
                },

                OptionalCoverages: [],

                Classifications: [
                    {
                        ClassCode: this.industry_code.cgl.toString(),
                        Percentage: 100
                    }
                ],

                QualifyingStatements: qualifyingStatements
            }

            // Send JSON to the insurer
            let quoteResult = null;
            try{
                quoteResult = await this.send_json_request(host, QUOTE_URL, JSON.stringify(data), token)
            }
            catch(error){
                log.error(`BTIS Submit Endpoint Returned Error ${util.inspect(error, false, null)}` + __location);
                this.reasons.push('Problem connecting to insurer');
                fulfill(this.return_error('error', "We have no idea what went wrong, but we're on it"));
            }

            // The result can be under either clearspring or victory, checking for success
            if (quoteResult.clearspring && quoteResult.clearspring.success === true || quoteResult.victory && quoteResult.victory.success === true) {

                const product = quoteResult.clearspring ? 'clearspring' : 'victory';
                const quoteInfo = quoteResult[product];

                try {
                    this.amount = quoteInfo.quote.results.total_premium;
                }
                catch (error) {
                    log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to retrieve quote amount.` + __location);
                    this.reasons.push('A quote was generated, but our API was unable to isolate it.');
                    fulfill(this.return_error('error', "Our bad. Something went wrong, but we're on it. Expect to hear from us"));
                    return;
                }

                // Grab the limits info
                try {
                    let limits_string = quoteInfo.quote.criteria.limits;

                    // Remove the commas
                    limits_string = limits_string.replace(/,/g, '');

                    // Break the limits into an array
                    const policy_limits = limits_string.split('/');

                    // Build out the limits how our system expects to see them
                    this.limits = {
                        '4': policy_limits[0],
                        '8': policy_limits[1],
                        '9': policy_limits[2]
                    };
                }
                catch (e) {
                    log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find limits.` + __location);
                }

                // Return the quote
                fulfill(this.return_result('referred_with_price'));
            }
            // Checking for referral with reasons
            if(quoteResult.clearspring && quoteResult.clearspring.success === false || quoteResult.victory && quoteResult.victory.success === false){
                const product = quoteResult.clearspring ? 'clearspring' : 'victory';
                const declinedInfo = quoteResult[product];

                declinedInfo.referral_reasons.forEach((reason) => {
                    this.reasons.push(reason);
                });
                fulfill(this.return_result('referred'));
            }

            // If we made it this far, they declined
            fulfill(this.return_result('declined'))
        });
    }
}