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

// these are questions that can be automatically answered through the application process
const defaultedQuestions = [
    "NBOP11", // any losses or claims in the past 3 years?
    "BOP1" // Year business started
];

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
        const deductible = this.getSupportedDeductible(sbopPolicy.deductible);

        const phone = applicationDocData.phone.toString();
        const formattedPhone = `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)}`

        // Liberty Mutual SBOP defaults
        const fireDamage = "1000000";
        const prodCompOperations = "2000000";
        const medicalExpenseLimit = "15000";
        const ECAggregateLimit = "1000000/2000000";

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
        applicationDocData.locations.forEach((location, index) => {
            const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo').att('LocationRef', `L${index}`);
            CommlPropertyInfo.ele('SubjectInsuranceCd', 'BPP');
        });

        // -------------- SEND XML REQUEST ----------------

        // -------------- PARSE XML RESPONSE ----------------

        console.log(this.request_id);
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