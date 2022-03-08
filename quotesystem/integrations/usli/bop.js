/* eslint-disable dot-location */
/* eslint-disable implicit-arrow-linebreak */
/* eslint-disable no-extra-parens */
/* eslint-disable radix */
/* eslint-disable function-paren-newline */
/* eslint-disable object-curly-newline */
/* eslint-disable no-trailing-spaces */
/* eslint-disable no-empty */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * BOP Policy Integration for USLI
 */

'use strict';

const builder = require('xmlbuilder');
const moment = require('moment');
const Integration = require('../Integration.js');

global.requireShared('./helpers/tracker.js');

// NOTE: There are currently no special case questions for BOPLineBusiness questions

let logPrefix = '';
let applicationDocData = null;
let industryCode = null;

// TODO: Once you get a response, fill out these values for quote submission within our system
// quote response properties
// let quoteNumber = null;
// let quoteProposalId = null;
// let premium = null;
// const quoteLimits = {};
// let quoteLetter = null;
// const quoteMIMEType = "BASE64";
// let policyStatus = null;
// const quoteCoverages = [];

module.exports = class USLIBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
        this.productDesc = 'Commercial Package'
    }

    /**
     * Requests a quote from USLI and returns. This request is not intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {
        applicationDocData = this.applicationDocData;
        const BOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP");
        logPrefix = `USLI Commercial Package (BOP) (Appid: ${applicationDocData.applicationId}): `;

        industryCode = await this.getUSLIIndustryCodes();

        if (!industryCode) {
            const errorMessage = `No Industry Code was found for Commercial BOP. `;
            log.warn(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_autodeclined_out_of_appetite();
        }

        // if there's no BOP policy
        if (!BOPPolicy) {
            const errorMessage = `Could not find a policy with type BOP.`;
            log.error(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_error(errorMessage, __location);
        }

        // ------------- CREATE XML REQUEST ---------------

        const ACORD = builder.create('ACORD', {'encoding': 'UTF-8'});

        // TODO: Create the xml request and hydrate it with the appropriate information
        // EXAMPLE BELOW

        // <ACORD>
        //     <SignonRq>
        //         <SignonPswd>
        //             <CustId>
        //                 <CustLoginId>YourOrg</CustLoginId>
        //             </CustId>
        //         </SignonPswd>
        //         <ClientDt>2021-04-01T12:00:00.000-04:00</ClientDt>
        //         <CustLangPref>English</CustLangPref>
        //         <ClientApp>
        //             <Org>YourOrg</Org>
        //             <Name>YourOrg</Name>
        //             <Version>2.0</Version>
        //         </ClientApp>
        //   </SignonRq>

        // const SignonRq = ACORD.ele('SignonRq');
        // const SignonPswd = SignonRq.ele('SignonPswd');
        // const CustId = SignonPswd.ele('CustId');
        // CustId.ele('CustLoginId', this.username);
        // SignonRq.ele('ClientDt', moment().local().format());
        // SignonRq.ele('CustLangPref', 'English');
        // const ClientApp = SignonRq.ele('ClientApp');
        // ClientApp.ele('Org', "Talage Insurance");
        // ClientApp.ele('Name', "Talage");
        // ClientApp.ele('Version', "2.0");

        //     <InsuranceSvcRq>
        //         <RqUID>C4A112CD-3382-43DF-B200-10340F3511B4</RqUID>
        //         <PolicyRq>

        // const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
        // InsuranceSvcRq.ele('RqUID', requestUUID);
        // const PolicyRq = InsuranceSvcRq.ele('PolicyRq');

        // -------------- SEND XML REQUEST ----------------

        // Get the XML structure as a string
        const xml = ACORD.end({'pretty': true});

        // TODO: Send the XML request object to USLI's quote API

        const host = ''; // TODO: base API path here
        const quotePath = ``; // TODO: API Route path here
        const additionalHeaders = {};

        let result = null;
        try {
            result = await this.send_xml_request(host, quotePath, xml, additionalHeaders);        
        }
        catch (e) {
            const errorMessage = `An error occurred while trying to hit the USLI Quote API endpoint: ${e}. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // -------------- PARSE XML RESPONSE ----------------

        // TODO: Check result structure


        // TODO: Perform necessary response parsing to determine fail/success and get appropriate quote information

 
        // TODO: Call the appropriate return function 
        // NOTE: This will likely be determined by some policyStatus in the quote response
        // EXAMPLE BELOW
        // return result based on policy status
        //  if (policyStatus) {
        //      switch (policyStatus.toLowerCase()) {
        //          case "accept":
        //              return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        //          case "refer":
        //              return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        //          default:
        //              const errorMessage = `USLI response error: unknown policyStatus - ${policyStatus} `;
        //              log.error(logPrefix + errorMessage + __location);
        //              return this.client_error(errorMessage, __location);
        //      }
        //  }
        //  else {
        //      const errorMessage = `USLI response error: missing policyStatus. `;
        //      log.error(logPrefix + errorMessage + __location);
        //      return this.client_error(errorMessage, __location);
        //  }
     }
 
    async getUSLIIndustryCode() {
        const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;
        const policyEffectiveDate = moment(this.policy.effective_date).format('YYYY-MM-DD HH:mm:ss');
        applicationDocData = this.applicationDocData;

        const industryQuery = {
            insurerId: this.insurer.id,
            talageIndustryCodeIdList: applicationDocData.industryCode,
            territoryList: applicationDocData.mailingState,
            effectiveDate: {$lte: policyEffectiveDate},
            expirationDate: {$gte: policyEffectiveDate},
            active: true
        }

        const orParamList = [];
        const policyTypeCheck = {policyType: this.policyTypeFilter};
        const policyTypeNullCheck = {policyType: null}
        orParamList.push(policyTypeCheck)
        orParamList.push(policyTypeNullCheck)
        industryQuery.$or = orParamList;

        // eslint-disable-next-line prefer-const
        let insurerIndustryCodeList = null;
        try {
            insurerIndustryCodeList = await InsurerIndustryCodeModel.find(industryQuery);
        }
        catch (e) {
            log.error(`${logPrefix}Error re-retrieving USLI industry codes. Falling back to original code. ${__location}`);
            return;
        }

        let USLIIndustryCode = null;
        if (insurerIndustryCodeList && insurerIndustryCodeList.length > 0) {
            USLIIndustryCode = insurerIndustryCodeList;
        }
        else {
            log.warn(`${logPrefix}No industry codes were returned while attempting to re-retrieve USLI industry codes. Falling back to original code. ${__location}`);
            USLIIndustryCode = [this.industry_code];
        }

        if (insurerIndustryCodeList.length > 1) {
            log.warn(`${logPrefix}Multiple insurer industry codes returned. Picking the first result. ${__location}`);
        }

        return USLIIndustryCode[0];
    }

}
 