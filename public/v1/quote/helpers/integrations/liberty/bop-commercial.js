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

/*
QUESTION SPECIAL CASES:
BOP8 (ignored)
    Question: "Wiring Year"
    Case: Year Built is > 24 years in the past and either Building limit > 0 or Business Personal Property limit > 500,000
BOP186 (ignored)
    Question: "Plumbing Year"
    Case: Year Built is > 24 years in the past and either Building limit > 0 or Business Personal Property limit > 500,000
BOP185 (ignored)
    Question: "Heating Year"
    Case: Year Built is > 24 years in the past and either Building limit > 0 or Business Personal Property limit > 500,000
*/

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

// NOTE: There are currently no special case questions for BOPLineBusiness questions

// these are special case questions that require specific details for inclusion in the request
const policyQuestionSpecialCases = [
    'UWQ5042', // GrossReceipts
    'UWQ1',
    'UWQ1_Explanation',
    'GLO202', // Not Included in Request(?)
    'UWQ2', // PolicySupplementExt
    'BOP24', // PolicySupplementExt
    'BOP23', // PolicySupplementExt
    'BOP2', // PolicySupplementExt
    'BOP191' // PolicySupplementExt
];

// these are special case questions that require specific details for inclusion in the request
const locationQuestionSpecialCases = [
    'UWQ5333', // GrossReceipts
    'UWQ5332', // GrossReceipts
    'UWQ5323', // GrossReceipts
    'UWQ5308', // GrossReceipts
    'UWQ172', // LocationUWInfoExt
    'UWQ172_Amount', // LocationUWInfoExt
    'CP64', // BldgImprovements/BldgImprovementExt
    'BOP8', // BldgImprovements
    'BOP58', // GrossReceipts
    'BOP56', // GrossReceipts, child of BOP55
    'BOP55', // GrossReceipts
    'BOP55_Amount', // GrossReceipts
    'BOP186', // BldgImprovements
    'BOP185', // BldgImprovements
    'BOP17', // BldgOccupancy/BldgOccupancyExt,
    'BOP17_YesNo', // internal question only
    'BOP17_AreaOccupiedByOthers', // BldgOccupancy
    'BOP17_AreaUnoccupied', // BldgOccupancy
    'LMBOP_Interest', // InterestCd
    'LMBOP_Construction', // Construction/ConstructionCd
    'LMBOP_RoofConstruction', // Construction/RoofingMaterial/com.libertymutual.ci_RoofMaterialResistanceCd
    'LMBOP_RoofType', // Construction/RoofingMaterial/RoofingMaterialCd
    'LMBOP_YearBuilt', // Construction/YearBuilt
    'LMBOP_NumStories', // Construction/NumStories
    'LMBOP_AlarmType', // BldgProtection/ProtectionDeviceBurglarCd
    'UWQ6003' // QuestionAnswer
];

const constructionMatrix = {
    "Frame": "F",
    "Joisted Masongry": "JM",
    "Non Combustible": "NC",
    "Masonry Non Combustible": "MNC",
    "Fire Resistive": "R"
};

const roofConstructionMatrix = {
    "Asphalt Shingles": "ASPHS",
    "Built Up (with gravel)": "TARGRB",
    "Built Up Without Gravel (Smooth Surface)": "BLTXGRVL",
    "Clay or Concrete Tile": "CLAYCONC",
    "Foam (sprayed on)": "FOAM",
    "Metal": "METL",
    "Modified Bitumen": "MODBITUMEN",
    "Single Ply Membrane (ballasted with smooth stone or paving blocks)": "MEMSINGLEBALL",
    "Single Ply Membrane (EPDM, Rubber)": "SPMSEPDMRUBB",
    "Single Ply Membrane (PVC, TPO)": "SPMSPVCTPO",
    "Wood Shingles/Shakes": "WOODSS",
    "Unknown": "UNKNOWN"
};

const roofTypeMatrix = {
    "Other than Wind Tolerant": "OT",
    "Wind Resistant": "WR"
};

