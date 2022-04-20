/* eslint-disable object-shorthand */
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
const {get} = require("lodash");
const {convertToDollarFormat} = global.requireShared('./helpers/stringFunctions.js');

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
    "usli.location.exposure.annualSubcontractedCost",
    "usli.location.exposure.numApartments",
    "usli.location.exposure.numDentists",
    "usli.location.exposure.numMobileHomePads",
    "usli.location.exposure.numCondos",
    "usli.location.exposure.numPowerUnits",
    "usli.location.exposure.numTanningBeds"
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

const plumbingCodes = {
    "PVC": "PVC",
    "COPPER": "COPPER",
    "LEAD": "LEAD",
    "IRON": "IRON",
    "GALVANIZED": "GALV",
    "OTHER": "OT",
    "UNKNOWN": "UNK"
};

// usli class code to usli gl code map
// These class codes require a child classification be sent w/ the provided gl code
// additionally, if a child classification is required, all classification questions should be provided for this child classification (denoted as ID S1 instead of C1)
const childClassificationMap = {
    "173": {id: "5864", description: "Barber Shops - Part-time employee"},
    "191": {id: "5862", description: "Beauty Parlors and Hair Styling Salons - Part-time employee"},
    "1082": {id: "5863", description: "Nail Salons - Part-time employee"},
    "6547": {id: "6548", description: "Janitorial Services - Cleaning of only Residential or Office Locations (part-time worker)"},
    "6549": {id: "6550", description: "Janitorial Services - Cleaning of only Residential, Office or Mercantile Locations (part-time worker)"},
    "5884": {id: "5885", description: "Janitorial Services - Cleaning of only Residential Locations (part-time worker)"}
};

let terrorismCoverageIncluded = false;

