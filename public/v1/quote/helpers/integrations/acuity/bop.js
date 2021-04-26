/**
 * General Liability for Acuity
 */

'use strict';

const builder = require('xmlbuilder');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
const InsurerBO = global.requireShared('./models/Insurer-BO.js');
global.requireShared('./helpers/tracker.js');

module.exports = class AcuityGL extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
    }

    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.app.applicationDocData
        const bopPolicy = this.app.applicationDocData.policies.find((appPolicy) => appPolicy.policyType === "BOP")
        if(!bopPolicy){
            log.error(`Acuity (application ${this.app.id}): Does not have policy ${this.policy.type}  ${__location}`);
            this.reasons.push(`Application does not have BOP policy`);
            return this.return_result('autodeclined');
        }
        const insurerBO = new InsurerBO();
        const insurerSlug = 'acuity';
        const insurer = await insurerBO.getBySlug(insurerSlug);
        if (!insurer) {
            log.error(`Acuity not found by slug ${__location}`);
            return this.return_result('error');
        }

        // Don't report certain activities in the payroll exposure
        const unreportedPayrollActivityCodes = [
            2869 // Office Employees
        ];

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

        // // Check Industry Code Support -- not used any in integration
        // if (!this.industry_code.cgl) {
        //     log.error(`Acuity (application ${this.app.id}): CGL not set for Industry Code ${this.industry_code.id} ${__location}`);
        //     return this.return_result('autodeclined');
        // }

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
            return this.client_error("Acuity GL requires FEIN.", __location);
        }


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
        ClientApp.ele('Version', '2.0');
        // </ClientApp>

        // </SignonRq>

        // <InsuranceSvcRq>
        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', this.request_id);

        // <GeneralLiabilityPolicyQuoteInqRq>
        const BOPPolicyQuoteInqRq = InsuranceSvcRq.ele('BOPPolicyQuoteInqRq');
        BOPPolicyQuoteInqRq.ele('RqUID', this.request_id);
        BOPPolicyQuoteInqRq.ele('BusinessPurposeTypeCd', "com.acuity_NBQ_RC1");
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

        if (!this.industry_code.attributes.acuityNAICSCode) {
            log.error(`Acuity (application ${this.app.id}): Could not find ACUITYNAICSCode for CGL code ${this.industry_code.cgl} ${__location}`);
            return this.return_result('autodeclined');
        }
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

        // <CommlPolicy>
        const CommlPolicy = BOPPolicyQuoteInqRq.ele('CommlPolicy');
        CommlPolicy.ele('LOBCd', 'BOP');
        CommlPolicy.ele('ControllingStateProvCd', this.app.business.primary_territory);

        // <ContractTerm>
        const ContractTerm = CommlPolicy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
        ContractTerm.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
        // </ContractTerm>

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
            log.error(`${this.insurer.name} ${this.policy.type} is unable to get question identifiers.${error}` + __location);
            return this.return_result('autodeclined');
        }
        const questionCodes = Object.values(question_identifiers);

        // Loop through each question
        for (const question_id in this.questions) {
            if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                const question = this.questions[question_id];
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
                    log.error(`Acuity (application ${this.app.id}): Could not determine question ${question_id} answer: ${error} ${__location}`);
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
        appDoc.locations.forEach((location, index) => {
            const Location = BOPPolicyQuoteInqRq.ele('Location');
            Location.att('id', `L${index + 1}`);
            // <Addr>
            Addr = Location.ele('Addr');
            Addr.ele('Addr1', location.address);
            if (location.address2) {
                Addr.ele('Addr2', location.address2);
            }
            Addr.ele('City', location.city);
            Addr.ele('StateProvCd', location.state);
            Addr.ele('PostalCode', location.zipcode);
            // </Addr>


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
        Limit.ele('FormatInteger', limits[0]);
        // </Limit>
        // </CommlCoverage>

        // <CommlCoverage>
        CommlCoverage = LiabilityInfo.ele('CommlCoverage');
        CommlCoverage.ele('CoverageCd', 'GENAG');
        CommlCoverage.ele('CoverageDesc', 'Liability - General Aggregate');
        // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatInteger', limits[1]);
        // </Limit>
        // </CommlCoverage>

        // <CommlCoverage>
        // CommlCoverage = LiabilityInfo.ele('CommlCoverage');
        // CommlCoverage.ele('CoverageCd', 'PRDCO');
        // CommlCoverage.ele('CoverageDesc', 'Products&Completed Operations');
        // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatInteger', limits[2]);
        // </Limit>
        // </CommlCoverage>
        // Exposures

        //PropertyInfo
        //const PropertyInfo = BOPLineBusiness.ele('PropertyInfo');

        for (let i = 0; i < appDoc.locations.length; i++) {
            const location = appDoc.locations[i];
            //blding limit
            // if(location.buildingLimit){

            //     const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo');
            //     CommlPropertyInfo.att('LocationRef', `L${i + 1}`);
            //     CommlPropertyInfo.ele('SubjectInsuranceCd', 'BLDG');
            //     const bopCommlCoverage = CommlPropertyInfo.ele('CommlCoverage');
            //     bopCommlCoverage.ele('CoverageCd', 'BLDG');
            //     bopCommlCoverage.ele('ValuationCd', 'RC');

            //     const bopLimit = bopCommlCoverage.ele('Limit');
            //     bopLimit.ele('FormatInteger', location.buildingLimit);
            //     const bopDeductible = bopCommlCoverage.ele('Deductible');
            //     bopDeductible.ele('FormatInteger', bopPolicy.deductible);

            // }
            //bpp
            // if(location.businessPersonalPropertyLimit){
            //     const CommlPropertyInfo = PropertyInfo.ele('CommlPropertyInfo');
            //     CommlPropertyInfo.att('LocationRef', `L${i + 1}`);
            //     CommlPropertyInfo.ele('SubjectInsuranceCd', 'BPP');
            //     const bopCommlCoverage = CommlPropertyInfo.ele('CommlCoverage');
            //     bopCommlCoverage.ele('CoverageCd', 'BPP');
            //     bopCommlCoverage.ele('ValuationCd', 'RC');

            //     const bopLimit = bopCommlCoverage.ele('Limit');
            //     bopLimit.ele('FormatInteger', location.businessPersonalPropertyLimit);
            //     const bopDeductible = bopCommlCoverage.ele('Deductible');
            //     bopDeductible.ele('FormatInteger', bopPolicy.deductible);
            // }
            const cobPayrollList = [];
            // eslint-disable-next-line prefer-const
            for (let activityCode of location.activityPayrollList){
                //check for new application doc
                if(!activityCode.activityCodeId){
                    activityCode.activityCodeId = activityCode.ncciCode;
                }
                // Skip activity codes we shouldn't include in payroll
                if (unreportedPayrollActivityCodes.includes(activityCode.activityCodeId)) {
                    continue;
                }
                const acuityActivityCode = await this.get_insurer_code_for_activity_code(insurer.id, location.state, activityCode.activityCodeId);
                if (acuityActivityCode && acuityActivityCode.attributes && acuityActivityCode.attributes.hasOwnProperty("assocGLClass")) {
                    const cglCode = acuityActivityCode.attributes.assocGLClass;
                    let cobPayroll = cobPayrollList.find((cp) => cp.cglCode === cglCode);
                    if (!cobPayroll) {
                        cobPayroll = {
                            cglCode: cglCode,
                            payroll: 0
                        };
                        cobPayrollList.push(cobPayroll);
                    }
                    //loop through EmployeeType payroll
                    if(activityCode.employeeTypeList && activityCode.employeeTypeList.length > 0){
                        activityCode.employeeTypeList.forEach((employeTypePayroll) => {
                            cobPayroll.payroll += employeTypePayroll.employeeTypePayroll;
                        });
                    }
                    else {
                        cobPayroll.payroll += activityCode.payroll;
                    }
                }
                else {
                    log.error(`Acuity GL (application ${this.app.id}): ActivityCode ${activityCode.activityCodeId}  had no assocGLClass. Application may fail at Acuit, acuityActivityCode ${JSON.stringify(acuityActivityCode)}` + __location);
                }
            }
            // Fill in the exposure. The Acuity CGL spreadsheet does not specify exposures per class code so we send PAYROLL for now until we get clarity.
            if(cobPayrollList.length > 0){
                for (const cobPayroll of cobPayrollList) {
                    const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification');
                    GeneralLiabilityClassification.att('LocationRef', `L${i + 1}`);
                    GeneralLiabilityClassification.ele('ClassCd', cobPayroll.cglCode);
                    // GeneralLiabilityClassification.ele('ClassCdDesc', this.industry_code.description);
                    GeneralLiabilityClassification.ele('PremiumBasisCd', 'PAYRL');
                    GeneralLiabilityClassification.ele('Exposure', cobPayroll.payroll);
                }
            }
            else {
                log.error(`Acuity GL (application ${this.app.id}): application issue no payroll. Application will fail at Acuity` + __location);
            }
        }

        // </BOPLineBusiness>
        // </BOPPolicyQuoteInqRq>
        // </InsuranceSvcRq>
        // </ACORD>

        // Get the XML structure as a string
        const xml = ACORD.end({pretty: true});

        // console.log('request', xml);

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

        switch (policyStatusCode) {
            case "com.acuity_BindableQuote":
            case "com.acuity_BindableModifiedQuote":
            case "com.acuity_NonBindableQuote":
                let policyAmount = 0;
                const policyAmountNode = this.get_xml_child(policySummaryInfo, 'FullTermAmt.Amt');
                if (policyAmountNode) {
                    policyAmount = parseFloat(policyAmountNode);
                }
                // Get the returned limits
                let foundLimitsCount = 0;
                const commlCoverage = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.BOPPolicyQuoteInqRs.BOPLineBusiness.LiabilityInfo.CommlCoverage', true);
                if (!commlCoverage) {
                    this.reasons.push(`Could not find CommlCoverage node in response.`);
                    log.error(`Acuity (application ${this.app.id}): Could not find the CommlCoverage node. ${__location}`);
                    return this.return_error('error', 'Acuity returned an unexpected reply');
                }
                commlCoverage.forEach((coverage) => {
                    if (!coverage.Limit || !coverage.Limit.length) {
                        return;
                    }
                    const amount = parseInt(coverage.Limit[0].FormatInteger[0], 10);
                    switch (coverage.CoverageCd[0]) {
                        case "EAOCC":
                            this.limits[4] = amount;
                            foundLimitsCount++;
                            break;
                        case "GENAG":
                            this.limits[8] = amount;
                            foundLimitsCount++;
                            break;
                        case "PRDCO":
                            this.limits[9] = amount;
                            foundLimitsCount++;
                            break;
                        case "PIADV":
                            this.limits[7] = amount;
                            foundLimitsCount++;
                            break;
                        default:
                            break;
                    }
                });
                // Ensure we found some limits
                if (!foundLimitsCount) {
                    this.reasons.push(`Did not recognized any returned limits.`);
                    log.error(`Acuity (application ${this.app.id}): Did not recognized any returned limits. ${__location}`);
                    return this.return_error('error', 'Acuity returned an unexpected reply');
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
                for (const fileAttachmentInfo of fileAttachmentInfoList) {
                    switch (fileAttachmentInfo.AttachmentDesc[0]) {
                        case "Policy Quote Print":
                            this.quote_letter = {
                                content_type: fileAttachmentInfo.MIMEContentTypeCd[0],
                                data: fileAttachmentInfo.cData[0],
                                file_name: `${this.insurer.name}_ ${this.policy.type}_quote_letter.pdf`
                            };
                            break;
                        case "URL":
                            this.quoteLink = fileAttachmentInfo.WebsiteURL[0];
                            break;
                        default:
                            break;
                    }
                }

                const status = policyStatusCode === "com.acuity_BindableQuote" ? "quoted" : "referred";
                log.info(`Acuity: Returning ${status} ${policyAmount ? "with price" : ""}`);
                return this.return_result(status);
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
};