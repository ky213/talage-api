/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Simple BOP Policy Integration for Liberty Mutual
 */

'use strict';

const builder = require('xmlbuilder');
const moment = require('moment');
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
global.requireShared('./helpers/tracker.js');

// The PerOcc field is the only one used, these are the Simple BOP supported PerOcc limits for LM
const supportedLimits = [
    300000,
    500000,
    1000000,
    2000000
];

// The supported property deductables
const supportedDeductables = [
    500,
    1000,
    2500,
    5000
];

// An association list tying the Talage entity list (left) to the codes used by this insurer (right)
const entityMatrix = {
    'Association': 'AS',
    'Corporation': 'CP',
    'Joint Venture': 'JV',
    'Limited Liability Company': 'LL',
    'Limited Liability Partnership': 'LY',
    'Limited Partnership': 'LY',
    'Other': 'OT',
    'Partnership': 'PT',
    'Sole Proprietorship': 'IN',
    'Trust - For Profit': 'TR',
    'Trust - Non-Profit': 'TR'
};

module.exports = class LibertySBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;

        this.requiresProductPolicyTypeFilter = true;
        this.policyTypeFilter = 'BOP';
    }

    /**
     * Requests a quote from Liberty and returns. This request is not intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {

        const applicationDocData = this.app.applicationDocData;
        const bopPolicy = applicationDocData.policies.find(p => p.policyType === "BOP"); // This may need to change to BOPSR?
        const logPrefix = `Liberty Mutual Commercial BOP (Appid: ${applicationDocData.mysqlId}): `;

        if (!bopPolicy) {
            const errorMessage = `${logPrefix}Could not find a policy with type BOP.`;
            log.error(`${errorMessage} ${__location}`);
            return this.client_error(errorMessage, __location);
        }

        if (!(bopPolicy.coverage > 0)) {
            const errorMessage = `${logPrefix}No BPP Coverage was supplied for the Simple BOP Policy.`;
            log.error(`${errorMessage} ${JSON.stringify(sbopPolicy)} ` + __location)
            return this.client_error(errorMessage, __location);
        }

        const commercialBOPQuestions = applicationDocData.questions.filter(q => q.insurerQuestionAttributes.commercialBOP);

        // Assign the closest supported limit for Per Occ
        // NOTE: Currently this is not included in the request and defaulted on LM's side
        const limit = this.getSupportedLimit(bopPolicy.limits);

        // NOTE: Liberty Mutual does not accept these values at this time. Automatically defaulted on their end...
        const deductible = this.getSupportedDeductible(bopPolicy.deductible);
        const fireDamage = "1000000"; // we do not store this data currently
        const prodCompOperations = "2000000"; // we do not store this data currently
        const medicalExpenseLimit = "15000"; // we do not store this data currently
        const ECAggregateLimit = "1000000/2000000"; // we do not store this data currently

        let phone = applicationDocData.contacts.find(c => c.primary).phone;
        // fall back to outside phone IFF we cannot find primary contact phone
        phone = phone ? phone : applicationDocData.phone;
        const formattedPhone = `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)}`;

        // used for implicit question NBOP11: any losses or claims in the past 3 years?
        const claimsPast3Years = applicationDocData.claims.length === 0 || 
            applicationDocData.claims.find(c => moment().diff(moment(c.eventDate), 'years', true) >= 3) ? "NO" : "YES";

        // ------------- CREATE XML REQUEST ---------------
        
        const ACORD = builder.create('ACORD', {'encoding': 'UTF-8'});


        // -------------- SEND XML REQUEST ----------------

        // Get the XML structure as a string
        const xml = ACORD.end({'pretty': true});

        // log.debug("=================== QUOTE REQUEST ===================");
        // log.debug(`Liberty Mutual request (Appid: ${this.app.id}): \n${xml}`);
        // log.debug("=================== QUOTE REQUEST ===================");

        // Determine which URL to use
        const host = 'ci-policyquoteapi.libertymutual.com';
        const path = `/v1/quotes?partnerID=${this.username}`;

        let result = null;
        try {
            result = await this.send_xml_request(host, path, xml, {'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`});
        }
        catch (e) {
            const errorMessage = `${logPrefix}An error occurred while trying to retrieve the quote proposal letter: ${e}. `;
            log.error(errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // -------------- PARSE XML RESPONSE ----------------

        // check we have valid status object structure
        if (!result.ACORD || !result.ACORD.Status || typeof result.ACORD.Status[0].StatusCd === 'undefined') {
            const errorMessage = `${logPrefix}Unknown result structure: cannot parse result. `;
            log.error(errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // check we have a valid status code
        if (result.ACORD.Status[0].StatusCd[0] !== '0') {
            const errorMessage = `${logPrefix}Unknown status code returned in quote response: ${result.ACORD.Status[0].StatusCd}. `;
            log.error(errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // check we have a valid object structure
        if (
            !result.ACORD.InsuranceSvcRs ||
            !result.ACORD.InsuranceSvcRs[0].PolicyRs ||
            !result.ACORD.InsuranceSvcRs[0].PolicyRs[0].MsgStatus
        ) {
            const errorMessage = `${logPrefix}Unknown result structure, no message status: cannot parse result. `;
            log.error(errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        let objPath = result.ACORD.InsuranceSvcRs[0].PolicyRs[0].MsgStatus[0];

        // check the response status
        switch (objPath.MsgStatusCd[0].toLowerCase()) {
            case "error":
                // NOTE: Insurer "error" is considered a "decline" within Wheelhouse.
                // log.error("=================== QUOTE ERROR ===================");
                // log.error(`Liberty Mutual Simple BOP Request Error (Appid: ${this.app.id}):\n${JSON.stringify(objPath, null, 4)}`);
                // log.error("=================== QUOTE ERROR ===================");
                // normal error structure, build an error message
                let additionalReasons = null;
                let errorMessage = `${logPrefix}`;
                if (objPath.MsgErrorCd) {
                    errorMessage += objPath.MsgErrorCd[0];
                }

                if (objPath.ExtendedStatus) {
                    objPath = objPath.ExtendedStatus[0];
                    if (objPath.ExtendedStatusCd && objPath.ExtendedStatusExt) {
                        errorMessage += ` (${objPath.ExtendedStatusCd}): `;
                    }

                    if (
                        objPath.ExtendedStatusExt &&
                        objPath.ExtendedStatusExt[0]['com.libertymutual.ci_ExtendedDataErrorCd'] &&
                        objPath.ExtendedStatusExt[0]['com.libertymutual.ci_ExtendedDataErrorDesc']
                    ) {
                        objPath = objPath.ExtendedStatusExt;
                        errorMessage += `[${objPath[0]['com.libertymutual.ci_ExtendedDataErrorCd']}] ${objPath[0]['com.libertymutual.ci_ExtendedDataErrorDesc']}`;

                        if (objPath.length > 1) {
                            additionalReasons = [];
                            objPath.forEach((reason, index) => {
                                // skip the first one, we've already added it as the primary reason
                                if (index !== 0) {
                                    additionalReasons.push(`[${reason['com.libertymutual.ci_ExtendedDataErrorCd']}] ${reason['com.libertymutual.ci_ExtendedDataErrorDesc']}`);
                                }
                            });
                        }
                    } else {
                        errorMessage += 'Failed to parse error, please review the logs for more details.';
                    }
                } else {
                    errorMessage += 'Failed to parse error, please review the logs for more details.';
                }
                return this.client_declined(errorMessage, additionalReasons);
            case "successwithinfo":
                log.debug(`${logPrefix}Quote returned with status Sucess With Info.` + __location);
                break;
            case "successnopremium":
                let reason = null;

                if (objPath.ExtendedStatus && Array.isArray(objPath.ExtendedStatus)) {
                    const reasonObj = objPath.ExtendedStatus.find(s => s.ExtendedStatusCd && typeof s.ExtendedStatusCd === 'string' && s.ExtendedStatusCd.toLowerCase() === "verifydatavalue");
                    reason = reasonObj && reasonObj.ExtendedStatusDesc ? reasonObj.ExtendedStatusDesc[0] : null;
                }
                log.warn(`${logPrefix}Quote was bridged to eCLIQ successfully but no premium was provided.`);
                if (reason) {
                    log.warn(`${logPrefix}Reason for no premium: ${reason}` + __location);
                }
                break;
            default:
                log.warn(`${logPrefix}Unknown MsgStatusCd returned in quote response - ${objPath.MsgStatusCd[0]}. Continuing...` + __location);
        }

        // PARSE SUCCESSFUL PAYLOAD
        // logged in database only use log.debug so it does not go to ElasticSearch
        // log.debug("=================== QUOTE RESULT ===================");
        // log.debug(`Liberty Mutual Simple BOP (Appid: ${this.app.id}):\n ${JSON.stringify(result, null, 4)}`);
        // log.debug("=================== QUOTE RESULT ===================");

        let quoteNumber = null;
        let quoteProposalId = null;
        let premium = null;
        const quoteLimits = {};
        let quoteLetter = null;
        const quoteMIMEType = null;
        let policyStatus = null;

        // check valid response object structure
        if (
            !result.ACORD.InsuranceSvcRs ||
            !result.ACORD.InsuranceSvcRs[0].PolicyRs ||
            !result.ACORD.InsuranceSvcRs[0].PolicyRs[0].Policy
        ) {
            const errorMessage = `${logPrefix}Unknown result structure: cannot parse quote information. `;
            log.error(errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        result = result.ACORD.InsuranceSvcRs[0].PolicyRs[0];
        const policy = result.Policy[0];

        // set quote values from response object, if provided
        if (!policy.QuoteInfo || !policy.QuoteInfo[0].CompanysQuoteNumber) {
            log.error(`${logPrefix}Premium and Quote number not provided, or the result structure has changed.` + __location);
        }
        else {
            quoteNumber = policy.QuoteInfo[0].CompanysQuoteNumber[0];
            premium = policy.QuoteInfo[0].InsuredFullToBePaidAmt[0].Amt[0];
        }
        if (!policy.UnderwritingDecisionInfo || !policy.UnderwritingDecisionInfo[0].SystemUnderwritingDecisionCd) {
            log.error(`${logPrefix}Policy status not provided, or the result structure has changed.` + __location);
        }
        else {
            policyStatus = policy.UnderwritingDecisionInfo[0].SystemUnderwritingDecisionCd[0];
        }
        if (!policy.PolicyExt || !policy.PolicyExt[0]['com.libertymutual.ci_QuoteProposalId']) {
            log.error(`${logPrefix}Quote ID for retrieving quote proposal not provided, or result structure has changed.` + __location);
        }
        else {
            quoteProposalId = policy.PolicyExt[0]['com.libertymutual.ci_QuoteProposalId'];
        }

        // check valid limit data structure in response
        if (
            !result.BOPLineBusiness ||
            !result.BOPLineBusiness[0].LiabilityInfo ||
            !result.BOPLineBusiness[0].LiabilityInfo[0].GeneralLiabilityClassification ||
            !result.BOPLineBusiness[0].LiabilityInfo[0].GeneralLiabilityClassification[0].Coverage
        ) {
            log.error(`${logPrefix}Liability Limits not provided, or result structure has changed.` + __location);
        }
        else {
            // limits exist, set them
            const coverages = result.BOPLineBusiness[0].LiabilityInfo[0].GeneralLiabilityClassification[0].Coverage[0];

            coverages.Limit.forEach((limit) => {
                const limitAmount = limit.FormatCurrencyAmt[0].Amt[0];
                switch(limit.LimitAppliesToCd[0]){
                    case 'Aggregate':
                        quoteLimits[8] = limitAmount;
                        break;
                    case 'FireDam':
                        quoteLimits[5] = limitAmount;
                        break;
                    case 'Medical':
                        quoteLimits[6] = limitAmount;
                        break;
                    case 'PerOcc':
                        quoteLimits[4] = limitAmount;
                        break;
                    case 'ProductsCompletedOperations':
                        quoteLimits[9] = limitAmount;
                        break;
                    default:
                        log.warn(`${logPrefix}Unexpected Limit found in response.`);
                        break;
                }
            });
        }

        const quotePath = `/v1/quoteProposal?quoteProposalId=${quoteProposalId}`;

        // attempt to get the quote proposal letter
        let quoteResult = null;
        try {
            quoteResult = await this.send_request(host,
                quotePath,
                null,
                {
                    'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
                    'Content-Type': 'application/xml'
                });
        }
        catch (e) {
            const errorMessage = `${logPrefix}An error occurred while trying to retrieve the quote proposal letter: ${e}.`;
            log.error(errorMessage + __location);
        }

        // comes back as a string, so we search for the XML BinData field and substring it out
        if (quoteResult !== null) {
            const start = quoteResult.indexOf("<BinData>") + 9;
            const end = quoteResult.indexOf("</BinData>");

            if (start === 8 || end === -1) {
                log.warn(`${logPrefix}Quote Proposal Letter not provided, or quote result structure has changed.` + __location);
            }
            else {
                quoteLetter = quoteResult.substring(start, end);
            }
        }

        // return result based on policy status
        if (policyStatus) {
            switch (policyStatus.toLowerCase()) {
                case "accept":
                    return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter.toString('base64'), quoteMIMEType);
                case "refer":
                    return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter.toString('base64'), quoteMIMEType);
                case "reject":
                    return this.client_declined(`${logPrefix}Application was rejected.`);
                default:
                    const errorMessage = `${logPrefix}Insurer response error: unknown policyStatus - ${policyStatus} `;
                    log.error(errorMessage + __location);
                    return this.client_error(errorMessage, __location);
            }
        }
        else {
            const errorMessage = `${logPrefix}Insurer response error: missing policyStatus. `;
            log.error(errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }
    }

    getSupportedLimit(limits) {
        // skip first character, look for first occurance of non-zero number
        let index = 0;
        for (let i = 1; i < limits.length; i++) {
            if (limits[i] !== "0") {
                index = i;
                break;
            }
        }

        // parse first limit out of limits string
        const limit = limits.substring(0, index)

        // attempt to convert the passed-in limit to an integer
        let limitInt = 0;
        try {
            limitInt = parseInt(limit, 10);
        }
        catch (e) {
            log.warn(`Error parsing limit: ${e}. Leaving value as-is.` + __location);
            return limit;
        }

        // find the index of the limit that is greater than the passed-in limit, if it exists
        let greaterThanIndex = -1;
        for (let i = 0; i < supportedLimits.length; i++) {
            const l = supportedLimits[i];
            if (l > limitInt) {
                greaterThanIndex = i;
                break;
            }
        }

        // based off the index, determine which limit to return (as a string)
        switch (greaterThanIndex) {
            case -1:
                return `${supportedLimits[supportedLimits.length - 1]}`;
            case 0:
                return `${supportedLimits[0]}`;
            default:
                const lowerLimit = supportedLimits[greaterThanIndex - 1];
                const upperLimit = supportedLimits[greaterThanIndex];
                const diffToLower = limitInt - lowerLimit;
                const diffToUpper = upperLimit - limitInt;
                if (diffToLower < diffToUpper) {
                    return `${lowerLimit}`;
                }
                else {
                    return `${upperLimit}`;
                }
        }
    }

    getSupportedDeductible(deductible) {
        // find the index of the limit that is greater than the passed-in limit, if it exists
        let greaterThanIndex = -1;
        for (let i = 0; i < supportedDeductables.length; i++) {
            const d = supportedDeductables[i];
            if (d > deductible) {
                greaterThanIndex = i;
                break;
            }
        }

        // based off the index, determine which limit to return (as a string)
        switch (greaterThanIndex) {
            case -1:
                return `${supportedDeductables[supportedDeductables.length - 1]}`;
            case 0:
                return `${supportedDeductables[0]}`;
            default:
                const lowerLimit = supportedDeductables[greaterThanIndex - 1];
                const upperLimit = supportedDeductables[greaterThanIndex];
                const diffToLower = deductible - lowerLimit;
                const diffToUpper = upperLimit - deductible;
                if (diffToLower < diffToUpper) {
                    return `${lowerLimit}`;
                }
                else {
                    return `${upperLimit}`;
                }
        }
    }
}