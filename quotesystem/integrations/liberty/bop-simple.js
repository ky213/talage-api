/* eslint-disable object-curly-newline */
/* eslint-disable array-element-newline */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Simple BOP Policy Integration for Liberty Mutual
 */

'use strict';

const builder = require('xmlbuilder');
const moment = require('moment');
const Integration = require('../Integration.js');
const {get} = require('lodash')

// eslint-disable-next-line no-unused-vars
global.requireShared('./helpers/tracker.js');
const {getLibertyQuoteProposal, getLibertyOAuthToken} = require('./api');

// The PerOcc field is the only one used, these are the Simple BOP supported PerOcc limits for LM
const supportedLimits = [
    300000,
    500000,
    1000000,
    2000000
];

// The supported property deductables
// const supportedDeductables = [
//     500,
//     1000,
//     2500,
//     5000
// ];

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
        this.productDesc = 'Simple BOP'
    }

    /**
     * Requests a quote from Liberty and returns. This request is not intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {

        const applicationDocData = this.applicationDocData;
        const logPrefix = `Liberty Mutual Simple BOP (Appid: ${applicationDocData.applicationId}): `;
        const SBOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP");

        // liberty can have multiple insurer industry codes tied to a single talage industry code
        // this will set this.industry_code to a list that will be handled in each Liberty BOP integration
        await this._getLibertyIndustryCodes();

        if (!this.industry_code) {
            const errorMessage = `${logPrefix}No Industry Code was found for Simple BOP. `;
            log.warn(`${errorMessage} ` + __location);
            return this.client_autodeclined_out_of_appetite();
        }

        if (!SBOPPolicy) {
            const errorMessage = `Could not find a policy with type BOP.`;
            log.error(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_error(errorMessage, __location);
        }

        if (!(SBOPPolicy.coverage > 0)) {
            let coverage = 0;
            for (const {businessPersonalPropertyLimit} of applicationDocData.locations) {
                if (typeof businessPersonalPropertyLimit === "number"){
                    coverage += businessPersonalPropertyLimit
                }
            }
            SBOPPolicy.coverage = coverage;
        }

        if (!(SBOPPolicy.coverage > 0)) {
            const errorMessage = `No BPP Coverage was supplied for the Simple BOP Policy.`;
            log.error(`${logPrefix}${errorMessage} ${JSON.stringify(SBOPPolicy)} ` + __location);
            return this.client_error(errorMessage, __location);
        }

        const simpleBOPQuestions = applicationDocData.questions.filter(q => q.insurerQuestionAttributes.simpleBOP);

        // Assign the closest supported limit for Per Occ
        // NOTE: Currently this is not included in the request and defaulted on LM's side
        //const limit = this.getSupportedLimit(SBOPPolicy.limits);

        // NOTE: Liberty Mutual does not accept these values at this time. Automatically defaulted on their end...
        // const deductible = this.getSupportedDeductible(SBOPPolicy.deductible);
        // const fireDamage = "1000000"; // we do not store this data currently
        // const prodCompOperations = "2000000"; // we do not store this data currently
        // const medicalExpenseLimit = "15000"; // we do not store this data currently
        // const ECAggregateLimit = "1000000/2000000"; // we do not store this data currently

        let phone = applicationDocData.contacts.find(c => c.primary).phone.toString();
        // fall back to outside phone IFF we cannot find primary contact phone
        phone = phone ? phone : applicationDocData.phone.toString();
        const formattedPhone = `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)}`;

        // used for implicit question NBOP11: any losses or claims in the past 3 years?
        const claimsPast3Years = applicationDocData.claims.length === 0 ||
            applicationDocData.claims.find(c => moment().diff(moment(c.eventDate), 'years', true) >= 3) ? "NO" : "YES";

        // Liberty has us define our own Request ID
        const UUID = this.generate_uuid();

        // -------------- BUILD XML REQUEST ----------------

        const ACORD = builder.create('ACORD', {'encoding': 'UTF-8'});

        // <SignonRq>
        //     <SignonPswd>
        //         <CustId>
        //             <CustLoginId>YourOrg</CustLoginId>
        //         </CustId>
        //     </SignonPswd>
        //     <ClientDt>2021-01-07T12:00:00.000-04:00</ClientDt>
        //     <CustLangPref>English</CustLangPref>
        //     <ClientApp>
        //         <Org>YourOrg</Org>
        //         <Name>YourOrg</Name>
        //         <Version>2.0</Version>
        //     </ClientApp>
        // </SignonRq>

        const SignonRq = ACORD.ele('SignonRq');
        const SignonPswd = SignonRq.ele('SignonPswd');
        const CustId = SignonPswd.ele('CustId');
        CustId.ele('CustLoginId', this.username);
        SignonRq.ele('ClientDt', moment().local().format());
        SignonRq.ele('CustLangPref', 'English');
        const ClientApp = SignonRq.ele('ClientApp');
        ClientApp.ele('Org', "Talage Insurance");
        ClientApp.ele('Name', "Talage");
        ClientApp.ele('Version', "1.0");

        // <InsuranceSvcRq>
        //      <RqUID> ... </RqUID>
        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', UUID);

        // <PolicyRq>
        // <RqUID>C4A112CD-3382-43DF-B200-10341F3511B4</RqUID>
        // <TransactionRequestDt>2021-01-07T12:00:00.000-04:00</TransactionRequestDt>
        // <TransactionEffectiveDt>2021-01-07</TransactionEffectiveDt>
        // <CurCd>USD</CurCd>
        // <BusinessPurposeTypeCd>NBQ</BusinessPurposeTypeCd>
        // <SourceSystem id="a4934abd">
        //     <SourceSystemCd>RAMP</SourceSystemCd>
        // </SourceSystem>
        // <Producer>
        //     <ProducerInfo>
        //         <ContractNumber SourceSystemRef="a4934abd">4689905</ContractNumber>
        //     </ProducerInfo>
        // </Producer>

        // OPTIONAL AGENT INFORMATION LATER - required for API bind once LM implements for Simple BOP
        // <Producer>
        //     <Surname>ELY</Surname>
        //     <GivenName>ELIZABETH</GivenName>
        //     <NIPRId>123456</NIPRId>
        //     <ProducerRoleCd>Agent</ProducerRoleCd>
        // </Producer>

        const PolicyRq = InsuranceSvcRq.ele('PolicyRq');
        PolicyRq.ele('RqUID', UUID);
        PolicyRq.ele('TransactionRequestDt', moment().local().format());
        PolicyRq.ele('TransactionEffectiveDt', moment().local().format('YYYY-MM-DD'));
        PolicyRq.ele('CurCd', 'USD');
        PolicyRq.ele('BusinessPurposeTypeCd', 'NBQ'); // this is what Liberty Mutual Expects
        const SourceSystem = PolicyRq.ele('SourceSystem').att('id', 'Talage');
        SourceSystem.ele('SourceSystemCd', 'RAMP'); // this is what Liberty Mutual Expects
        const Producer = PolicyRq.ele('Producer');
        const ProducerInfo = Producer.ele('ProducerInfo');
        ProducerInfo.ele('ContractNumber', this.insurer.useSandbox ? '4689905' : this.app.agencyLocation.insurers[this.insurer.id].agency_id).att('SourceSystemRef', 'Talage');

        // <InsuredOrPrincipal id = ...>
        const InsuredOrPrincipal = PolicyRq.ele('InsuredOrPrincipal').att('id', UUID);

        // <GeneralPartyInfo>
        //     <NameInfo>
        //         <CommlName>
        //             <CommercialName>SIMPLE BOP SAMPLE XML</CommercialName>
        //         </CommlName>
        //         <LegalEntityCd>CP</LegalEntityCd>
        //     </NameInfo>
        //     <Addr>
        //         <Addr1>1137 N State Street</Addr1>
        //         <City>Greenfield</City>
        //         <StateProvCd>IN</StateProvCd>
        //         <PostalCode>46140</PostalCode>
        //     </Addr>
        //     <Communications>
        //         <PhoneInfo>
        //             <PhoneTypeCd>Phone</PhoneTypeCd>
        //             <PhoneNumber>+1-530-6616044</PhoneNumber>
        //         </PhoneInfo>
        //     </Communications>
        // </GeneralPartyInfo>

        const GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');
        const NameInfo = GeneralPartyInfo.ele('NameInfo');
        const CommlName = NameInfo.ele('CommlName');
        CommlName.ele('CommercialName', applicationDocData.businessName);
        NameInfo.ele('LegalEntityCd', entityMatrix[applicationDocData.entityType]);
        const Addr = GeneralPartyInfo.ele('Addr');
        Addr.ele('Addr1', applicationDocData.mailingAddress);
        Addr.ele('City', applicationDocData.mailingCity);
        Addr.ele('StateProvCd', applicationDocData.mailingState);
        Addr.ele('PostalCode', applicationDocData.mailingZipcode.substring(0, 5));
        const Communications = GeneralPartyInfo.ele('Communications');
        const PhoneInfo = Communications.ele('PhoneInfo');
        PhoneInfo.ele('PhoneTypeCd', 'Phone');
        PhoneInfo.ele('PhoneNumber', formattedPhone);

        // <InsuredOrPrincipalInfo>
        //     <InsuredOrPrincipalRoleCd>FNI</InsuredOrPrincipalRoleCd>
        //     <BusinessInfo>
        //         <BusinessStartDt>2015</BusinessStartDt>
        //         <NumEmployeesFullTime>2</NumEmployeesFullTime>
        //         <NumEmployeesPartTime>0</NumEmployeesPartTime>
        //         <NumEmployees>2</NumEmployees>
        //     </BusinessInfo>
        // </InsuredOrPrincipalInfo>

        let fullTimeEmployees = 0;
        let partTimeEmployees = 0;
        applicationDocData.locations.forEach(location => {
            fullTimeEmployees += location.full_time_employees;
            partTimeEmployees += location.part_time_employees;
        });

        const InsuredOrPrincipalInfo = InsuredOrPrincipal.ele('InsuredOrPrincipalInfo');
        InsuredOrPrincipalInfo.ele('InsuredOrPrincipalRoleCd', 'FNI'); // Per Liberty, "first name insured" is the only valid value
        const BusinessInfo = InsuredOrPrincipalInfo.ele('BusinessInfo');
        // NOTE: This satisifies the BOP1 question - we do not need to send BOP1 question to Liberty Mutual
        BusinessInfo.ele('BusinessStartDt', moment(applicationDocData.founded).format('YYYY'));
        BusinessInfo.ele('NumEmployeesFullTime', fullTimeEmployees);
        BusinessInfo.ele('NumEmployeesPartTime', partTimeEmployees);
        BusinessInfo.ele('NumEmployees', fullTimeEmployees + partTimeEmployees);

        // <Policy>
        //     <LOBCd>BOP</LOBCd>
        //     <ControllingStateProvCd>IN</ControllingStateProvCd>
        //     <ContractTerm>
        //         <EffectiveDt>2021-01-07</EffectiveDt>
        //     </ContractTerm>
        //     <QuestionAnswer>
        //         <QuestionCd>LMGENRL404</QuestionCd>
        //         <YesNoCd>NO</YesNoCd>
        //     </QuestionAnswer>
        //     <QuestionAnswer>
        //         <QuestionCd>LMGENRL586</QuestionCd>
        //         <YesNoCd>NO</YesNoCd>
        //     </QuestionAnswer>
        //     <PolicyExt>
        //         <com.libertymutual.ci_BusinessClassDesc>Business Class Description</com.libertymutual.ci_BusinessClassDesc>
        //         <com.libertymutual.ci_BusinessClassId>01234</com.libertymutual.ci_BusinessClassId>
        //     </PolicyExt>
        // </Policy>

        const Policy = PolicyRq.ele('Policy');
        Policy.ele('LOBCd', 'BOP');
        Policy.ele('ControllingStateProvCd', applicationDocData.mailingState);
        const ContractTerm = Policy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', moment(SBOPPolicy.effectiveDate).format('YYYY-MM-DD'));
        // ContractTerm.ele('ExpirationDt', ...) is defaulted to 12 months from EffectiveDt by Liberty Mutual, not including

        // Add the questions
        for (const applicationQuestion of simpleBOPQuestions) {
            if (applicationQuestion.insurerQuestionAttributes.simpleBOP.ACORDCd) {
                const QuestionAnswer = Policy.ele('QuestionAnswer');
                QuestionAnswer.ele('QuestionCd', applicationQuestion.insurerQuestionAttributes.simpleBOP.ACORDCd);
                QuestionAnswer.ele('YesNoCd', applicationQuestion.answerValue.toUpperCase());
            }
            else {
                log.warn(`${logPrefix}Could not find ACORDCd for question ${applicationQuestion.insurerQuestionIdentifier}`, __location);
            }
        }

        // add implicit questions
        const implicitQuestion1 = Policy.ele('QuestionAnswer');
        implicitQuestion1.ele('QuestionCd', 'LMGENRL404');
        implicitQuestion1.ele('YesNoCd', claimsPast3Years);

        const PolicyExt = Policy.ele('PolicyExt');
        PolicyExt.ele('com.libertymutual.ci_BusinessClassDesc', this.industry_code.description);
        PolicyExt.ele('com.libertymutual.ci_BusinessClassId', this.industry_code.id);

        // <Location id="Wc3a968def7d94ae0acdabc4d95c34a86W">
        //     <Addr>
        //         <Addr1>1137 N State Street</Addr1>
        //         <City>Greenfield</City>
        //         <StateProvCd>IN</StateProvCd>
        //         <PostalCode>46140</PostalCode>
        //     </Addr>
        // </Location>

        applicationDocData.locations.forEach((location, index) => {
            const Location = PolicyRq.ele('Location').att('id', `L${index}`);
            const subAddr = Location.ele('Addr');
            subAddr.ele('Addr1', location.address);
            subAddr.ele('City', location.city);
            subAddr.ele('StateProvCd', location.state);
            subAddr.ele('PostalCode', location.zipcode.substring(0, 5));
        });

        // <BOPLineBusiness>
        //     <LOBCd>BOPSR</LOBCd>

        const BOPLineBusiness = PolicyRq.ele('BOPLineBusiness');
        BOPLineBusiness.ele('LOBCd', 'BOPSR');

        // <PropertyInfo>
        //     <CommlPropertyInfo LocationRef="Wc3a968def7d94ae0acdabc4d95c34a86W">
        //         <SubjectInsuranceCd>BPP</SubjectInsuranceCd>
        //         <ClassCd>89391</ClassCd>
        //         <Coverage>
        //             <CoverageCd>BPP</CoverageCd>
        //             <Limit>
        //                 <FormatCurrencyAmt>
        //                     <Amt>10000</Amt>
        //                 </FormatCurrencyAmt>
        //                 <LimitAppliesToCd>PerOcc</LimitAppliesToCd>
        //             </Limit>
        //         </Coverage>
        //     </CommlPropertyInfo>
        // </PropertyInfo>

        const PropertyInfo = BOPLineBusiness.ele('PropertyInfo');
        for (let i = 0; i < applicationDocData.locations.length; i++) {
            const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo').att('LocationRef', `L${i}`);
            CommlPropertyInfo.ele('SubjectInsuranceCd', 'BPP');
            CommlPropertyInfo.ele('ClassCd', this.industry_code.code);
            const Coverage = CommlPropertyInfo.ele('Coverage');
            Coverage.ele('CoverageCd', 'BPP');
            const Limit = Coverage.ele('Limit');
            const FormatCurrencyAmt = Limit.ele('FormatCurrencyAmt');
            FormatCurrencyAmt.ele('Amt', SBOPPolicy.coverage);
            Limit.ele('LimitAppliesToCd', 'PerOcc');
        }

        // <LiabilityInfo>
        //     <GeneralLiabilityClassification LocationRef="L0">
        //         <Coverage>
        //             <CoverageCd>CGL</CoverageCd>
        //         </Coverage>
        //         <ClassCd>89324</ClassCd>
        //     </GeneralLiabilityClassification>
        // </LiabilityInfo>

        const LiabilityInfo = BOPLineBusiness.ele('LiabilityInfo');
        applicationDocData.locations.forEach((location, index) => {
            if(index === 0){
                const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification').att('LocationRef', `L${index}`);
                const innerCoverage = GeneralLiabilityClassification.ele('Coverage');
                innerCoverage.ele('CoverageCd', 'CGL');
                // Per Liberty Only Included on 1st location
                GeneralLiabilityClassification.ele('ClassCd', this.industry_code.code);
            }
        });

        // -------------- SEND XML REQUEST ----------------

        // Get the XML structure as a string
        const xml = ACORD.end({'pretty': true});

        // log.debug("=================== QUOTE REQUEST ===================");
        // log.debug(`Liberty Mutual request (Appid: ${this.app.id}): \n${xml}`);
        // log.debug("=================== QUOTE REQUEST ===================");

        let auth = null;
        try {
            auth = await getLibertyOAuthToken();
        }
        catch (e) {
            log.error(`${logPrefix}${e}${__location}`);
            return this.client_error(e, __location);
        }

        const host = 'apis.us-east-1.libertymutual.com';
        const quotePath = `/bl-partnerships/quotes?partnerID=${this.username}`;

        let result = null;
        try {
            result = await this.send_xml_request(host, quotePath, xml, {
                'Authorization': `Bearer ${auth.access_token}`
            });
        }
        catch (e) {
            const errorMessage = `An error occurred while trying to hit the Liberty Quote API endpoint: ${e}. `
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // -------------- PARSE XML RESPONSE ----------------

        // check we have valid status object structure
        const statusCode = get(result, "ACORD.Status[0].StatusCd")

        if (!statusCode) {
            const errorMessage = `Unknown result structure: cannot parse result. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // check we have a valid status code
        if (statusCode[0] !== '0') {
            const errorMessage = `Unknown status code returned in quote response: ${statusCode}. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // check we have a valid object structure
        const msgStatus = get(result, "ACORD.InsuranceSvcRs[0].PolicyRs[0].MsgStatus")

        if (!msgStatus) {
            const errorMessage = `${logPrefix}Unknown result structure, no message status: cannot parse result. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        let objPath = msgStatus[0];

        // check the response status
        switch (get(objPath, "MsgStatusCd[0]")?.toLowerCase()) {
            case "error":
                // NOTE: Insurer "error" is considered a "decline" within Wheelhouse.
                // log.error("=================== QUOTE ERROR ===================");
                // log.error(`Liberty Mutual Simple BOP Request Error (Appid: ${this.app.id}):\n${JSON.stringify(objPath, null, 4)}`);
                // log.error("=================== QUOTE ERROR ===================");
                // normal error structure, build an error message
                let additionalReasons = null;
                let errorMessage = ``;
                if (objPath?.MsgErrorCd) {
                    errorMessage += objPath.MsgErrorCd[0];
                }

                if (objPath?.ExtendedStatus) {
                    objPath = objPath.ExtendedStatus[0];
                    if (objPath?.ExtendedStatusCd && objPath?.ExtendedStatusDesc) {
                        errorMessage += ` (${objPath.ExtendedStatusCd}): ${objPath.ExtendedStatusDesc}. `;
                    }

                    if (
                        objPath?.ExtendedStatusExt &&
                        objPath?.ExtendedStatusExt[0]['com.libertymutual.ci_ExtendedDataErrorCd'] &&
                        objPath?.ExtendedStatusExt[0]['com.libertymutual.ci_ExtendedDataErrorDesc']
                    ) {
                        objPath = objPath.ExtendedStatusExt;
                        additionalReasons = [];
                        objPath.forEach(reason => {
                            additionalReasons.push(`[${reason['com.libertymutual.ci_ExtendedDataErrorCd']}] ${reason['com.libertymutual.ci_ExtendedDataErrorDesc']}`);
                        });
                    }
                    else {
                        errorMessage += 'Failed to parse error, please review the logs for more details.';
                    }
                }
                else {
                    errorMessage += 'Failed to parse error, please review the logs for more details.';
                }
                return this.client_declined(errorMessage, additionalReasons);
            case "successwithinfo":
                log.debug(`${logPrefix}Quote returned with status Sucess With Info. ` + __location);
                break;
            case "successnopremium":
                let reason = null;

                if (objPath?.ExtendedStatus && Array.isArray(objPath?.ExtendedStatus)) {
                    const reasonObj = objPath.ExtendedStatus.find(s => s.ExtendedStatusCd && typeof s.ExtendedStatusCd === 'string' && s.ExtendedStatusCd.toLowerCase() === "verifydatavalue");
                    reason = reasonObj && reasonObj.ExtendedStatusDesc ? reasonObj.ExtendedStatusDesc[0] : null;
                }
                log.warn(`${logPrefix}Quote was bridged to eCLIQ successfully but no premium was provided. ` + __location);
                if (reason) {
                    log.warn(`${logPrefix}Reason for no premium: ${reason} ` + __location);
                }
                break;
            default:
                log.warn(`${logPrefix}Unknown MsgStatusCd returned in quote response - ${get(objPath, "MsgStatusCd[0]")}, continuing. ` + __location);
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
        if (!get(result, "ACORD.InsuranceSvcRs[0].PolicyRs[0].Policy")) {
            const errorMessage = `Unknown result structure: cannot parse quote information. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        result = get(result, "ACORD.InsuranceSvcRs[0].PolicyRs[0]");
        const policy = get(result, "Policy[0]");
        const underwritingDecisionCd = get(policy, "UnderwritingDecisionInfo[0].SystemUnderwritingDecisionCd[0]")

        if (!underwritingDecisionCd) {
            log.error(`${logPrefix}Policy status not provided, or the result structure has changed. ` + __location);
        }
        else {
            policyStatus = underwritingDecisionCd;
            if (policyStatus?.toLowerCase() === "reject") {
                return this.client_declined(`Application was rejected.`);
            }
        }

        // set quote values from response object, if provided
        const companysQuoteNumber = get(policy, "QuoteInfo[0].CompanysQuoteNumber[0]")

        if (!companysQuoteNumber) {
            log.error(`${logPrefix}Premium and Quote number not provided, or the result structure has changed. ` + __location);
        }
        else {
            if (companysQuoteNumber) {
                quoteNumber = companysQuoteNumber;
            }
            else {
                log.error(`${logPrefix}Quote number not provided, or the result structure has changed. ` + __location);
            }
            const premiumAmt = get(policy, "QuoteInfo[0].InsuredFullToBePaidAmt[0].Amt[0]")

            if (premiumAmt) {
                premium = premiumAmt;
            }
            else {
                log.error(`${logPrefix}Premium not provided, or the result structure has changed. ` + __location);
            }
        }
        const insurerQuoteProposalId = get(policy, ["PolicyExt", "0", "com.libertymutual.ci_QuoteProposalId"])

        if (!insurerQuoteProposalId) {
            log.warn(`${logPrefix}Quote ID for retrieving quote proposal not provided, or result structure has changed. ` + __location);
        }
        else {
            quoteProposalId = insurerQuoteProposalId;
        }

        // check valid limit data structure in response
        const coverages = get(result, "BOPLineBusiness[0].LiabilityInfo[0].GeneralLiabilityClassification[0].Coverage[0]")

        if (!coverages) {
            log.error(`${logPrefix}Liability Limits not provided, or result structure has changed. ` + __location);
        }
        else {
            // limits exist, set them
            const limits = coverages?.Limit || []

            limits.forEach((limit) => {
                const limitAmount = get(limit, "FormatCurrencyAmt[0].Amt[0]");
                switch(get(limit, "LimitAppliesToCd[0]")){
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

        let quoteResult = null;
        if (quoteProposalId) {
            // Liberty's quote proposal endpoint has a tendency to throw 503 (service unavailable), retry up to 5 times to get the quote proposal
            const MAX_RETRY_ATTEMPTS = 5;
            let retry = 0;
            let error = false;
            do {
                retry++;
                try {
                    quoteResult = await getLibertyQuoteProposal(quoteProposalId, auth);
                }
                catch (e) {
                    log.error(`${logPrefix}ATTEMPT ${retry}: ${e}. ${__location}`);
                    error = true;
                    if (retry <= MAX_RETRY_ATTEMPTS) {
                        continue;
                    }
                    else {
                        break;
                    }
                }

                error = false;
            } while (error);
        }

        // comes back as a string, so we search for the XML BinData field and substring it out
        if (quoteResult !== null) {
            const start = quoteResult.indexOf("<BinData>") + 9;
            const end = quoteResult.indexOf("</BinData>");

            if (start === 8 || end === -1) {
                log.warn(`${logPrefix}Quote Proposal Letter not provided, or quote result structure has changed. ` + __location);
            }
            else {
                quoteLetter = quoteResult.substring(start, end);
            }
        }

        // Get quote link
        this.quoteLink = get(result, "ResponseURL[0]")


        // return result based on policy status
        if (policyStatus) {
            switch (policyStatus.toLowerCase()) {
                case "accept":
                    return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter.toString('base64'), quoteMIMEType);
                case "refer":
                    return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter.toString('base64'), quoteMIMEType);
                default:
                    const errorMessage = `Insurer response error: unknown policyStatus - ${policyStatus} `;
                    log.error(logPrefix + errorMessage + __location);
                    return this.client_error(errorMessage, __location);
            }
        }
        else {
            const errorMessage = `Insurer response error: missing policyStatus. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }
    }

    async _getLibertyIndustryCodes() {
        const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;
        const policyEffectiveDate = moment(this.policy.effective_date).format('YYYY-MM-DD HH:mm:ss');
        const applicationDocData = this.applicationDocData;

        const logPrefix = `Liberty Mutual Simple BOP (Appid: ${applicationDocData.applicationId}): `

        // eslint-disable-next-line prefer-const
        const industryQuery = {
            insurerId: this.insurer.id,
            talageIndustryCodeIdList: applicationDocData.industryCode,
            territoryList: applicationDocData.mailingState,
            effectiveDate: {$lte: policyEffectiveDate},
            expirationDate: {$gte: policyEffectiveDate},
            active: true
        }

        // eslint-disable-next-line prefer-const
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
            log.error(`${logPrefix}Error re-retrieving Liberty industry codes. Falling back to original code.` + __location);
            return;
        }

        if (insurerIndustryCodeList && insurerIndustryCodeList.length > 0) {
            this.industry_code = insurerIndustryCodeList;
        }
        else {
            log.warn(`${logPrefix}No industry codes were returned while attempting to re-retrieve Liberty industry codes. Falling back to original code.` + __location);
            this.industry_code = [this.industry_code];
        }

        this.industry_code = this.industry_code.find(ic => ic.attributes.simpleBOP);
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
        const limit = limits.substring(0, index);

        // attempt to convert the passed-in limit to an integer
        let limitInt = 0;
        try {
            limitInt = parseInt(limit, 10);
        }
        catch (e) {
            log.warn(`Error parsing limit: ${e}. Leaving value as-is. ` + __location);
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

}