// TODO: Add claims information to request

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

        const childClassificationRequired = Object.keys(childClassificationMap).includes(industryCode.code);

        // if there's no BOP policy, error out
        if (!BOPPolicy) {
            const errorMessage = `Could not find a policy with type BOP.`;
            log.error(`${logPrefix}${errorMessage} ${__location}`);
            return this.client_error(errorMessage, __location);
        }

        const UUID = this.generate_uuid();

        // ------------- CREATE XML REQUEST ---------------

        const ACORD = builder.create('ACORD', {'encoding': 'UTF-8'});
        ACORD.att('xmlns:xsi', "http://www.w3.org/2001/XMLSchema-instance")
            .att('xmlns:xsd', "http://www.w3.org/2001/XMLSchema")
            .att('xmlns', "http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/")
            .att('xmlns:usli', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");

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
        const SignonPswd = SignonRq.ele('SignonPswd');
        const CustId = SignonPswd.ele('CustId');
        CustId.ele('SPName', 'com.usli');
        CustId.ele('CustLoginId', this.username);
        const CustPswd = SignonPswd.ele('CustPswd');
        CustPswd.ele('EncryptionTypeCd', 'NONE');
        CustPswd.ele('Pswd', this.password);
        SignonPswd.ele('GenSessKey', false);
        // SignonRq.ele('ClientDt', moment().local().format());
        SignonRq.ele('CustLangPref', 'en');
        const ClientApp = SignonRq.ele('ClientApp');
        ClientApp.ele('Version', "2.0");
        SignonRq.ele('SuppressEcho', false);

        //     <InsuranceSvcRq>

        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');

        //         <RqUID xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">3d792504-9f1d-49e7-82e5-7a7ac8327b6b</RqUID>
        //         <SPName xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">com.usli</SPName>

        InsuranceSvcRq.ele('RqUID', UUID);
        InsuranceSvcRq.ele('SPName', "com.usli");

        //         <CommlPkgPolicyQuoteInqRq>

        const CommlPkgPolicyQuoteInqRq = InsuranceSvcRq.ele('CommlPkgPolicyQuoteInqRq');

        //             <RqUID xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">3d792504-9f1d-49e7-82e5-7a7ac8327b6b</RqUID>
        //             <CurCd xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">USD</CurCd>

        CommlPkgPolicyQuoteInqRq.ele('RqUID', UUID);
        CommlPkgPolicyQuoteInqRq.ele('CurCd', "USD");

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

        const agencyInfo = await this.getAgencyInfo();
        const Producer = CommlPkgPolicyQuoteInqRq.ele('Producer');
        const ItemIdInfo = Producer.ele('ItemIdInfo');
        ItemIdInfo.ele('InsurerId', agencyInfo.id); 
        const PGeneralPartyInfo = Producer.ele('GeneralPartyInfo');
        const NameInfo1 = PGeneralPartyInfo.ele('NameInfo');
        const CommlName = NameInfo1.ele('CommlName');
        CommlName.ele('CommercialName', agencyInfo.name);
        const NameInfo2 = PGeneralPartyInfo.ele('NameInfo');
        const PersonName = NameInfo2.ele('PersonName');
        // PersonName.ele('Surname')
        PersonName.ele('GivenName', `${agencyInfo.firstName} ${agencyInfo.lastName}`);
        const Communications = PGeneralPartyInfo.ele('Communications');
        const EmailInfo = Communications.ele('EmailInfo');
        EmailInfo.ele('EmailAddr', agencyInfo.email);
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

        const InsuredOrPrincipal = CommlPkgPolicyQuoteInqRq.ele('InsuredOrPrincipal');
        const IPGeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');
        const GPINameInfo = IPGeneralPartyInfo.ele('NameInfo');
        const GPICommlName = GPINameInfo.ele('CommlName');
        GPICommlName.ele('CommercialName', applicationDocData.businessName);
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
        LTCADurationPeriod.ele('NumUnits', 12);
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

        const CommlPolicy = CommlPkgPolicyQuoteInqRq.ele('CommlPolicy');
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
        const CommlPolicySupplement = CommlPolicy.ele('CommlPolicySupplement');
        CommlPolicySupplement.ele('PolicyTypeCd', "SPC");
        CommlPolicy.ele('WrapUpInd', false);
        // NOTE: Defaulting Stamping Fee, this is not required and returned by USLI
        const STMPFCommlCoverage = CommlPolicy.ele('CommlCoverage');
        STMPFCommlCoverage.ele('CoverageCd', "STMPF");
        STMPFCommlCoverage.ele('CoverageDesc', "Stamping Fee");
        STMPFCommlCoverage.ele('usli:CoverageTypeId', "0");
        STMPFCommlCoverage.ele('usli:FireCoverageTypeId', "0");
        STMPFCommlCoverage.ele('usli:IsLeasedOccupancy', "0");
        // NOTE: Defaulting Surplus Lines Tax, this is not required and returned by USLI
        const SPLTXCommlCoverage = CommlPolicy.ele('CommlCoverage');
        SPLTXCommlCoverage.ele('CoverageCd', "SPLTX");
        SPLTXCommlCoverage.ele('CoverageDesc', "Surplus Lines Tax");
        SPLTXCommlCoverage.ele('usli:CoverageTypeId', "0");
        SPLTXCommlCoverage.ele('usli.FireCoverageTypeId', "0");
        SPLTXCommlCoverage.ele('usli.IsLeasedOccupancy', "0");

        CommlPolicy.ele('AnyLossesAccidentsConvictions', applicationDocData.claims.length > 0);
        // general questions go here...
        // TODO: Check if we need to add a check if these questions can have type Classification, if so, they will need the ClassificationRef attribute
        applicationDocData.questions.forEach(question => {
            if (!ignoredQuestionIds.includes(question.insurerQuestionIdentifier)) {
                const usliDynamicQuestion = CommlPolicy.ele('usli:DynamicQuestion');
                usliDynamicQuestion.ele('usli:QuestionId', question.insurerQuestionIdentifier);
                usliDynamicQuestion.ele('usli:QuestionType', question?.insurerQuestionAttributes?.questionType);
                usliDynamicQuestion.ele('usli:Answer', question.answerValue);
            }
        });

        // location questions also go here...
        applicationDocData.locations.forEach((location, index) => {
            const locRef = index + 1;
            location.questions.forEach(question => {
                if (!ignoredQuestionIds.includes(question.insurerQuestionIdentifier)) {
                    const isClassificationQuestion = question?.insurerQuestionAttributes?.questionType === "Classification";
                    const usliDynamicQuestion = CommlPolicy.ele('usli:DynamicQuestion').att('LocationRef', locRef);
                    if (isClassificationQuestion) {
                        usliDynamicQuestion.att('ClassificationRef', "C1");
                    }
                    usliDynamicQuestion.ele('usli:QuestionId', question.insurerQuestionIdentifier);
                    usliDynamicQuestion.ele('usli:QuestionType', question?.insurerQuestionAttributes?.questionType);
                    usliDynamicQuestion.ele('usli:Answer', question.answerValue); 

                    // if the industry code requires a child classification and this is a classification question, resend it w/ the child classification ID S1
                    if (isClassificationQuestion && childClassificationRequired) {
                        const usliDynamicQuestionS1 = CommlPolicy.ele('usli:DynamicQuestion').att('LocationRef', locRef);
                        usliDynamicQuestionS1.att('ClassificationRef', "S1");
                        usliDynamicQuestionS1.ele('usli:QuestionId', question.insurerQuestionIdentifier);
                        usliDynamicQuestionS1.ele('usli:QuestionType', question?.insurerQuestionAttributes?.questionType);
                        usliDynamicQuestionS1.ele('usli:Answer', question.answerValue); 
                    }
                }
            });
        });
        
        CommlPolicy.ele('usli:Status', "Quote");
        CommlPolicy.ele('usli:Carrier', "MTV");
        CommlPolicy.ele('usli:FilingId', "0");
        CommlPolicy.ele('usli:IsUnsolicted', "0");

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

            const Location = CommlPkgPolicyQuoteInqRq.ele('Location').att('id', index + 1);
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

            const CommlSubLocation = CommlPkgPolicyQuoteInqRq.ele('CommlSubLocation').att('LocationRef', index + 1);
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
            const plumbingCodeQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.building.plumbingCode");
            const plumbingCode = plumbingCodeQuestion && plumbingCodes[plumbingCodeQuestion.answerValue] ? plumbingCodes[plumbingCodeQuestion.answerValue] : "OT";
            Construction.ele('usli:PlumbingCd', plumbingCode).att('xmlns:usli', "http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/");
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
            BldgProtection.ele('ProtectionDeviceSprinklerCd', location.bop.sprinklerEquipped ? "FullSprinkler" : "Unknown");
            BldgProtection.ele('SprinkleredPct', 0) // NOTE: Defaulting to 0% for now, we may need to add a question for this
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
            BldgOccupancy.ele('usli:YearsAtCurrentLocation', yearAtLocation);
            BldgOccupancy.ele('usli:YearOccupiedCurrentLocation', yearOccupied);
            const requestedValuationTypeQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.building.requestedValuationTypeCd");
            let requestedValuationTypeCd = "RC";
            if (requestedValuationTypeQuestion) {
                if (requestedValuationTypeCodes[requestedValuationTypeQuestion.answerValue]) {
                    requestedValuationTypeCd = requestedValuationTypeCodes[requestedValuationTypeQuestion.answerValue];
                }
            }
            CommlSubLocation.ele('RequestedValuationTypeCd', requestedValuationTypeCd);
            CommlSubLocation.ele('usli:Perils', "Special Excluding Wind And Hail");
            CommlSubLocation.ele('usli:RequestedCauseOfLossCd', "SPC");

            //             <CommlPropertyLineBusiness xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
            //                 <LOBCd>CPKGE</LOBCd>
            //                 <MinPremInd>false</MinPremInd>
            //                 <PropertyInfo>

            const CommlPropertyLineBusiness = CommlPkgPolicyQuoteInqRq.ele('CommlPropertyLineBusiness');
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
                CommlCoverage.ele('usli:CoverageTypeId', "10000");
                CommlCoverage.ele('usli:FireCoverageTypeId', "0");
                CommlCoverage.ele('usli:IsLeasedOccupancy', location.own ? 1 : 0);
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
                CommlCoverage.ele('usli:CoverageTypeId', "10001");
                CommlCoverage.ele('usli:FireCoverageTypeId', "0");
                CommlCoverage.ele('usli:IsLeasedOccupancy', location.own ? 1 : 0);
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

        const GeneralLiabilityLineBusiness = CommlPkgPolicyQuoteInqRq.ele('GeneralLiabilityLineBusiness');
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

            // NOTE: We include both PREM and PRDCO GL Classifications
            const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification').att('id', "C1").att('LocationRef', index + 1);
            const PREMCommlCoverage = GeneralLiabilityClassification.ele('CommlCoverage');
            PREMCommlCoverage.ele('CoverageCd', "PREM");
            PREMCommlCoverage.ele('ClassCd', industryCode.attributes.GLCode); 
            PREMCommlCoverage.ele('usli:CoverageTypeId', 0);
            PREMCommlCoverage.ele('usli:FireCoverageTypeId', 0); 
            PREMCommlCoverage.ele('usli:FireCode', BOPPolicy.fireCode ? BOPPolicy.fireCode : 0);
            PREMCommlCoverage.ele('usli:IsLeasedOccupancy', 0);
            const PRDCOCommlCoverage = GeneralLiabilityClassification.ele('CommlCoverage');
            PRDCOCommlCoverage.ele('CoverageCd', "PRDCO");
            PRDCOCommlCoverage.ele('ClassCd', industryCode.attributes.GLCode); 
            PRDCOCommlCoverage.ele('usli:CoverageTypeId', 0);
            PRDCOCommlCoverage.ele('usli:FireCoverageTypeId', 0); 
            PRDCOCommlCoverage.ele('usli:FireCode', BOPPolicy.fireCode ? BOPPolicy.fireCode : 0);
            PRDCOCommlCoverage.ele('usli:IsLeasedOccupancy', 0);
            GeneralLiabilityClassification.ele('ClassCd', industryCode.attributes.GLCode); 
            GeneralLiabilityClassification.ele('ClassCdDesc', industryCode.description);
            const exposure = this.getExposure(location);
            if (exposure) {
                GeneralLiabilityClassification.ele('Exposure', exposure);
            }
            GeneralLiabilityClassification.ele('PremiumBasisCd', industryCode.attributes.ACORDPremiumBasisCode);
            GeneralLiabilityClassification.ele('IfAnyRatingBasisInd', false);
            GeneralLiabilityClassification.ele('usli:ClassId', 0);
            GeneralLiabilityClassification.ele('usli:CoverageTypeId', industryCode.code);
            if (childClassificationRequired) {
                const GeneralLiabilityClassificationS1 = LiabilityInfo.ele('GeneralLiabilityClassification').att('id', "S1").att('LocationRef', index + 1);
                const PREMCommlCoverageS1 = GeneralLiabilityClassificationS1.ele('CommlCoverage');
                PREMCommlCoverageS1.ele('CoverageCd', "PREM");
                PREMCommlCoverageS1.ele('ClassCd', industryCode.attributes.GLCode);
                PREMCommlCoverageS1.ele('usli:CoverageTypeId', 0);
                PREMCommlCoverageS1.ele('usli:FireCoverageTypeId', 0); 
                PREMCommlCoverageS1.ele('usli:FireCode', BOPPolicy.fireCode ? BOPPolicy.fireCode : 0);
                PREMCommlCoverageS1.ele('usli:IsLeasedOccupancy', 0);
                const PRDCOCommlCoverageS1 = GeneralLiabilityClassificationS1.ele('CommlCoverage');
                PRDCOCommlCoverageS1.ele('CoverageCd', "PRDCO");
                PRDCOCommlCoverageS1.ele('ClassCd', industryCode.attributes.GLCode);
                PRDCOCommlCoverageS1.ele('usli:CoverageTypeId', 0);
                PRDCOCommlCoverageS1.ele('usli:FireCoverageTypeId', 0); 
                PRDCOCommlCoverageS1.ele('usli:FireCode', BOPPolicy.fireCode ? BOPPolicy.fireCode : 0);
                PRDCOCommlCoverageS1.ele('usli:IsLeasedOccupancy', 0);
                GeneralLiabilityClassificationS1.ele('ClassCd', industryCode.attributes.GLCode); 
                GeneralLiabilityClassificationS1.ele('ClassCdDesc', childClassificationMap[industryCode.code].description);
                GeneralLiabilityClassificationS1.ele('Exposure', this.get_total_location_part_time_employees(location)); // for this special case, we're always looking for part time
                GeneralLiabilityClassificationS1.ele('PremiumBasisCd', industryCode.attributes.ACORDPremiumBasisCode);
                GeneralLiabilityClassificationS1.ele('IfAnyRatingBasisInd', false);
                GeneralLiabilityClassificationS1.ele('usli:ClassId', 0);
                GeneralLiabilityClassificationS1.ele('usli:CoverageTypeId',childClassificationMap[industryCode.code].id); // use the specific child GL code
            }

            if (terrorismCoverageIncluded && index + 1 === 1) {
                const TIAGeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification').att('LocationRef', 1).att('id', "TRIA1");
                TIAGeneralLiabilityClassification.ele('ClassCd', "08811");
                TIAGeneralLiabilityClassification.ele('ClassCdDesc', "Terrorism Coverage");
                TIAGeneralLiabilityClassification.ele('usli:CoverageTypeId', "6197");
            }
        });
        
        //                     <usli:EarnedPremiumPct xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:EarnedPremiumPct>
        //                 </LiabilityInfo>
        //             </GeneralLiabilityLineBusiness>
        //             <TransactionRequestDt xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">2022-04-07T14:58:43.930-04:00</TransactionRequestDt>
        //         </CommlPkgPolicyQuoteInqRq>
        //     </InsuranceSvcRq>
        // </ACORD>

        LiabilityInfo.ele('usli:EarnedPremiumPct', 0);
        CommlPkgPolicyQuoteInqRq.ele('TransactionRequestDt', moment().local().format());

        // -------------- SEND XML REQUEST ----------------

        // Get the XML structure as a string
        const xml = ACORD.end({'pretty': true});

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
            const errorMessage = `${logPrefix}An error occurred while trying to hit the USLI Quote API endpoint: ${e}. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        // -------------- PARSE XML RESPONSE ----------------

        const response = get(result, "ACORD.InsuranceSvcRs[0]");
        const statusCd = get(response, "Status[0].StatusCd[0]");
        const statusDesc = get(response, "Status[0].StatusDesc[0]");
        const msgStatusCd = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusCd[0]");
        const msgStatusDesc = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusDesc[0]");
        // const msgErrorCode = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgErrorCd[0]");

        let missingRespObj = false;
        const responseObjects = {
            "ACORD.InsuranceSvcRs[0]": response,
            "Status[0].StatusCd[0]": statusCd,
            "Status[0].StatusDesc[0]": statusDesc,
            "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusCd[0]": msgStatusCd,
            "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].MsgStatusDesc[0]": msgStatusDesc
        };
        
        // check each part of the response we parse and ensure it exists. If it doesn't, report the error, as the response object USLI returns may have changed
        for (const [path, obj] of Object.entries(responseObjects)) {
            if (!obj) {
                missingRespObj = true;
                log.error(`${logPrefix}Response is missing path: ${path}. ` + __location);
            }
        }

        if (missingRespObj) {
            const errorMessage = `One or more required paths in the response are missing. This may be because USLI's response structure changed. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }

        const errorCd = statusDesc.split(" ")[1];
        let errorReasons = null;
        if (statusDesc.indexOf("Script Errors:") !== -1) {
            // if script errors are reported, parse them a particular way
            errorReasons = statusDesc.substring(statusDesc.indexOf("Script Errors:") + 16).split("\n").filter(reason => reason !== "");
        }
        else {
            // otherwise, look for extended status and parse into strings with the code and description pairs
            const extendedStatus = get(response, "CommlPkgPolicyQuoteInqRs[0].MsgStatus[0].ExtendedStatus");
            if (extendedStatus) {
                errorReasons = extendedStatus.map(status => (`${status.ExtendedStatusCd[0]}: ${status.ExtendedStatusDesc[0]}`));
            }
            else {
                // catch all to just split any reasons provided by newline
                errorReasons = statusDesc.split("\n");
            }
        }

        // main reason is just the first reason for an error reported
        let mainReason = errorReasons.shift();
        if (mainReason.indexOf("Description: ") !== -1) {
            mainReason = mainReason.substring(mainReason.indexOf("Description: ") + 13);
        }

        // declined error code(s)
        if (errorCd === "433") {
            const declineMessage = `USLI declined the quote: ${mainReason} `;
            const additionalReasons = errorReasons.length > 0 ? `Other reasons: ${errorReasons.join(" | ")}. ` : "";
            log.info(logPrefix + declineMessage + additionalReasons + __location);
            return this.client_declined(declineMessage, errorReasons);
        }

        // if not a referred error code, it's an error
        if (!["434", "436"].includes(errorCd) && !["Success", "SuccessWithInfo"].includes(msgStatusCd)) {
            if (mainReason.includes("class code with Commercial Property")) {
                mainReason = 'A property classification was not provided with the Commercial Property submission. This could be due to a missing fire code in the submission.';
            }
            else {
                this.reasons = errorReasons;
            }

            const errorMessage = `USLI returned an error: ${mainReason} `;
            const additionalReasons = errorReasons.length > 0 ? `Other reasons: ${errorReasons.join(" | ")}. ` : "";
            log.error(logPrefix + errorMessage + additionalReasons + __location);
            return this.client_error(errorMessage, __location);
        }

        // quote response properties
        let quoteNumber = null;
        // let quoteProposalId = null;
        let premium = null;
        const quoteLimits = {};
        const quoteLetter = null;
        const quoteMIMEType = "BASE64";
        let quoteCoverages = [];
        let admitted = false;

        quoteNumber = get(response, "CommlPkgPolicyQuoteInqRs[0].CommlPolicy[0].QuoteInfo[0].CompanysQuoteNumber[0]");
        const commlCoverage = get(response, "CommlPkgPolicyQuoteInqRs[0].GeneralLiabilityLineBusiness[0].LiabilityInfo[0].CommlCoverage");
        premium = get(response, "CommlPkgPolicyQuoteInqRs[0].PolicySummaryInfo[0].FullTermAmt[0].Amt[0]");
        const remarkText = get(response, "CommlPkgPolicyQuoteInqRs[0].RemarkText");
        
        if (Array.isArray(remarkText) && remarkText.length > 0) {
            const admittedRemark = remarkText.find(remark => remark?.$?.id === "Admitted Status");
            admitted = admittedRemark && admittedRemark?._ === "This quote is admitted";

            // add remarkText to quote additionalInfo
            this.quoteAdditionalInfo.remarkText = remarkText.map(remark => ({
                id: remark?.$?.id,
                description: remark?._ 
            }));
        }

        // remove taxes from premium if quote is not admitted and taxes exist
        if (!admitted) {
            const taxesAdditionalInfo = [];
            premium = parseFloat(premium);
            const taxCoverages = get(response, "CommlPkgPolicyQuoteInqRs[0].CommlPolicy[0].CommlCoverage");

            if (Array.isArray(taxCoverages)) {
                taxCoverages.forEach(tax => {
                    let taxAmount = tax.CurrentTermAmt[0].Amt[0];
                    const taxCode = tax.CoverageCd[0];
                    const taxDescription = tax.CoverageDesc[0];

                    if (taxAmount) {
                        taxAmount = parseFloat(taxAmount);

                        if (!isNaN(premium) && !isNaN(taxAmount)) {
                            premium -= taxAmount;
                        }
                        else {
                            log.warn(`${logPrefix}Unable to remove tax ${taxDescription} from non-admitted quote premium. Reference quote additionalInfo for tax information. ` + __location);
                        }
                    }

                    taxesAdditionalInfo.push({
                        code: taxCode,
                        description: taxDescription,
                        amount: taxAmount
                    });
                });

                if (premium < 0) {
                    log.warn(`${logPrefix}Tax and fee deductions resulted in a premium value below 0. ` + __location);
                    premium = 0;
                }
                else {
                    premium = `${premium}`.substring(0, `${premium}`.indexOf(".") + 3);
                }
            }

            // add tax and fees to quote additional info
            this.quoteAdditionalInfo.taxAndFeeInfo = taxesAdditionalInfo;
        }
        
        // TODO: Parse remarkText to see if id View Quote Letter exists, if so, use for Quote Letter

        if (commlCoverage) {
            quoteCoverages = commlCoverage?.map((coverage, index) => {
                const code = coverage.CoverageCd[0];
                const description = coverage.CoverageDesc[0];
                const limit = coverage.Limit[0]?.FormatText[0];
                let included = get(coverage, "Option[0].OptionCd[0]");
                if (included) {
                    if (included === "Incl") {
                        included = "Included"
                    }
                    else if (included === "Excl") {
                        included = "Excluded"
                    }
                    else {
                        included = "N/A";
                    }
                }

                let value = "N/A";
                if (limit) {
                    value = convertToDollarFormat(limit, true);
                }
                else if (included) {
                    value = included;
                }

                return {
                    description: description,
                    value,
                    sort: index,
                    category: "General Limits",
                    insurerIdentifier: code
                };
            });
        }

        // Even if quoted, any classification with GLElig of PP (Premises Preferred) must be submitted as "SUBMIT" (our referred)
        if (statusCd === "0" && msgStatusCd === "Success" && industryCode.attributes?.GLElig !== "PP" && msgStatusDesc !== "Submit") {
            return this.client_quoted(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        }
        else if (statusCd === "0" && ["434", "436", "627"].includes(errorCd) || premium || msgStatusDesc === "Submit") {
            errorReasons.unshift(mainReason);
            if (errorReasons[0].includes("successfully processed the request.") && industryCode.attributes.GLElig === "PP") {
                this.reasons = ["The chosen classification has GL Eligibility PP (Premises Preferred)."];
            }
            else {
                this.reasons = errorReasons;
            }
            
            return this.client_referred(quoteNumber, quoteLimits, premium, quoteLetter, quoteMIMEType, quoteCoverages);
        }
        // base error catch-all
        else {
            const errorMessage = `USLI quote was unsuccessful: ${mainReason}. `;
            this.reasons = errorReasons;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }
    }

    getExposure(location) {
        let exposure = null;
        let exposureEncountered = true;
        switch (industryCode.attributes.premiumExposureBasis) {
            case "1,000 Gallons":
                const gallonsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === "usli.location.exposure.totalGallonsOfFuel");
                if (gallonsQuestion) {
                    const numGallons = parseInt(gallonsQuestion.answerValue, 10);
                    if (!isNaN(numGallons)) {
                        exposure = Math.round(numGallons / 1000);
                    }
                    else {
                        log.error(`${logPrefix}Invalid number of gallons, unable to convert ${numGallons} into an integer. ` + __location);
                        return null;
                    }
                }
                break;
            case "100 Payroll":
                const locationPayroll = parseInt(this.get_location_payroll(location), 10);
                if (!isNaN(locationPayroll)) {
                    exposure = Math.round(locationPayroll / 100);
                }
                else {
                    log.error(`${logPrefix}Invalid number for payroll, unable to convert ${locationPayroll} into an integer. ` + __location);
                    return null;
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
                let questionIdentifier = null;
                switch (industryCode.code) {
                    case "5337":
                        questionIdentifier = "usli.location.exposure.numApartments";
                        break;
                    case "7119":
                        questionIdentifier = "usli.location.exposure.numDentists";
                        break;
                    case "5852": 
                    case "7100":
                        questionIdentifier = "usli.location.exposure.numMobileHomePads";
                        break;
                    case "5013":
                    case "5014":
                    case "5858":
                    case "1681":
                        questionIdentifier = "usli.location.exposure.numCondos";
                        break;
                    case "652":
                    case "1693":
                        questionIdentifier = "usli.location.exposure.numPowerUnits";
                        break;
                    case "5378":
                        questionIdentifier = "usli.location.exposure.numTanningBeds";
                        break;
                    default:
                        log.error(`${logPrefix}Class code ${industryCode.code} is not a valid classification for the "Number of Units" exposure type, therefor no exposure can be provided. ` + __location);
                        return null;
                }

                if (!questionIdentifier) {
                    log.error(`${logPrefix}No question identifier was found for Class code ${industryCode.code}, therefor no exposure can be provided. ` + __location);
                    return null;
                }

                const numUnitsQuestion = location.questions.find(question => question.insurerQuestionIdentifier === questionIdentifier);
                if (numUnitsQuestion) {
                    exposure = numUnitsQuestion.answerValue;
                }
                break;
            case "Fitness Center":
            case "Additional Insured":
            case "Part-Time Janitor":
            case "Part-time employee":
                log.error(`${logPrefix}Exposure ${industryCode.attributes.premiumExposureBasis} is not supported, returning null. ` + __location);
                return null;
            case "Full-Time Janitor":
            case "Full-time employee":
                exposure = this.get_total_location_full_time_employees(location);
                break;
            case "":
                log.error(`${logPrefix}Classification has blank exposure. This classification should be disabled. ` + __location);
                return null;
            default:
                exposureEncountered = false;
                break;
        }

        if (!exposureEncountered) {
            log.error(`${logPrefix}No case found for ${industryCode.attributes.premiumExposureBasis} exposure. ` + __location);
        }
        else if (exposure === null) {
            log.error(`${logPrefix}Encountered ${industryCode.attributes.premiumExposureBasis} exposure, but found no exposure question - This could be a question mapping error. ` + __location);
        }

        return exposure;
    }
 
    async getAgencyInfo() {
        let id = this.app.agencyLocation.agencyId;
        let name = this.app.agencyLocation.agency;
        let phone = this.app.agencyLocation.agencyPhone;
        let email = this.app.agencyLocation.agencyEmail;
        let firstName = this.app.agencyLocation.first_name;
        let lastName = this.app.agencyLocation.last_name;

        // If talageWholeSale
        if (this.app.agencyLocation.insurers[this.insurer.id].talageWholesale) {
            //Use Talage Agency.
            id = 1;
            const AgencyBO = global.requireShared('./models/Agency-BO.js');
            const agencyBO = new AgencyBO();
            const agencyInfo = await agencyBO.getById(this.agencyId);
            name = agencyInfo.name;
            const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
            const agencyLocationBO = new AgencyLocationBO();
            const agencyLocationInfo = await agencyLocationBO.getById(1);
            email = agencyLocationInfo.email;
            phone = agencyLocationInfo.phone;
            firstName = agencyLocationInfo.firstName
            lastName = agencyLocationInfo.lastName
        }

        return {
            id: id || "NA",
            name,
            phone,
            email,
            firstName,
            lastName
        };
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
    CommlCoverage.ele('usli:CoverageTypeId', 0);
    CommlCoverage.ele('usli:FireCoverageTypeId', 0);
    CommlCoverage.ele('usli:IsLeasedOccupancy', 0);
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