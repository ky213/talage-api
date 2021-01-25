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
const tracker = global.requireShared('./helpers/tracker.js');

// The PerOcc field only is used, these are the Simple BOP supported limits for LM 
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
        const sbopPolicy = applicationDocData.policies.find(p => p.policyType === "BOP"); // This may need to change to BOPSR?

        if (!sbopPolicy) {
            return this.client_error(`Liberty: Could not find a policy with type BOP.`);
        }

        // Assign the closest supported limit for Per Occ
        const limit = this.getSupportedLimit(sbopPolicy.limits);

        // NOTE: Liberty Mutual does not accept these values at this time. Automatically defaulted on their end...
        const deductible = this.getSupportedDeductible(sbopPolicy.deductible);
        const fireDamage = "1000000"; // we do not store this data currently
        const prodCompOperations = "2000000"; // we do not store this data currently
        const medicalExpenseLimit = "15000"; // we do not store this data currently
        const ECAggregateLimit = "1000000/2000000"; // we do not store this data currently

        const phone = applicationDocData.phone.toString();
        const formattedPhone = `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)}`;

        // used for implicit question NBOP11: any losses or claims in the past 3 years?
        const claimsPast3Years = 
            applicationDocData.claims.length === 0 || 
            applicationDocData.claims.find(c => moment().diff(moment(c.eventDate), 'years', true) >= 3) ?
                "NO" :
                "YES";

        // used for implicit question NBOP1: Year business started
        const yearBusinessStarted = moment(applicationDocData.founded).format('YYYY');

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
        ProducerInfo.ele(
            'ContractNumber', this.insurer.useSandbox ? '4689905' : this.app.agencyLocation.insurers[this.insurer.id].agency_id
        ).att('SourceSystemRef', 'Talage');

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
        Addr.ele('PostalCode', applicationDocData.mailingZipcode);
        const Communications = GeneralPartyInfo.ele('Communications');
        const PhoneInfo = Communications.ele('PhoneInfo');
        PhoneInfo.ele('PhoneTypeCd', 'Phone');
        PhoneInfo.ele('PhoneNumber', formattedPhone);

        // <InsuredOrPrincipalInfo>
        //     <InsuredOrPrincipalRoleCd>FNI</InsuredOrPrincipalRoleCd>
        //     <BusinessInfo>
        //         <BusinessStartDt>2015</BusinessStartDt>
        //     </BusinessInfo>
        // </InsuredOrPrincipalInfo>

        const InsuredOrPrincipalInfo = InsuredOrPrincipal.ele('InsuredOrPrincipalInfo');
        InsuredOrPrincipalInfo.ele('InsuredOrPrincipalRoleCd', 'FNI'); // Per Liberty, "first name insured" is the only valid value
        const BusinessInfo = InsuredOrPrincipalInfo.ele('BusinessInfo');
        BusinessInfo.ele('BusinessStartDt', moment(applicationDocData.founded).format('YYYY'));

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
        ContractTerm.ele('EffectiveDt', moment(sbopPolicy.effectiveDate).format('YYYY-MM-DD'));
        // ContractTerm.ele('ExpirationDt', ...) is defaulted to 12 months from EffectiveDt by Liberty Mutual, not including

        // add the questions that were answered (not hidden)
        applicationDocData.questions.filter(q => !q.hidden).forEach(q => {
            const questionId = this.question_identifiers[q.questionId];
            if (questionId) {
                const QuestionAnswer = Policy.ele('QuestionAnswer');
                QuestionAnswer.ele('QuestionCd', questionId);
                QuestionAnswer.ele('YesNoCd', q.answerValue.toUpperCase());
            } else {
                log.error(`Liberty Mutual Error: Could not find insurer question identifier for question: ${q.questionId}. Not sending question to insurer...`);
            }
        });

        // add implicit questions
        const implicitQuestion1 = Policy.ele('QuestionAnswer');
        implicitQuestion1.ele('QuestionCd', 'NBOP11');
        implicitQuestion1.ele('YesNoCd', claimsPast3Years);
        const implicitQuestion2 = Policy.ele('QuestionAnswer');
        implicitQuestion2.ele('QuestionCd', 'NBOP1');
        implicitQuestion2.ele('YesNoCd', yearBusinessStarted);

        const PolicyExt = Policy.ele('PolicyExt');
        PolicyExt.ele('com.libertymutual.ci_BusinessClassDesc', this.industry_code.insurerDescription);
        PolicyExt.ele('com.libertymutual.ci_BusinessClassId', this.industry_code.code);

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
            subAddr.ele('PostalCode', location.zipcode);
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
            FormatCurrencyAmt.ele('Amt', "10000"); // defaulted to LM's max limit of $10,000
            Limit.ele('LimitAppliesToCd', 'PerOcc');
        }

        // <LiabilityInfo>
        //     <GeneralLiabilityClassification LocationRef="Wc3a968def7d94ae0acdabc4d95c34a86W">
        //         <Coverage>
        //             <CoverageCd>LBMED</CoverageCd>
        //             <Limit>
        //                 <FormatCurrencyAmt>
        //                     <Amt>1000000</Amt>
        //                 </FormatCurrencyAmt>
        //                 <LimitAppliesToCd>"PerOcc"</LimitAppliesToCd>
        //             </Limit>
        //             <Option>
        //                 <OptionCd>PartTime</OptionCd>
        //                 <OptionValue>0.0</OptionValue>
        //             </Option>
        //             <Option>
        //                 <OptionCd>FullTime</OptionCd>
        //                 <OptionValue>1.0</OptionValue>
        //             </Option>
        //             <Option>
        //                 <OptionCd>EMPL</OptionCd>
        //                 <OptionValue>1.0</OptionValue>
        //             </Option>
        //         </Coverage>
        //         <ClassCd>89391</ClassCd>
        //     </GeneralLiabilityClassification>
        // </LiabilityInfo>

        const LiabilityInfo = BOPLineBusiness.ele('LiabilityInfo');
        applicationDocData.locations.forEach((location, index) => {
            const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification').att('LocationRef', `L${index}`);
            const Coverage = GeneralLiabilityClassification.ele('Coverage');
            Coverage.ele('CoverageCd', 'LBMED');
            const Limit = Coverage.ele('Limit');
            const innerFormatCurrencyAmt = Limit.ele('FormatCurrencyAmt');
            innerFormatCurrencyAmt.ele('Amt', limit);
            Limit.ele('LimitAppliesToCd', 'PerOcc');
            const Option1 = Coverage.ele('Option');
            Option1.ele('OptionCd', 'PartTime');
            Option1.ele('OptionValue', `${location.part_time_employees}.0`);
            const Option2 = Coverage.ele('Option');
            Option2.ele('OptionCd', 'FullTime');
            Option2.ele('OptionValue', `${location.full_time_employees}.0`);
            const Option3 = Coverage.ele('Option');
            Option3.ele('OptionCd', 'EMPL');
            Option3.ele('OptionValue', `${location.part_time_employees + location.full_time_employees}.0`);
            Coverage.ele('ClassCd', this.industry_code.code);
        });

        // -------------- SEND XML REQUEST ----------------

        // Get the XML structure as a string
        const xml = ACORD.end({'pretty': true});

        // Determine which URL to use
        const host = 'ci-policyquoteapi.libertymutual.com';
        const path = `/v1/quotes?partnerID=${this.username}`;

        let result = null;
        try {
            result = await this.send_xml_request(host, path, xml, {'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`});
        } catch (e) {
            log.error(`An error occurred! ${e}.`);
            return this.client_declined(e);
        }        

        // -------------- PARSE XML RESPONSE ----------------

        if (!result.ACORD || !result.ACORD.Status || typeof result.ACORD.Status[0].StatusCd === 'undefined') {
            console.log(JSON.stringify(result, null, 4));
            const errorMessage = `Liberty Mutual: Unknown result structure: cannot parse result.`;
            log.error(errorMessage);
            return this.client_declined(errorMessage);
        }

        if (result.ACORD.Status[0].StatusCd[0] !== '0') {
            const errorMessage = `Liberty Mutual: Unknown status code returned in quote response: ${result.ACORD.Status[0].StatusCd}.`;
            log.error(errorMessage);
            return this.client_declined(errorMessage);
        }

        if (
            !result.ACORD.InsuranceSvcRs || 
            !result.ACORD.InsuranceSvcRs[0].PolicyRs ||
            !result.ACORD.InsuranceSvcRs[0].PolicyRs[0].MsgStatus
        ) {
            const errorMessage = `Liberty Mutual: Unknown result structure, no message status: cannot parse result.`;
            log.error(errorMessage);
            return this.client_declined(errorMessage);
        }

        let objPath = result.ACORD.InsuranceSvcRs[0].PolicyRs[0].MsgStatus[0];

        if (objPath.MsgStatusCd[0].toLowerCase() === "error") {
            let additionalReasons = null;
            let errorMessage = 'Liberty Mutual: ';
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
                        objPath.forEach(reason => {
                            additionalReasons.push(`[${reason['com.libertymutual.ci_ExtendedDataErrorCd']}] ${reason['com.libertymutual.ci_ExtendedDataErrorDesc']}`);
                        });
                    }
                } else {
                    errorMessage += 'Please review the logs for more details.';
                }
            }

            return this.client_declined(errorMessage, additionalReasons);
        }

        // PARSE SUCCESSFUL PAYLOAD

        // console.log(JSON.stringify(xml, null, 4));
        console.log(xml);
        console.log(JSON.stringify(result, null, 4));
        process.exit(-1);
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
        let limit = limits.substring(0, index)

        // attempt to convert the passed-in limit to an integer
        let limitInt = 0;
        try {
            limitInt = parseInt(limit, 10);
        } catch (e) {
            log.warning(`Error parsing limit: ${e}. Leaving value as-is.`);
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
                } else {
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
                } else {
                    return `${upperLimit}`;
                }
        }
    }
}