const alarmTypeMatrix = {
    "Central Station Without Keys": "CEN",
    "Local": "LO",
    "Police/Fire Connected": "PCFC",
    "None": "NO" 
};

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

        // liberty can have multiple insurer industry codes tied to a single talage industry code
        // this will set this.industry_code to a list that will be handled in each Liberty BOP integration
        await this._getLibertyIndustryCodes();

        const applicationDocData = this.app.applicationDocData;
        const BOPPolicy = applicationDocData.policies.find(p => p.policyType === "BOP"); // This may need to change to BOPSR?
        const logPrefix = `Liberty Mutual Commercial BOP (Appid: ${applicationDocData.mysqlId}): `;

        if (!BOPPolicy) {
            const errorMessage = `${logPrefix}Could not find a policy with type BOP.`;
            log.error(`${errorMessage} ${__location}`);
            return this.client_error(errorMessage, __location);
        }

        if (!(BOPPolicy.coverage > 0)) {
            const errorMessage = `${logPrefix}No BPP Coverage was supplied for the Simple BOP Policy.`;
            log.error(`${errorMessage} ${JSON.stringify(BOPPolicy)} ` + __location)
            return this.client_error(errorMessage, __location);
        }

        const commercialBOPQuestions = applicationDocData.questions.filter(q => q.insurerQuestionAttributes.commercialBOP);
        const requestUUID = this.generate_uuid();

        // Assign the closest supported limit for Per Occ
        // NOTE: Currently this is not included in the request and defaulted on LM's side
        const limit = this.getSupportedLimit(BOPPolicy.limits);

        // NOTE: Liberty Mutual does not accept these values at this time. Automatically defaulted on their end...
        const deductible = this.getSupportedDeductible(BOPPolicy.deductible);
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

        const SignonRq = ACORD.ele('SignonRq');
        const SignonPswd = SignonRq.ele('SignonPswd');
        const CustId = SignonPswd.ele('CustId');
        CustId.ele('CustLoginId', this.username);
        SignonRq.ele('ClientDt', moment().local().format());
        SignonRq.ele('CustLangPref', 'English');
        const ClientApp = SignonRq.ele('ClientApp');
        ClientApp.ele('Org', "Talage Insurance");
        ClientApp.ele('Name', "Talage");
        ClientApp.ele('Version', "2.0");

        //     <InsuranceSvcRq>
        //         <RqUID>C4A112CD-3382-43DF-B200-10340F3511B4</RqUID>
        //         <PolicyRq>

        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', requestUUID);
        const PolicyRq = InsuranceSvcRq.ele('PolicyRq');

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

        // OPTIONAL AGENT INFORMATION LATER - required for API bind once LM implements for BOP
        //             <Producer>
        //                 <Surname>CONSUMER</Surname>
        //                 <GivenName>JOHNATHAN</GivenName>
        //                 <NIPRId>123456</NIPRId>
        //                 <ProducerRoleCd>Agent</ProducerRoleCd>
        //             </Producer>

        PolicyRq.ele('RqUID', requestUUID);
        PolicyRq.ele('TransactionRequestDt', moment().local().format());
        PolicyRq.ele('TransactionEffectiveDt', moment().local().format('YYYY-MM-DD'));
        PolicyRq.ele('CurCd', 'USD');
        PolicyRq.ele('BusinessPurposeTypeCd', 'NBQ'); // this is what Liberty Mutual Expects
        const SourceSystem = PolicyRq.ele('SourceSystem').att('id', 'Talage');
        SourceSystem.ele('SourceSystemCd', 'RAMP'); // this is what Liberty Mutual Expects
        const Producer = PolicyRq.ele('Producer');
        const ProducerInfo = Producer.ele('ProducerInfo');
        ProducerInfo.ele('ContractNumber', this.insurer.useSandbox ? '4689905' : this.app.agencyLocation.insurers[this.insurer.id].agency_id).att('SourceSystemRef', 'Talage');

        //             <InsuredOrPrincipal>

        const InsuredOrPrincipal = PolicyRq.ele('InsuredOrPrincipal');

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

        const GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');
        const NameInfo = GeneralPartyInfo.ele('NameInfo');
        const CommlName = NameInfo.ele('CommlName');
        CommlName.ele('CommercialName', applicationDocData.businessName);
        NameInfo.ele('LegalEntityCd', entityMatrix[applicationDocData.entityType]);
        const TaxIdentity = NameInfo.ele('TaxIdentity');
        TaxIdentity.ele('TaxIdTypeCd', 'FEIN');
        TaxIdentity.ele('TaxId', applicationDocData.ein);
        const Addr = GeneralPartyInfo.ele('Addr');
        Addr.ele('Addr1', applicationDocData.mailingAddress);
        Addr.ele('City', applicationDocData.mailingCity);
        Addr.ele('StateProvCd', applicationDocData.mailingState);
        Addr.ele('PostalCode', applicationDocData.mailingZipcode.substring(0, 5));
        const Communications = GeneralPartyInfo.ele('Communications');
        const PhoneInfo = Communications.ele('PhoneInfo');
        PhoneInfo.ele('PhoneTypeCd', 'Phone');
        PhoneInfo.ele('PhoneNumber', formattedPhone);

        //                 <InsuredOrPrincipalInfo>
        //                     <InsuredOrPrincipalRoleCd>FNI</InsuredOrPrincipalRoleCd>
        //                     <BusinessInfo>
        //                         <BusinessStartDt>2015</BusinessStartDt>
        //                         <OperationsDesc>Operations Desc</OperationsDesc>
        //                     </BusinessInfo>
        //                 </InsuredOrPrincipalInfo>
        //             </InsuredOrPrincipal>

        const InsuredOrPrincipalInfo = InsuredOrPrincipal.ele('InsuredOrPrincipalInfo');
        InsuredOrPrincipalInfo.ele('InsuredOrPrincipalRoleCd', 'FNI');
        const BusinessInfo = InsuredOrPrincipalInfo.ele('BusinessInfo');
        BusinessInfo.ele('BusinessStartDt', moment(applicationDocData.founded).format('YYYY'));
        BusinessInfo.ele('OperationsDesc', 'N/A'); // NOTE: See if this is acceptable, or if we need to add a question 

    //             <Policy>

        const Policy = PolicyRq.ele('Policy');

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

        const MiscParty = Policy.ele('MiscParty');
        const MiscPartyInfo = MiscParty.ele('MiscPartyInfo');
        MiscPartyInfo.ele('MiscPartyRoleCd', "PrimaryContact");
        const GeneralPartyInfoSub = MiscParty.ele('GeneralPartyInfo');
        const NameInfoSub = GeneralPartyInfoSub.ele('NameInfo');
        const CommlNameSub = NameInfoSub.ele('CommlName');
        CommlNameSub.ele('CommercialName', applicationDocData.businessName);
        const CommunicationsSub = GeneralPartyInfoSub.ele('Communications');
        const PhoneInfoSub = CommunicationsSub.ele('PhoneInfo');
        PhoneInfoSub.ele('PhoneTypeCd', 'Phone');
        PhoneInfoSub.ele('PhoneNumber', formattedPhone);

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

        Policy.ele('LOBCd', 'BOP');
        Policy.ele('ControllingStateProvCd', applicationDocData.mailingState);
        const ContractTerm = Policy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', moment(BOPPolicy.effectiveDate).format('YYYY-MM-DD'));
        const PolicySupplement = Policy.ele('PolicySupplement');
        PolicySupplement.ele('NumEmployees', this.get_total_employees());
        const AnnualSalesAmt = PolicySupplement.ele('AnnualSalesAmt');
        AnnualSalesAmt.ele('Amt', applicationDocData.grossSalesAmt);

        //                 <!-- Has the insured been involved in any EPLI claims regardless of whether any payment or not, or does the insured have knowledge of any situation(s) that could produce an EPLI claim? -->
        //                 <QuestionAnswer>
        //                     <QuestionCd>EPL03</QuestionCd>
        //                     <YesNoCd>NO</YesNoCd>
        //                 </QuestionAnswer>

        //                 <QuestionAnswer>
        //                     <QuestionCd>LMGENRL20</QuestionCd>
        //                     <YesNoCd>NO</YesNoCd>
        //                     <!-- Please provide details of prior coverage -->
        //                     <Explanation>Prior Coverage detail goes here</Explanation>
        //                 </QuestionAnswer>

        const allPolicyQuestions = commercialBOPQuestions.filter(q => q.insurerQuestionAttributes.commercialBOP.ACORDValue === "Policy");
        const standardPolicyQuestions = allPolicyQuestions.filter(q => !policyQuestionSpecialCases.concat().includes(q.insurerQuestionIdentifier));
        const specialPolicyQuestions = allPolicyQuestions.filter(q => policyQuestionSpecialCases.includes(q.insurerQuestionIdentifier));

        let PolicySupplementExt = null;
        specialPolicyQuestions.forEach(question => {
            switch (question.insurerQuestionIdentifier) {
                case "UWQ5042":
                    const UWQ5042GrossReceipts = Policy.ele('GrossReceipts');
                    UWQ5042GrossReceipts.ele('OperationsCd', 'OUTSIDEUS');
                    UWQ5042GrossReceipts.ele('RevenuePct', question.answerValue);
                    break;
                case "UWQ2":
                    if (!PolicySupplementExt) {
                        PolicySupplementExt = PolicySupplement.ele('PolicySupplementExt');
                    }
                    PolicySupplementExt.ele('com.libertymutual.ci_NonRenewalOrCancellationOtherReasonText', question.answerValue);
                    break;
                case "UWQ1":
                    const UWQ1QuestionAnswer = Policy.ele('QuestionAnswer');
                    UWQ1QuestionAnswer.ele('QuestionCd', question.insurerQuestionAttributes.commercialBOP.ACORDCd);
                    UWQ1QuestionAnswer.ele('YesNoCd', question.answerValue.toUpperCase());

                    if (question.answerValue.toLowerCase() === "yes") {
                        const explanation = specialPolicyQuestions.find(q => q.insurerQuestionIdentifier === "UWQ1_Explanation");

                        if (explanation) {
                            UWQ1QuestionAnswer.ele('Explanation', explanation.answerValue);
                        } else {
                            log.warn(`${logPrefix}Question UWQ1 was answered "Yes", but no child Explanation question was found.`);
                        }
                    }
                    break;
                case "UWQ1_Explanation":
                    // handled in UWQ1
                    break;
                case "GLO202":
                    // Question dock shows "N/A UI only, so currently not including in request"
                    break;
                case "BOP24":
                    if (!PolicySupplementExt) {
                        PolicySupplementExt = PolicySupplement.ele('PolicySupplementExt');
                    }                    
                    PolicySupplementExt.ele('com.libertymutual.ci_EquipLeasedRentedOperatorsStatusCd', question.answerValue);
                    break;
                case "BOP23":
                    if (!PolicySupplementExt) {
                        PolicySupplementExt = PolicySupplement.ele('PolicySupplementExt');
                    }
                    PolicySupplementExt.ele('com.libertymutual.ci_TypeEquipLeasedRentedText', question.answerValue);
                    break;
                case "BOP2":
                    if (!PolicySupplementExt) {
                        PolicySupplementExt = PolicySupplement.ele('PolicySupplementExt');
                    }

                    let yearsOfExp = parseInt(question.answerValue);
                    if (isNaN(yearsOfExp)) {
                        yearsOfExp = 0;
                    }

                    PolicySupplementExt.ele('com.libertymutual.ci_NumYrsManagementExperience', yearsOfExp);

                    if (yearsOfExp < 3) {
                        const BOP191 = specialPolicyQuestions.find(q => q.insurerQuestionIdentifier === "BOP191");

                        if (BOP191) {
                            PolicySupplementExt.ele('com.libertymutual.ci_InsuredManagementExperienceText', BOP191.answerValue);
                        }
                    }
                    break;
                case "BOP191":
                    // handled in BOP2
                    break;
                default: 
                    log.warn(`${logPrefix}Unknown question identifier [${question.insurerQuestionIdentifier}] encountered while adding Policy question special cases.`);
                    break;
            }
        });

        // for each policy question (that's not UWQ1 related), add it to XML
        standardPolicyQuestions.forEach(question => {
            const QuestionAnswer = Policy.ele('QuestionAnswer');
            QuestionAnswer.ele('QuestionCd', question.insurerQuestionAttributes.commercialBOP.ACORDCd);

            if (question.insurerQuestionAttributes.commercialBOP.ACORDPath && question.insurerQuestionAttributes.commercialBOP.ACORDPath.toLowerCase().includes('explanation')) {
                // NOTE: We may need to find the parent question and provide its answer that triggered this explanation question here as YesNoCd
                QuestionAnswer.ele('Explanation', question.answerValue);
            } else {
                QuestionAnswer.ele('YesNoCd', question.answerValue);
            }
        });
        
        //                 <AnyLossesAccidentsConvictionsInd>0</AnyLossesAccidentsConvictionsInd>

        Policy.ele('AnyLossesAccidentsConvictionsInd', applicationDocData.claims.length);

        //                 <PolicyExt>
        //                     <com.libertymutual.ci_BusinessClassDesc>Business Class Description</com.libertymutual.ci_BusinessClassDesc>
        //                     <com.libertymutual.ci_BusinessClassId>01234</com.libertymutual.ci_BusinessClassId>
        //                 </PolicyExt>
        //             </Policy>

        const PolicyExt = Policy.ele('PolicyExt');
        PolicyExt.ele('com.libertymutual.ci_BusinessClassDesc', this.industry_code.description);
        PolicyExt.ele('com.libertymutual.ci_BusinessClassId', this.industry_code.code);

        //             <Location id="Wc3a968def7d94ae0acdabc4d95c34a86W">
        //                 <Addr>
        //                     <Addr1>1 Penman Lane</Addr1>
        //                     <City>Bountiful</City>
        //                     <StateProvCd>UT</StateProvCd>
        //                     <PostalCode>84010</PostalCode>
        //                 </Addr>
        //             </Location>

        applicationDocData.locations.forEach((location, index) => {
            const Location = PolicyRq.ele('Location').att('id', `L${index}`);
            const subAddr = Location.ele('Addr');
            subAddr.ele('Addr1', location.address);
            subAddr.ele('City', location.city);
            subAddr.ele('StateProvCd', location.state);
            subAddr.ele('PostalCode', location.zipcode.substring(0, 5));
        });

        //             <BOPLineBusiness>
        //                 <LOBCd>BOP</LOBCd>

        const BOPLineBusiness = PolicyRq.ele('BOPLineBusiness');
        BOPLineBusiness.ele('LOBCd', 'BOP');

        //                 <PropertyInfo>
        //                     <Coverage>
        //                         <CoverageCd>PropDed</CoverageCd>
        //                         <Deductible>
        //                             <FormatCurrencyAmt>
        //                                 <Amt>500</Amt>
        //                             </FormatCurrencyAmt>
        //                             <DeductibleTypeCd>"FL"</DeductibleTypeCd>
        //                             <DeductibleAppliesToCd>"Coverage"</DeductibleAppliesToCd>
        //                         </Deductible>
        //                     </Coverage>
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
        //                 </PropertyInfo>

        const PropertyInfo = BOPLineBusiness.ele('PropertyInfo');
        for (let i = 0; i < applicationDocData.locations.length; i++) {
            const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo').att('LocationRef', `L${i}`);
            CommlPropertyInfo.ele('SubjectInsuranceCd', 'BPP');
            CommlPropertyInfo.ele('ClassCd', this.industry_code.code);
            const Coverage = CommlPropertyInfo.ele('Coverage');
            Coverage.ele('CoverageCd', 'BPP');
            const Limit = Coverage.ele('Limit');
            const FormatCurrencyAmt = Limit.ele('FormatCurrencyAmt');
            FormatCurrencyAmt.ele('Amt', BOPPolicy.coverage);
            Limit.ele('LimitAppliesToCd', 'Coverage');
        }

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
        //                     </GeneralLiabilityClassification>
        //                 </LiabilityInfo>

        const LiabilityInfo = BOPLineBusiness.ele('LiabilityInfo');
        applicationDocData.locations.forEach((location, index) => {
            const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification').att('LocationRef', `L${index}`);
            GeneralLiabilityClassification.ele('ClassCd', this.industry_code.code);
            const innerCoverage = GeneralLiabilityClassification.ele('Coverage');
            innerCoverage.ele('CoverageCd', 'CGL');
            const PTOption = innerCoverage.ele('Option');
            PTOption.ele('OptionCd', 'PartTime');
            PTOption.ele('OptionTypeCd', 'Num1');
            PTOption.ele('OptionValue', location.part_time_employees);
            const FTOption = innerCoverage.ele('Option');
            FTOption.ele('OptionCd', 'FullTime');
            FTOption.ele('OptionTypeCd', 'Num1');
            FTOption.ele('OptionValue', location.full_time_employees);
        });

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
        //             </BOPLineBusiness>

        const BOPLineBusinessQuestions = commercialBOPQuestions.filter(q => q.insurerQuestionAttributes.commercialBOP.ACORDValue === "BOPLineBusiness");

        // for each policy question, add it to XML
        BOPLineBusinessQuestions.forEach(question => {
            const QuestionAnswer = BOPLineBusiness.ele('QuestionAnswer');
            QuestionAnswer.ele('QuestionCd', question.insurerQuestionAttributes.commercialBOP.ACORDCd);

            if (question.insurerQuestionAttributes.commercialBOP.ACORDPath && question.insurerQuestionAttributes.commercialBOP.ACORDPath.toLowerCase().includes('explanation')) {
                // NOTE: We may need to find the parent question and provide its answer that triggered this explanation question here as YesNoCd
                QuestionAnswer.ele('Explanation', question.answerValue);
            } else {
                QuestionAnswer.ele('YesNoCd', question.answerValue);
            }
        });

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
        //                 <!-- What are the insured's sales from any installation, excluding delivery, generated from this location? -->
        //                 <GrossReceipts>
        //                     <OperationsCd>INSTALLATION</OperationsCd>
        //                     <AnnualGrossReceiptsAmt>
        //                         <Amt>15000</Amt>
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

        applicationDocData.locations.forEach((location, index) => {
            const LocationUWInfo = PolicyRq.ele('LocationUWInfo').att('LocationRef', `L${index}`);
            const allLocationQuestions = location.questions;
            const standardLocationQuestions = allLocationQuestions.filter(q => !locationQuestionSpecialCases.concat().includes(q.insurerQuestionIdentifier));
            const specialLocationQuestions = allLocationQuestions.filter(q => locationQuestionSpecialCases.includes(q.insurerQuestionIdentifier));
            const yearBuiltQuestion = specialLocationQuestions.find(q => q.insurerQuestionIdentifier === "LMBOP_YearBuilt");

            let yearBuilt = null;
            if (yearBuiltQuestion) {
                if (!isNaN(parseInt(yearBuiltQuestion.answerValue))) {
                    yearBuilt = parseInt(yearBuiltQuestion.answerValue);
                }
            }

            const BldgProtection = LocationUWInfo.ele('BldgProtection');
            const Construction = LocationUWInfo.ele('Construction');
            const RoofingMaterial = Construction.ele('RoofingMaterial');
            const BldgOccupancy = LocationUWInfo.ele('BldgOccupancy');
            const AreaOccupied = BldgOccupancy.ele('AreaOccupied');
            const BldgArea = Construction.ele('BldgArea');

            // Bldg Area (autofill)
            BldgArea.ele('NumUnits', location.square_footage);
            BldgArea.ele('UnitMeasurementCd', 'SquareFeet');

            // Gross Revenue (autofill)
            const AnnualGrossReceipts = LocationUWInfo.ele('GrossReceipts');
            AnnualGrossReceipts.ele('OperationsCd', 'TOTAL');
            const AGRAnnualGrossReceiptsAmt = AnnualGrossReceipts.ele('AnnualGrossReceiptsAmt');
            AGRAnnualGrossReceiptsAmt.ele('Amt', applicationDocData.grossSalesAmt);

            let LocationUWInfoExt = null;
            let BldgImprovements = null;
            let BldgImprovementExt = null;
            let BldgOccupancyExt = null;

            // handle special case questions first
            specialLocationQuestions.forEach(question => {
                switch (question.insurerQuestionIdentifier) {
                    case "UWQ5333":
                        const UWQ5333GrossReceipts = LocationUWInfo.ele('GrossReceipts');
                        UWQ5333GrossReceipts.ele('OperationsCd', 'INTERNET');
                        const UWQ5333AnnualGrossReceiptsAmt = UWQ5333GrossReceipts.ele('AnnualGrossReceiptsAmt');
                        UWQ5333AnnualGrossReceiptsAmt.ele('Amt', question.answerValue);
                        break;
                    case "UWQ5332":
                        const UWQ5332GrossReceipts = LocationUWInfo.ele('GrossReceipts');
                        UWQ5332GrossReceipts.ele('OperationsCd', 'AMMFIRE');
                        const UWQ5332AnnualGrossReceiptsAmt = UWQ5332GrossReceipts.ele('AnnualGrossReceiptsAmt');
                        UWQ5332AnnualGrossReceiptsAmt.ele('Amt', question.answerValue);
                        break;
                    case "UWQ5323":
                        const UWQ5323GrossReceipts = LocationUWInfo.ele('GrossReceipts');
                        UWQ5323GrossReceipts.ele('OperationsCd', 'IMPORTS');
                        const UWQ5323AnnualGrossReceiptsAmt = UWQ5323GrossReceipts.ele('AnnualGrossReceiptsAmt');
                        UWQ5323AnnualGrossReceiptsAmt.ele('Amt', question.answerValue);
                        break;
                    case "UWQ5308":
                        const UWQ5308GrossReceipts = LocationUWInfo.ele('GrossReceipts');
                        UWQ5308GrossReceipts.ele('OperationsCd', 'ADULT');
                        const UWQ5308AnnualGrossReceiptsAmt = UWQ5308GrossReceipts.ele('AnnualGrossReceiptsAmt');
                        UWQ5308AnnualGrossReceiptsAmt.ele('Amt', question.answerValue);
                        break;
                    case "UWQ172":
                        // handled in UWQ172_Amount
                        break;
                    case "UWQ172_Amount":
                        if (!LocationUWInfoExt) {
                            LocationUWInfoExt = LocationUWInfo.ele('LocationUWInfoExt');
                        }
                        LocationUWInfoExt.ele('com.libertymutual.ci_DeepFatFryersCountCd', question.answerValue);
                        break;
                    case "CP64":
                        if (!BldgImprovements) {
                            BldgImprovements = LocationUWInfo.ele('BldgImprovements');
                        }
                        if (!BldgImprovementExt) {
                            BldgImprovementExt = BldgImprovements.ele('BldgImprovementExt');
                        }
                        BldgImprovementExt.ele('com.libertymutual.ci_ResidentialOccupancyPct', question.answerValue);
                        break;
                    case "BOP8":
                    case "BOP186":
                    case "BOP185":
                        // only provide these questions if year built was over 24 years ago
                        if (!yearBuilt || moment().year() - yearBuilt > 24) {
                            if (!BldgImprovements) {
                                BldgImprovements = LocationUWInfo.ele('BldgImprovements');
                            }
                            if (!BldgImprovementExt) {
                                BldgImprovementExt = BldgImprovements.ele('BldgImprovementExt');
                            }
                            const qId = question.insurerQuestionIdentifier;
                            if (qId === 'BOP8') {
                                BldgImprovementExt.ele('WiringImprovementYear', question.answerValue);
                            } else if (qId === 'BOP186') {
                                BldgImprovementExt.ele('PlumbingImprovementYear', question.answerValue);
                            } else { // if BOP185
                                BldgImprovementExt.ele('HeatingImprovementYear', question.answerValue);
                            }
                        }
                        break;
                    case "BOP58":
                        const BOP58GrossReceipts = LocationUWInfo.ele('GrossReceipts');
                        BOP58GrossReceipts.ele('OperationsCd', 'INSTALLATION');
                        const BOP58AnnualGrossReceiptsAmt = BOP58GrossReceipts.ele('AnnualGrossReceiptsAmt');
                        BOP58AnnualGrossReceiptsAmt.ele('Amt', question.answerValue);
                        break;
                    case "BOP56":
                    case "BOP55":
                        // handled in BOP55_Amount
                        break;
                    case "BOP55_Amount":
                        const BOP55GrossReceipts = LocationUWInfo.ele('GrossReceipts');
                        BOP55GrossReceipts.ele('OperationsCd', 'SVCIN');
                        const BOP55AnnualGrossReceiptsAmt = BOP55GrossReceipts.ele('AnnualGrossReceiptsAmt');
                        BOP55AnnualGrossReceiptsAmt.ele('Amt', question.answerValue);

                        const BOP56 = specialLocationQuestions.find(q => q.insurerQuestionIdentifier === "BOP56");
                        if (BOP56) {
                            BOP55GrossReceipts.ele('ProductDesc', BOP56.answerValue);
                        }
                        break;
                    case "BOP17_YesNo":
                        if (question.answerValue.toLowerCase() === "no") {
                            const BOP17_AreaOccupiedByOther = specialLocationQuestions.find(q => q.insurerQuestionIdentifier === "BOP17_AreaOccupiedByOther");
                            const BOP17_AreaUnoccupied = specialLocationQuestions.find(q => q.insurerQuestionIdentifier === "BOP17_AreaUnoccupied");
                            const BOP17 = specialLocationQuestions.find(q => q.insurerQuestionIdentifier === "BOP17");

                            let occupiedByOther = 0;
                            let unoccupied = 0;

                            if (BOP17_AreaOccupiedByOther) {
                                occupiedByOther = parseInt(BOP17_AreaOccupiedByOther.answerValue);
                                const AreaOccupiedByOther = BldgOccupancy.ele('AreaOccupiedByOther');
                                AreaOccupiedByOther.ele('NumUnits', occupiedByOther);
                                AreaOccupiedByOther.ele('UnitMeasurementCd', 'SquareFeet');
                                
                            }

                            if (BOP17_AreaUnoccupied) {
                                unoccupied = parseInt(BOP17_AreaUnoccupied.answerValue);
                                const AreaUnoccupied = BldgOccupancy.ele('AreaUnoccupied');
                                AreaUnoccupied.ele('NumUnits', unoccupied);
                                AreaUnoccupied.ele('UnitMeasurementCd', 'SquareFeet');
                            }

                            if (BOP17) {
                                if (!BldgOccupancyExt) {
                                    BldgOccupancyExt = BldgOccupancy.ele('BldgOccupancyExt');
                                }
                                BldgOccupancyExt.ele('com.libertymutual.ci_UnoccupiedAreasConditionText', question.answerValue);
                            }

                            const occupied = location.square_footage - (occupiedByOther + unoccupied);
                            AreaOccupied.ele('NumUnits', occupied >= 0 ? occupied : 0);
                            AreaOccupied.ele('UnitMeasurementCd', 'SquareFeet');
                        } else {
                            AreaOccupied.ele('NumUnits', location.square_footage);
                            AreaOccupied.ele('UnitMeasurementCd', 'SquareFeet');
                        }
                        break;
                    case "BOP17":
                    case "BOP17_AreaOccupiedByOther":
                    case "BOP17_AreaUnoccupied":
                        // handled in BOP17_YesNo
                        break;
                    case "LMBOP_Interest":
                        LocationUWInfo.ele('InterestCd', question.answerValue);
                        break;
                    case "LMBOP_Construction":
                        Construction.ele('ConstructionCd', constructionMatrix[question.answerValue.trim()]);
                        break;
                    case "LMBOP_RoofConstruction":
                        RoofingMaterial.ele('com.libertymutual.ci_RoofMaterialResistanceCd', roofConstructionMatrix[question.answerValue.trim()]);
                        break;
                    case "LMBOP_RoofType":
                        RoofingMaterial.ele('RoofingMaterialCd', roofTypeMatrix[question.answerValue.trim()]);
                        break;
                    case "LMBOP_YearBuilt":
                        Construction.ele('YearBuilt', question.answerValue);
                        break;
                    case "LMBOP_NumStories":
                        Construction.ele('NumStories', question.answerValue);
                        break;
                    case "LMBOP_AlarmType":
                        BldgProtection.ele('ProtectionDeviceBurglarCd', alarmTypeMatrix[question.answerValue.trim()]);
                        break;
                    case "UWQ6003":
                        // only provide answer to this question if year built is over 24 years ago 
                        if (!yearBuilt || moment().year() - yearBuilt > 24) {
                            const UWQ6003QuestionAnswer = LocationUWInfo.ele('QuestionAnswer');
                            UWQ6003QuestionAnswer.ele('QuestionCode', question.insurerQuestionAttributes.commercialBOP.ACORDCd);
                            UWQ6003QuestionAnswer.ele('YesNoCd', question.answerValue);
                        }
                        break;
                    default: 
                        log.warn(`${logPrefix}Unknown question identifier [${question.insurerQuestionIdentifier}] encountered while adding Policy question special cases.`);
                        break;
                }
            });

            // then create general questions
            standardLocationQuestions.forEach(question => {
                const QuestionAnswer = LocationUWInfo.ele('QuestionAnswer');

                if (question.insurerQuestionAttributes.commercialBOP.ACORDCd === 'N/A') {
                    console.log(JSON.stringify(question, null, 4));
                }
                QuestionAnswer.ele('QuestionCd', question.insurerQuestionAttributes.commercialBOP.ACORDCd);

                if (question.insurerQuestionAttributes.commercialBOP.ACORDPath && question.insurerQuestionAttributes.commercialBOP.ACORDPath.toLowerCase().includes('explanation')) {
                    // NOTE: We may need to find the parent question and provide its answer that triggered this explanation question here as YesNoCd
                    QuestionAnswer.ele('Explanation', question.answerValue);
                } else {
                    QuestionAnswer.ele('YesNoCd', question.answerValue);
                }
            });
        });

        // -------------- SEND XML REQUEST ----------------

        // Get the XML structure as a string
        const xml = ACORD.end({'pretty': true});

        log.debug("=================== QUOTE REQUEST ===================");
        log.debug(`Liberty Mutual request (Appid: ${this.app.id}): \n${xml}`);
        log.debug("=================== QUOTE REQUEST ===================");

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
                log.error("=================== QUOTE ERROR ===================");
                log.error(`Liberty Mutual Simple BOP Request Error (Appid: ${this.app.id}):\n${JSON.stringify(objPath, null, 4)}`);
                log.error("=================== QUOTE ERROR ===================");
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

    async _getLibertyIndustryCodes() {

        const InsurerIndustryCodeModel = require('mongoose').model('InsurerIndustryCode');
        const policyEffectiveDate = moment(this.policy.effective_date).format(db.dbTimeFormat());
        const applicationDocData = this.app.applicationDocData;

        const logPrefix = `Liberty Mutual Commercial BOP (Appid: ${applicationDocData.mysqlId}): `

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
        } catch (e) {
            log.error(`${logPrefix}Error re-retrieving Liberty industry codes. Falling back to original code.`);
            return;
        }

        if (insurerIndustryCodeList && insurerIndustryCodeList.length > 0) {
            this.industry_code = insurerIndustryCodeList;
        } else {
            log.warn(`${logPrefix}No industry codes were returned while attempting to re-retrieve Liberty industry codes. Falling back to original code.`);
            this.industry_code = [this.industry_code];
        }

        this.industry_code = this.industry_code.find(ic => ic.attributes.commercialBOP);
        if (!this.industry_code) {
            const errorMessage = `${logPrefix}No Industry Code was found for Commercial BOP. `;
            log.error(`${errorMessage} ${JSON.stringify(sbopPolicy)} ` + __location)
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