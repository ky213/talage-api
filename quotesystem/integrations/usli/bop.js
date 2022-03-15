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

        const UUID = this.generate_uuid();

        // ------------- CREATE XML REQUEST ---------------

        const ACORD = builder.create('ACORD', {'encoding': 'UTF-8'});

        // TODO: Create the xml request and hydrate it with the appropriate information

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
        const entityType = this.getEntityType(); // TODO: finish this.getEntityTypeFunction
        GPINameInfo.ele('LegalEntityCd', entityType.abbr).att('id', entityType.id);

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
        //                 <usli:Status xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">Quote</usli:Status>
        //                 <usli:Carrier xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">MTV</usli:Carrier>
        //                 <usli:FilingId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FilingId>
        //                 <usli:IsUnsolicited xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsUnsolicited>
        //             </CommlPolicy>


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
        //             <CommlPropertyLineBusiness xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
        //                 <LOBCd>CPKGE</LOBCd>
        //                 <MinPremInd>false</MinPremInd>
        //                 <PropertyInfo>
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
        //                     <CommlPropertyInfo LocationRef="1">
        //                         <ItemValueAmt>
        //                             <Amt>0</Amt>
        //                         </ItemValueAmt>
        //                         <ClassCdDesc>Equipment Breakdown</ClassCdDesc>
        //                         <CommlCoverage>
        //                             <CoverageCd>EQBK</CoverageCd>
        //                             <CoverageDesc>Equipment Breakdown</CoverageDesc>
        //                             <Limit>
        //                                 <FormatText>500000</FormatText>
        //                                 <ValuationCd>NotSet</ValuationCd>
        //                                 <LimitAppliesToCd>Aggregate</LimitAppliesToCd>
        //                             </Limit>
        //                             <Deductible>
        //                                 <FormatInteger>0</FormatInteger>
        //                                 <DeductibleTypeCd>WD</DeductibleTypeCd>
        //                                 <DeductibleAppliesToCd>AllPeril</DeductibleAppliesToCd>
        //                             </Deductible>
        //                             <PremiumBasisCd>Unit</PremiumBasisCd>
        //                             <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">10010</usli:CoverageTypeId>
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
        //                 </PropertyInfo>
        //             </CommlPropertyLineBusiness>
        //             <GeneralLiabilityLineBusiness xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">
        //                 <LOBCd>CPKGE</LOBCd>
        //                 <MinPremInd>false</MinPremInd>
        //                 <LiabilityInfo>
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
        //                     <CommlCoverage>
        //                         <CoverageCd>PIADV</CoverageCd>
        //                         <CoverageDesc>Personal &amp; Advertising Injury Limit</CoverageDesc>
        //                         <Limit>
        //                             <FormatText>1000000</FormatText>
        //                             <LimitAppliesToCd>PerPers</LimitAppliesToCd>
        //                         </Limit>
        //                         <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
        //                         <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
        //                         <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
        //                     </CommlCoverage>
        //                     <CommlCoverage>
        //                         <CoverageCd>MEDEX</CoverageCd>
        //                         <CoverageDesc>Medical Expense Limit</CoverageDesc>
        //                         <Limit>
        //                             <FormatText>5000</FormatText>
        //                             <LimitAppliesToCd>PerPers</LimitAppliesToCd>
        //                         </Limit>
        //                         <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
        //                         <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
        //                         <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
        //                     </CommlCoverage>
        //                     <CommlCoverage>
        //                         <CoverageCd>FIRDM</CoverageCd>
        //                         <CoverageDesc>Damages To Premises Rented To You</CoverageDesc>
        //                         <Limit>
        //                             <FormatText>100000</FormatText>
        //                             <LimitAppliesToCd>PropDam</LimitAppliesToCd>
        //                         </Limit>
        //                         <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
        //                         <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
        //                         <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
        //                     </CommlCoverage>
        //                     <CommlCoverage>
        //                         <CoverageCd>PRDCO</CoverageCd>
        //                         <CoverageDesc>Products/Completed Operations Aggregate Limit</CoverageDesc>
        //                         <Limit>
        //                             <LimitAppliesToCd>Aggregate</LimitAppliesToCd>
        //                         </Limit>
        //                         <Option>
        //                             <OptionCd>Incl</OptionCd>
        //                         </Option>
        //                         <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
        //                         <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
        //                         <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
        //                     </CommlCoverage>
        //                     <CommlCoverage>
        //                         <CoverageCd>GENAG</CoverageCd>
        //                         <CoverageDesc>General Aggregate Limit</CoverageDesc>
        //                         <Limit>
        //                             <FormatText>2000000</FormatText>
        //                             <LimitAppliesToCd>Aggregate</LimitAppliesToCd>
        //                         </Limit>
        //                         <usli:CoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:CoverageTypeId>
        //                         <usli:FireCoverageTypeId xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:FireCoverageTypeId>
        //                         <usli:IsLeasedOccupancy xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:IsLeasedOccupancy>
        //                     </CommlCoverage>
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
        //                     <usli:EarnedPremiumPct xmlns:usli="http://www.USLI.com/Standards/PC_Surety/ACORD1.30.0/xml/">0</usli:EarnedPremiumPct>
        //                 </LiabilityInfo>
        //             </GeneralLiabilityLineBusiness>
        //             <TransactionRequestDt xmlns="http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/">2022-04-07T14:58:43.930-04:00</TransactionRequestDt>
        //         </CommlPkgPolicyQuoteInqRq>
        //     </InsuranceSvcRq>
        // </ACORD>

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

getEntityType = () => {
    switch (applicationDocData.entityType) {
        case "":
            return {abbr: "IN",
id: "INDIVIDUAL"};
        case "":
            return {abbr: "CP",
id: "CORPORATION"};
        case "":
            return {abbr: "PT",
id: "PARTNERSHIP"};
        case "":
            return {abbr: "NP",
id: "NON PROFIT CORPORATION"};
        case "":
            return {abbr: "LL",
id: "LIMITED LIABILITY COMPANY"};
        case "":
            return {abbr: "TR",
id: "TRUST"};
        default:
            return {abbr: "OT",
id: "OTHER"};
    }
}
 