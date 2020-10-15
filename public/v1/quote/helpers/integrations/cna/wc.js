/* eslint-disable space-before-function-paren */
/* eslint-disable no-trailing-spaces */
/* eslint-disable eol-last */
/* eslint-disable function-paren-newline */
/* eslint-disable no-console */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */
const axios = require('axios');
const util = require('util');
// const cnaWCTemplate = require('jsrender').templates('./public/v1/quote/helpers/integrations/cna/wc_request.xmlt');
// const converter = require('xml-js');
const Integration = require('../Integration.js');

// import template WC request JSON object. Fields not set below are defaulted to values in the template
const wcRequest = require('./wc_request.json');

/**
 * Workers' Comp Integration for CNA
 */

'use strict';

/*
 * Quote URL
 *  Required Headers: 
 *  branch-producer-cd - combination of branch code and producer code (test: 010000000)
 *  agentId - (test: TEST19)
 *  Content-Type - application/json
 *  Accept - application/json
*/
const HOST = 'drt-apis.cna.com';
const QUOTE_URL = '/policy/small-business/full-quote';
const AUTH_URL = '/security/external-token/small-business';

//TODO: Ensure this is the proper order
const LIMIT_CODES = [
    'BIEachOcc',
    'DisPol',
    'DisEachEmpl'
];

const carrierLimits = [
    '100000/500000/100000',
    '100000/1000000/100000',
    '500000/500000/500000',
    '500000/1000000/500000',
    '1000000/1000000/1000000' // if state = CA, this is ONLY option
]

