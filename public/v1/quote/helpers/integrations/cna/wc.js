/* eslint-disable prefer-const */
/* eslint-disable multiline-ternary */
/* eslint-disable array-element-newline */
/* eslint-disable space-before-function-paren */
/* eslint-disable no-trailing-spaces */
/* eslint-disable eol-last */
/* eslint-disable function-paren-newline */
/* eslint-disable no-console */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */
const axios = require('axios');
const moment = require('moment');

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

//TODO: Implement url / cred swap between dev and prod 
const HOST = 'drt-apis.cna.com';
const QUOTE_URL = '/policy/small-business/full-quote';
const AUTH_URL = '/security/external-token/small-business';

const LIMIT_CODES = [
    'BIEachOcc',
    'DisPol',
    'DisEachEmpl'
];

const explanationQuestions = [
    "com.cna_WORK20293"
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
    "Sole Proprietorship": "SP",
    "Association": "AS",
    "Partnership": "PA",
    "Other": "OT"
}   

// legal entities that require SSN
const ssnLegalEntities = [
    "SP",
    "IN"
];

// Deductible by state (no deductables for WC, keeping for GL/BOP)
const stateDeductables = {
    "AL": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500],     
    "AR": [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000],     
    "CO": [500, 1000, 1500, 2000, 2500, 5000, 10000, 13500],  
    "CT": [1000, 5000, 10000],
    "DE": [500],
    "FL": [500, 1000, 1500, 2000, 2500, 5000, 10000, 15000, 20000, 21000],  
    "GA": [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000, 20000],
    "HI": [100, 150, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000],  
    "IA": [100, 150, 200, 250, 300, 400, 500, 1000, 1500, 2000, 2500],
    "IL": [1000],
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
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
        this.requiresInsurerActivityClassCodes = true;
    }

	/** 
	 * Requests a quote from Employers. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an error if rejected
	 */
    async _insurer_quote() {
        const business = this.app.business;
        const policy = this.app.policies[0]; // currently just ['WC']

        // NOTE: Right now this is hard-coded to the first reference
        const nameInfoRefId = "N000";

        let agencyId = null;
        try {
            agencyId = this.app.agencyLocation.insurers[this.insurer.id].agency_id.split("-");
        }
        catch (e) {
            return this.client_error(`CNA: There was an error splitting the agency_id for insurer ${this.insurer.id}. ${e}.`);
        }
        if (!Array.isArray(agencyId) || agencyId.length !== 2) {
            return this.client_error(`CNA: Could not generate branch code and contract number from Agency ID ${this.app.agencyLocation.agencyId}.`);
        }

        const branchCode = agencyId[0];
        const contractNumber = agencyId[1];

        // Check to ensure we have NCCI codes available for every provided activity code.
        for (const location of this.app.business.locations) {
            for (const activityCode of location.activity_codes) {
                const ncciCode = this.insurer_wc_codes[location.territory + activityCode.id];
                if (!ncciCode) {
                    return this.client_error(`CNA: Unable to locate an NCCI code for activity code ${activityCode.id}.`);
                }
                activityCode.ncciCode = ncciCode;
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
            TODO LIST: 
            
            FIND OUT WHAT THESE VALUES ARE AND HOW TO GET THEM:
            - Policy - Power Unit (Number Units, Exposure in Monopolistic States): [0 - 999]; and YES; NO; | 100 YES (Ask Adam and Christen)
            |__> com.cna_NumPowerUnitsOwned.NumUnits.value
            |__> QuestionCd.value='com.cna_MonopolisticInd'.YesNoCd

            GO THROUGH DEFAULTED FIELDS IN TEMPLATE AND REMOVE OPTIONAL ONES, EXPLICITLY SET REQUIRED ONES (EVEN IF NO CHANGE)

            REMOVE UNNECESSARY OR TOO-VERBOSE LOGGING (WHEN FINISHED TESTING)
        */

        // =================================================================
        //                     FILL OUT REQUEST OBJECT
        // =================================================================

        log.debug("CNA WC starting to create submission JSON " + __location)
        
        // API Information
        try {
            wcRequest.SignonRq.SignonPswd.CustId.CustLoginId = "TALAGEAPI";
            wcRequest.SignonRq.ClientApp.Org = "TALAGE";
            wcRequest.SignonRq.ClientApp.Name = "API"

            // Transaction ID
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInq = [{RqUID: this.generate_uuid()}];

            // ====== Producer Information ======
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo.ContractNumber.value = "018297";
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo.ProducerSubCode.value = "AGT";
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo['com.cna_branchCode'][0].value = "010";
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Producer[0].ProducerInfo['com.cna_branchLabel'][0].value = "AI";

            // ====== Agency API Information ======
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].ItemIdInfo.AgencyId.value = `${contractNumber}-${branchCode}`;

        }
        catch (err) {
            return this.client_error(`CNA WC JSON processing error ${err} ` + __location);
        }

        // ====== General Business Information ======
        try {
            // eslint-disable-next-line prefer-const
            const generalPartyInfo = wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].GeneralPartyInfo;
            generalPartyInfo.NameInfo[0].CommlName.CommercialName.value = business.name;
            generalPartyInfo.NameInfo[0].LegalEntityCd.value = legalEntityCodes[business.entity_type];
        
            generalPartyInfo.NameInfo[0].TaxIdentity = this.getTaxIdentity();
            
            if (business.dba) {
                generalPartyInfo.NameInfo[0].SupplementaryNameInfo[0].SupplementaryNameCd.value = 'DBA';
                generalPartyInfo.NameInfo[0].SupplementaryNameInfo[0].SupplementaryName.value = business.dba;
            }
            else {
                generalPartyInfo.NameInfo[0].SupplementaryNameInfo = [];
            }
            generalPartyInfo.NameInfo[0].id = nameInfoRefId

            // if legal entity is defined and is one that requires an SSN, provide name information
            if (generalPartyInfo.NameInfo[0].LegalEntityCd.value && ssnLegalEntities.includes(generalPartyInfo.NameInfo[0].LegalEntityCd.value)) {
                generalPartyInfo.NameInfo[0].PersonName = {
                    GivenName: {
                        value: this.app.applicationDocData.contacts[0].firstName
                    },
                    Surname: {
                        value: this.app.applicationDocData.contacts[0].lastName
                    }
                }
            }

            // ====== Address Information ======
            generalPartyInfo.Addr[0].Addr1.value = `${business.mailing_address} ${business.mailing_address2}`.trim();
            generalPartyInfo.Addr[0].City.value = business.mailing_city;
            generalPartyInfo.Addr[0].StateProvCd.value = business.mailing_territory;
            generalPartyInfo.Addr[0].PostalCode.value = business.mailing_zipcode;
            generalPartyInfo.Addr[0].County.value = business.mailing_territory; // TODO: Should be actual county information when we start storing that

            // ====== Business Contact Information ======
            generalPartyInfo.Communications.PhoneInfo[0].PhoneNumber.value = `${business.contacts[0].phone}`;
            generalPartyInfo.Communications.EmailInfo[0].EmailAddr.value = business.contacts[0].email;
            generalPartyInfo.Communications.WebsiteInfo[0].WebsiteURL.value = business.website;

        }
        catch (err) {
            return this.client_error(`CNA WC JSON processing error ${err} ` + __location);
        }
       
        // ====== Insured Or Principle Information ======
        try {
            let insuredOrPrincipalInfo = wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].InsuredOrPrincipal[0].InsuredOrPrincipalInfo;
            if (!this.industry_code) {
                log.error(`CNA WC missing this.industry_code` + __location);
                // might be mapping issue. industry code table has what we need. (SQL in integration.js does a join)
                // this.app.applicationDocData as the industryCode.
            }
            insuredOrPrincipalInfo.InsuredOrPrincipalRoleCd[0].value = "Insured";
            insuredOrPrincipalInfo.BusinessInfo.SICCd.value = this.industry_code.sic;
            insuredOrPrincipalInfo.BusinessInfo.NAICSCd.value = this.industry_code.naics;

            if (this.industry_code.attributes) {
                if (this.industry_code.attributes.SICCd) {
                    insuredOrPrincipalInfo.BusinessInfo.SICCd.value = this.industry_code.attributes.SICCd;
                }
                else {
                    log.error(`CNA WC missing this.industry_code.attributes.SICCd ${JSON.stringify(this.industry_code)}` + __location)
                }

                if (this.industry_code.attributes.NAICSCd) {
                    insuredOrPrincipalInfo.BusinessInfo.NAICSCd.value = this.industry_code.attributes.NAICSCd;
                }
                else {
                    log.error(`CNA WC missing this.industry_code.attributes.NAICSCd ${JSON.stringify(this.industry_code)}` + __location)
                }
            }
            else {
                log.error(`CNA WC missing this.industry_code.attributes needed ${JSON.stringify(this.industry_code)}` + __location)
            }

        }
        catch (err) {
            return this.client_error(`CNA WC JSON processing error ${err} ` + __location);
        }

        try {
            // ====== Commercial Policy Information ======
            const commlPolicy = wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].CommlPolicy;
            const durationPeriod = policy.expiration_date.diff(policy.effective_date, 'months');
            commlPolicy.LOBCd.value = "WORK";
            commlPolicy.NAICCd.value =
                this.industry_code.attributes && this.industry_code.attributes.NAICSCd ? 
                    this.industry_code.attributes.NAICSCd : 
                    this.industry_code.naics;

            commlPolicy.ControllingStateProvCd.value = policy.primary_territory;
            commlPolicy.ContractTerm.EffectiveDt.value = policy.effective_date.format('YYYY-MM-DD');
            commlPolicy.ContractTerm.ExpirationDt.value = policy.expiration_date.format('YYYY-MM-DD');
            commlPolicy.ContractTerm.DurationPeriod.NumUnits.value = durationPeriod;
            commlPolicy.ContractTerm.DurationPeriod.UnitMeasurementCd.value = "MON";
            commlPolicy.NumLosses.value = this.app.applicationDocData.claims.length; 
            
            // Should properly fill this out IFF we support history of previous policies
            commlPolicy.OtherOrPriorPolicy[0].InsurerName.value = "None";

            // ====== Supplemental Commercial Policy Information ======
            commlPolicy.CommlPolicySupplement.PolicyTypeCd.value = "SPC";
            commlPolicy.CommlPolicySupplement.LengthTimeInBusiness.NumUnits.value = this.get_years_in_business();
            commlPolicy.CommlPolicySupplement.OtherSafetyProgramInd.value = false;
            commlPolicy.CommlPolicySupplement['com.cna_LengthTimeIndustyManagement'].NumUnits = {};
            commlPolicy.CommlPolicySupplement['com.cna_NumPowerUnitsOwned'].NumUnits.value = 0;

            if (this.app.applicationDocData.claims.length > 0) {
                commlPolicy.Loss = this.getLosses();
            }

            // ====== Location Information ======
            wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].Location = this.getLocations();

            // ====== Workers' Comp Line of Business Information ======
            const WorkCompLineBusiness = wcRequest.InsuranceSvcRq[0].WorkCompPolicyQuoteInqRq[0].WorkCompLineBusiness;
            WorkCompLineBusiness.LOBCd.value = "WORK";
            WorkCompLineBusiness.WorkCompRateState[0].StateProvCd.value = business.mailing_territory;
            WorkCompLineBusiness.WorkCompRateState[0].WorkCompLocInfo[0].NumEmployees.value = this.get_total_employees();

            // delete optional fields (not necessary for quoting)
            delete WorkCompLineBusiness.CurrentTermAmt; // .value | 10000
            delete WorkCompLineBusiness['com.cna_PremiumTypeCd']; // .value | "EST"
            delete WorkCompLineBusiness['com.cna_AnniversaryRatingDt']; // .value | "2020-09-27"

            WorkCompLineBusiness.WorkCompRateState = this.getWorkCompRateStates();

            // ====== Coverage Information ======
            WorkCompLineBusiness.CommlCoverage[0].CoverageCd.value = "WCEL";
            WorkCompLineBusiness.CommlCoverage[0].Limit = this.getLimits(limits);

            // ====== Questions ======
            WorkCompLineBusiness.QuestionAnswer = this.getQuestionArray();

        }
        catch (err) {
            return this.client_error(`CNA WC JSON processing error ${err} ` + __location);
        }

        // =================================================================
        //                        START QUOTE PROCESS
        // =================================================================

        // authenticate with CNA before running quote
        const jwt = await this.auth();
        if (jwt.includes("Error")) {
            log.error(jwt);
            this.client_connection_error(__location, jwt);
        }

        // create request headers using auth access token (jwt)
        const headers = {
            'authorization': `Bearer ${jwt.trim()}`,
            'branch-producer-cd': "010018297",
            'agentid': 'TALAGAPI',
            'content-type': 'application/json'
        }

        let result = null;

        try {

            log.debug("=================== QUOTE REQUEST ===================");
            log.debug("CNA request: " + JSON.stringify(wcRequest, null, 4));
            log.debug("=================== QUOTE REQUEST ===================");
            result = await this.send_json_request(HOST, QUOTE_URL, JSON.stringify(wcRequest), headers, "POST");
        }
        catch (error) {
            let errorJSON = null;
            try {
                errorJSON = JSON.parse(error.response);
            }
            catch (e) {
                log.error(`There was an error parsing the error object: ${e}.`);
            }

            log.debug("=================== QUOTE ERROR ===================");
            log.error("CNA WC send_json_request error " + JSON.stringify(errorJSON ? errorJSON : "Null", null, 4));
            log.debug("=================== QUOTE ERROR ===================");

            let errorMessage = "";
            try {
                errorMessage = `CNA: status code ${error.httpStatusCode}: ${errorJSON.InsuranceSvcRs[0].WorkCompPolicyQuoteInqRs[0].MsgStatus.MsgStatusDesc.value}`;
            } catch (e1) {
                try {
                    errorMessage = `CNA: status code ${error.httpStatusCode}: ${errorJSON.message}`;
                } catch (e2) {
                    log.error(`CNA: Couldn't parse error object for description. Parsing errors: ${[e1, e2]}.`);
                }
            }

            errorMessage = errorMessage ? errorMessage : "CNA: An error occurred while attempting to quote.";
            return this.client_declined(errorMessage);
        }

        log.debug("=================== QUOTE RESULT ===================");
        log.debug("CNA WC " + JSON.stringify(result, null, 4));
        log.debug("=================== QUOTE RESULT ===================");

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
                        }
                        catch (e) {
                            log.warn(`CNA: Couldn't parse quote number: ${e}` + __location);
                        }

                        // get premium (required)
                        try {
                            premium = policySummary.FullTermAmt.Amt.value;
                        }
                        catch (e) {
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
                                        log.error(`CNA: Unexpected limit found in quote response. ${__location}`);
                                        break;
                                }
                            });
                        }
                        catch (e) {
                            return this.client_error(`CNA: Couldn't parse one or more limit values from response: ${e}.`);
                        }
                        
                        // get quote letter (optional) and quote MIME type (optional)
                        let proposalURL = response.MsgStatus.ChangeStatus.find(change => change.IdRef.hasOwnProperty("AttachmentTypeCd") && change.IdRef.AttachmentTypeCd.value === "QuoteProposal");
                        if (proposalURL) {
                            proposalURL = proposalURL.IdRef.WebsiteURL.value;
                            const [quoteHost, quotePath] = this.splitUrl(proposalURL);

                            let quoteResult = null;
                            try {
                                quoteResult = await this.send_json_request(quoteHost, quotePath, null, headers, "GET");
                            }
                            catch (e) {
                                log.error(`CNA: The request to retrieve the quote proposal letter failed: ${e}.`);
                            }

                            try {
                                quoteLetter = quoteResult.InsuranceSvcRs[0].ViewInqRs[0].FileAttachmentInfo[0]["com.cna.AttachmentData"].value;
                            }
                            catch (e) {
                                log.error(`CNA: There was an error parsing the quote letter: ${e}.`);
                            }

                            try {
                                quoteMIMEType = quoteResult.InsuranceSvcRs[0].ViewInqRs[0].FileAttachmentInfo[0].MIMEEncodingTypeCd.value;
                            }
                            catch (e) {
                                log.error(`CNA: There was an error parsing the quote MIME type: ${e}.`);
                            }

                        }
                        else {
                            log.error(`CNA: Couldn't find proposal URL with successful quote status: ${response.MsgStatus.MsgStatusCd.value}. Change Status': ${JSON.stringify(response.MsgStatus.ChangeStatus, null, 4)}`);
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
            }
            else {
                return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType);
            }
        }
        else {
            return this.client_error(`CNA: Response doesn't include a policy status code.`);
        }
    }

    // transform our business locations array into location objects array to be inserted into the WC request Object
    getLocations() {
        // iterate over each location and transform it into a location object
        return this.app.business.locations.map((location, i) => ({
                ItemIdInfo: {AgencyId: {value: `${this.app.agencyLocation.agencyId}`}},
                Addr: {
                    AddrTypeCd: [{value: "MailingAddress"}],
                    Addr1: {value: `${location.address} ${location.address2}`.trim()},
                    City: {value: location.city},
                    StateProvCd: {value: location.territory},
                    PostalCode: {value: location.zipcode}
                },
                id: `L${i}` 
            }));
    }

    // generates the Loss array based off values from claims
    getLosses() {
        // NOTE: CNA supports Closed (C), Declined (D), Open (O), Other (OT), Reoponed (R), and Subrogation - Claim Open Pending Subrogation (S)
        // We only have Open (O), and Closed (C)
        // We don't store loss type information, so hardcoded to "Both", meaning Medical & Indemnity
        const losses = [];

        this.app.applicationDocData.claims.forEach(claim => {
            losses.push({
                LossTypeCd: {
                    value: "Both"
                },
                ClaimStatusCd: {
                    value: claim.open ? "O" : "C"
                },
                TotalPaidAmt: {
                    Amt: {
                        value: claim.amountPaid
                    }
                },
                LossDt: {
                    value: moment(claim.eventDate).format("YYYY-MM-DD")
                },
                LossDesc: {
                    value: "None"
                },
                ReservedAmt: {
                    Amt: {
                        value: claim.amountReserved ? claim.amountReserved : 0
                    }
                }
            });
        });

        return losses;
    }

    // generates the tax identity object array, returns returns empty array if SSN 
    getTaxIdentity() {
        // even if hasEin is FALSE (we're provided an SSN), CNA still expects us to have the TaxTypeCd as FEIN
        const taxIdentity = {
            TaxIdTypeCd: {value: "FEIN"},
            TaxId: {value: this.app.applicationDocData.ein}
        }
    
        return [taxIdentity];
    }

    // generates the array of WorkCompRateState objects
    getWorkCompRateStates() {
        const workCompRateStates = [];

        for (const [index, location] of Object.entries(this.app.business.locations)) {
            const wcrs = {
                StateProvCd: {value: location.territory},
                WorkCompLocInfo: this.getWorkCompLocInfo(location, index)
            }
            const firstNCCICode = location.activity_codes[0].ncciCode;
            wcrs.GoverningClassCd = {value: firstNCCICode.substring(0, firstNCCICode.length - 1)}
            workCompRateStates.push(wcrs);
        }

        return workCompRateStates;    
    }

    // generates the WorkCompLocInfo objets
    getWorkCompLocInfo(location, index) {        
        const wcli = {
            NumEmployees: {value: location.full_time_employees + location.part_time_employees},
            WorkCompRateClass: [],
            LocationRef: `L${index}`,
            NameInfoRef: this.getNameRef(index)
        }

        for (const activityCode of location.activity_codes) {
            const wcrc = {
                RatingClassificationCd: {value: activityCode.ncciCode}, 
                Exposure: `${activityCode.payroll}`
            }

            wcli.WorkCompRateClass.push(wcrc);
        }

        return [wcli];
    }

    // generates the NameRef based off the index of the records being created
    getNameRef(index) {
        if (index >= 100) {
            return `N${index}`;
        }
        else if (index >= 10) {
            return `N0${index}`;
        }
        else {
            return `N00${index}`;
        }
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
                FormatInteger: {value: limit},
                LimitAppliesToCd: [{value: LIMIT_CODES[i]}]
            }); 
        });

        return limitArray;
    }

    // transform our questions into question objects array to be inserted into the WC Request Object
    getQuestionArray() {
        // convert question map to array
        const questionArray = Object.values(this.questions);

        // filtering questions to only those answered
        for (let i = questionArray.length - 1; i >= 0; i--) {
            let answer = null;
            try {
                answer = this.determine_question_answer(questionArray[i]);
            }
            catch (error) {
                return this.client_error('Could not determine the answer for one of the questions', __location, {questionID: question_id});
            }

            // if no answer, the question isn't shown
            if (!answer) {
                questionArray.splice(i, 1);
            }
        }

        // mapping answered questions to request question objects
        return questionArray.map(question => {
            const questionAnswerObj = {QuestionCd: {value: this.question_identifiers[question.id]}};

            if (explanationQuestions.includes(this.question_identifiers[question.id])) {
                questionAnswerObj.YesNoCd = {value: "N/A"};
                questionAnswerObj.Explanation = {value: question.answer}
            } else {
                // eslint-disable-next-line no-unused-expressions
                question.type === 'Yes/No' ? 
                    questionAnswerObj.YesNoCd = {value: question.answer.toUpperCase()} :
                    questionAnswerObj['com.cna_OptionCd'] = {value: question.answer};
            }

            return questionAnswerObj;
        });
    }

    async auth() {
        const data = {"id": "11248"}
        const headers = {headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic VEFMQUdBUEk6VEdhOTU4M2h3OTM3MTghIw=='
            }}
        try {
            const result = await axios.post(`https://${HOST}${AUTH_URL}`, data, headers);
            return result.data.access_token;
        }
        catch (err) {
            return `CNA Error: Could Not Authorize: ${err}`;
        }
    }

    splitUrl(url) {
        if (!url) {
            log.warn(`CNA: Supplied url is not defined and cannot be split into host and path.`);
            return [];
        }

        let host = "";
        let path = "";

        // default to 0, no http:// or https:// included
        let protocalIndex = 0;

        try {
            if (url.indexOf("https") !== -1) {
                protocalIndex = url.indexOf("https") + 8;
            }
            else if (url.indexOf("http") !== -1) {
                protocalIndex = url.indexOf("http") + 7;
            }

            const splitIndex = url.indexOf("com") + 3;

            host = url.substring(protocalIndex, splitIndex);
            path = url.substring(splitIndex, url.length);
        }
        catch (e) {
            log.warn(`CNA: There was an error splitting the supplied url: ${e}.`);
        }

        return [host, path];
    }
}
