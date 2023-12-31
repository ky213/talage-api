/**
 * BOP for Acuity
 */

'use strict';

const builder = require('xmlbuilder');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');
global.requireShared('./helpers/tracker.js');
const {convertToDollarFormat} = global.requireShared('./helpers/stringFunctions.js');


module.exports = class AcuityBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
        this.requiresProductPolicyTypeFilter = true;
    }

    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.applicationDocData

        const logPrefix = `Appid: ${this.app.id} Acuity BOP `
        const insurerBO = new InsurerBO();
        const insurerSlug = 'acuity';
        const insurer = await insurerBO.getBySlug(insurerSlug);
        if (!insurer) {
            log.error(`Acuity not found by slug ${__location}`);
            return this.return_result('error');
        }

        // These are the limits supported by Acuity
        const carrierLimits = [
            '1000000/1000000/1000000',
            '1000000/2000000/1000000',
            '1000000/2000000/2000000'
        ];

        // Define how legal entities are mapped for Acuity
        const entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };

        // These are special questions that are not handled the same as other class questions. They will be skipped when generating QuestionAnswer values.
        // They are likely that they are hard-coded in below somewhere
        const skipQuestions = [1036, 1037];


        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            log.error(`Acuity (application ${this.app.id}): Could not get best limits for policy ${this.policy.type} ${this.industry_code.id} ${__location}`);
            this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // Ensure we support this entity type
        if (!(this.app.business.entity_type in entityMatrix)) {
            log.error(`Acuity (application ${this.app.id}): Invalid Entity Type ${__location}`);
            return this.return_result('autodeclined');
        }

        // for EIN
        if (!appDoc.ein) {
            return this.client_error("Acuity BOP requires FEIN.", __location);
        }

        if (!this.industry_code.attributes.acuityNAICSCode) {
            log.error(`Acuity (application ${this.app.id}): Could not find ACUITYNAICSCode for industry code ${this.industry_code.id} ${__location}`);
            return this.return_result('autodeclined');
        }
        //Controlls RC1 vs Rc2. Only RC1 for now
        const quickQuote = true;
        // if (this.industry_code.attributes.acuityNAICSCode.split('-')[1] === '000') {
        //     quickQuote = true;
        // }

        // Acuity has us define our own Request ID
        this.request_id = this.generate_uuid();

        // Get the current time in the Pacific timezone
        const now = moment_timezone.tz('America/Los_Angeles');

        // Build the XML Request

        // <ACORD>
        const ACORD = builder.create('ACORD');

        // <SignonRq>
        const SignonRq = ACORD.ele('SignonRq');

        // <SignonTransport>
        const SignonTransport = SignonRq.ele('SignonTransport');
        SignonTransport.ele('SignonRoleCd', 'Customer');

        // <CustId>
        const CustId = SignonTransport.ele('CustId');
        CustId.ele('SPName', 'com.talage');
        CustId.ele('CustLoginId', 'talage');
        // </CustId>

        // </SignonTransport>

        SignonRq.ele('CustLangPref', 'EN-US');

        // <ClientApp>
        const ClientApp = SignonRq.ele('ClientApp');
        ClientApp.ele('Org', 'Talage Insurance');
        ClientApp.ele('Name', 'Talage');
        // ClientApp.ele('Version', '2.0');
        ClientApp.ele('Version', '6.0');
        // </ClientApp>

        // </SignonRq>

        // <InsuranceSvcRq>
        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', this.request_id);

        // <BOPPolicyQuoteInqRq>
        const BOPPolicyQuoteInqRq = InsuranceSvcRq.ele('BOPPolicyQuoteInqRq');
        BOPPolicyQuoteInqRq.ele('RqUID', this.request_id);
        BOPPolicyQuoteInqRq.ele('BusinessPurposeTypeCd', quickQuote ? 'com.acuity_NBQ_RC1' : 'com.acuity_NBQ_RC2');
        BOPPolicyQuoteInqRq.ele('TransactionRequestDt', now.format('YYYY-MM-DDTHH:mm:ss'));
        BOPPolicyQuoteInqRq.ele('TransactionEffectiveDt', now.format('YYYY-MM-DD'));
        BOPPolicyQuoteInqRq.ele('CurCd', 'USD');

        // <Producer>
        const Producer = BOPPolicyQuoteInqRq.ele('Producer');

        // <GeneralPartyInfo>
        let GeneralPartyInfo = Producer.ele('GeneralPartyInfo');

        // <NameInfo>
        let NameInfo = GeneralPartyInfo.ele('NameInfo');

        // <CommlName>
        NameInfo.ele('CommlName').ele('CommercialName', 'Talage Insurance');
        // </CommlName>
        // </NameInfo>

        // <Addr>
        let Addr = GeneralPartyInfo.ele('Addr');
        Addr.ele('Addr1', '300 South Wells Ave., Suite 4');
        Addr.ele('City', 'Reno');
        Addr.ele('StateProvCd', 'NV');
        Addr.ele('PostalCode', 89502);
        // </Addr>

        // <Communications>
        let Communications = GeneralPartyInfo.ele('Communications');

        // <PhoneInfo>
        let PhoneInfo = Communications.ele('PhoneInfo');
        PhoneInfo.ele('PhoneTypeCd', 'Phone');
        PhoneInfo.ele('PhoneNumber', '+1-833-4825243');
        // </PhoneInfo>

        // </Communications>

        // </GeneralPartyInfo>

        // <ProducerInfo>
        const ProducerInfo = Producer.ele('ProducerInfo');
        ProducerInfo.ele('ContractNumber', this.app.agencyLocation.insurers[this.insurer.id].agency_id);
        // ProducerInfo.ele('ProducerSubCode', 'AA');
        // </ProducerInfo>

        // </Producer>

        // <InsuredOrPrincipal>
        const InsuredOrPrincipal = BOPPolicyQuoteInqRq.ele('InsuredOrPrincipal');
        // <GeneralPartyInfo>
        GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');
        // <NameInfo>
        NameInfo = GeneralPartyInfo.ele('NameInfo');
        // <CommlName>
        NameInfo.ele('CommlName').ele('CommercialName', this.app.business.name);
        // </CommlName>

        NameInfo.ele('LegalEntityCd', entityMatrix[this.app.business.entity_type]);

        // Add full name for a sole proprietorship
        if (this.app.business.entity_type === 'Sole Proprietorship') {
            // <PersonName>
            const PersonNameSP = NameInfo.ele('PersonName');
            PersonNameSP.ele('GivenName', this.app.business.contacts[0].first_name);
            PersonNameSP.ele('Surname', this.app.business.contacts[0].last_name);
            // </PersonName>
        }

        // <TaxIdentity>
        const TaxIdentity = NameInfo.ele('TaxIdentity');
        TaxIdentity.ele('TaxIdTypeCd', 'FEIN');
        TaxIdentity.ele('TaxId', appDoc.ein);
        // </TaxIdentity>

        if (this.app.business.dba) {
            // <SupplementaryNameInfo>
            const SupplementaryNameInfo = NameInfo.ele('SupplementaryNameInfo');
            SupplementaryNameInfo.ele('SupplementaryNameCd', 'DBA');
            SupplementaryNameInfo.ele('SupplementaryName', this.app.business.dba);
            // </SupplementaryNameInfo>
        }

        // </NameInfo>

        // <Addr>
        Addr = GeneralPartyInfo.ele('Addr');
        Addr.ele('AddrTypeCd', 'MailingAddress');
        Addr.ele('Addr1', this.app.business.mailing_address);
        if (this.app.business.mailing_address2) {
            Addr.ele('Addr2', this.app.business.mailing_address2);
        }
        Addr.ele('City', this.app.business.mailing_city);
        Addr.ele('StateProvCd', this.app.business.mailing_territory);
        Addr.ele('PostalCode', this.app.business.mailing_zip);
        // </Addr>

        // <Communications>
        Communications = GeneralPartyInfo.ele('Communications');

        // <PhoneInfo>
        PhoneInfo = Communications.ele('PhoneInfo');
        PhoneInfo.ele('PhoneTypeCd', 'Phone');
        PhoneInfo.ele('CommunicationUseCd', 'Day');
        const phone = this.app.business.contacts[0].phone.toString();
        PhoneInfo.ele('PhoneNumber', `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)} `);
        // </PhoneInfo>

        // <EmailInfo>
        const EmailInfo = Communications.ele('EmailInfo');
        EmailInfo.ele('EmailAddr', this.app.business.contacts[0].email);
        // </EmailInfo>

        if (this.app.business.website) {
            // <WebsiteInfo>
            const WebsiteInfo = Communications.ele('WebsiteInfo');
            WebsiteInfo.ele('WebsiteURL', this.app.business.website);
            // </WebsiteInfo>
        }

        // </Communications>
        // </GeneralPartyInfo>

        // <InsuredOrPrincipalInfo>
        const InsuredOrPrincipalInfo = InsuredOrPrincipal.ele('InsuredOrPrincipalInfo');
        InsuredOrPrincipalInfo.ele('InsuredOrPrincipalRoleCd', 'Insured');
        // <BusinessInfo>
        const BusinessInfo = InsuredOrPrincipalInfo.ele('BusinessInfo');
        BusinessInfo.ele('NAICSCd', this.industry_code.attributes.acuityNAICSCode);
        BusinessInfo.ele('BusinessStartDt', this.app.business.founded.format('YYYY-MM-DD'));
        let operationsDescription = this.app.business.industry_code_description;
        //caused produciton error before defensive check.
        if(this.app.business.locations[0] && this.app.business.locations[0].activity_codes[0]){
            operationsDescription = this.app.business.locations[0].activity_codes[0].description;
        }
        BusinessInfo.ele('OperationsDesc', operationsDescription);
        BusinessInfo.ele('NumOwners', this.app.business.num_owners);
        BusinessInfo.ele('NumEmployees', this.get_total_employees());
        BusinessInfo.ele('NumEmployeesFullTime', this.get_total_full_time_employees());
        BusinessInfo.ele('NumEmployeesPartTime', this.get_total_part_time_employees());
        // </BusinessInfo>
        // </InsuredOrPrincipalInfo>
        // </InsuredOrPrincipal>

        //<BOPPolicyQuoteInqRq>
        // <CommlPolicy>
        const CommlPolicy = BOPPolicyQuoteInqRq.ele('CommlPolicy');
        CommlPolicy.ele('LOBCd', 'BOP');
        CommlPolicy.ele('ControllingStateProvCd', this.app.business.primary_territory);

        // <ContractTerm>
        const ContractTerm = CommlPolicy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
        ContractTerm.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
        // </ContractTerm>

        // <CommlPolicySupplement>
        const CommlPolicySupplement = CommlPolicy.ele('CommlPolicySupplement');
        if (appDoc.grossSalesAmt) {
            CommlPolicySupplement.ele('AnnualSalesAmt').ele('Amt', appDoc.grossSalesAmt);
        }
        else {
            log.error(`${logPrefix}: Missing Gross Sales Amount`)
        }
        // </CommlPolicySupplement>

        // <MiscParty>
        const MiscParty = CommlPolicy.ele('MiscParty');
        // <GeneralPartyInfo>
        GeneralPartyInfo = MiscParty.ele('GeneralPartyInfo');
        // <NameInfo>
        NameInfo = GeneralPartyInfo.ele('NameInfo');
        // <PersonName>
        const PersonName = NameInfo.ele('PersonName');
        PersonName.ele('GivenName', this.app.business.contacts[0].first_name);
        PersonName.ele('Surname', this.app.business.contacts[0].last_name);
        // </PersonName>
        // </NameInfo>
        // </GeneralPartyInfo>
        // <MiscPartyInfo>
        const MiscPartyInfo = MiscParty.ele('MiscPartyInfo');
        // <MiscPartyRoldCd> (contact)
        MiscPartyInfo.ele('MiscPartyRoleCd', 'CT');
        // </MiscParty>

        // Losses
        this.app.policies.forEach((policy) => {
            if (policy.type !== "BOP") {
                return;
            }
            const totalClaimCount = this.get_num_claims(3);
            if (!totalClaimCount) {
                return;
            }
            const totalClaimAmount = this.get_total_amount_incurred_on_claims(3);
            const OtherOrPriorPolicy = CommlPolicy.ele('OtherOrPriorPolicy');
            OtherOrPriorPolicy.ele('PolicyCd', 'com.acuity_LossHistory');
            OtherOrPriorPolicy.ele('LOBCd', 'BOP');
            OtherOrPriorPolicy.ele('NumLosses', totalClaimCount);
            OtherOrPriorPolicy.ele('ContractTerm').ele('DurationPeriod').ele('NumUnits', 3);
            OtherOrPriorPolicy.ele('TotalPaidLossesAmt').ele('Amt', totalClaimAmount);
        });

        // Questions
        let QuestionAnswer = null;

        let question_identifiers = null;
        try {
            question_identifiers = await this.get_question_identifiers();
        }
        catch (error) {
            log.error(`${this.insurer.name} BOP is unable to get question identifiers.${error}` + __location);
            return this.return_result('autodeclined');
        }
        const questionCodes = Object.values(question_identifiers);

        const generalQuestionsToIgnore = [
            'AcuityBOPContractorLicenseNumber', 'acuitybop-Gallons'
        ];

        // Insurer Question Loop
        for (const insurerQuestion of this.insurerQuestionList) {
            if (generalQuestionsToIgnore.includes(insurerQuestion.identifier)) {
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)) {
                const question = this.questions[insurerQuestion.talageQuestionId];
                if(!question){
                    log.debug(`Acuity question processing ${insurerQuestion?.attributes?.elementName} no TalageQuestion`)
                    continue;
                }

                const QuestionCd = question_identifiers[question.id];

                // Don't process questions without a code (not for this insurer) or ones that we have marked to skip
                if (!QuestionCd || skipQuestions.includes(question.id)) {
                    continue;
                }

                // Get the answer
                let answer = '';
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    log.error(`Acuity (application ${this.app.id}): Could not determine question ${question.id} answer: ${error} ${__location}`);
                    //return this.return_result('autodeclined');
                }

                // This question was not answered
                if (!answer) {
                    continue;
                }

                // Build out the question structure
                QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
                QuestionAnswer.ele('QuestionCd', QuestionCd);

                // Determine how to send the answer
                if (question.type === 'Yes/No') {
                    QuestionAnswer.ele('YesNoCd', question.get_answer_as_boolean() ? 'YES' : 'NO');
                }
                else if (/^\d+$/.test(answer)) {
                    QuestionAnswer.ele('Num', answer);
                }
                else {
                    QuestionAnswer.ele('Explanation', answer);
                }

                switch (insurerQuestion.identifier) {
                    case 'com.acuity_999990064':
                        const licenseNumber = this.getAnswerForQuestionIdentifier('AcuityBOPContractorLicenseNumber');
                        if (licenseNumber) {
                            QuestionAnswer.ele('Explanation', licenseNumber);
                        }
                        else {
                            QuestionAnswer.ele('Explanation', '');
                        }
                        break;
                    default:
                }
            }
        }

        // Add auto-filled questions due to mismatch in Acuity data

        if (!questionCodes.includes("com.acuity_999990014")) {
            // <QuestionAnswer> Insurer operates any business not insured by Acuity
            QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
            QuestionAnswer.ele('QuestionCd', 'com.acuity_999990014');
            QuestionAnswer.ele('YesNoCd', 'NO');
            // </QuestionAnswer>

            // NOTE: com.acuity_999990015 is a child of this if answer is YES so we do not need to send com.acuity_999990015
        }

        if (!questionCodes.includes("com.acuity_999990041")) {
            // <QuestionAnswer> Up to how many stories does the insured work
            QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
            QuestionAnswer.ele('QuestionCd', 'com.acuity_999990041');
            QuestionAnswer.ele('Num', '1');
            // </QuestionAnswer>
        }
        if (!questionCodes.includes("com.acuity_999990045")) {
            // <QuestionAnswer> Number of jobs annually over this height
            QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
            QuestionAnswer.ele('QuestionCd', 'com.acuity_999990045');
            QuestionAnswer.ele('Num', '1');
            // </QuestionAnswer>
        }

        // MT/VA LLCs
        if (this.app.business.management_structure) {
            // <QuestionAnswer> Is this a legal liability company that is member managed?
            QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
            QuestionAnswer.ele('QuestionCd', 'WORK72');
            QuestionAnswer.ele('YesNoCd', this.app.business.management_structure === 'member' ? 'YES' : 'NO');
            // </QuestionAnswer>

            // <QuestionAnswer> Is this a legal liability company that is manager managed?
            QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
            QuestionAnswer.ele('QuestionCd', 'WORK73');
            QuestionAnswer.ele('YesNoCd', this.app.business.management_structure === 'manager' ? 'YES' : 'NO');
            // </QuestionAnswer>
        }
        // </CommlPolicy>

        // <Location>
        this.app.business.locations.forEach((location, index) => {
            const Location = BOPPolicyQuoteInqRq.ele('Location');
            Location.att('id', `L${index + 1}`);

            // <Addr>
            Addr = Location.ele('Addr');
            Addr.ele('Addr1', location.address);
            if (location.address2) {
                Addr.ele('Addr2', location.address2);
            }
            Addr.ele('City', location.city);
            Addr.ele('StateProvCd', location.territory);
            Addr.ele('PostalCode', location.zip);
            // </Addr>

            // <Sublocation>
            const Sublocation = Location.ele('SubLocation');
            Sublocation.att('id', `L${index + 1}S1`); // Only supports one sublocation per location right now
            // <Addr>
            Addr = Sublocation.ele('Addr');
            Addr.ele('Addr1', location.address);
            if (location.address2) {
                Addr.ele('Addr2', location.address2);
            }
            Addr.ele('City', location.city);
            Addr.ele('StateProvCd', location.territory);
            Addr.ele('PostalCode', location.zip);
            // </Addr>
            // </Sublocation>
        });

        // <BOPLineBusiness>
        const BOPLineBusiness = BOPPolicyQuoteInqRq.ele('BOPLineBusiness');
        BOPLineBusiness.ele('LOBCd', 'BOP');

        // <LiabilityInfo>
        const LiabilityInfo = BOPLineBusiness.ele('LiabilityInfo');
        // <CommlCoverage>
        let CommlCoverage = LiabilityInfo.ele('CommlCoverage');
        CommlCoverage.ele('CoverageCd', 'EAOCC');
        CommlCoverage.ele('CoverageDesc', 'Liability - Each Occurrence');
        // <Limit>
        let Limit = CommlCoverage.ele('Limit');
        Limit.ele('LimitAppliesToCd', 'EAOCC');
        Limit.ele('FormatInteger', limits[0]);
        // </Limit>
        // </CommlCoverage>

        // <CommlCoverage>
        CommlCoverage = LiabilityInfo.ele('CommlCoverage');
        CommlCoverage.ele('CoverageCd', 'GENAG');
        CommlCoverage.ele('CoverageDesc', 'Liability - General Aggregate');
        // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('LimitAppliesToCd', 'GENAG');
        Limit.ele('FormatInteger', limits[1]);
        // </Limit>
        // </CommlCoverage>

        // <CommlCoverage>
        CommlCoverage = LiabilityInfo.ele('CommlCoverage');
        CommlCoverage.ele('CoverageCd', 'PRDCO');
        CommlCoverage.ele('CoverageDesc', 'Products&Completed Operations');
        // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('LimitAppliesToCd', 'PRDCO');
        Limit.ele('FormatInteger', limits[2]);


        // Exposures
        if (this.insurerIndustryCode?.attributes?.premiumBasis?.code) {
            const premiumBasisCode = this.insurerIndustryCode.attributes.premiumBasis.code;
            appDoc.locations.forEach(async(location, index) => {
                const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification');

                GeneralLiabilityClassification.att('LocationRef', `L${index + 1}`);
                GeneralLiabilityClassification.att('SubLocationRef', `L${index + 1}S1`);
                GeneralLiabilityClassification.ele('PremiumBasisCd', premiumBasisCode);

                if (this.insurerIndustryCode?.attributes?.cgl) {
                    GeneralLiabilityClassification.ele('ClassCd', this.insurerIndustryCode.attributes.cgl);
                }
                else {
                    log.error(`${logPrefix}: Insurer Industry Code "${this.insurerIndustryCode.code}" did not have Class in attributes.cgl`)
                }

                switch (premiumBasisCode) {
                    case 'PAYRL':
                        const locationPayroll = location.activityPayrollList.reduce((totalPayroll, ele) => totalPayroll + ele.payroll, 0)
                        GeneralLiabilityClassification.ele('Exposure', locationPayroll);
                        break;
                    case 'GrSales':
                        const locationGrossSales = location.questions.find(question => question.insurerQuestionIdentifier === 'AcuityBOPLocationGrossSales');
                        log.debug(`Location Gross Sales ${locationGrossSales.answerValue}`);

                        if (locationGrossSales) {
                            GeneralLiabilityClassification.ele('Exposure', locationGrossSales.answerValue);
                        }
                        else {
                            log.error(`${logPrefix}: Missing Gross Sales Amount`);
                        }
                        break;
                    case 'Gallons':
                        const acuityIndentifier = "acuitybop-Gallons";
                        const insurerQuestion = this.insurerQuestionList.find((iq) => iq.identifier === acuityIndentifier)
                        if(insurerQuestion && Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)){
                            const question = this.questions[insurerQuestion.talageQuestionId];
                            if(question){
                                // Get the answer
                                let answer = '';
                                try {
                                    answer = this.determine_question_answer(question);
                                    // This question was not answered
                                    if (answer && parseInt(answer, 10)) {
                                        GeneralLiabilityClassification.ele('Exposure', parseInt(answer, 10));
                                    }
                                }
                                catch (error) {
                                    log.error(`Acuity (application ${this.app.id}): Could not determine question ${question.id} answer: ${error} ${__location}`);
                                    //return this.return_result('autodeclined');
                                }
                            }
                        }
                        break;
                    case 'ADMIS':
                        break;
                    case 'AREA':
                        break;
                    case 'Boat':
                        break;
                    case 'Dwelling':
                        break;
                    case 'Each':
                        break;
                    case 'TotCost':
                        break;
                    case 'Unit':
                        break;
                    case 'com.acuity_Gallons':
                        break;
                    default:
                }
            })
        }
        else {
            log.error(`${logPrefix}: Missing Premium Basis information for insurer industry code ${this.insurerIndustryCode.code}. Cannot send proper exposure to Acuity`);
            return this.client_declined(`Missing Premium Basis information`);
        }


        // </GeneralLiabilityClassification>

        const PropertyInfo = BOPLineBusiness.ele('PropertyInfo');


        const locationQuestionsToIgnore = [
            'AcuityRoofConstruction',
            'AcuityBOPRoofGeometry',
            'AcuityBOPOccupiedByOthersSqft',
            'AcuityBOPUnoccupiedSqft',
            'AcuityBOPOccupancyDesc',
            'AcuityBOPDistanceFireStation',
            'AcuityBOPDistanceHydrant'
        ]

        // Deductible
        const deductible = this.policy.deductible ? this.policy.deductible : 0

        appDoc.locations.forEach((location, index) => {
            // <CommlCoverage>
            if (location.businessPersonalPropertyLimit) {
                const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo');
                CommlPropertyInfo.att('LocationRef', `L${index + 1}`);
                CommlPropertyInfo.att('SubLocationRef', `L${index + 1}S1`);
                CommlPropertyInfo.ele('SubjectInsuranceCd', `BPP`);
                CommlCoverage = CommlPropertyInfo.ele('CommlCoverage');
                CommlCoverage.ele('CoverageCd', 'BPP');
                CommlCoverage.ele('CoverageDesc', 'Business Personal Property');
                Limit = CommlCoverage.ele('Limit');
                Limit.ele('FormatInteger', location.businessPersonalPropertyLimit);
                const Deductible = CommlCoverage.ele('Deductible');
                Deductible.ele('FormatInteger', deductible);
            }
            else {
                log.error(`${logPrefix}: No Business Personal Property Limit present on application`);
            }

            if (location.buildingLimit) {
                const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo');
                CommlPropertyInfo.att('LocationRef', `L${index + 1}`);
                CommlPropertyInfo.att('SubLocationRef', `L${index + 1}S1`);
                CommlPropertyInfo.ele('SubjectInsuranceCd', `BLDG`);
                CommlCoverage = CommlPropertyInfo.ele('CommlCoverage');
                CommlCoverage.ele('CoverageCd', 'BLDG');
                CommlCoverage.ele('CoverageDesc', 'Building');
                Limit = CommlCoverage.ele('Limit');
                Limit.ele('FormatInteger', location.buildingLimit);
                const Deductible = CommlCoverage.ele('Deductible');
                Deductible.ele('FormatInteger', deductible);
            }
            else {
                log.error(`${logPrefix}: No Building Limit present on application` + __location)
                this.reasons.push(`No Building Limit present on application`)
            }

            // For assigning question elements in question loop
            const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo');
            CommlPropertyInfo.att('LocationRef', `L${index + 1}`);
            CommlPropertyInfo.att('SubLocationRef', `L${index + 1}S1`);
            CommlCoverage = CommlPropertyInfo.ele('CommlCoverage');
            const CommlCoverageSupplement = CommlCoverage.ele('CommlCoverageSupplement');
            for (const question of location.questions) {
                if (locationQuestionsToIgnore.includes(question.insurerQuestionIdentifier)) {
                    continue;
                }
                // This question was not answered
                if (!question.answerValue) {
                    continue;
                }

                const QuestionCd = question.insurerQuestionIdentifier;

                // Build out the question structure
                QuestionAnswer = CommlCoverageSupplement.ele('QuestionAnswer');
                QuestionAnswer.ele('QuestionCd', QuestionCd);

                // Determine how to send the answer
                if (question.questionType === 'Yes/No') {
                    QuestionAnswer.ele('YesNoCd', question.answerValue.toUpperCase());
                }
                else if (/^\d+$/.test(question.answerValue)) {
                    QuestionAnswer.ele('Num', question.answerValue);
                }
                else {
                    QuestionAnswer.ele('Explanation', question.answerValue);
                }
            }
            // </CommlCoverage>
        })
        // </BOPLineBusiness>
        // log.debug(`Appdoc.location[0]: ${JSON.stringify(appDoc.locations[0], null, 4)}`);

        // <CommlSubLocation>
        const constructionTypeMatrix = {
            'Frame': 'F',
            'Joisted Masonry': 'JM',
            'Fire Resistive': 'MFR',
            'Non Combustible': 'NC',
            'Rail': 'R',
            'Masonry Non Combustible': 'SMNC',
            'Masonry Veneer': 'V'
        };

        appDoc.locations.forEach((location, index) => {
            // <CommlSubLocation>
            const CommlSubLocation = BOPPolicyQuoteInqRq.ele('CommlSubLocation');
            CommlSubLocation.att('LocationRef', `L${index + 1}`);
            CommlSubLocation.att('SubLocationRef', `L${index + 1}S1`); // Only supports one sublocation per location

            CommlSubLocation.ele('InterestCd', location.own ? 'OWNER' : 'TENANT');
            // <Construction>
            const Construction = CommlSubLocation.ele('Construction');
            Construction.ele('YearBuilt', location.yearBuilt);

            if (location.constructionType && Object.keys(constructionTypeMatrix).includes(location.constructionType)) {
                Construction.ele('ConstructionCd', constructionTypeMatrix[location.constructionType]);
            }
            else {
                log.error(`${logPrefix}: Unrecognized construction type for location ${index}: ${location.constructionType}`);
            }

            if (location.numStories) {
                Construction.ele('NumStories', location.numStories);
            }
            else {
                log.error(`${logPrefix}: Missing Number of Stories for location ${index}`);
            }

            Construction.ele('BldgArea').ele('NumUnits', location.square_footage);
            // </Construction>

            // <BldgOccupancy>
            const BldgOccupancy = CommlSubLocation.ele('BldgOccupancy');

            const AreaOccupied = BldgOccupancy.ele('AreaOccupied');
            const AreaOccupiedByOthers = BldgOccupancy.ele('AreaOccupiedByOthers');
            const AreaUnoccupied = BldgOccupancy.ele('AreaUnoccupied');
            let areaOccupiedByOthers = 0;
            let areaUnoccupied = 0;

            const BldgProtection = CommlSubLocation.ele('BldgProtection');

            if (location.bop.hasOwnProperty('sprinklerEquipped')) {
                BldgProtection.ele('SprinkleredPct', location.bop.sprinklerEquipped ? 100 : 0);
            }
            else {
                log.error(`${logPrefix}: Missing sprinkler information for location ${index}`);
            }

            for (const question of location.questions) {
                if (!question.answerValue && question.answer !== 0) {
                    continue;
                }

                switch (question.insurerQuestionIdentifier) {
                    case 'AcuityRoofConstruction':
                        let materialCode = 'OT';
                        if (question.insurerQuestionAttributes.hasOwnProperty(question.answerValue)) {
                            materialCode = question.insurerQuestionAttributes[question.answerValue];
                        }
                        Construction.ele('RoofingMaterial').ele('RoofMaterialCd', materialCode);
                        break;
                    case 'AcuityBOPRoofGeometry':
                        Construction.ele('RoofGeometryTypeCd', question.answerValue.toUpperCase());
                        break;
                    case 'AcuityBOPOccupiedByOthersSqft':
                        areaOccupiedByOthers = question.answerValue;
                        AreaOccupiedByOthers.ele(`NumUnits`, areaOccupiedByOthers);
                        AreaOccupiedByOthers.ele(`UnitMeasurementCd`, 'SQFT');
                        break;
                    case 'AcuityBOPUnoccupiedSqft':
                        areaUnoccupied = question.answerValue
                        AreaUnoccupied.ele(`NumUnits`, areaUnoccupied);
                        AreaUnoccupied.ele(`UnitMeasurementCd`, 'SQFT');
                        break;
                    case 'AcuityBOPDistanceFireStation':
                        const DistanceToFireStation = BldgProtection.ele('DistanceToFireStation');
                        DistanceToFireStation.ele('NumUnits', question.answerValue);
                        DistanceToFireStation.ele('UnitMeasurementCd', 'SMI');
                        break;
                    case 'AcuityBOPDistanceHydrant':
                        const DistanceToHydrant = BldgProtection.ele('DistanceToHydrant');
                        DistanceToHydrant.ele('UnitMeasurementCd', 'FT');
                        DistanceToHydrant.ele('NumUnits', question.answerValue);
                        break;
                    case 'AcuityBOPOccupancyDesc':
                        BldgOccupancy.ele('OccupancyDesc', question.answerValue);
                        break;
                    default:
                        continue;
                }
            }

            const totalArea = location.square_footage;
            const areaOccupied = totalArea - areaUnoccupied - areaOccupiedByOthers;
            AreaOccupied.ele(`NumUnits`, areaOccupied);
            AreaOccupied.ele(`UnitMeasurementCd`, 'SQFT');

            // </BldgOccupancy>
            // <CommlSubLocation>
        })
        // </CommlSubLocation>

        // </BOPPolicyQuoteInqRq>
        // </InsuranceSvcRq>
        // </ACORD>


        // Get the XML structure as a string
        const xml = ACORD.end({pretty: true});

        // console.log(`XML Request`, xml);

        // Determine which URL to use
        let host = '';
        let path = '';
        let credentials = null;
        if (this.insurer.useSandbox) {
            host = 'tptest.acuity.com';
            path = '/ws/partner/public/irate/rating/RatingService/Talage'
            credentials = {
                'X-IBM-Client-Id': this.username,
                'X-IBM-Client-Secret': this.password
            };
        }
        else {
            host = 'services.acuity.com';
            path = '/ws/irate/rating/RatingService/Talage';
            credentials = {'x-acuity-api-key': this.password};
        }
        // console.log("request", xml);

        // Send the XML to the insurer
        let res = null;
        try {
            res = await this.send_xml_request(host, path, xml, credentials);
        }
        catch (error) {
            log.error(`Acuity (application ${this.app.id}): Could not connect to server: ${error} ${__location}`);
            this.reasons.push('Could not connect to the Acuity server');
            return this.return_error('error', "Could not connect to Acuity server");
        }

        // console.log('response', JSON.stringify(res, null, 4));

        // Check if there was an error
        if (res.errorResponse) {
            const error_code = parseInt(res.errorResponse.httpCode, 10);
            log.error(`Acuity (application ${this.app.id}): Error when connecting to the Acuity servers (${error_code}) ${__location}`);
            this.reasons.push(`Error when connecting to the Acuity servers (${error_code})`);
            return this.return_error('error', `Error when connecting to the Acuity servers (${error_code})`);
        }

        // Check SignonRs.Status.StatuCd to ensure that we authenticated properly
        const status_code = parseInt(res.ACORD.SignonRs[0].Status[0].StatusCd[0], 10);
        if (status_code !== 0) {
            this.log += '--------======= Unexpected API Error =======--------<br><br>';
            log.error(`Acuity (application ${this.app.id}): Status code of ${status_code} from API ${__location}`);
            this.reasons.push(`Status of '${status_code}' recieved from API`);
            return this.return_error('error', 'Acuity returned an unsuccessful status code');
        }

        // Find the PolicySummaryInfo, PolicySummaryInfo.PolicyStatusCode, and optionally the PolicySummaryInfo.FullTermAmt.Amt
        const policySummaryInfo = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.PolicySummaryInfo');
        if (!policySummaryInfo) {
            log.error(`Acuity (application ${this.app.id}): Could not find PolicySummaryInfo ${__location}`);
            this.reasons.push(`Could not find PolicySummaryInfo in response`);
            return this.return_error('error', 'Acuity returned an unexpected reply');
        }
        const policyStatusCode = this.get_xml_child(policySummaryInfo, 'PolicyStatusCd');
        if (!policyStatusCode) {
            log.error(`Acuity (application ${this.app.id}): Could not find PolicyStatusCode ${__location}`);
            this.reasons.push(`Could not find PolicyStatusCode in response`);
            return this.return_error('error', 'Acuity returned an unexpected reply');
        }

        // If the first message status begins with "Rating is not available ...", it is an autodecline
        const extendedStatusDescription = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.MsgStatus.ExtendedStatus.ExtendedStatusDesc');
        if (extendedStatusDescription && extendedStatusDescription.startsWith("Rating is not available for this type of business")) {
            this.reasons.push('Rating is not available for this type of business.');
            return this.return_result('autodeclined');
        }

        // get quote number (optional)
        let quoteNumber = null;
        const CompanysQuoteNumber = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.CommlPolicy.QuoteInfo.CompanysQuoteNumber');
        if (CompanysQuoteNumber) {
            quoteNumber = CompanysQuoteNumber[0];
            //if we get it make sure it gets saved.
            this.quoteNumber = quoteNumber
        }
        else {
            log.warn(`${logPrefix}Couldn't parse quote number` + __location);
        }


        const insurerWeblink = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.FileAttachmentInfo.WebsiteURL');
        if(insurerWeblink){
            this.quoteLink = insurerWeblink
            log.debug(`Acuity BOP (appId ${this.app.id}) Setting weblink High for all status`)
        }

        switch (policyStatusCode) {
            case 'com.acuity_Incomplete':
                log.error(`Acuity BOP (appId ${this.app.id}): Reporting incomplete information for quoting.` + __location);
                //look for reason to determine if declined or referred.
                let reasonMessage = "incomplete information to quote";
                const ExtendedStatusDesc2 = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.MsgStatus.ExtendedStatus.ExtendedStatusDesc');
                if(ExtendedStatusDesc2){
                    reasonMessage = ExtendedStatusDesc2;
                }
                if(reasonMessage.indexOf(`processed via this channel`) > -1){
                    this.reasons.push(reasonMessage);
                    return this.client_referred(quoteNumber);
                }
                else {
                    return this.client_declined(reasonMessage);
                }
            case "com.acuity_BindableQuote":
            case "com.acuity_BindableModifiedQuote":
            case 'com.acuity_BindableReferredQuote':
            case 'com.acuity_BindableModifiedReferredQuote':
            case "com.acuity_NonBindableQuote":
                let policyAmount = 0;
                const policyAmountNode = this.get_xml_child(policySummaryInfo, 'FullTermAmt.Amt');
                if (policyAmountNode) {
                    policyAmount = parseFloat(policyAmountNode);
                }
                // Get the returned limits
                const quoteCoverages = [];
                let foundLimitsCount = 0;
                let sortIndex = 0;
                let commlCoverage = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.BOPLineBusiness.LiabilityInfo.CommlCoverage', true);
                if (!commlCoverage) {
                    this.reasons.push(`Could not find CommlCoverage node  with Limit information in response.`);
                    log.error(`Acuity BOP (application ${this.app.id}): Could not find the CommlCoverage with Limit information node. ${__location}`);
                    //return this.return_error('error', 'Acuity returned an unexpected reply');
                }

                if(commlCoverage){
                    commlCoverage.forEach((coverage) => {
                        if (!coverage.Limit || !coverage.Limit.length) {
                            return;
                        }
                        let description = '';
                        const limitAmt = parseInt(coverage.Limit[0].FormatInteger[0], 10);
                        const quoteCoverage = {
                            value: convertToDollarFormat(limitAmt, true),
                            sort: sortIndex++,
                            category: `General Limits`,
                            insurerIdentifier: coverage.CoverageCd[0]
                        }
                        switch (coverage.CoverageCd[0]) {
                            case "EAOCC":
                                description = 'Each Occurrence';
                                quoteCoverage.description = 'Each Occurrence';
                                foundLimitsCount++;
                                quoteCoverages.push(quoteCoverage);
                                break;
                            case "GENAG":
                                description = 'General Aggregate';
                                quoteCoverage.description = 'General Aggregate';
                                foundLimitsCount++;
                                quoteCoverages.push(quoteCoverage);
                                break;
                            case "PRDCO":
                                description = 'Products & Completed Operations';
                                quoteCoverage.description = 'Products & Completed Operations';
                                foundLimitsCount++;
                                quoteCoverages.push(quoteCoverage);
                                break;
                            case "PIADV":
                                description = 'Personal and Advertising Injury';
                                quoteCoverage.description = 'Personal and Advertising Injury';
                                foundLimitsCount++;
                                quoteCoverages.push(quoteCoverage);
                                break;
                            default:
                                break;
                        }

                        if (coverage.Deductible && coverage.Deductible.length) {
                            const deductibleAmt = parseInt(coverage.Deductible[0].FormatInteger[0], 10);
                            const quoteCoverage2 = {
                                description: description + ' Deductible',
                                value: convertToDollarFormat(deductibleAmt, true),
                                sort: sortIndex++,
                                category: `General Limits`,
                                insurerIdentifier: coverage.CoverageCd[0]
                            }
                            foundLimitsCount++;
                            quoteCoverages.push(quoteCoverage2);
                        }
                    });
                }

                // Get Location based Limits
                const CommlPropertyInfoList = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.BOPLineBusiness.PropertyInfo.CommlPropertyInfo', true);
                for (const coverage of CommlPropertyInfoList) {
                    if (!coverage?.CommlCoverage?.length) {
                        continue;
                    }
                    commlCoverage = coverage.CommlCoverage[0];
                    if (commlCoverage.CoverageCd) {
                        let description = '';
                        switch (commlCoverage.CoverageCd[0]) {
                            case "BPP":
                                description = 'Business Personal Property';
                                break;
                            case "BLDG":
                                description = 'Building';
                                break;
                            default:
                                continue;
                        }

                        if (commlCoverage.Limit && commlCoverage.Limit.length) {
                            const limitAmt = parseInt(commlCoverage.Limit[0].FormatInteger[0], 10);
                            const quoteCoverage = {
                                description: description + ' Limit',
                                value: convertToDollarFormat(limitAmt, true),
                                sort: sortIndex++,
                                category: `Location ${coverage.$.LocationRef}`,
                                insurerIdentifier: commlCoverage.CoverageCd[0]
                            }
                            foundLimitsCount++;
                            quoteCoverages.push(quoteCoverage);
                        }
                        if (commlCoverage.Deductible && commlCoverage.Deductible.length) {
                            const deductibleAmt = parseInt(commlCoverage.Deductible[0].FormatInteger[0], 10);
                            const quoteCoverage = {
                                description: description + ' Deductible',
                                value: convertToDollarFormat(deductibleAmt, true),
                                sort: sortIndex++,
                                category: `Location ${coverage.$.LocationRef}`,
                                insurerIdentifier: commlCoverage.CoverageCd[0]
                            }
                            foundLimitsCount++;
                            quoteCoverages.push(quoteCoverage);
                        }
                    }
                }

                // Ensure we found some limits
                if (!foundLimitsCount) {
                    //this.reasons.push(`Did not recognized any returned limits.`);
                    log.error(`Acuity BOP (application ${this.app.id}): Did not recognized any returned limits. ${__location}`);
                    //return this.return_error('error', 'Acuity returned an unexpected reply');
                }

                if (policyAmount) {
                    // Set the policy amount
                    this.amount = policyAmount;
                }
                else if (policyStatusCode === "com.acuity_BindableQuote" || policyStatusCode === "com.acuity_BindableModifiedQuote") {
                    // If this is bindable and we can't find a policy amount, flag an error.
                    this.reasons.push(`Could not find policy amount for bindable quote.`);
                    log.error(`Acuity (application ${this.app.id}): Could not find policy amount for bindable quote. ${__location}`);
                    return this.return_error('error', 'Acuity returned an unexpected result for a bindable quote.');
                }

                // Retrieve and the quote letter if it exists
                const fileAttachmentInfoList = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.FileAttachmentInfo', true);
                let quoteLetter = null;
                let quoteMIMEType = null;
                if(fileAttachmentInfoList){
                    for (const fileAttachmentInfo of fileAttachmentInfoList) {
                        switch (fileAttachmentInfo.AttachmentDesc[0]) {
                            case "Policy Quote Print":
                                this.quote_letter = {
                                    content_type: fileAttachmentInfo.MIMEContentTypeCd[0],
                                    data: fileAttachmentInfo.cData[0],
                                    file_name: `${this.insurer.name}_ ${this.policy.type}_quote_letter.pdf`
                                };
                                quoteMIMEType = fileAttachmentInfo.MIMEContentTypeCd[0];
                                quoteLetter = fileAttachmentInfo.cData[0];
                                break;
                            case "URL":
                                this.quoteLink = fileAttachmentInfo.WebsiteURL[0];
                                break;
                            default:
                                break;
                        }
                    }
                }

                // Set payment plans
                const insurerPaymentPlans = this.get_xml_child(res.ACORD, "InsuranceSvcRs.BOPPolicyQuoteInqRs.CommlPolicy.PaymentOption", true);

                this.insurerPaymentPlans = insurerPaymentPlans.map(({
                    $, ...rest
                }) => (
                    {
                        id: $.id,
                        ...rest
                    }))

                const paymentPlansIDsMap = {
                    'FL': 1,
                    'SA': 2,
                    'QT': 3,
                    '5P': 1,
                    '11': 1
                }

                this.talageInsurerPaymentPlans = insurerPaymentPlans.map((insurerPaymentPlan) => {
                    const insurerPaymentPlanId = insurerPaymentPlan.$.id
                    const code = insurerPaymentPlan.PaymentPlanCd[0]
                    const description = insurerPaymentPlan.Description[0]
                    const numberPayments = Number(insurerPaymentPlan.NumPayments[0])
                    const total = policyAmount
                    const depositAmount = Number(insurerPaymentPlan.DepositAmt[0].Amt[0])
                    const installmentFees = Number(insurerPaymentPlan.InstallmentFeeAmt[0].Amt[0])
                    const paymentMethod = insurerPaymentPlan.MethodPaymentCd[0]
                    const installmentPayment = Number(insurerPaymentPlan.InstallmentInfo[0].InstallmentAmt[0].Amt[0])

                    return {
                        paymentPlanId: paymentPlansIDsMap[code],
                        insurerPaymentPlanId: insurerPaymentPlanId,
                        insurerPaymentPlanDescription: `${description} (${paymentMethod})`,
                        NumberPayments: numberPayments,
                        TotalCost: total,
                        TotalPremium: total,
                        DownPayment: code === 'FL' ? 0 : depositAmount,
                        TotalStateTaxes: 0,
                        TotalBillingFees: numberPayments * installmentFees,
                        DepositPercent: Number((100 * depositAmount / total).toFixed(2)),
                        IsDirectDebit: paymentMethod === 'CHECK',
                        installmentPayment: installmentPayment
                    }
                })

                if (!quickQuote && (policyStatusCode === "com.acuity_BindableQuote" || policyStatusCode === "com.acuity_BindableModifiedQuote")) {
                    return this.client_quoted(quoteNumber, [], policyAmount, quoteLetter, quoteMIMEType, quoteCoverages);
                }
                else {
                    return this.client_referred(quoteNumber, [], policyAmount, quoteLetter, quoteMIMEType, quoteCoverages);
                }
            case "com.acuity_Declined":
                const extendedStatusList = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.MsgStatus.ExtendedStatus', true);
                if (extendedStatusList) {
                    for (const extendedStatus of extendedStatusList) {
                        if (extendedStatus.hasOwnProperty('com.acuity_ExtendedStatusType') && extendedStatus['com.acuity_ExtendedStatusType'].length) {
                            const extendedStatusType = extendedStatus['com.acuity_ExtendedStatusType'][0];
                            const extendedStatusDesc = this.get_xml_child(extendedStatus, 'ExtendedStatusDesc');
                            if (extendedStatusType === 'Error') {
                                this.reasons.push(extendedStatusDesc.replace("Acuity_Decline: ", ""));
                            }
                        }
                    }
                }
                return this.return_result('declined');
            default:
                this.reasons.push(`Returned unknown policy code '${policyStatusCode}`);
                log.error(`Acuity (application ${this.app.id}): Returned unknown policy code '${policyStatusCode}' ${__location}`);
                return this.return_error('error', 'Acuity returned an unexpected result for a bindable quote.');
        }
    }

    getAnswerForQuestionIdentifier(identifier) {
        const talageQuestion = this.insurerQuestionList.find(question => question.identifier === identifier);
        if (talageQuestion) {
            const question = this.questions[talageQuestion.talageQuestionId];
            if(question) {
                let answer = null;
                try {
                    answer = this.determine_question_answer(question);
                    return answer;
                }
                catch (err) {
                    log.error(`Acuity application ${this.app.id}): Could not determine question ${question.talageQuestionId} answer: ${err} ${__location}`);
                }
            }
            else {
                log.debug(`Acuity question processing ${question?.attributes?.elementName} no TalageQuestion`)
            }
        }
        else {
            return null;
        }

    }
};