module.exports = class CnaWC extends Integration {

	/**
	 * Requests a quote from Employers. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an error if rejected
	 */
    async _insurer_quote() {

        const business = this.app.business;
        const policy = this.app.policies[0]; // currently just ['WC']

        // Check to ensure we have NCCI codes available for every provided activity code.
        for (const location of this.app.business.locations) {
            for (const activityCode of location.activity_codes) {
                const ncciCode = await this.get_ncci_code_from_activity_code(location.territory, activityCode.id);
                if (!ncciCode) {
                    return this.client_error('We could not locate an NCCI code for one or more of the provided activities.', {activityCode: activityCode.id});
                }
                activityCode.ncciCode = `${ncciCode.code}${ncciCode.sub}`;
                activityCode.ncciCodeDescription = ncciCode.description;
            }
        }

        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            return this.client_autodeclined('The insurer does not support the request liability limits', {industryCode: this.industry_code.id});
        }

        // =================================================================
        //                     FILL OUT REQUEST OBJECT
        // =================================================================

        /*
         * NOTE: Commented Lines below are defaulted from the template.
         * They Follow the pattern: Property Path | Default Value
        */

        // API Information
        wcRequest.SignonRq.SignonPswd.CustId.CustLoginId = "TALAGEAPI";
        wcRequest.SignonRq.ClientApp.Org = "TALAGE";
        // wcRequest.SignonRq.ClientApp.Name | "API"

        // ====== Producer Information ======
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo.ContractNumber.value | "018297"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo.ProducerSubCode.value | "AGT"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo['com.cna_branchCode'][0].value | "010"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo['com.cna_branchLabel'][0].value | "AI"

        // ====== Agency API Information ======
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].ItemIdInfo.AgencyId.value | "018297-010" (reverse of producer-branch-code)

        // ====== General Business Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].CommlName.CommercialName.value = business.name;
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].LegalEntityCd.value | "CP"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].TaxIdentity[0].TaxIdTypeCd.value | "FEIN"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].TaxIdentity[0].TaxId.value | "595976858"
        // TODO: Determine if these are required. If not, then delete these properties unless we have a value for business.dba???
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].SupplementaryNameInfo[0].SupplementaryNameCd.value | "DBA"
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].SupplementaryNameInfo[0].SupplementaryName.value = business.dba;
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].SupplementaryNameInfo[0].SupplementaryNameCd | 'DBA'
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].SupplementaryNameInfo[0].id | "N001"

        // ====== Address Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].Addr1.value = `${business.mailing_address} ${business.mailing_address2}`.trim();
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].City.value = business.mailing_city;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].StateProvCd.value = business.mailing_territory;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].PostalCode.value = business.mailing_zipcode;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].County.value = business.mailing_territory; // TODO: Should be full state name

        // ====== Business Contact Information ======
        // TODO: may need to be in format "+1-812-2222222"
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Communications.PhoneInfo[0].PhoneNumber.value = `${business.contacts[0].phone}`;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Communications.EmailInfo[0].EmailAddr.value = business.contacts[0].email;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Communications.WebsiteInfo[0].WebsiteURL.value = business.website;

        // ====== Insured Or Principle Information ======
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo.InsuredOrPrincipalRoleCd[0].value | "Insured"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo.BusinessInfo.SICCd.value | "55550_50" 
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo.BusinessInfo.NAICSCd.value | "315240"

        // ====== Commercial Policy Information ======
        const durationPeriod = policy.expiration_date.diff(policy.effective_date, 'months');
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.LOBCd.value = "WORK";
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.NAICCd.value | "448120"
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ControllingStateProvCd.value = policy.appBusiness.primary_territory;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ContractTerm.EffectiveDt.value = policy.effective_date.format('YYYY-MM-DD');
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ContractTerm.ExpirationDt.value = policy.expiration_date.format('YYYY-MM-DD');
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ContractTerm.DurationPeriod.NumUnits.value = durationPeriod;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ContractTerm.DurationPeriod.UnitMeasurementCd.value = "MON";
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.NumLosses.value | 0
        // Should properly fill this out IFF we support history of previous policies
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.OtherOrPriorPolicy[0].InsurerName.value = "None";

        // ====== Supplemental Commercial Policy Information ======
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement.PolicyTypeCd.value | "SPC"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement.LengthTimeInBusiness.NumUnits.value | 1
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement.OtherSafetyProgramInd.value | false
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement['com.cna_LengthTimeIndustyManagement'].NumUnits | {}
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement['com.cna_NumPowerUnitsOwned'].NumUnits.value | 0

        // ====== Location Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Location = this.getLocations();

        // ====== Workers' Comp Line of Business Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.LOBCd.value = "WORK";
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.CurrentTermAmt.value | 10000
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness['com.cna_PremiumTypeCd'].value | "EST"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness['com.cna_AnniversaryRatingDt'].value | "2020-09-27"
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].StateProvCd.value = business.mailing_territory;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].NumEmployees.value = this.get_total_employees();
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].WorkCompRateClass[0].RatingClassificationCd.value | "8008A"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].WorkCompRateClass[0].RatingClassificationDescCd.value | "STORES-CLOTHING/DRY GOODS-RETAIL"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].WorkCompRateClass[0].Exposure | "66000"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].LocationRef | "L1"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].NameInfoRef | "N001"
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].GoverningClassCd | "8008"

        // ====== Coverage Information ======
        // wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.CommlCoverage[0].CoverageCd.value | "WCEL"
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.CommlCoverage[0].Limit = this.getLimits(limits);

        // ====== Questions ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.QuestionAnswer = this.getQuestionArray();

        // =================================================================
        //                        START QUOTE PROCESS
        // =================================================================

        // authenticate with CNA before running quote
        const jwt = await this.auth();
        if (jwt === '') {
            process.exit(-1);
        }

        // create request headers using auth access token (jwt)
        const headers = {
            'authorization': `Bearer ${jwt.trim()}`,
            'branch-producer-cd': '010018297',
            'agentid': 'TALAGAPI'
        }

        let result = null;
        try {
            result = await this.send_json_request(HOST, QUOTE_URL, JSON.stringify(wcRequest), headers, "POST");
        }
        catch (error) {
            log.error(`CNA Quote Endpoint Returned Error: ${util.inspect(error.response.data.InsuranceSvcRs[0], false, null)}` + __location);
            const errorString = JSON.stringify(error.response.data.InsuranceSvcRs[0]);
            if (errorString.indexOf("No Carrier found for passed state and class code") > -1) {
                this.reasons.push('CNA response with: No Carrier found for passed state and class code ');
                return this.return_result('declined');
            }
            else {
                this.reasons.push('Problem connecting to insurer CNA: ' + error);
                return this.return_result('autodeclined');
            }
        }

        console.log("=================== QUOTE RESULT ===================");
        console.log(JSON.stringify(result));
        console.log("=================== QUOTE RESULT ===================");

        // TODO: Extract CompanysQuoteNumber 
        // - look at data from PolicyStatusCd
        // - look for url param to get quote letter, otherwise hit https://drt-apis.cna.com/policy/small-business/quote-proposal-letter/8738376/options/00/proposals
        // -- where 8738376 = policy number(?) and 00 = ???

        return this.return_result('referred');
    }

    // transform our business locations array into location objects array to be inserted into the WC request Object
    getLocations() {
        // iterate over each location and transform it into a location object
        return this.app.business.locations.map(location => {
            return {
                ItemIdInfo: {
                    AgencyId: {
                        value: `${this.app.agencyLocation.agencyId}`
                    }
                },
                Addr: {
                    AddrTypeCd: [{
                        value: "MailingAddress"
                    }],
                    Addr1: {
                        value: `${location.address} ${location.address2}`.trim()
                    },
                    City: {
                        value: location.city
                    },
                    StateProvCd: {
                        value: location.territory
                    },
                    PostalCode: {
                        value: location.zipcode
                    }
                },
                id: "L1" // What is this? 
            }
        });
    }

    // transform our policy limit selection into limit objects array to be inserted into the WC Request Object
    getLimits(limits) {
        // split the policy limits string into individual limits array
        const limitArray = [];

        // for each limit, create a limit object with the limit value and applyTo code
        limits.forEach((limit, i) => {
            limitArray.push({
                FormatInteger: {
                    value: limit
                },
                LimitAppliesToCd: [{
                    value: LIMIT_CODES[i]
                }]
            }); 
        });

        return limitArray;
    }

    // transform our questions into question objects array to be inserted into the WC Request Object
    getQuestionArray() {
        // convert question map to array
        const questionArray = Object.values(this.questions);

        // filtering questions to only those answered
        const answeredQuestions = questionArray.filter(question => question.answer); // answer !== null

        // mapping answered questions to request question objects
        return answeredQuestions.map(question => {
            let questionAnswerObj = {
                QuestionCd: {
                    value: this.question_identifiers[question.id]
                }
            };
            question.type === 'Yes/No' ? 
                questionAnswerObj.YesNoCd = { value: question.answer } :
                questionAnswerObj['com.cna_OptionCd'] = { value: question.answer };

            return questionAnswerObj;
        });
    }

    async auth() {
        const data = {
            "id": "11248"
        }
        const headers = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic VEFMQUdBUEk6VEdhOTU4M2h3OTM3MTghIw=='
            }
        }
        try {
            // const result = await this.send_json_request(HOST, AUTH_URL, JSON.stringify(data), headers, 'POST', false);

            const result = await axios.post('https://drt-apis.cna.com/security/external-token/small-business', data, headers);
            return result.data.access_token;
        } catch (err) {
            log.error(`CNA API - Could Not Authorize: ${err}`);
            return '';
        }
    }
}
