/* eslint-disable space-before-function-paren */
/* eslint-disable no-trailing-spaces */
/* eslint-disable eol-last */
/* eslint-disable function-paren-newline */
/* eslint-disable no-console */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */
const axios = require('axios');
const utility = require('../../../../../../shared/helpers/utility');
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

const legalEntityCodes = {
    "Government Entity": "FG",
    "Non-profit Corporation": "NP",
    "Unincorporated Association": "UA",
    "Estate": "ES",
    "Individual": "IN",
    "Corporation": "CP",
    "General Partnership": "PT",
    "Limited Partnership": "LP",
    "Trust": "TR",
    "Joint Venture": "JV",
    "Limited Liability Company": "LL",
    "Sole Propietorship": "SP"
}   

// Dedubctible by state (no deductables for WC)
const stateDeductables = {
    "AL": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500],     
    "AR": [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000],     
    "CO": [500, 1000, 1500, 2000, 2500, 5000, 10000, 13500],  
    "CT": [1000, 5000, 10000],
    "DE": [500],
    "FL": [500, 1000, 1500, 2000, 2500, 5000, 10000, 15000, 20000, 21000],  
    "GA": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10,000, 20000],
    "HI": [100, 150, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000],  
    "IA": [100, 150, 200, 250, 300, 400, 500, 1000, 1500, 2000, 2500],
    "IL": [1,000],
    "IN": [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 21000],
    "KS": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000],
    "KY": [100, 200, 300, 400, 500, 1000, 1500, 2500, 5000, 7500, 10000],
    "MA": [500, 1000, 2000, 2500, 5000],
    "MD": [500, 1500, 2500],
    "ME": [250, 500, 1000, 5000],
    "MN": [100, 150, 200, 250, 500, 1000, 1500, 2000, 2500, 5000, 10000, 25000, 50000],
    "MO": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000, 15000, 20000],
    "MT": [500, 1000, 1500, 2000, 2500, 5000, 10000],
    "NC": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000],
    "NE": [500, 1000, 1500, 2000, 2500],
    "NH": [500, 1000, 1500, 2000, 2500, 5000],
    "NM": [500, 1000, 1500, 2000, 2500, 5000, 10000],
    "NV": [100, 250, 500, 1000, 1500, 2000, 2500, 5000, 10000, 15000, 20000],
    "SC": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500],
    "SD": [500, 1000, 1500, 2000, 2500],
    "TX": [500, 1000, 1500, 2000, 2500, 5000, 10000, 25000],
    "UT": [500, 1000, 1500, 2000, 2500, 5000],
    "VA": [100, 250, 500, 1000, 2500, 5000, 7500, 10000],
    "WV": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 7500, 10000]
}

