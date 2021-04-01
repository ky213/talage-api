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

// {/* <ACORD>
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
//     </SignonRq>
//     <InsuranceSvcRq>
//         <RqUID>C4A112CD-3382-43DF-B200-10340F3511B4</RqUID>
//         <PolicyRq>
//             <RqUID>C4A112CD-3382-43DF-B200-lkrtegfcgjk11C6</RqUID>
//             <TransactionRequestDt>2021-04-01T12:00:00.000-04:00</TransactionRequestDt>
//             <TransactionEffectiveDt>2021-04-01</TransactionEffectiveDt>
//             <CurCd>USD</CurCd>
//             <BusinessPurposeTypeCd>NBQ</BusinessPurposeTypeCd>
//             <SourceSystem id="a4934abd">
//                 <SourceSystemCd>RAMP</SourceSystemCd>
//             </SourceSystem>
//             <Producer>
//                 <ProducerInfo>
//                     <ContractNumber SourceSystemRef="a4934abd">4689905</ContractNumber>
//                 </ProducerInfo>
//             </Producer>
//             <Producer>
//                 <Surname>CONSUMER</Surname>
//                 <GivenName>JOHNATHAN</GivenName>
//                 <NIPRId>123456</NIPRId>
//                 <ProducerRoleCd>Agent</ProducerRoleCd>
//             </Producer>
//             <InsuredOrPrincipal>
//                 <GeneralPartyInfo>
//                     <NameInfo>
//                         <CommlName>
//                             <CommercialName>BOP SAMPLE XML</CommercialName>
//                         </CommlName>
//                         <LegalEntityCd>CP</LegalEntityCd>
//                         <TaxIdentity>
//                             <TaxIdTypeCd>FEIN</TaxIdTypeCd>
//                             <TaxId>435839454</TaxId>
//                         </TaxIdentity>
//                     </NameInfo>
//                     <Addr>
//                         <Addr1>1 Penman Lane</Addr1>
//                         <City>Bountiful</City>
//                         <StateProvCd>UT</StateProvCd>
//                         <PostalCode>84010</PostalCode>
//                     </Addr>
//                     <Communications>
//                         <PhoneInfo>
//                             <PhoneTypeCd>Phone</PhoneTypeCd>
//                             <PhoneNumber>+1-530-6616044</PhoneNumber>
//                         </PhoneInfo>
//                     </Communications>
//                 </GeneralPartyInfo>
//                 <InsuredOrPrincipalInfo>
//                     <InsuredOrPrincipalRoleCd>FNI</InsuredOrPrincipalRoleCd>
//                     <BusinessInfo>
//                         <BusinessStartDt>2015</BusinessStartDt>
//                         <OperationsDesc>Operations Desc</OperationsDesc>
//                     </BusinessInfo>
//                 </InsuredOrPrincipalInfo>
//             </InsuredOrPrincipal>
//             <Policy>
//                 <MiscParty>
//                     <MiscPartyInfo>
//                         <MiscPartyRoleCd>PrimaryContact</MiscPartyRoleCd>
//                     </MiscPartyInfo>
//                     <GeneralPartyInfo>
//                         <NameInfo>
//                             <CommlName>
//                                 <CommercialName>Test Commercial Name</CommercialName>
//                             </CommlName>
//                         </NameInfo>
//                         <Communications>
//                             <PhoneInfo>
//                                 <PhoneTypeCd>Phone</PhoneTypeCd>
//                                 <PhoneNumber>+1-315-4568453</PhoneNumber>
//                             </PhoneInfo>
//                         </Communications>
//                     </GeneralPartyInfo>
//                 </MiscParty>
//                 <LOBCd>BOP</LOBCd>
//                 <ControllingStateProvCd>UT</ControllingStateProvCd>
//                 <ContractTerm>
//                     <EffectiveDt>2021-04-01</EffectiveDt>
//                 </ContractTerm>
//                 <PolicySupplement>
//                     <NumEmployees>5</NumEmployees>
//                     <AnnualSalesAmt>
//                         <Amt>250000</Amt>
//                     </AnnualSalesAmt>
//                 </PolicySupplement>
//                 <!-- Has the insured been involved in any EPLI claims regardless of whether any payment or not, or does the insured have knowledge of any situation(s) that could produce an EPLI claim? -->
//                 <QuestionAnswer>
//                     <QuestionCd>EPL03</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured have professional liability coverage currently in force with another carrier? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL77</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are any of the operations seasonal? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP36</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is there an employee on premises during all hours of operations? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP59</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Was insurance coverage in force for the same exposures for the prior policy period? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL20</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                     <!-- Please provide details of prior coverage -->
//                     <Explanation>Prior Coverage detail goes here</Explanation>
//                 </QuestionAnswer>
//                 <!-- Are there any other business interests or activities of the named insured that are not identified or scheduled on this policy? -->
//                 <QuestionAnswer>
//                     <QuestionCd>GENRL53</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                     <Explanation>No details.</Explanation>
//                 </QuestionAnswer>
//                 <!-- Is other business a separate legal entity insured elsewhere? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL31</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Please provide details regarding other business interests or activities of the named insured that are not Insured. Depended on LMGENRL31 -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL17</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                     <Explanation>Explanation</Explanation>
//                 </QuestionAnswer>
//                 <!-- Is this policy written on a short term basis to have an expiration date concurrent with another policy? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL24</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- During the last five years (ten in RI), has any applicant been indicted for or convicted of any degree of the crime of fraud, bribery, arson or any other arson-related crime? -->
//                 <QuestionAnswer>
//                     <QuestionCd>GENRL08</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Has insured been non-renewed or cancelled during the past three years for any of the following reasons? -->
//                 <QuestionAnswer>
//                     <QuestionCd>GENRL06</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                     <Explanation>No</Explanation>
//                 </QuestionAnswer>
//                 <!-- Has this policy been aligned with this insured's other account for billing purposes? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL21</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!--  Does the applicant have any subsidiaries or is the applicant a subsidiary of another entity? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL95</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                     <!-- Please provide details regarding the subsidiary relationship. -->
//                     <Explanation>This will be defaulted by Rule to No Details</Explanation>
//                 </QuestionAnswer>
//                 <!-- Are any professional services provided to animals used or bred for: racing, show, circus, rodeos or any other entertainment purposes? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP34</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are background checks obtained (including all state sex offender registries) on all staff and/or volunteers who interact with students? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL81</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are proper risk transfers in place (insured is listed as AI, Hold Harmless language in favor of the insured, limits carried are at or above what the insured carries)? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL82</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does applicant perform any repairing or renting of ladders or scaffolding? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP32</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the applicant offer any extra curricular activities (i.e. fields trips, special events, etc.)? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL80</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured do development or hosting of websites? -->
//                 <QuestionAnswer>
//                     <QuestionCd>HOME23</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured do development or hosting of websites? -->
//                 <QuestionAnswer>
//                     <QuestionCd>HOME23</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Has there ever been a citation issued by an Alcoholic beverage commission or other  government regulator for any location that sells and/or serves alcoholic beverages? -->
//                 <QuestionAnswer>
//                     <QuestionCd>RESTA08</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured and/or employees serve alcohol? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL99</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured utilize a third party to provide and/or serve alcohol? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL100</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured do computer programming for a fee? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL96</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured sell used and/or refurbished goods or equipment? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL13</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Any sale of any type of motorized conveyance including ATVs, motorbikes, or scooters? -->
//                 <QuestionAnswer>
//                     <QuestionCd>AGLIA69</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured sell any products under their own name?? -->
//                 <QuestionAnswer>
//                     <QuestionCd>CGL18</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured rent or lease equipment to others? -->
//                 <QuestionAnswer>
//                     <QuestionCd>CGL25</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are bank accounts reconciled by someone not authorized to deposit or withdraw? -->
//                 <QuestionAnswer>
//                     <QuestionCd>CRIM03</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are all officers and employees required to take annual vacations of at least five consecutive business days? -->
//                 <QuestionAnswer>
//                     <QuestionCd>CRIM06</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does Insured own any autos that are titled in the name of the business? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMAUTOB08</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are any services provided other than those that are typical to a Day Spa? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP24</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is there an audit computed on the insured? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP25</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Do the operations of the applicant involve any jobsite or project management? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP30</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does Applicant's business include installation or repair of restaurant furniture/equipment?? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP35</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are any services provided other than those typical to a beauty salon or barber shop? Typical services include hair cutting, styling, coloring, permanents, eyebrow waxing, and manicures/pedicures? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL14</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is the insured involved in the manufacturing, mixing, relabeling or repackaging of products? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL103</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Any 3D printing operations? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL69</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Any operations involving pet rescue, adoptions or shelters for which the insured does not have a risk transfer to a separate organization? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL74</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are all employees serving alcohol properly trained? -->
//                 <QuestionAnswer>
//                     <QuestionCd>RESTA07</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <AnyLossesAccidentsConvictionsInd>0</AnyLossesAccidentsConvictionsInd>
//                 <PolicyExt>
//                     <com.libertymutual.ci_BusinessClassDesc>Business Class Description</com.libertymutual.ci_BusinessClassDesc>
//                     <com.libertymutual.ci_BusinessClassId>01234</com.libertymutual.ci_BusinessClassId>
//                 </PolicyExt>
//             </Policy>
//             <Location id="Wc3a968def7d94ae0acdabc4d95c34a86W">
//                 <Addr>
//                     <Addr1>1 Penman Lane</Addr1>
//                     <City>Bountiful</City>
//                     <StateProvCd>UT</StateProvCd>
//                     <PostalCode>84010</PostalCode>
//                 </Addr>
//             </Location>
//             <BOPLineBusiness>
//                 <LOBCd>BOP</LOBCd>
//                 <PropertyInfo>
//                     <CommlPropertyInfo LocationRef="Wc3a968def7d94ae0acdabc4d95c34a86W">
//                         <SubjectInsuranceCd>BPP</SubjectInsuranceCd>
//                         <ClassCd>88573</ClassCd>
//                         <Coverage>
//                             <CoverageCd>BPP</CoverageCd>
//                             <Limit>
//                                 <FormatCurrencyAmt>
//                                     <Amt>250000</Amt>
//                                 </FormatCurrencyAmt>
//                                 <LimitAppliesToCd>Coverage</LimitAppliesToCd>
//                             </Limit>
//                         </Coverage>
//                     </CommlPropertyInfo>
//                     <CommlPropertyInfo LocationRef="Wc3a968def7d94ae0acdabc4d95c34a86W">
//                         <SubjectInsuranceCd>BLDG</SubjectInsuranceCd>
//                         <ClassCd>88573</ClassCd>
//                         <Coverage>
//                             <CoverageCd>BLDG</CoverageCd>
//                             <Limit>
//                                 <FormatCurrencyAmt>
//                                     <Amt>160000</Amt>
//                                 </FormatCurrencyAmt>
//                                 <LimitAppliesToCd>Coverage</LimitAppliesToCd>
//                             </Limit>
//                         </Coverage>
//                     </CommlPropertyInfo>
//                 </PropertyInfo>
//                 <LiabilityInfo>
//                     <GeneralLiabilityClassification LocationRef="Wc3a968def7d94ae0acdabc4d95c34a86W">
//                         <ClassCd>88573</ClassCd>
//                         <Coverage>
//                             <CoverageCd>BAPRL</CoverageCd>
//                             <Option>
//                                 <OptionCd>PartTime</OptionCd>
//                                 <OptionTypeCd>Num1</OptionTypeCd>
//                                 <OptionValue>2</OptionValue>
//                             </Option>
//                             <Option>
//                                 <OptionCd>FullTime</OptionCd>
//                                 <OptionTypeCd>Num1</OptionTypeCd>
//                                 <OptionValue>1</OptionValue>
//                             </Option>
//                         </Coverage>
//                         <Coverage>
//                             <CoverageCd>BEPRL</CoverageCd>
//                             <Option>
//                                 <OptionCd>PartTime</OptionCd>
//                                 <OptionTypeCd>Num1</OptionTypeCd>
//                                 <OptionValue>2</OptionValue>
//                             </Option>
//                             <Option>
//                                 <OptionCd>FullTime</OptionCd>
//                                 <OptionTypeCd>Num1</OptionTypeCd>
//                                 <OptionValue>0</OptionValue>
//                             </Option>
//                         </Coverage>
//                         <Coverage>
//                             <CoverageCd>MNPL</CoverageCd>
//                             <Option>
//                                 <OptionCd>EMPL</OptionCd>
//                                 <OptionTypeCd>Num1</OptionTypeCd>
//                                 <OptionValue>1</OptionValue>
//                             </Option>
//                         </Coverage>
//                     </GeneralLiabilityClassification>
//                 </LiabilityInfo>
//                 <!-- Does the applicant have any subsidiaries or is the applicant a subsidiary of another entity? -->
//                 <QuestionAnswer>
//                     <QuestionCd>GENRL34</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                     <!-- Please provide details regarding the subsidiary relationship. -->
//                     <Explanation>Explanation</Explanation>
//                 </QuestionAnswer>
//                 <!-- Is the business an employee leasing, labor leasing, labor contractor, PEO, temporary worker staffing or employment agency firm? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL65</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are any operations open 24 hours a day?? -->
//                 <QuestionAnswer>
//                     <QuestionCd>BOP39</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are non-owned autos (i.e., employees' personal autos) used either daily or weekly in the course of the insured's business?? -->
//                 <QuestionAnswer>
//                     <QuestionCd>GARAG12</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are employees required to carry their own personal auto coverage with minimum limits requirements of $300,000 CSL or $100,000/$300,000 split limits? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMAUTOB07</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does Insured provide delivery service? -->
//                 <QuestionAnswer>
//                     <QuestionCd>RESTA04</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//             </BOPLineBusiness>
//             <LocationUWInfo LocationRef="Wc3a968def7d94ae0acdabc4d95c34a86W">
//                 <InterestCd>TENANT</InterestCd>
//                 <Construction>
//                     <ConstructionCd>MNC</ConstructionCd>
//                     <YearBuilt>2015</YearBuilt>
//                     <NumStories>1</NumStories>
//                     <BldgArea>
//                         <NumUnits>1000</NumUnits>
//                         <UnitMeasurementCd>SquareFeet</UnitMeasurementCd>
//                     </BldgArea>
//                     <RoofingMaterial>
//                         <RoofMaterialCd>ASPHS</RoofMaterialCd>
//                         <com.libertymutual.ci_RoofMaterialResistanceCd>WR</com.libertymutual.ci_RoofMaterialResistanceCd>
//                     </RoofingMaterial>
//                 </Construction>
//                 <BldgProtection>
//                     <ProtectionDeviceBurglarCd>PCFC</ProtectionDeviceBurglarCd>
//                 </BldgProtection>
//                 <BldgOccupancy>
//                     <AreaOccupied>
//                         <NumUnits>1000</NumUnits>
//                         <UnitMeasurementCd>SquareFeet</UnitMeasurementCd>
//                     </AreaOccupied>
//                     <AreaOccupiedByOthers>
//                         <NumUnits>0</NumUnits>
//                         <UnitMeasurementCd>SquareFeet</UnitMeasurementCd>
//                     </AreaOccupiedByOthers>
//                     <AreaUnoccupied>
//                         <NumUnits>0</NumUnits>
//                         <UnitMeasurementCd>SquareFeet</UnitMeasurementCd>
//                     </AreaUnoccupied>
//                     <BldgOccupancyExt>
//                         <com.libertymutual.ci_UnoccupiedAreasConditionText>Text</com.libertymutual.ci_UnoccupiedAreasConditionText>
//                     </BldgOccupancyExt>
//                 </BldgOccupancy>
//                 <GrossReceipts>
//                     <OperationsCd>TOTAL</OperationsCd>
//                     <AnnualGrossReceiptsAmt>
//                         <Amt>250000</Amt>
//                     </AnnualGrossReceiptsAmt>
//                 </GrossReceipts>
//                 <!-- What are the insured`s total sales from firearms and ammunition at this location? -->
//                 <GrossReceipts>
//                     <OperationsCd>AMMFIRE</OperationsCd>
//                     <AnnualGrossReceiptsAmt>
//                         <Amt>0</Amt>
//                     </AnnualGrossReceiptsAmt>
//                 </GrossReceipts>
//                 <!-- What are the total sales transacted from this location on the insured`s web site? -->
//                 <GrossReceipts>
//                     <OperationsCd>INTERNET</OperationsCd>
//                     <AnnualGrossReceiptsAmt>
//                         <Amt>40000</Amt>
//                     </AnnualGrossReceiptsAmt>
//                 </GrossReceipts>
//                 <!-- What are the insured's sales from any installation, excluding delivery, generated from this location? -->
//                 <GrossReceipts>
//                     <OperationsCd>INSTALLATION</OperationsCd>
//                     <AnnualGrossReceiptsAmt>
//                         <Amt>15000</Amt>
//                     </AnnualGrossReceiptsAmt>
//                 </GrossReceipts>
//                 <!-- What percentage of total receipts are from sales of furniture? -->
//                 <GrossReceipts>
//                     <OperationsCd>FURNITURE</OperationsCd>
//                     <RevenuePct>55</RevenuePct>
//                 </GrossReceipts>
//                 <!-- What are the insured`s sales from adult materials at this location?? -->
//                 <GrossReceipts>
//                     <OperationsCd>ADULT</OperationsCd>
//                     <AnnualGrossReceiptsAmt>
//                         <Amt>0</Amt>
//                     </AnnualGrossReceiptsAmt>
//                 </GrossReceipts>
//                 <!-- What are the insured`s sales at this location from directly imported merchandise from manufacturers or distributors not domiciled in the United States?? -->
//                 <GrossReceipts>
//                     <OperationsCd>IMPORTS</OperationsCd>
//                     <AnnualGrossReceiptsAmt>
//                         <Amt>0</Amt>
//                     </AnnualGrossReceiptsAmt>
//                 </GrossReceipts>
//                 <!-- Is any of the space leased to tenants used for business operations that do not qualify for coverage on the Commercial Protector (BOP) (e.g. manufacturing, metal working or welding, restaurants or other operations with commercial cooking exposures, spray painting, autobody work, woodworking, storage/manufacturing of flammables, or growing, processing, storing or dispensing marijuana)?  -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP07</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Has heating integrity been verified by a licensed heating contractor in the last 5 years? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP10</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Has electrical integrity been verified by a licensed electrical contractor in the last 5 years? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP11</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Has roofing integrity been verified by a licensed roofing contractor in the last 5 years? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP21</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                     <Explanation>No Details.</Explanation>
//                 </QuestionAnswer>
//                 <!-- Has plumbing integrity been verified by a licensed plumbing contractor in the last 5 years? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP18</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is the named insured included as an additional insured on the tenants general liability policy? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL11</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are check-cashing services provided? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP92</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are the majority of internet sales from this location (over 50%) generated from inventory stored on the insured's premises? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP31</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Do the operations of the risk include home care services of any kind? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP62</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the applicant do any compounding or mixing of drugs? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP08</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is the extinguishing system serviced at least on a semi-annual basis by a licensed contractor? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL78</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is the insured involved in the manufacturing, mixing, relabeling or repackaging of products? -->
//                 <QuestionAnswer>
//                     <QuestionCd>BOP02</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is there involvement in any real estate development or speculation? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP37</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- The majority of menu items (at least 75%) are baked (in oven and/or microwave) or heated on the stove top. -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL79</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Do the applicant's business practices include all of the following: background checks for all employees, implementation of appropriate drug distribution tracking procedures, storage and handling of prescription narcotics that meet the operating state's requirements? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP63</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is there a UL 300 fixed extinguishing system with automatic fuel cutoff protecting all cooking surfaces? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL98</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are the hoods, ductwork and flues cleaned by an outside service at least quarterly? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL97</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are flammables used in the operations at this location?  -->
//                 <QuestionAnswer>
//                     <QuestionCd>GENRL41</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does insured sell any motorized watercraft at this location? -->
//                 <QuestionAnswer>
//                     <QuestionCd>AGLIA71</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insured sell second hand or used materials or merchandise? -->
//                 <GrossReceipts>
//                     <OperationsCd>HOME20</OperationsCd>
//                     <AnnualGrossReceiptsAmt>
//                         <Amt>0</Amt>
//                     </AnnualGrossReceiptsAmt>
//                 </GrossReceipts>
//                 <!-- Does the insured sell second hand or used materials or merchandise? -->
//                 <QuestionAnswer>
//                     <QuestionCd>HOME20</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is there any of the following types of cooking operations at this location: frying, grilling, broiling, barbequing or other cooking that produces grease laden vapors? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP09</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does your Business Personal Property Limit include any equipment valued over $500,000 per item(i.e. - Magnetic Resonance Imaging - MRI,X-Ray equipment,Ultra Sound technology,etc.)? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP12</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the applicant clean and disinfect all instruments and equipment according to the manufacturers instructions? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP13</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Do any of the other building tenants engage in operations that have significant fire hazards (i.e. commercial cooking (frying or grilling), spray painting, woodworking, welding or heavy manufacturing, etc.)? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP17</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                     <Explanation>No Details.</Explanation>
//                 </QuestionAnswer>
//                 <!-- Does the insured have professional liability coverage in place for all medical and non-medical professional services they provide with limits that are equal to or greater than those requested on this application? Note: Operations involving Cryotherapy are not eligible.? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP19</QuestionCd>
//                     <YesNoCd>YES</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does insured rent or lease any equipment such as skis, snowboards, bicycles or similar equipment? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP20</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is there a contract for semi-annual inspection and maintenance of the extinguishing system, hood, filters, and ducts? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP23</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is there a donut fryer at this location? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP28</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the rental agreement with storage unit customers contain restrictions concerning the storage of hazardous goods? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP57</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the applicant's premises have security protection i.e. locked gate with electronic key pad?? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP58</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does the insureds operations involve growing, storing, selling, dispensing, or otherwise providing access to medically-prescribed marijuana? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP64</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Has applicant been closed by the board of health in the last three years? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP66</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Have there been any sinkhole claims on this location? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP90</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are there any visible signs of sinkhole activity or damage at this location? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP91</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is any of the space leased to tenants used for business operations that do not qualify for coverage on the Commercial Protector (e.g. manufacturing, metal working or welding, spray painting, autobody work, woodworking, storage/manufacturing of flammables, or growing, processing, storing or dispensing marijuana)? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP96</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is any of the space leased to tenants used for business operations that do not qualify for coverage on the Commercial Protector (e.g. manufacturing, metal working or welding, spray painting, autobody work, woodworking, storage/manufacturing of flammables)?? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP97</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are customers' vehicles stored on applicant's premises overnight? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGARAG01</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are customers required to proof-read prior to printing? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL05</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are more than 10% of the gross annual receipts generated from assembly of bicycles or other sports equipment?? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL06</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are any receipts derived from the sale of LPG (do not include receipts generated from the sale of small pre-filled propane containers or the sale or exchange of empty propane receptacles)? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL16</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Has the operations undergone lead abatement? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL6</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Does glass make up more than 50% of the exterior construction?-->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL64</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is more than 15% of this building (maximum of 7,500 square feet) occupied by other tenants that are not offices, but have property exposures similar to those contemplated for the BOP, such as eligible Retail, Wholesale or Service classifications? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL84</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Is there a greenhouse present at this location? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMGENRL92</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- Are there any habitational exposures in this building? -->
//                 <QuestionAnswer>
//                     <QuestionCd>LMBOP75</QuestionCd>
//                     <YesNoCd>NO</YesNoCd>
//                 </QuestionAnswer>
//                 <!-- What are the insured's sales from any installation, service, or repair work generated from this location? -->
//                 <GrossReceipts>
//                     <OperationsCd>SVCIN</OperationsCd>
//                     <AnnualGrossReceiptsAmt>
//                         <Amt>0</Amt>
//                     </AnnualGrossReceiptsAmt>
//                 </GrossReceipts>
//                 <!-- <LocationUWInfoExt> -->
//                 <!-- Number of deep fat fryers -->
//                 <com.libertymutual.ci_DeepFatFryersCountCd>0</com.libertymutual.ci_DeepFatFryersCountCd>
//                 <!-- </LocationUWInfoExt>   -->
//             </LocationUWInfo>
//         </PolicyRq>
//     </InsuranceSvcRq>
// </ACORD> */}

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