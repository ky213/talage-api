/**
 * General Liability for Acuity
 */

'use strict';

const builder = require('xmlbuilder');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
const utility = require('../../../../../../shared/helpers/utility');

global.requireShared('./helpers/tracker.js');

module.exports = class AcuityGL extends Integration {

    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {

        const insurerSlug = 'acuity';
        const insurer = utility.getInsurer(insurerSlug);

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

        // Check Industry Code Support
        if (!this.industry_code.cgl) {
            log.error(`Acuity (application ${this.app.id}): CGL not set for Industry Code ${this.industry_code.id} ${__location}`);
            return this.return_result('autodeclined');
        }

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
        const GeneralLiabilityPolicyQuoteInqRq = InsuranceSvcRq.ele('GeneralLiabilityPolicyQuoteInqRq');
        GeneralLiabilityPolicyQuoteInqRq.ele('RqUID', this.request_id);
        GeneralLiabilityPolicyQuoteInqRq.ele('TransactionRequestDt', now.format('YYYY-MM-DDTHH:mm:ss'));
        GeneralLiabilityPolicyQuoteInqRq.ele('TransactionEffectiveDt', now.format('YYYY-MM-DD'));
        GeneralLiabilityPolicyQuoteInqRq.ele('CurCd', 'USD');

        // <Producer>
        const Producer = GeneralLiabilityPolicyQuoteInqRq.ele('Producer');

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
        ProducerInfo.ele('ContractNumber', '8843');
        ProducerInfo.ele('ProducerSubCode', 'AA');
        // </ProducerInfo>

        // </Producer>

        // <InsuredOrPrincipal>
        const InsuredOrPrincipal = GeneralLiabilityPolicyQuoteInqRq.ele('InsuredOrPrincipal');
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
        TaxIdentity.ele('TaxId', this.app.business.locations[0].identification_number);
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
        const operationsDescription = this.app.business.locations[0].activity_codes[0].description ? this.app.business.locations[0].activity_codes[0].description : this.app.business.industry_code_description;
        BusinessInfo.ele('OperationsDesc', operationsDescription);
        BusinessInfo.ele('NumOwners', this.app.business.num_owners);
        BusinessInfo.ele('NumEmployees', this.get_total_employees());
        // </BusinessInfo>
        // </InsuredOrPrincipalInfo>
        // </InsuredOrPrincipal>

        // <CommlPolicy>
        const CommlPolicy = GeneralLiabilityPolicyQuoteInqRq.ele('CommlPolicy');
        CommlPolicy.ele('LOBCd', 'CGL');
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
            if (policy.type !== "GL") {
                return;
            }
            const totalClaimCount = this.get_num_claims(3);
            if (!totalClaimCount) {
                return;
            }
            const totalClaimAmount = this.get_total_amount_incurred_on_claims(3);
            const OtherOrPriorPolicy = CommlPolicy.ele('OtherOrPriorPolicy');
            OtherOrPriorPolicy.ele('PolicyCd', 'com.acuity_LossHistory');
            OtherOrPriorPolicy.ele('LOBCd', 'CGL');
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
            log.error(`${this.insurer.name} WC is unable to get question identifiers.${error}` + __location);
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
                    return this.return_result('autodeclined');
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
        this.app.business.locations.forEach((location, index) => {
            const Location = GeneralLiabilityPolicyQuoteInqRq.ele('Location');
            Location.att('id', `L${index + 1}`);

            // TO DO: Ask Adam: The RiskLocationCd is used to indicate if an address is within city limits (IN) or outside city limits (OUT).  I believe this only comes into play for the state of KY when more detailed location info is needed for tax purposes.  For the Rating API, if this information is not provided, the default is to assume the address IS within city limits.
            // <RiskLocationCd>IN</RiskLocationCd>
            // We must ask the user (it is higher in the city limits)

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
        });

        // <GeneralLiabilityLineBusiness>
        const GeneralLiabilityLineBusiness = GeneralLiabilityPolicyQuoteInqRq.ele('GeneralLiabilityLineBusiness');
        GeneralLiabilityLineBusiness.ele('LOBCd', 'CGL');

        // Get the claims organized by year
        const claims_by_year = this.claims_to_policy_years();

        // Loop through all four years and send claims data
        for (let i = 1; i <= 3; i++) {
            if (claims_by_year[i].count) {
                // <WorkCompLossOrPriorPolicy>
                const WorkCompLossOrPriorPolicy = GeneralLiabilityLineBusiness.ele('WorkCompLossOrPriorPolicy');
                WorkCompLossOrPriorPolicy.ele('EffectiveDt', claims_by_year[i].effective_date.format('YYYY-MM-DD'));
                WorkCompLossOrPriorPolicy.ele('ExpirationDt', claims_by_year[i].expiration_date.format('YYYY-MM-DD'));

                // <PaidTotalAmt>
                const PaidTotalAmt = WorkCompLossOrPriorPolicy.ele('TotalIncurredAmt');
                PaidTotalAmt.ele('Amt', claims_by_year[i].amountPaid + claims_by_year[i].amountReserved);
                // </PaidTotalAmt>

                WorkCompLossOrPriorPolicy.ele('NumClaims', claims_by_year[i].count);
                // </WorkCompLossOrPriorPolicy>
            }
        }

        // <LiabilityInfo>
        const LiabilityInfo = GeneralLiabilityLineBusiness.ele('LiabilityInfo');
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
        CommlCoverage = LiabilityInfo.ele('CommlCoverage');
        CommlCoverage.ele('CoverageCd', 'PRDCO');
        CommlCoverage.ele('CoverageDesc', 'Products&Completed Operations');
        // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatInteger', limits[2]);
        // </Limit>
        // </CommlCoverage>
        // Exposures
        for (let i = 0; i < this.app.business.locations.length; i++) {
            const location = this.app.business.locations[i];
            // Ensure we have a GL policy and activity codes exist
            if (!location.appPolicyTypeList.includes("GL") && location.activity_codes) {
                continue;
            }
            // let totalPayroll = 0;
            const cobPayrollMap = {};
            for (const activityCode of location.activity_codes) {
                // Skip activity codes we shouldn't include in payroll
                if (unreportedPayrollActivityCodes.includes(activityCode.id)) {
                    continue;
                }

                let cglCode = null;
                if (insurer) {
                    cglCode = await this.get_cgl_code_from_activity_code(insurer.id, location.territory, activityCode.id);
                }

                if (cglCode) {
                    if (!cobPayrollMap.hasOwnProperty(cglCode)) {
                        cobPayrollMap[cglCode] = 0;
                    }
                    cobPayrollMap[cglCode] += activityCode.payroll;
                }
            }
            // Fill in the exposure. The Acuity CGL spreadsheet does not specify exposures per class code so we send PAYROLL for now until we get clarity.
            Object.keys(cobPayrollMap).forEach((cglCode) => {
                const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification');
                GeneralLiabilityClassification.att('LocationRef', `L${i + 1}`);
                GeneralLiabilityClassification.ele('ClassCd', cglCode);
                // GeneralLiabilityClassification.ele('ClassCdDesc', this.industry_code.description);
                GeneralLiabilityClassification.ele('PremiumBasisCd', 'PAYRL');
                GeneralLiabilityClassification.ele('Exposure', cobPayrollMap[cglCode]);
            });
        }

        // </GeneralLiabilityLineBusiness>
        // </GeneralLiabilityPolicyQuoteInqRq>
        // </InsuranceSvcRq>
        // </ACORD>

        // Get the XML structure as a string
        const xml = ACORD.end({pretty: true});

        // console.log('request', xml);

        // Determine which URL to use
        let host = '';
        if (this.insurer.useSandbox) {
            host = 'tptest.acuity.com';
        }
        else {
            host = 'www.acuity.com';
        }
        const path = '/ws/partner/public/irate/rating/RatingService/Talage';

        // console.log(xml);

        // Send the XML to the insurer
        let res = null;
        try {
            res = await this.send_xml_request(host, path, xml, {
                'X-IBM-Client-Id': this.username,
                'X-IBM-Client-Secret': this.password
            });
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
        const policySummaryInfo = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.GeneralLiabilityPolicyQuoteInqRs.PolicySummaryInfo');
        if (!policySummaryInfo) {
            log.error(`Acuity (application ${this.app.id}): Could not find PolicySummaryInfo ${__location}`);
            return this.return_error('error', 'Acuity returned an unexpected reply');
        }
        const policyStatusCode = this.get_xml_child(policySummaryInfo, 'PolicyStatusCd');
        if (!policyStatusCode) {
            log.error(`Acuity (application ${this.app.id}): Could not find PolicyStatusCode ${__location}`);
            return this.return_error('error', 'Acuity returned an unexpected reply');
        }

        // If the first message status begins with "Rating is not available ...", it is an autodecline
        const extendedStatusDescription = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.GeneralLiabilityPolicyQuoteInqRs.MsgStatus.ExtendedStatus.ExtendedStatusDesc');
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
                const commlCoverage = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.GeneralLiabilityPolicyQuoteInqRs.GeneralLiabilityLineBusiness.LiabilityInfo.CommlCoverage', true);
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
                // Look for a quote letter
                const fileAttachmentInfo = this.get_xml_child(res.ACORD, 'InsuranceSvcRs.GeneralLiabilityPolicyQuoteInqRs.FileAttachmentInfo');
                if (fileAttachmentInfo) {
                    log.info(`Acuity: Found a quote letter and saving it.`);
                    // Try to save the letter. This is a non-fatal event if we can't save it, but we log it as an error.
                    try {
                        this.quote_letter = {
                            content_type: fileAttachmentInfo.MIMEContentTypeCd[0],
                            data: fileAttachmentInfo.cData[0],
                            file_name: `${this.insurer.name}_ ${this.policy.type}_quote_letter.pdf`
                        };
                    }
                    catch (error) {
                        log.error(`Acuity (application ${this.app.id}): Quote letter node exists, but could not extract it. Continuing.`);
                    }
                }
                const status = policyStatusCode === "com.acuity_BindableQuote" ? "quoted" : "referred";
                log.info(`Acuity: Returning ${status} ${policyAmount ? "with price" : ""}`);
                return this.return_result(status);
            case "com.acuity_Declined":
                return this.return_result('declined');
            default:
                this.reasons.push(`Returned unknown policy code '${policyStatusCode}`);
                log.error(`Acuity (application ${this.app.id}): Returned unknown policy code '${policyStatusCode}' ${__location}`);
                return this.return_error('error', 'Acuity returned an unexpected result for a bindable quote.');
        }
    }
};