module.exports = class CnaWC extends Integration {

	/**
	 * Requests a quote from Employers. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an error if rejected
	 */
    async _insurer_quote() {

        const insurerSlug = 'cna';
        const insurer = await utility.getInsurer(insurerSlug);

        const business = this.app.business;
        const policy = this.app.policies[0]; // currently just ['WC']

        //TODO: Right now we're leaving this hard-coded.
        const nameInfoRefId = "N001";

        // Check to ensure we have NCCI codes available for every provided activity code.
        for (const location of this.app.business.locations) {
            for (const activityCode of location.activity_codes) {
                let ncciCode = null;
                if (insurer) {
                    ncciCode = await this.get_ncci_code_from_activity_code(insurer.id, location.territory, activityCode.id);
                } else {
                    return this.client_error(`CNA: We can't locate NCCI codes without a valid insurer. Slug used: ${insurerSlug}.`);
                }

                if (!ncciCode) {
                    return this.client_error(`CNA: We could not locate an NCCI code for one or more of the provided activities and territories: ${JSON.stringify(activityCode, null, 4)}`);
                }

                activityCode.ncciCode = `${ncciCode.code}${ncciCode.sub}`;
                activityCode.ncciCodeDescription = ncciCode.description;
            }
        }

        // Prepare limits (if CA, only accept 1,000,000/1,000,000/1,000,000)
        const limits = business.mailing_territory === "CA" ? 
            carrierLimits[carrierLimits.length - 1] : 
            this.getBestLimits(carrierLimits);
        if (!limits) {
            return this.client_autodeclined('CNA: Requested liability limits not supported.', {industryCode: this.industry_code.id});
        }

        /*
            TODO LIST: FIND OUT WHAT THESE VALUES ARE AND HOW TO GET THEM:
            - Policy - Power Unit (Number Units, Exposure in Monopolistic States): [0 - 999]; and YES; NO; | 100 YES (Ask Adam and Christen)
            |__> com.cna_NumPowerUnitsOwned.NumUnits.value
            |__> QuestionCd.value='com.cna_MonopolisticInd'.YesNoCd
            - NameInfo Id: ... | "N001"
        */

        // TODO: GO THROUGH DEFAULTED FIELDS IN TEMPLATE AND REMOVE OPTIONAL ONES, EXPLICITLY SET REQUIRED ONES (EVEN IF NO CHANGE)

        // =================================================================
        //                     FILL OUT REQUEST OBJECT
        // =================================================================

        // API Information
        wcRequest.SignonRq.SignonPswd.CustId.CustLoginId = "TALAGEAPI";
        wcRequest.SignonRq.ClientApp.Org = "TALAGE";
        wcRequest.SignonRq.ClientApp.Name = "API"

        // Transaction ID
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInq = [{
            RqUID: this.generate_uuid()
        }];

        // ====== Producer Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo.ContractNumber.value = "018297";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo.ProducerSubCode.value = "AGT";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo['com.cna_branchCode'][0].value = "010";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo['com.cna_branchLabel'][0].value = "AI";

        // ====== Agency API Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].ItemIdInfo.AgencyId.value = "018297-010"; // (reverse of producer-branch-code)

        // ====== General Business Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].CommlName.CommercialName.value = business.name;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].LegalEntityCd.value = legalEntityCodes[business.entity_type];
        
        delete wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].TaxIdentity;

        if (business.dba) {
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].SupplementaryNameInfo[0].SupplementaryNameCd.value = 'DBA';
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].SupplementaryNameInfo[0].SupplementaryName.value = business.dba;
        } else {
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].SupplementaryNameInfo = [];
        }
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.NameInfo[0].id = nameInfoRefId

        // ====== Address Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].Addr1.value = `${business.mailing_address} ${business.mailing_address2}`.trim();
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].City.value = business.mailing_city;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].StateProvCd.value = business.mailing_territory;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].PostalCode.value = business.mailing_zipcode;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Addr[0].County.value = business.mailing_territory; // TODO: Should be actual county information when we start storing that

        // ====== Business Contact Information ======
        // NOTE: may need phone number to be in the format "+1-812-2222222"
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Communications.PhoneInfo[0].PhoneNumber.value = `${business.contacts[0].phone}`;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Communications.EmailInfo[0].EmailAddr.value = business.contacts[0].email;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo.Communications.WebsiteInfo[0].WebsiteURL.value = business.website;

        // ====== Insured Or Principle Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo.InsuredOrPrincipalRoleCd[0].value = "Insured";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo.BusinessInfo.SICCd.value = this.industry_code.sic;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo.BusinessInfo.NAICSCd.value = this.industry_code.naics;
        if (this.industry_code.attributes) {
            if (this.industry_code.attributes.SICCd) {
                wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo.BusinessInfo.SICCd.value = this.industry_code.attributes.SICCd;
            }

            if (this.industry_code.attributes.NAICSCd) {
                wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo.BusinessInfo.NAICSCd.value = this.industry_code.attributes.NAICSCd;
            }
        }

        // ====== Commercial Policy Information ======
        const durationPeriod = policy.expiration_date.diff(policy.effective_date, 'months');
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.LOBCd.value = "WORK";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.NAICCd.value =
            this.industry_code.attributes && this.industry_code.attributes.NAICSCd ? 
                this.industry_code.attributes.NAICSCd : 
                this.industry_code.naics;

        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ControllingStateProvCd.value = policy.primary_territory;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ContractTerm.EffectiveDt.value = policy.effective_date.format('YYYY-MM-DD');
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ContractTerm.ExpirationDt.value = policy.expiration_date.format('YYYY-MM-DD');
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ContractTerm.DurationPeriod.NumUnits.value = durationPeriod;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.ContractTerm.DurationPeriod.UnitMeasurementCd.value = "MON";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.NumLosses.value = 0; // we don't store this information, default to 0
        
        // Should properly fill this out IFF we support history of previous policies
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.OtherOrPriorPolicy[0].InsurerName.value = "None";

        // ====== Supplemental Commercial Policy Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement.PolicyTypeCd.value = "SPC";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement.LengthTimeInBusiness.NumUnits.value = this.get_years_in_business();
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement.OtherSafetyProgramInd.value = false;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement['com.cna_LengthTimeIndustyManagement'].NumUnits = {};
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy.CommlPolicySupplement['com.cna_NumPowerUnitsOwned'].NumUnits.value = 0;

        // ====== Location Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Location = this.getLocations();

        // ====== Workers' Comp Line of Business Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.LOBCd.value = "WORK";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].StateProvCd.value = business.mailing_territory;
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].NumEmployees.value = this.get_total_employees();

        // delete optional fields (not necessary for quoting)
        delete wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.CurrentTermAmt; // .value | 10000
        delete wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness['com.cna_PremiumTypeCd']; // .value | "EST"
        delete wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness['com.cna_AnniversaryRatingDt']; // .value | "2020-09-27"

        // MOVING THIS CODE AWAY vvvvvv
        // if we have the rating classification code, set it, otherwise delete the property
        const keys = Object.keys(this.insurer_wc_codes);
        if (keys.length > 0) {
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].WorkCompRateClass[0].RatingClassificationCd.value = this.insurer_wc_codes[keys[0]];
        } else {
            delete wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].WorkCompRateClass[0].RatingClassificationCd;
        }

        // if we have the rating classification code description, set it, otherwise delete the property
        if (this.industry_code && this.industry_code.description) {
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].WorkCompRateClass[0].RatingClassificationDescCd.value = this.industry_code.description;
        } else {
            delete wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].WorkCompRateClass[0].RatingClassificationDescCd;
        }

        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].WorkCompRateClass[0].Exposure = this.get_total_payroll();
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].LocationRef = "L0";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].NameInfoRef = nameInfoRefId;

        if (keys.length > 0) {
            const governingClassCd = this.insurer_wc_codes[keys[0]].substring(0, this.insurer_wc_codes[keys[0]].length - 1);
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].GoverningClassCd = governingClassCd;
        } else {
            delete wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].GoverningClassCd;
        }
        console.log(JSON.stringify(this.getWorkCompRateStates(), null, 4));
        process.exit(-1);
        // MOVING THIS CODE AWAY ^^^^^^

        // ====== Coverage Information ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.CommlCoverage[0].CoverageCd.value = "WCEL";
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.CommlCoverage[0].Limit = this.getLimits(limits);

        // ====== Questions ======
        wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness.QuestionAnswer = this.getQuestionArray();

        // =================================================================
        //                        START QUOTE PROCESS
        // =================================================================

        // authenticate with CNA before running quote
        const jwt = await this.auth();
        if (jwt.includes("Error")) {
            this.client_connection_error(__location, jwt);
        }

        // create request headers using auth access token (jwt)
        const headers = {
            'authorization': `Bearer ${jwt.trim()}`,
            'branch-producer-cd': '010018297',
            'agentid': 'TALAGAPI',
            'content-type': 'application/json'
        }

        let result = null;
        try {

            console.log("=================== QUOTE REQUEST ===================");
            console.log(JSON.stringify(wcRequest, null, 4));
            console.log("=================== QUOTE REQUEST ===================");

            result = await this.send_json_request(HOST, QUOTE_URL, JSON.stringify(wcRequest), headers, "POST");
        }
        catch (error) {
            console.log("=================== QUOTE ERROR ===================");
            const errorJSON = JSON.parse(error.response);
            console.log(JSON.stringify(errorJSON, null, 4));
            console.log("=================== QUOTE ERROR ===================");

            let errorMessage = "";
            try {
                errorMessage = `CNA: status code ${error.httpStatusCode}: ${errorJSON.InsuranceSvcRs[0].WorkCompPolicyQuoteInqRs[0].MsgStatus.MsgStatusDesc.value}`;
            } catch (e) {
                console.warn(`CNA: Error object doesn't have expected description path. ${e}.`);
            }

            errorMessage = errorMessage ? errorMessage : "CNA: An error occurred while attempting to quote.";
            return this.client_declined(errorMessage);
        }

        console.log("=================== QUOTE RESULT ===================");
        console.log(JSON.stringify(result, null, 4));
        console.log("=================== QUOTE RESULT ===================");

        let quoteNumber = null;
        let premium = null;
        let quoteLimits = {};
        let quoteLetter = null;
        let quoteMIMEType = null;
        let policyStatus = null;

        const response = result.InsuranceSvcRs[0].WorkCompPolicyQuoteInqRs[0];
        switch (response.MsgStatus.MsgStatusCd.value.toLowerCase()) {
            case "dataerror":
            case "datainvalid":
            case "error":
            case "login_error":
            case "general failure":
                return this.client_error(`CNA: ${response.MsgStatus.MsgStatusDesc.value}`);
            case "rejected": 
                return this.client_declined(`CNA: ${response.MsgStatus.MsgStatusDesc.value}`);
            case "in_progress":
                return this.client_error(`CNA: The quote request did not complete.`);
            case "351":
                return this.client_declined(`CNA: The quote request is not available.`);
            case "success":
            case "successwithinfo":
            case "successwithchanges":
            case "resultpendingoutofband":
                const policySummary = response.PolicySummaryInfo;
                policyStatus = policySummary.PolicyStatusCd.value;
                switch (policySummary.PolicyStatusCd.value.toLowerCase()) {
                    case "quotednotbound":
                    case "issued":
                        // get quote number (optional)
                        try {
                            quoteNumber = response.CommlPolicy.QuoteInfo.CompanysQuoteNumber.value;
                        } catch (e) {
                            console.warn(`CNA: Couldn't parse quote number: ${e}`);
                        }

                        // get premium (required)
                        try {
                            premium = policySummary.FullTermAmt.Amt.value;
                        } catch (e) {
                            return this.client_error(`CNA: Couldn't parse premium from CNA response: ${e}.`);
                        }

                        // get limits (required)
                        try {
                            response.WorkCompLineBusiness.CommlCoverage[0].Limit.forEach(limit => {
                                switch (limit.LimitAppliesToCd[0].value) {
                                    case 'BIEachOcc':
                                        quoteLimits[1] = limit.FormatInteger.value;
                                        break;
                                    case 'DisEachEmpl':
                                        quoteLimits[2] = limit.FormatInteger.value;
                                        break;
                                    case 'DisPol':
                                        quoteLimits[3] = limit.FormatInteger.value;
                                        break;
                                    default:
                                        console.warn(`CNA: Unexpected limit found in quote response. ${__location}`);
                                        break;
                                }
                            });
                        } catch (e) {
                            return this.client_error(`CNA: Couldn't parse one or more limit values from response: ${e}.`);
                        }
                        
                        // get quote letter (optional) and quote MIME type (optional)
                        let proposalURL = response.MsgStatus.ChangeStatus.find(change => 
                            change.IdRef.hasOwnProperty("AttachmentTypeCd") && change.IdRef.AttachmentTypeCd.value === "QuoteProposal");
                        if (proposalURL) {
                            proposalURL = proposalURL.IdRef.WebsiteURL.value;
                            const [quoteHost, quotePath] = this.splitUrl(proposalURL);

                            let quoteResult = null;
                            try {
                                quoteResult = await this.send_json_request(quoteHost, quotePath, null, headers, "GET");
                            } catch (e) {
                                console.warn(`CNA: The request to retrieve the quote proposal letter failed: ${e}.`);
                            }

                            try {
                                quoteLetter = quoteResult.InsuranceSvcRs[0].ViewInqRs[0].FileAttachmentInfo[0]["com.cna.AttachmentData"].value;
                            } catch (e) {
                                console.warn(`CNA: There was an error parsing the quote letter: ${e}.`);
                            }

                            try {
                                quoteMIMEType = quoteResult.InsuranceSvcRs[0].ViewInqRs[0].FileAttachmentInfo[0].MIMEEncodingTypeCd.value;
                            } catch (e) {
                                console.warn(`CNA: There was an error parsing the quote MIME type: ${e}.`);
                            }

                        } else {
                            console.warn(`CNA: Couldn't find proposal URL with successful quote status: ${response.MsgStatus.MsgStatusCd.value}. Change Status': ${JSON.stringify(response.MsgStatus.ChangeStatus, null, 4)}`);
                        }
                        break;
                    case "notquotednotbound":
                        return this.client_declined(`CNA: Application was not quoted or bound.`);
                    default: 
                        return this.client_error(`CNA: Response contains an unrecognized policy status: ${policySummary.PolicyStatusCd.value}`);
                } // end inner switch
                break;
            default: 
                return this.client_error(`CNA: Got an unknown quote status "${response.MsgStatus.MsgStatusCd.value}": "${response.MsgStatus.MsgStatusDesc.value}".`);
        } // end outer switch

        if (policyStatus) {
            // will either be issued or quotednotbound
            if (policyStatus === "issued") { 
                return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType);
            } else {
                return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType);
            }
        } else {
            return this.client_error(`CNA: Response doesn't include a policy status code.`);
        }
    }

    // transform our business locations array into location objects array to be inserted into the WC request Object
    getLocations() {
        // iterate over each location and transform it into a location object
        return this.app.business.locations.map((location, i) => { 
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
                id: `L${i}` 
            }
        });
    }

    /*
    "WorkCompRateState": [
       {
            "StateProvCd": {
                "value": "CA"
            },
            "WorkCompLocInfo": [
                {
                    "NumEmployees": {
                        "value": 4
                    },
                    "WorkCompRateClass": [
                        {
                            "RatingClassificationCd": {
                                "value": "8008A"
                            },
                            "Exposure": "66000",
                            "RatingClassificationDescCd": {
                                "value": "STORES-CLOTHING/DRY GOODS-RETAIL"
                            }
                        }
                    ],
                    "LocationRef": "L1",
                    "NameInfoRef": "N001"
                }
            ],
            "GoverningClassCd": {
                "value": "8008"
            }
        }
    ]
    */
    getWorkCompRateStates() {
        return this.app.business.locations;
    }

    // transform our policy limit selection into limit objects array to be inserted into the WC Request Object
    getLimits(limits) {
        const limitArray = [];
        
        if (typeof limits === 'string') {
            limits = limits.split('/');
        }

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
                questionAnswerObj.YesNoCd = { value: question.answer.toUpperCase() } :
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
            return `CNA Error: Could Not Authorize: ${err}`;
        }
    }

    splitUrl(url) {
        if (!url) {
            console.warn(`CNA: Supplied url is not defined and cannot be split into host and path.`);
            return [];
        }

        let host = "";
        let path = "";
        let protocalIndex = 0;

        try {
            if (url.indexOf("https") !== -1) {
                protocalIndex = url.indexOf("https") + 8;
            } else if (url.indexOf("http") !== -1) {
                protocalIndex = url.indexOf("http") + 7;
            }
            const splitIndex = url.indexOf("com") + 3;

            host = url.substring(protocalIndex, splitIndex);
            path = url.substring(splitIndex, url.length);
        } catch (e) {
            console.warn(`CNA: There was an error splitting the supplied url: ${e}.`);
        }

        return [host, path];
    }
}
