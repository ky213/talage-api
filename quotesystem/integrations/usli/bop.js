/* eslint-disable array-element-newline */
/* eslint-disable space-before-function-paren */
/* eslint-disable object-property-newline */
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

let logPrefix = '';
let applicationDocData = null;
let industryCode = null;

// A list of question indentifiers for questions that are manually added into specific parts of the request
// This list ensures the questions do not show up in the request, as they are custom Talage questions
const ignoredQuestionIds = [
    "usli.building.roofingMaterial",
    "usli.general.terrorismCoverage",
    "usli.building.fireProtectionClassCd",
    "usli.building.requestedValuationTypeCd",
    "usli.building.yearOccupiedLocation",
    "usli.general.operationsDesc",
    "usli.location.exposure.totalGallonsOfFuel",
    "usli.location.exposure.numAcres",
    "usli.location.exposure.totalAdmissions",
    "usli.location.exposure.numStudents",
    "usli.location.exposure.numKennels",
    "usli.location.exposure.totalEvents",
    "usli.location.exposure.yearlyExhibitions",
    "usli.location.exposure.numTeachersInstructors",
    "usli.location.exposure.numPoolsTubs",
    "usli.location.exposure.grossSales",
    "usli.location.exposure.annualSubcontractedCost"
];

// EAOCC/GENAG/PRDCO
// NOTE: PIADV = EAOCC
// "500000/1000000/1000000"
// "1000000/2000000/2000000"
// "2000000/4000000/4000000"
// This is a map of our options to theirs. If an option doesn't map, default to their highest supported limits
const supportedLimitsMap = {
    "100000010000001000000": [
        "1000000", 
        "2000000",
        "2000000"
    ],
    "100000020000001000000": [
        "1000000", 
        "2000000",
        "2000000"
    ],
    "100000020000002000000": [
        "1000000", 
        "2000000",
        "2000000"
    ],
    "200000040000004000000": [
        "2000000",
        "4000000",
        "4000000"
    ]
};

const fireProtectionClassCodes = [
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10"
];

const requestedValuationTypeCodes = {
    "Actual Cash Value": "ACV",
    "Replacement Cost": "RC"
};

// key value map where key is OUR options, value is THEIR data
// NOTE: Options we do not support are commented out
const constructionCodes = {
    "Frame": {
        desc: "Frame",
        code: "F"
    },
    // "": {
    //     desc: "Veneer",
    //     code: "F"
    // },
    "Joisted Masonry": {
        desc: "Joisted Masonry",
        code: "JM"
    },
    // "": {
    //     desc: "Light Non-Combustible",
    //     code: "NC"
    // },
    "Non Combustible": {
        desc: "Non-Combustuble",
        code: "NC"
    },
    "Masonry Non Combustible": {
        desc: "Masonry Non-Combustible",
        code: "MNC"
    },
    // "": {
    //     desc: "Masonry Non-Combustible with Wind Resistive Roof",
    //     code: "MFR"
    // },
    "Fire Resistive": {
        desc: "Fire-Resistive",
        code: "FR"
    },
    "Other": {
        desc: "Other",
        code: "OT"
    }
};

// options we do not support in our existing talage question are commented out
const roofingMaterials = {
    "Asphalt Shingles": "ASPHS",
    "Clay or Concrete Tile": "CONCRETE",
    "Metal": "METL",
    // "": "SLAT", // Slate
    // "": "TILE", // Tile
    "Wood Shingles/Shakes": "WOODK",
    "Other": "OT"
};

let terrorismCoverageIncluded = false;

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

        industryCode = await this.getUSLIIndustryCode();

        if (!industryCode) {
            const errorMessage = `No Industry Code was found for Commercial BOP. `;
            log.warn(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_autodeclined_out_of_appetite();
        }

        // if there's no BOP policy, error out
        if (!BOPPolicy) {
            const errorMessage = `Could not find a policy with type BOP.`;
            log.error(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_error(errorMessage, __location);
        }

        const UUID = this.generate_uuid();

        // ------------- CREATE XML REQUEST ---------------

        const ACORD = builder.create('ACORD', {'encoding': 'UTF-8'});

        // <ACORD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/" xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">
        //     <SignonRq>
        //         <SignonPswd xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
        //             <CustId>
        //                 <SPName>com.usli</SPName>
        //                 <CustLoginId>APIcombinedtest</CustLoginId>
        //             </CustId>
        //             <CustPswd>
        //                 <EncryptionTypeCd>NONE</EncryptionTypeCd>
        //                 <Pswd>6RME0D</Pswd>
        //             </CustPswd>
        //             <GenSessKey>false</GenSessKey>
        //         </SignonPswd>
        //         <CustLangPref xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">en</CustLangPref>
        //         <ClientApp xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
        //             <Version>0</Version>
        //         </ClientApp>
        //         <SuppressEcho xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">false</SuppressEcho>
        //     </SignonRq>

        const SignonRq = ACORD.ele('SignonRq');
        const SignonPswd = SignonRq.ele('SignonPswd').att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        const CustId = SignonPswd.ele('CustId');
        CustId.ele('SPName', 'com.usli');
        CustId.ele('CustLoginId', this.username);
        const CustPswd = SignonPswd.ele('CustPswd');
        CustPswd.ele('EncryptionTypeCd', 'NONE');
        CustPswd.ele('Pswd', this.password);
        SignonRq.ele('GenSessKey', false);
        // SignonRq.ele('ClientDt', moment().local().format());
        SignonRq.ele('CustLangPref', 'en').att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        const ClientApp = SignonRq.ele('ClientApp').att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        ClientApp.ele('Version', "2.0");
        SignonRq.ele('SuppressEcho', false).att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");

        //     <InsuranceSvcRq>

        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');

        //         <RqUID xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">3d792504-9f1d-49e7-82e5-7a7ac8327b6b</RqUID>
        //         <SPName xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">com.usli</SPName>

        InsuranceSvcRq.ele('RqUID', UUID).att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        InsuranceSvcRq.ele('SPName', "com.usli").att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");

        //         <CommlPkgPolicyQuoteInqRq>

        const CommlPkgPolicyQuoteInqRq = InsuranceSvcRq.ele('CommlPkgPolicyQuoteInqRq');

        //             <RqUID xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">3d792504-9f1d-49e7-82e5-7a7ac8327b6b</RqUID>
        //             <CurCd xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">USD</CurCd>

        CommlPkgPolicyQuoteInqRq.ele('RqUID', UUID).att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        CommlPkgPolicyQuoteInqRq.ele('CurCd', "USD").att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");

        //             <Producer xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
        //                 <ItemIdInfo>
        //                     <InsurerId>1065</InsurerId>
        //                 </ItemIdInfo>
        //                 <GeneralPartyInfo>
        //                     <NameInfo>
        //                         <CommlName>
        //                             <CommercialName>COMBINED GROUP INSURANCE SERVICES</CommercialName>
        //                         </CommlName>
        //                     </NameInfo>
        //                     <NameInfo>
        //                         <PersonName>
        //                             <Surname>Combined Test</Surname>
        //                             <GivenName>API</GivenName>
        //                         </PersonName>
        //                     </NameInfo>
        //                     <Communications>
        //                         <EmailInfo>
        //                             <EmailAddr>bpoole@quantumsys.net</EmailAddr>
        //                             <DoNotContactInd>false</DoNotContactInd>
        //                         </EmailInfo>
        //                     </Communications>
        //                 </GeneralPartyInfo>
        //                 <ProducerInfo>
        //                     <ProducerRoleCd>Agency</ProducerRoleCd>
        //                 </ProducerInfo>
        //             </Producer>

        // TODO: Look into this, I think this is agent information, so we may not include most of this...
        const Producer = CommlPkgPolicyQuoteInqRq.ele('Producer').att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        Producer.ele('ItemIdInfo', '1065');
        const PGeneralPartyInfo = Producer.ele('GeneralPartyInfo');
        const NameInfo1 = PGeneralPartyInfo.ele('NameInfo');
        const CommlName = NameInfo1.ele('CommlName');
        CommlName.ele('CommercialName', applicationDocData.businessName);
        const NameInfo2 = PGeneralPartyInfo.ele('NameInfo');
        const PersonName = NameInfo2.ele('PersonName');
        // PersonName.ele('Surname')
        PersonName.ele('GivenName', `${applicationDocData.firstName} ${applicationDocData.lastName}`);
        const Communications = PGeneralPartyInfo.ele('Communications');
        const EmailInfo = Communications.ele('EmailInfo');
        EmailInfo.ele('EmailAddr', applicationDocData.emailAddress); // TODO: See if this is ok if no email is provided
        EmailInfo.ele('DoNotContactInd', false);
        const ProducerInfo = Producer.ele('ProducerInfo');
        ProducerInfo.ele('ProducerRoleCd', 'Agency');

        //             <InsuredOrPrincipal xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
        //                 <GeneralPartyInfo>
        //                     <NameInfo>
        //                         <CommlName>
        //                             <CommercialName>CommercialPackageTestXMLCombinedGroup1</CommercialName>
        //                         </CommlName>
        //                         <LegalEntityCd id="INDIVIDUAL">IN</LegalEntityCd>
        //                     </NameInfo>
        //                     <Addr>
        //                         <AddrTypeCd>InsuredsAddress</AddrTypeCd>
        //                         <Addr1>123 Main Street</Addr1>
        //                         <City>Katy</City>
        //                         <StateProvCd>TX</StateProvCd>
        //                         <PostalCode>77493</PostalCode>
        //                         <CountryCd>USA</CountryCd>
        //                     </Addr>
        //                     <Communications>
        //                         <PhoneInfo>
        //                             <DoNotContactInd>false</DoNotContactInd>
        //                         </PhoneInfo>
        //                     </Communications>
        //                 </GeneralPartyInfo>

        const InsuredOrPrincipal = CommlPkgPolicyQuoteInqRq.ele('InsuredOrPrincipal').att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        const IPGeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');
        const GPINameInfo = IPGeneralPartyInfo.ele('NameInfo');
        const GPICommlName = GPINameInfo.ele('CommlName');
        GPICommlName.ele('CommercialName', applicationDocData.bussinessName);
        const entityType = getEntityType();
        GPINameInfo.ele('LegalEntityCd', entityType.abbr).att('id', entityType.id);
        const GPIAddr = IPGeneralPartyInfo.ele('Addr');
        GPIAddr.ele('AddrTypeCd', "InsuredsAddress");
        GPIAddr.ele('Addr1', applicationDocData.mailingAddress);
        GPIAddr.ele('City', applicationDocData.mailingCity);
        GPIAddr.ele('StateProvCd', applicationDocData.mailingState);
        GPIAddr.ele('PostalCode', applicationDocData.mailingZipcode.substring(0, 5));
        GPIAddr.ele('CountryCd', "USA");
        const GPICommunications = IPGeneralPartyInfo.ele('Communications');
        const GPIPhoneInfo = GPICommunications.ele('PhoneInfo');
        GPIPhoneInfo.ele('DoNotContactInd', false);


        //                 <InsuredOrPrincipalInfo>
        //                     <InsuredOrPrincipalRoleCd>Insured</InsuredOrPrincipalRoleCd>
        //                     <PersonInfo>
        //                         <LengthTimeEmployed>
        //                             <NumUnits>0</NumUnits>
        //                         </LengthTimeEmployed>
        //                         <LengthTimeCurrentOccupation>
        //                             <NumUnits>0</NumUnits>
        //                         </LengthTimeCurrentOccupation>
        //                         <LengthTimeWithPreviousEmployer>
        //                             <NumUnits>0</NumUnits>
        //                         </LengthTimeWithPreviousEmployer>
        //                         <LengthTimeCurrentAddr>
        //                             <StartTime>00:00:00.0000000-04:00</StartTime>
        //                             <EndTime>00:00:00.0000000-04:00</EndTime>
        //                             <LocalStandardTimeInd>false</LocalStandardTimeInd>
        //                             <DurationPeriod>
        //                                 <NumUnits>0</NumUnits>
        //                             </DurationPeriod>
        //                             <ContinuousInd>false</ContinuousInd>
        //                             <GB.BothDaysInclusiveInd>false</GB.BothDaysInclusiveInd>
        //                         </LengthTimeCurrentAddr>
        //                         <DoNotSolicitInd>false</DoNotSolicitInd>
        //                         <NumDependents>0</NumDependents>
        //                         <CoInsuredSameAddressInsuredInd>false</CoInsuredSameAddressInsuredInd>
        //                     </PersonInfo>
        //                     <BusinessInfo>
        //                         <BusinessStartDt>-1</BusinessStartDt>
        //                         <OperationsDesc>Apartment</OperationsDesc>
        //                     </BusinessInfo>
        //                 </InsuredOrPrincipalInfo>
        //             </InsuredOrPrincipal>

        // NOTE: This whole section is currently defaulted to 0'd values
        const InsuredOrPrincipalInfo = InsuredOrPrincipal.ele('InsuredOrPrincipalInfo');
        InsuredOrPrincipalInfo.ele('InsuredOrPrincipalRoleCd', "Insured");
        const IPIPersonInfo = InsuredOrPrincipalInfo.ele('PersonInfo');
        const LengthTimeEmployed = IPIPersonInfo.ele('LengthTimeEmployed');
        LengthTimeEmployed.ele('NumUnits', 0); // NOTE: not asking and defaulting to 0, not required by USLI
        const LengthTimeCurrentOccupation = IPIPersonInfo.ele('LengthTimeCurrentOccupation');
        LengthTimeCurrentOccupation.ele('NumUnits', 0); // NOTE: not asking and defaulting to 0, not required by USLI
        const LengthTimeWithPreviousEmployer = IPIPersonInfo.ele('LengthTimeWithPreviousEmployer');
        LengthTimeWithPreviousEmployer.ele('NumUnits', 0); // NOTE: not asking and defaulting to 0, not required by USLI
        const LengthTimeCurrentAddr = IPIPersonInfo.ele('LengthTimeCurrentAddr');
        LengthTimeCurrentAddr.ele('StartTime', "00:00:00.0000000-04:00"); // NOTE: not asking and defaulting to 0, not required by USLI
        LengthTimeCurrentAddr.ele('EndTime', "00:00:00.0000000-04:00"); // NOTE: not asking and defaulting to 0, not required by USLI
        LengthTimeCurrentAddr.ele('LocalStandardTimeInd', false);
        const LTCADurationPeriod = LengthTimeCurrentAddr.ele('DurationPeriod');
        LTCADurationPeriod.ele('NumUnits', 0);
        LengthTimeCurrentAddr.ele('ContinuousInd', false);
        LengthTimeCurrentAddr.ele('GB.BothDaysInclusiveInd', false);
        const IPIBusinessInfo = InsuredOrPrincipalInfo.ele('BusinessInfo');
        IPIBusinessInfo.ele('BusinessStartDt', moment(applicationDocData.founded).year());
        const operationsDescQuestion = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "usli.general.operationsDesc");
        const operationsDesc = operationsDescQuestion ? operationsDescQuestion.answerValue : "Not Provided";
        IPIBusinessInfo.ele('OperationsDesc', operationsDesc);


        //             <CommlPolicy xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
        //                 <CompanyProductCd>050070</CompanyProductCd>
        //                 <LOBCd>CPKGE</LOBCd>
        //                 <NAICCd>26522</NAICCd>
        //                 <ControllingStateProvCd>TX</ControllingStateProvCd>
        //                 <ContractTerm>
        //                     <EffectiveDt>2022-04-17</EffectiveDt>
        //                     <ExpirationDt>2023-04-17</ExpirationDt>
        //                     <DurationPeriod>
        //                         <NumUnits>12</NumUnits>
        //                         <UnitMeasurementCd>month</UnitMeasurementCd>
        //                     </DurationPeriod>
        //                 </ContractTerm>
        //                 <PrintedDocumentsRequestedInd>false</PrintedDocumentsRequestedInd>
        //                 <TotalPaidLossAmt>
        //                     <Amt>0</Amt>
        //                 </TotalPaidLossAmt>
        //                 <NumLosses>0</NumLosses>
        //                 <NumLossesYrs>0</NumLossesYrs>
        //                 <FutureEffDateInd>false</FutureEffDateInd>
        //                 <FutureEffDateNumDays>0</FutureEffDateNumDays>
        //                 <InsuredRequestsPrintedDocumentsInd>false</InsuredRequestsPrintedDocumentsInd>
        //                 <CommlPolicySupplement>
        //                     <PolicyTypeCd>SPC</PolicyTypeCd>
        //                 </CommlPolicySupplement>
        //                 <WrapUpInd>false</WrapUpInd>
        //                 <CommlCoverage>
        //                     <CoverageCd>STMPF</CoverageCd>
        //                     <CoverageDesc>Stamping Fee</CoverageDesc>
        //                     <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
        //                     <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
        //                     <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
        //                 </CommlCoverage>
        //                 <CommlCoverage>
        //                     <CoverageCd>SPLTX</CoverageCd>
        //                     <CoverageDesc>Surplus Lines Tax</CoverageDesc>
        //                     <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
        //                     <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
        //                     <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
        //                 </CommlCoverage>
        //                 <AnyLossesAccidentsConvictionsInd>false</AnyLossesAccidentsConvictionsInd>
        //                 <usli:DynamicQuestion xmlns="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/" xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">
        //                     <usli:QuestionID>10345</usli:QuestionID>
        //                     <usli:QuestionType>Applicant</usli:QuestionType>
        //                     <usli:Answer>Unknown</usli:Answer>
        //                 ... general questions continue here...
        //                 <usli:Status xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">Quote</usli:Status>
        //                 <usli:Carrier xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">MTV</usli:Carrier>
        //                 <usli:FilingId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FilingId>
        //                 <usli:IsUnsolicited xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsUnsolicited>
        //             </CommlPolicy>

        const CommlPolicy = CommlPkgPolicyQuoteInqRq.ele('CommlPolicy').att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        CommlPolicy.ele('CompanyProductCd', "050070"); // Hard coded per Combined Group's advice
        CommlPolicy.ele('LOBCd', "CPKGE");
        const NAICSCd = await getNAICSCode();
        CommlPolicy.ele('NAICCd', NAICSCd);
        CommlPolicy.ele('ControllingStateProvCd', applicationDocData.mailingState);
        const ContractTerm = CommlPolicy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', moment(BOPPolicy.effectiveDate).format("YYYY-MM-DD"));
        ContractTerm.ele('ExpirationDt', moment(BOPPolicy.expirationDate).format("YYYY-MM-DD"));
        const DurationPeriod = ContractTerm.ele('DurationPeriod');
        DurationPeriod.ele('NumUnits', moment(applicationDocData.expirationDate).diff(applicationDocData.effectiveDate, "months"));
        DurationPeriod.ele('UnitMeasurementCd', "month");
        CommlPolicy.ele('PrintedDocumentsRequestedInd', false);
        const TotalPaidLossAmt = CommlPolicy.ele('TotalPaidLossAmt');
        TotalPaidLossAmt.ele('Amt', this.get_total_amount_paid_on_claims());
        CommlPolicy.ele('NumLosses', applicationDocData.claims.length);
        CommlPolicy.ele('NumLossesYrs', 0);
        CommlPolicy.ele('FutureEffDateInd', false);
        CommlPolicy.ele('FutureEffDateNumDays', 0);
        CommlPolicy.ele('InsuredRequestsPrintedDocumentsInd', false);
        const CommlPolicySupplement = CommlPolicy.ele('CommlPolicySupplement'); // TODO: IS THIS NEEDED, WHAT IS THIS?
        CommlPolicySupplement.ele('PolicyTypeCd', "SPC"); // TODO: IS THIS NEEDED, WHAT IS THIS?
        CommlPolicy.ele('WrapUpInd', false);
        // NOTE: Defaulting Stamping Fee, this is not required and returned by USLI
        const STMPFCommlCoverage = CommlPolicy.ele('CommlCoverage');
        STMPFCommlCoverage.ele('CoverageCd', "STMPF");
        STMPFCommlCoverage.ele('CoverageDesc', "Stamping Fee");
        STMPFCommlCoverage.ele('usli:CoverageTypeId', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
        STMPFCommlCoverage.ele('usli:FireCoverageTypeId', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
        STMPFCommlCoverage.ele('usli:IsLeasedOccupancy', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
        // NOTE: Defaulting Surplus Lines Tax, this is not required and returned by USLI
        const SPLTXCommlCoverage = CommlPolicy.ele('CommlCoverage');
        SPLTXCommlCoverage.ele('CoverageCd', "SPLTX");
        SPLTXCommlCoverage.ele('CoverageDesc', "Surplus Lines Tax");
        SPLTXCommlCoverage.ele('usli:CoverageTypeId', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
        SPLTXCommlCoverage.ele('usli.FireCoverageTypeId', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
        SPLTXCommlCoverage.ele('usli.IsLeasedOccupancy', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");

        CommlPolicy.ele('AnyLossesAccidentsConvictions', applicationDocData.claims.length > 0);
        // general questions go here...
        // TODO: Check if we need to add a check if these questions can have type Classification, if so, they will need the ClassificationRef attribute
        applicationDocData.questions.forEach(question => {
            if (!ignoredQuestionIds.includes(question.insurerQuestionIdentifier)) {
                const usliDynamicQuestion = CommlPolicy.ele('usli:DynamicQuestion').att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
                usliDynamicQuestion.ele('usli:QuestionId', question.insurerQuestionIdentifier);
                usliDynamicQuestion.ele('usli:QuestionType', "Applicant");
                usliDynamicQuestion.ele('usli:Answer', question.answerValue);
            }
        });

        // location questions also go here...
        applicationDocData.locations.forEach((location, index) => {
            const locRef = index + 1;
            location.questions.forEach(question => {
                if (!ignoredQuestionIds.includes(question.insurerQuestionIdentifier)) {
                    const usliDynamicQuestion = CommlPolicy.ele('usli:DynamicQuestion').att('LocationRef', locRef).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
                    if (question?.insurerQuestionAttributes?.questionType === "Classification") {
                        usliDynamicQuestion.att('ClassificationRef', "C1");
                    }
                    usliDynamicQuestion.ele('usli:QuestionId', question.insurerQuestionIdentifier);
                    usliDynamicQuestion.ele('usli:QuestionType', "Applicant");
                    usliDynamicQuestion.ele('usli:Answer', question.answerValue); 
                }
            });
        });
        
        CommlPolicy.ele('usli:Status', "Quote").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
        CommlPolicy.ele('usli:Carrier', "MTV").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
        CommlPolicy.ele('usli:FilingId', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
        CommlPolicy.ele('usli:IsUnsolicted', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");

        applicationDocData.locations.forEach((location, index) => {
            //             <Location id="1" xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
            //                 <Addr>
            //                     <AddrTypeCd>PhysicalRisk</AddrTypeCd>
            //                     <Addr1>123 Main Street</Addr1>
            //                     <City>Katy</City>
            //                     <StateProvCd>TX</StateProvCd>
            //                     <PostalCode>77493</PostalCode>
            //                     <CountryCd>USA</CountryCd>
            //                     <County>Harris</County>
            //                 </Addr>
            //             </Location>

            const Location = CommlPkgPolicyQuoteInqRq.ele('Location').att('id', index + 1).att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
            const Addr = Location.ele('Addr');
            Addr.ele('AddrTypeCd', "PhysicalRisk");
            Addr.ele('Addr1', location.address);
            Addr.ele('City', location.city);
            Addr.ele('StateProvCd', location.state);
            Addr.ele('PostalCode', location.zipcode.substring(0, 5));
            Addr.ele('CountryCd', "USA");
            // NOTE: leaving out County for now...

            //             <CommlSubLocation LocationRef="1" xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
            //                 <Construction>
            //                     <ConstructionCd>F</ConstructionCd>
            //                     <Description>Frame</Description>
            //                     <YearBuilt>2010</YearBuilt>
            //                     <BldgArea>
            //                         <NumUnits>4000</NumUnits>
            //                     </BldgArea>
            //                     <RoofingMaterial>
            //                         <RoofMaterialCd>ASPHS</RoofMaterialCd>
            //                     </RoofingMaterial>
            //                     <usli:PlumbingCd xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">PVC</usli:PlumbingCd>
            //                 </Construction>
            //                 <BldgImprovements>
            //                     <RoofingImprovementYear>2010</RoofingImprovementYear>
            //                 </BldgImprovements>
            //                 <BldgProtection>
            //                     <FireProtectionClassCd>1</FireProtectionClassCd>
            //                     <ProtectionDeviceBurglarCd>NotAnswered</ProtectionDeviceBurglarCd>
            //                     <ProtectionDeviceSmokeCd>0</ProtectionDeviceSmokeCd>
            //                     <ProtectionDeviceSprinklerCd>Unknown</ProtectionDeviceSprinklerCd>
            //                     <SprinkleredPct>0</SprinkleredPct>
            //                 </BldgProtection>
            //                 <BldgOccupancy>
            //                     <usli:YearsAtCurrentLocation xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:YearsAtCurrentLocation>
            //                     <usli:YearOccupiedCurrentLocation xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:YearOccupiedCurrentLocation>
            //                 </BldgOccupancy>
            //                 <RequestedValuationTypeCd>RC</RequestedValuationTypeCd>
            //                 <usli:Perils xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">Special Excluding Wind And Hail</usli:Perils>
            //                 <usli:RequestedCauseOfLossCd xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">SPC</usli:RequestedCauseOfLossCd>
            //             </CommlSubLocation>

            const CommlSubLocation = CommlPkgPolicyQuoteInqRq.ele('CommlSubLocation').att('LocationRef', index + 1).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            const Construction = CommlSubLocation.ele('Construction');
            const constructionType = constructionCodes[location.constructionType] ? constructionCodes[location.constructionType] : {desc: "Other", code: "OT"};
            Construction.ele('ConstructionCd', constructionType.code);
            Construction.ele('Description', constructionType.desc);
            Construction.ele('YearBuilt', location.yearBuilt);
            const BldgArea = Construction.ele('BldgArea');
            BldgArea.ele('NumUnits', location.square_footage);
            const RoofingMaterial = Construction.ele('RoofingMaterial');
            const roofingMaterialQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.building.roofingMaterial");
            const roofingMaterial = roofingMaterialQuestion && roofingMaterials[roofingMaterialQuestion.answerValue] ? roofingMaterials[roofingMaterialQuestion.answerValue] : "OT"; 
            RoofingMaterial.ele('RoofMaterialCd', roofingMaterial);
            const BldgImprovements = CommlSubLocation.ele('BldgImprovements');
            BldgImprovements.ele('RoofingImprovementYear', location.bop.roofingImprovementYear);
            const BldgProtection = CommlSubLocation.ele('BldgProtection');
            const fireProtectionCdQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.building.fireProtectionClassCd");
            let fireProtectionClassCd = "01";
            if (fireProtectionCdQuestion) {
                if (fireProtectionClassCodes.includes(fireProtectionCdQuestion.answerValue)) {
                    fireProtectionClassCd = fireProtectionCdQuestion.answerValue;
                }
            }
            BldgProtection.ele('FireProtectionClassCd', fireProtectionClassCd);
            BldgProtection.ele('ProtectionDeviceBurglarCd', "Unknown");
            BldgProtection.ele('ProtectionDeviceSmokeCd', 0);
            BldgProtection.ele('ProtectionDeviceSprinkler', location.bop.sprinklerEquipped ? "FullSprinkler" : "Unknown");
            BldgProtection.ele('SprinklerPct', 0) // NOTE: Defaulting to 0% for now, we may need to add a question for this
            const BldgOccupancy = CommlSubLocation.ele('BldgOccupancy');
            const yearOccupiedLocationQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.building.yearOccupiedLocation");
            let yearOccupied = 0;
            let yearAtLocation = 0;
            if (yearOccupiedLocationQuestion) {
                yearOccupied = parseInt(yearOccupiedLocationQuestion.answerValue, 10);
                if (!isNaN(yearOccupied)) {
                    yearAtLocation = moment().year() - yearOccupied;
                }
                else {
                    yearOccupied = 0;
                }
            }
            BldgOccupancy.ele('usli:YearsAtCurrentLocation', yearAtLocation).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            BldgOccupancy.ele('usli:YearOccupiedCurrentLocation', yearOccupied).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            const requestedValuationTypeQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.building.requestedValuationTypeCd");
            let requestedValuationTypeCd = "RC";
            if (requestedValuationTypeQuestion) {
                if (requestedValuationTypeCodes[requestedValuationTypeQuestion.answerValue]) {
                    requestedValuationTypeCd = requestedValuationTypeCodes[requestedValuationTypeQuestion.answerValue];
                }
            }
            CommlSubLocation.ele('RequestedValuationTypeCd', requestedValuationTypeCd);
            CommlSubLocation.ele('usli:Perils', "Special Excluding Wind And Hail").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            CommlSubLocation.ele('usli:RequestedCauseOfLoss', "SPC").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");

            //             <CommlPropertyLineBusiness xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
            //                 <LOBCd>CPKGE</LOBCd>
            //                 <MinPremInd>false</MinPremInd>
            //                 <PropertyInfo>

            const CommlPropertyLineBusiness = CommlPkgPolicyQuoteInqRq.ele('CommlPropertyLineBusiness').att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            CommlPropertyLineBusiness.ele('LOBCd', "CPKGE");
            CommlPropertyLineBusiness.ele('MinPremInd', false);
            const PropertyInfo = CommlPropertyLineBusiness.ele('PropertyInfo');

            //                     <CommlPropertyInfo LocationRef="1">
            //                         <ItemValueAmt>
            //                             <Amt>0</Amt>
            //                         </ItemValueAmt>
            //                         <ClassCdDesc>Building</ClassCdDesc>
            //                         <CommlCoverage>
            //                             <CoverageCd>BLDG</CoverageCd>
            //                             <CoverageDesc>Building</CoverageDesc>
            //                             <Limit>
            //                                 <FormatText>500000</FormatText>
            //                                 <ValuationCd>RC</ValuationCd>
            //                                 <LimitAppliesToCd>Aggregate</LimitAppliesToCd>
            //                             </Limit>
            //                             <Deductible>
            //                                 <FormatInteger>1000</FormatInteger>
            //                                 <DeductibleTypeCd>WD</DeductibleTypeCd>
            //                                 <DeductibleAppliesToCd>AllPeril</DeductibleAppliesToCd>
            //                             </Deductible>
            //                             <PremiumBasisCd>Unit</PremiumBasisCd>
            //                             <CommlCoverageSupplement>
            //                                 <CoinsurancePct>80</CoinsurancePct>
            //                             </CommlCoverageSupplement>
            //                             <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">10000</usli:CoverageTypeId>
            //                             <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
            //                             <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
            //                         </CommlCoverage>
            //                         <BlanketNumber>0</BlanketNumber>
            //                         <ValueReportingInd>false</ValueReportingInd>
            //                         <GroundFloorArea>
            //                             <NumUnits>0</NumUnits>
            //                         </GroundFloorArea>
            //                         <BlanketInd>false</BlanketInd>
            //                         <TotalPayrollAmt>
            //                             <Amt>0</Amt>
            //                         </TotalPayrollAmt>
            //                     </CommlPropertyInfo>

            if (location.buildingLimit && location.buildingLimit !== "") {
                const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo').att('LocationRef', index + 1);
                const ItemValueAmt1 = CommlPropertyInfo.ele('ItemValueAmt');
                ItemValueAmt1.ele('Amt', 0);
                CommlPropertyInfo.ele('ClassCdDesc', 'Building');
                const CommlCoverage = CommlPropertyInfo.ele('CommlCoverage');
                CommlCoverage.ele('CoverageCd', "BLDG");
                CommlCoverage.ele('CoverageDesc', "Building");
                const Limit = CommlCoverage.ele('Limit');
                Limit.ele('FormatText', location.buildingLimit ? location.buildingLimit : 0);
                Limit.ele('ValuationCd', "RC"); // TODO: What is this?
                Limit.ele('LimitAppliesToCd', "Aggregate");
                const Deductible = CommlCoverage.ele('Deductible');
                Deductible.ele('FormatInteger', BOPPolicy.deductible); // NOTE: For now, leaving this as policy-level deductible
                Deductible.ele('DeductibleTypeCd', "WD"); // NOTE: Leaving as default
                Deductible.ele('DeductibleAppliesToCd', "AllPeril"); // NOTE: Leaving as default
                CommlCoverage.ele('PremiumBasisCd', "Unit");
                const CommlCoverageSupplement = CommlCoverage.ele('CommlCoverageSupplement');
                CommlCoverageSupplement.ele('CoinsurancePct', 80); // NOTE: Defaulting to industry standard 80%
                CommlCoverage.ele('usli:CoverageTypeId', "10000").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
                CommlCoverage.ele('usli:FireCoverageTypeId', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
                CommlCoverage.ele('usli:IsLeasedOccupancy', location.own ? 1 : 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
                CommlPropertyInfo.ele('BlanketNumber', 0);
                CommlPropertyInfo.ele('ValueReportingInd', false);
                const GroundFloorArea = CommlPropertyInfo.ele('GroundFloorArea');
                // NOTE: We do not collect ground level area. If 1 story, default to location sq ft, otherwise set to 0
                GroundFloorArea.ele('NumUnits', location.numStories === 1 ? location.square_footage : 0); 
                CommlPropertyInfo.ele('BlanketInd', false);
                const TotalPayrollAmt = CommlPropertyInfo.ele('TotalPayrollAmt');
                TotalPayrollAmt.ele('Amt', this.get_location_payroll(location));
            }

            if (location.businessPersonalPropertyLimit && location.businessPersonalPropertyLimit !== "") {
                const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo').att('LocationRef', index + 1);
                const ItemValueAmt1 = CommlPropertyInfo.ele('ItemValueAmt');
                ItemValueAmt1.ele('Amt', 0);
                CommlPropertyInfo.ele('ClassCdDesc', 'Business Personal Property');
                const CommlCoverage = CommlPropertyInfo.ele('CommlCoverage');
                CommlCoverage.ele('CoverageCd', "BPP");
                CommlCoverage.ele('CoverageDesc', "Business Personal Property");
                const Limit = CommlCoverage.ele('Limit');
                Limit.ele('FormatText', location.businessPersonalPropertyLimit ? location.businessPersonalPropertyLimit : 0);
                Limit.ele('ValuationCd', "RC"); // defaulting to Replacement Cost
                Limit.ele('LimitAppliesToCd', "Aggregate");
                const Deductible = CommlCoverage.ele('Deductible');
                Deductible.ele('FormatInteger', BOPPolicy.deductible); // NOTE: For now, leaving this as policy-level deductible
                Deductible.ele('DeductibleTypeCd', "WD"); // NOTE: Leaving as default
                Deductible.ele('DeductibleAppliesToCd', "AllPeril"); // NOTE: Leaving as default
                CommlCoverage.ele('PremiumBasisCd', "Unit");
                const CommlCoverageSupplement = CommlCoverage.ele('CommlCoverageSupplement');
                CommlCoverageSupplement.ele('CoinsurancePct', 80); // NOTE: Defaulting to industry standard 80%
                CommlCoverage.ele('usli:CoverageTypeId', "10001").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
                CommlCoverage.ele('usli:FireCoverageTypeId', "0").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
                CommlCoverage.ele('usli:IsLeasedOccupancy', location.own ? 1 : 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
                CommlPropertyInfo.ele('BlanketNumber', 0);
                CommlPropertyInfo.ele('ValueReportingInd', false);
                const GroundFloorArea = CommlPropertyInfo.ele('GroundFloorArea');
                // NOTE: We do not collect ground level area. If 1 story, default to location sq ft, otherwise set to 0
                GroundFloorArea.ele('NumUnits', location.numStories === 1 ? location.square_footage : 0); 
                CommlPropertyInfo.ele('BlanketInd', false);
                const TotalPayrollAmt = CommlPropertyInfo.ele('TotalPayrollAmt');
                TotalPayrollAmt.ele('Amt', this.get_location_payroll(location));
            }

            // although terrorism coverage is a general question, it is placed in the location specific area of the request. So only attached to the first location
            const terrorismCoverageQuestion = applicationDocData.questions.find(question => question.insurerQuestionIdentifier === "usli.general.terrorismCoverage");
            if (index + 1 === 1 && terrorismCoverageQuestion && terrorismCoverageQuestion.answerValue.toLowerCase() === "yes") {
                terrorismCoverageIncluded = true;
                const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo').att('LocationRef', 1);
                const CommlCoverage = CommlPropertyInfo.ele('CommlCoverage');
                CommlCoverage.ele('CoverageCd', "TRIA");
                CommlCoverage.ele('CoverageDesc', "Terrorism Coverage");
                CommlCoverage.ele('usli:CoverageTypeId', "10600");
            }
        });

        //             <GeneralLiabilityLineBusiness xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
        //                 <LOBCd>CPKGE</LOBCd>
        //                 <MinPremInd>false</MinPremInd>
        //                 <LiabilityInfo>

        const GeneralLiabilityLineBusiness = CommlPkgPolicyQuoteInqRq.ele('GeneralLiabilityLineBusiness').att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        GeneralLiabilityLineBusiness.ele('LOBCd', "CPKGE");
        GeneralLiabilityLineBusiness.ele('MinPremInd', false);
        const LiabilityInfo = GeneralLiabilityLineBusiness.ele('LiabilityInfo');
        const limits = supportedLimitsMap[BOPPolicy.limits] ? supportedLimitsMap[BOPPolicy.limits] : ["2000000", "4000000", "4000000"]; 

        //                     <CommlCoverage>
        //                         <CoverageCd>EAOCC</CoverageCd>
        //                         <CoverageDesc>Each Occurrence Limit</CoverageDesc>
        //                         <Limit>
        //                             <FormatText>1000000</FormatText>
        //                             <LimitAppliesToCd>PerOcc</LimitAppliesToCd>
        //                         </Limit>
        //                         <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
        //                         <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
        //                         <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
        //                     </CommlCoverage>

        createLiabilityInfoCoverage(LiabilityInfo, "EAOCC", "Each Occurrence Limit", limits[0], "PerOcc");
        createLiabilityInfoCoverage(LiabilityInfo, "GENAG", "General Aggregate Limit", limits[1], "Aggregate");
        createLiabilityInfoCoverage(LiabilityInfo, "PRDCO", "Products/Completed Operations Aggregate Limit", limits[2], "Aggregate");
        createLiabilityInfoCoverage(LiabilityInfo, "PIADV", "Personal &amp; Advertising Injury Limit", limits[2], "PerPers");
        // USLI only supports one option - 5,000
        createLiabilityInfoCoverage(LiabilityInfo, "MEDEX", "Medical Expense Limit", "5000", "PerPers");
        // USLI only supports one option - 100,000
        createLiabilityInfoCoverage(LiabilityInfo, "FIRDM", "Damages To Premises Rented To You", "100000", "PropDam");

        applicationDocData.locations.forEach((location, index) => {
            //                     <GeneralLiabilityClassification id="C1" LocationRef="1">
            //                         <CommlCoverage>
            //                             <CoverageCd>PREM</CoverageCd>
            //                             <ClassCd>60010</ClassCd>
            //                             <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
            //                             <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">101</usli:FireCoverageTypeId>
            //                             <usli:FireCode xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0312</usli:FireCode>
            //                             <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
            //                         </CommlCoverage>
            //                         <ClassCd>60010</ClassCd>
            //                         <ClassCdDesc>Apartment Buildings</ClassCdDesc>
            //                         <Exposure>12</Exposure>
            //                         <PremiumBasisCd>Unit</PremiumBasisCd>
            //                         <IfAnyRatingBasisInd>false</IfAnyRatingBasisInd>
            //                         <usli:ClassId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:ClassId>
            //                         <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">5337</usli:CoverageTypeId>
            //                     </GeneralLiabilityClassification>

            // NOTE: We include both PREM and PROD GL Classifications
            const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification').att('id', "C1").att('LocationRef', index + 1);
            const PREMCommlCoverage = GeneralLiabilityClassification.ele('CommlCoverage');
            PREMCommlCoverage.ele('CoverageCd', "PREM");
            PREMCommlCoverage.ele('ClassCd', industryCode.attributes.GLCode); 
            PREMCommlCoverage.ele('usli:CoverageTypeId', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            PREMCommlCoverage.ele('usli:FireCoverageTypeId', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/"); 
            PREMCommlCoverage.ele('usli:FireCode', BOPPolicy.fireCode ? BOPPolicy.fireCode : 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            PREMCommlCoverage.ele('usli:IsLeasedOccupancy', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            const PRODCommlCoverage = GeneralLiabilityClassification.ele('CommlCoverage');
            PRODCommlCoverage.ele('CoverageCd', "PROD");
            PRODCommlCoverage.ele('ClassCd', industryCode.attributes.GLCode); 
            PRODCommlCoverage.ele('usli:CoverageTypeId', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            PRODCommlCoverage.ele('usli:FireCoverageTypeId', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/"); 
            PRODCommlCoverage.ele('usli:FireCode', BOPPolicy.fireCode ? BOPPolicy.fireCode : 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            PRODCommlCoverage.ele('usli:IsLeasedOccupancy', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            GeneralLiabilityClassification.ele('ClassCd', industryCode.attributes.GLCode); 
            GeneralLiabilityClassification.ele('ClassCdDesc', industryCode.description);
            const exposure = this.getExposure(location);
            if (exposure) {
                GeneralLiabilityClassification.ele('Exposure', exposure);
            }
            GeneralLiabilityClassification.ele('PremiumBasisCd', industryCode.attributes.ACORDPremiumBasisCode);
            GeneralLiabilityClassification.ele('IfAnyRatingBasisInd', false);
            GeneralLiabilityClassification.ele('usli:ClassId', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            GeneralLiabilityClassification.ele('usli:CoverageTypeId', industryCode.code).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            if (terrorismCoverageIncluded && index + 1 === 1) {
                const TIAGeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification').att('LocationRef', 1).att('id', "TRIA1");
                TIAGeneralLiabilityClassification.ele('ClassCd', "08811");
                TIAGeneralLiabilityClassification.ele('ClassCdDesc', "Terrorism Coverage");
                TIAGeneralLiabilityClassification.ele('usli:CoverageTypeId', "6197").att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
            }
        });
        
        //                     <usli:EarnedPremiumPct xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:EarnedPremiumPct>
        //                 </LiabilityInfo>
        //             </GeneralLiabilityLineBusiness>
        //             <TransactionRequestDt xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">2022-04-07T14:58:43.930-04:00</TransactionRequestDt>
        //         </CommlPkgPolicyQuoteInqRq>
        //     </InsuranceSvcRq>
        // </ACORD>

        LiabilityInfo.ele('usli:EarnedPremiumPct', 0).att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/");
        CommlPkgPolicyQuoteInqRq.ele('TransactionRequestDt', moment().local().format()).att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/"); // TODO: Ensure proper date format here

        // -------------- SEND XML REQUEST ----------------

        // Get the XML structure as a string
        const xml = ACORD.end({'pretty': true});

        console.log(xml);

        const host = "services.uslistage.com";
        const quotePath = `/API/Quote`;
        const additionalHeaders = {
          "Content-Type": "application/xml"
        };
    
        let result = null;
        try {
            result = await this.send_xml_request(host, quotePath, xml, additionalHeaders);        
        }
        catch (e) {
            const errorMessage = `An error occurred while trying to hit the USLI Quote API endpoint: ${e}. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        console.log(JSON.parse(JSON.stringify(result, null, 4)));
        return this.client_error(`Testing - forced error`, __location);

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

    getExposure(location) {
        let exposure = null;
        let exposureNotSupported = false;
        let exposureEncountered = true;
        let errorMessage = null;
        switch (industryCode.attributes.premiumExposureBasis) {
            case "1,000 Gallons":
                const gallonsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.totalGallonsOfFuel");
                if (gallonsQuestion) {
                    const numGallons = parseInt(gallonsQuestion.answerValue, 10);
                    if (!isNaN(numGallons)) {
                        exposure = Math.round(numGallons / 1000);
                    }
                    else {
                        errorMessage = `${logPrefix}Invalid number of gallons, unable to convert ${numGallons} into an integer. `;
                    }
                }
                break;
            case "100 Payroll":
                const locationPayroll = parseInt(this.get_location_payroll(location), 10);
                if (!isNaN(locationPayroll)) {
                    exposure = Math.round(locationPayroll / 100);
                }
                else {
                    errorMessage = `${logPrefix}Invalid number for payroll, unable to convert ${locationPayroll} into an integer. `;
                }
                break;
            case "Acre":
                const acreQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numAcres");
                if (acreQuestion) {
                    exposure = acreQuestion.answerValue;
                }
                break;
            case "Admissions":
                const admissionsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.totalAdmissions");
                if (admissionsQuestion) {
                    exposure = admissionsQuestion.answerValue;
                }
                break;
            case "Student":
                const studentQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numStudents");
                if (studentQuestion) {
                    exposure = studentQuestion.answerValue;
                }
                break;
            case "Kennel":
                const kennelQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numKennels");
                if (kennelQuestion) {
                    exposure = kennelQuestion.answerValue;
                }
                break;
            case "Event":
                const eventsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.totalEvents");
                if (eventsQuestion) {
                    exposure = eventsQuestion.answerValue;
                }
                break;
            case "Exhibition":
                const exhibitionsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.yearlyExhibitions");
                if (exhibitionsQuestion) {
                    exposure = exhibitionsQuestion.answerValue;
                }
                break;

            case "Payroll":
                exposure = this.get_location_payroll(location);
                break;
            case "Per Instructor":
                const teacherQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numTeachersInstructors");
                if (teacherQuestion) {
                    exposure = teacherQuestion.answerValue;
                }
                break;
            case "Pool":
                const poolQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.numPoolsTubs");
                if (poolQuestion) {
                    exposure = poolQuestion.answerValue;
                }
                break;
            case "Sales":
                const salesQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.grossSales");
                if (salesQuestion) {
                    exposure = salesQuestion.answerValue;
                }
                break;
            case "Total Area":
                exposure = location.square_footage;
                break;
            case "Total Cost":
                const totalCostQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.annualSubcontractedCost");
                if (totalCostQuestion) {
                    exposure = totalCostQuestion.answerValue;
                }
                break;
            case "Flat":
            case "Dwelling":
                exposure = 1;
                break;
            case "Per Assistant":
            case "Beautician/Barber":
            case "Washer":
            case "Worker":
                exposure = this.get_total_location_employees(location);
                break;
            case "Number of Units":
            case "Fitness Center":
            case "Additional Insured":
                exposureNotSupported = true;
                break;
            case "Full-Time Janitor":
            case "Part-Time Janitor":
            case "Full-time employee":
            case "Part-time employee":
                // TODO: these are special cases where we may need to send additional classifications
                break;
            case "":
                log.warn(`${logPrefix}Classification has blank exposure. This classification should be disabled. ` + __location);
                return null;
            default:
                exposureEncountered = false;
                break;
        }

        if (exposureNotSupported) {
            log.warn(`${logPrefix}Exposure ${industryCode.attributes.premiumExposureBasis} is not supported, returning null. ` + __location);
        }
        else if (errorMessage) {
            log.warn(errorMessage + __location);
        }
        else if (!exposureEncountered) {
            log.warn(`${logPrefix}No case found for ${industryCode.attributes.premiumExposureBasis} exposure. ` + __location);
        }
        else if (exposure === null) {
            log.warn(`${logPrefix}Encountered ${industryCode.attributes.premiumExposureBasis} exposure, but found no exposure question - This could be a question mapping error. ` + __location);
        }

        return exposure;
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
        };

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

const createLiabilityInfoCoverage = (LiabilityInfoElement, limitAbbreviation, limitFullName, limitValue, limitType) => {
    const CommlCoverage = LiabilityInfoElement.ele('CommlCoverage');
    CommlCoverage.ele('CoverageCd', limitAbbreviation);
    CommlCoverage.ele('CoverageDesc', limitFullName);
    const Limit = CommlCoverage.ele('Limit');
    Limit.ele('FormatText', limitValue);
    Limit.ele('LimitAppliesToCd', limitType);
    // default these to 0, as they are set elsewhere
    CommlCoverage.ele('usli:CoverageTypeId', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
    CommlCoverage.ele('usli:FireCoverageTypeId', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
    CommlCoverage.ele('usli:IsLeasedOccupancy', 0).att('xmlns', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
}

const getNAICSCode = async () => {
    const query = {
        active: true,
        industryCodeId: applicationDocData.industryCode
    };

    let talageIndustryCodeRecord = null;
    try {
        talageIndustryCodeRecord = await global.mongoose.IndustryCode.find(query);
    }
    catch (e) {
        log.error(`An error occurred retrieving the Talage Industry Code for its NAICS: ${e}. Defaulting to 26522 per Combined Group advice.`);
        return "26522";
    }

    if (!talageIndustryCodeRecord || talageIndustryCodeRecord.length === 0) {
        log.warn(`No Talage Industry Code found with id: ${applicationDocData.industryCode}. Defaulting to 26522 per Combined Group advice.`);
        return "26522";
    }

    talageIndustryCodeRecord = talageIndustryCodeRecord[0];

    if (!talageIndustryCodeRecord.naics || talageIndustryCodeRecord.naics === "") {
        log.warn(`No naics code on the Talage Industry Code. Defaulting to 26522 per Combined Group advice.`);
        return "26522";
    }
    else {
        return talageIndustryCodeRecord.naics;
    }
}

const getEntityType = () => {
    switch (applicationDocData.entityType) {
        // case "":
        //     return {abbr: "IN", id: "INDIVIDUAL"};
        case "Corporation":
            return {abbr: "CP", id: "CORPORATION"};
        case "Partnership":
            return {abbr: "PT", id: "PARTNERSHIP"};
        case "Non Profit Corporation":
            return {abbr: "NP", id: "NON PROFIT CORPORATION"};
        case "Limited Liability Company":
            return {abbr: "LL", id: "LIMITED LIABILITY COMPANY"};
        // case "":
        //     return {abbr: "TR", id: "TRUST"};
        default:
            return {abbr: "OT", id: "OTHER"};
    }
}