/* eslint-disable object-curly-newline */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Workers Compensation Policy Integration for Liberty
 *
 * Note: We have taken liberty by sending in a fake Gross Sales amount. It is set to payroll * 3.
 */

'use strict';

const builder = require('xmlbuilder');
const moment_timezone = require('moment-timezone');
const moment = require('moment');
const Integration = require('../Integration.js');
const paymentPlanSVC = global.requireShared('./services/paymentplansvc');
global.requireShared('./helpers/tracker.js');
const {getLibertyQuoteProposal, getLibertyOAuthToken} = require('./api');
module.exports = class LibertyWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

	/**
	 * Requests a quote from Liberty and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.applicationDocData

        const logPrefix = `Liberty Mutual WC (Appid: ${this.app.id}): `;

        const tomorrow = moment().add(1,'d').startOf('d');
        if(this.policy.effective_date < tomorrow){
            this.reasons.push("Insurer: Does not allow effective dates before tomorrow. - Stopped before submission to insurer");
            return this.return_result('autodeclined');
        }


        // These are the statuses returned by the insurer and how they map to our Talage statuses
        this.possible_api_responses.Accept = 'quoted';
        this.possible_api_responses.Refer = 'referred';
        this.possible_api_responses.Reject = 'declined';

        // These are the limits supported by Liberty
        const carrierLimits = [
            '100000/500000/100000',
            '500000/500000/500000',
            '500000/1000000/500000',
            '1000000/1000000/1000000'
        ];

        // The structure for these questions is separate from the class specific questions. They are addressed lower in the file.
        const codedQuestionsByIdentifier = [
            'LMGENRL65',
            'LMWORK07',
            'LMWORK10',
            'LMWORK17',
            'LMWORK18',
            'LMWORK19',
            'WORK11'
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

        // Liberty has us define our own Request ID
        this.request_id = this.generate_uuid();

        // Establish the current time
        const now = moment_timezone.tz('America/Los_Angeles');

        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            log.error(`${logPrefix}Autodeclined: no limits. Insurer does not support the requested liability limits. ${__location}`);
            this.reasons.push(`Insurer does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // Build the XML Request

        // <ACORD>
        const ACORD = builder.create('ACORD', {'encoding': 'UTF-8'});

        // <SignonRq>
        const SignonRq = ACORD.ele('SignonRq');

        // <SignonPswd>
        const SignonPswd = SignonRq.ele('SignonPswd');

        // <CustId>
        const CustId = SignonPswd.ele('CustId');
        CustId.ele('CustLoginId', this.username);
        // </CustId>
        // </SignonPswd>

        SignonRq.ele('ClientDt', now.format());
        SignonRq.ele('CustLangPref', 'English');

        // <ClientApp>
        const ClientApp = SignonRq.ele('ClientApp');
        ClientApp.ele('Org', 'Talage Insurance');
        ClientApp.ele('Name', 'Talage');
        ClientApp.ele('Version', '1.0');
        // </ClientApp>

        // </SignonRq>

        // <InsuranceSvcRq>
        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', this.request_id);

        // <PolicyRq>
        const PolicyRq = InsuranceSvcRq.ele('PolicyRq');
        PolicyRq.ele('RqUID', this.request_id);
        PolicyRq.ele('TransactionRequestDt', now.format());
        PolicyRq.ele('TransactionEffectiveDt', now.format('YYYY-MM-DD'));
        PolicyRq.ele('CurCd', 'USD');
        PolicyRq.ele('BusinessPurposeTypeCd', 'NBQ'); // Per Liberty, this is the only valid value

        // <SourceSystem>
        const SourceSystem = PolicyRq.ele('SourceSystem').att('id', 'Talage');
        SourceSystem.ele('SourceSystemCd', 'RAMP'); // Per Liberty, this is the only valid value
        // </SourceSystem>

        // <Producer>
        const Producer = PolicyRq.ele('Producer');

        // <ProducerInfo>
        const ProducerInfo = Producer.ele('ProducerInfo');
        ProducerInfo.ele('ContractNumber', !this.insurer.useSandbox ? this.app.agencyLocation.insurers[this.insurer.id].agency_id : '4689905').att('SourceSystemRef', 'Talage');
        // </ProducerInfo>
        // </Producer>

        // <InsuredOrPrincipal>
        const InsuredOrPrincipalUUID = this.generate_uuid();
        const InsuredOrPrincipal = PolicyRq.ele('InsuredOrPrincipal');
        InsuredOrPrincipal.att('id', InsuredOrPrincipalUUID);

        // <GeneralPartyInfo>
        const GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');

        // <NameInfo>
        const NameInfo = GeneralPartyInfo.ele('NameInfo');

        // <CommlName>
        const CommlName = NameInfo.ele('CommlName');
        CommlName.ele('CommercialName', this.app.business.name);
        // </CommlName>

        NameInfo.ele('LegalEntityCd', entityMatrix[this.app.business.entity_type]);

        // <TaxIdentity>
        const TaxIdentity = NameInfo.ele('TaxIdentity');
        TaxIdentity.ele('TaxIdTypeCd', 'FEIN');
        TaxIdentity.ele('TaxId', appDoc.ein);
        // </TaxIdentity>
        // </NameInfo>

        // <Addr>
        let Addr = GeneralPartyInfo.ele('Addr');
        Addr.ele('Addr1', this.app.business.mailing_address);
        if (this.app.business.mailing_address2) {
            Addr.ele('Addr2', this.app.business.mailing_address2);
        }
        Addr.ele('City', this.app.business.mailing_city);
        Addr.ele('StateProvCd', this.app.business.mailing_territory);
        Addr.ele('PostalCode', this.app.business.mailing_zip);
        // </Addr>

        // <Communications>
        const Communications = GeneralPartyInfo.ele('Communications');

        // <PhoneInfo>
        const PhoneInfo = Communications.ele('PhoneInfo');
        PhoneInfo.ele('PhoneTypeCd', 'Phone');
        const phone = this.app.business.contacts[0].phone.toString();
        PhoneInfo.ele('PhoneNumber', `+1-${phone.substring(0, 3)}-${phone.substring(phone.length - 7)}`);
        // </PhoneInfo>
        // </Communications>
        // </GeneralPartyInfo>

        // <InsuredOrPrincipalInfo>
        const InsuredOrPrincipalInfo = InsuredOrPrincipal.ele('InsuredOrPrincipalInfo');
        InsuredOrPrincipalInfo.ele('InsuredOrPrincipalRoleCd', 'FNI'); // Per Liberty, "first name insured" is the only valid value

        // <BusinessInfo>
        const BusinessInfo = InsuredOrPrincipalInfo.ele('BusinessInfo');
        BusinessInfo.ele('BusinessStartDt', this.app.business.founded.format('YYYY'));
        BusinessInfo.ele('OperationsDesc', this.get_operation_description());
        // </BusinessInfo>
        // </InsuredOrPrincipalInfo>
        // </InsuredOrPrincipal>

        // <Policy>
        const Policy = PolicyRq.ele('Policy');
        Policy.ele('LOBCd', 'WORK');
        Policy.ele('ControllingStateProvCd', this.app.business.primary_territory);

        if (this.policy.claims.length) {
            for (const claim_index in this.policy.claims) {
                if (Object.prototype.hasOwnProperty.call(this.policy.claims, claim_index)) {
                    const claim = this.policy.claims[claim_index];

                    // <Loss>
                    const Loss = Policy.ele('Loss');
                    Loss.ele('LOBCd', 'WORK');
                    Loss.ele('LossDt', claim.date.format('YYYY-MM-DD'));
                    Loss.ele('StateProvCd', this.app.business.primary_territory);
                    Loss.ele('LossCauseCd', claim.missedWork ? 'WLT' : 'WMO');
                    Loss.ele('ClaimStatusCd', claim.open ? 'open' : 'closed');

                    // <TotalPaidAmt>
                    const TotalPaidAmt = Loss.ele('TotalPaidAmt');
                    TotalPaidAmt.ele('Amt', claim.amountPaid);
                    // </TotalPaidAmt>

                    // <ReservedAmt>
                    const ReservedAmt = Loss.ele('ReservedAmt');
                    ReservedAmt.ele('Amt', claim.amountReserved);
                    // </ReservedAmt>
                    // </Loss>
                }
            }
        }

        // <ContractTerm>
        const ContractTerm = Policy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
        // </ContractTerm>

        // <PolicySupplement>
        const PolicySupplement = Policy.ele('PolicySupplement');
        PolicySupplement.ele('NumEmployees', this.get_total_employees());

        // <AnnualSalesAmt>
        const AnnualSalesAmt = PolicySupplement.ele('AnnualSalesAmt');
        // Per Adam: We are sending them a fake annual sales amount because this value is not used in rating
        AnnualSalesAmt.ele('Amt', this.get_total_payroll() * 3);
        // </AnnualSalesAmt>

        if (this.app.business.years_of_exp) {
            // <PolicySupplementExt>
            const PolicySupplementExt = PolicySupplement.ele('PolicySupplementExt');
            // How many years of management experience does the management team have in this industry?
            PolicySupplementExt.ele('com.libertymutual.ci_NumYrsManagementExperience', this.app.business.years_of_exp);

            // Please provide details regarding insured's management experience
            PolicySupplementExt.ele('com.libertymutual.ci_InsuredManagementExperienceText', this.app.business.industry_code_description);
            // </PolicySupplementExt
        }
        // </PolicySupplement>

        // Loop through each question
        let QuestionAnswer = '';
        for(const insurerQuestion of this.insurerQuestionList){
        //for (const question_id in this.questions) {
            if (Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)) {
                //const question = this.questions[question_id];
                const question = this.questions[insurerQuestion.talageQuestionId];
                if(!question){
                    continue;
                }


                /**
                 * Don't process questions:
                 *  - without a code (not for this insurer)
                 *  - coded questions (one that has a structure hard-coded elsehwere in this file)
                 */
                if (!insurerQuestion.identifier || codedQuestionsByIdentifier.includes(insurerQuestion.identifier)) {
                    continue;
                }
                //do not process universal questions
                //Do no process univseral questions here.
                if(insurerQuestion.universal){
                    continue;
                }

                // For Yes/No questions, if they are not required and the user answered 'No', simply don't send them
                // not nothing change question.required from false.  There are all false
                if (question.type === 'Yes/No' && !question.hidden && !question.get_answer_as_boolean()) {
                    continue;
                }

                // Get the answer
                let answer = '';
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    log.error(`${logPrefix}Could not determine question ${insurerQuestion.talageQuestionId} answer: ${error}. ${__location}`);
                }

                // This question was not answered
                if (!answer) {
                    continue;
                }

                // Build out the question structure
                QuestionAnswer = Policy.ele('QuestionAnswer');
                QuestionAnswer.ele('QuestionCd', insurerQuestion.identifier);

                if (question.type === 'Yes/No') {
                    let boolean_answer = question.get_answer_as_boolean() ? 'YES' : 'NO';

                    // For the question GENRL06, flip the answer
                    if (insurerQuestion.identifier === 'GENRL06') {
                        boolean_answer = !boolean_answer;
                    }

                    QuestionAnswer.ele('YesNoCd', boolean_answer);
                }
                else {
                    // Other Question Type
                    QuestionAnswer.ele('YesNoCd', 'NA');

                    // Check if the answer is a number
                    if (/^\d+$/.test(answer)) {
                        QuestionAnswer.ele('Num', answer);
                    }
                    else {
                        QuestionAnswer.ele('Explanation', answer);
                    }
                }
            }
            else {
                log.error(`${logPrefix}Missing expected Talage Question ${insurerQuestion.talageQuestionId} for InsurerQuestion : ${insurerQuestion.identifier}. ${__location}`);
            }
        }

        // Governing Class Codes
        const governing_class = this.determine_governing_activity_code();
        Policy.ele('GoverningClassCd', this.insurer_wc_codes[this.app.business.primary_territory + governing_class.id]);
        // </Policy>

        this.app.business.locations.forEach((loc, index) => {
            // <Location>
            const Location = PolicyRq.ele('Location');
            Location.att('id', `l${index + 1}`);

            Addr = Location.ele('Addr');
            Addr.ele('Addr1', loc.address.substring(0, 30));
            if (loc.address2) {
                Addr.ele('Addr2', loc.address2.substring(0, 30));
            }
            Addr.ele('City', loc.city);
            Addr.ele('StateProvCd', loc.territory);
            Addr.ele('PostalCode', loc.zip);
            // </Location>
        });

        // <WorkCompLineBusiness>
        const WorkCompLineBusiness = PolicyRq.ele('WorkCompLineBusiness');
        WorkCompLineBusiness.ele('LOBCd', 'WORK');

        // Separate out the states
        const territories = this.app.business.getTerritories();
        //territories.forEach((territory) => {
        for(const territory of territories) {

            // <WorkCompRateState>
            const WorkCompRateState = WorkCompLineBusiness.ele('WorkCompRateState');
            WorkCompRateState.ele('StateProvCd', territory);

            //this.app.business.locations.forEach((location, index) => {
            for(let index = 0; index < this.app.business.locations.length; index++) {
                const location = this.app.business.locations[index]
                // Make sure this location is in the current territory, if not, skip it
                if (location.territory !== territory) {
                    return;
                }

                // <WorkCompLocInfo>
                const WorkCompLocInfo = WorkCompRateState.ele('WorkCompLocInfo');
                WorkCompLocInfo.att('LocationRef', `l${index + 1}`);

                for (const activity_code of location.activity_codes){
                    // <WorkCompRateClass>
                    const WorkCompRateClass = WorkCompLocInfo.ele('WorkCompRateClass');
                    WorkCompRateClass.att('InsuredOrPrincipalRef', InsuredOrPrincipalUUID);

                    WorkCompRateClass.ele('RatingClassificationCd', this.insurer_wc_codes[location.territory + activity_code.id]);
                    WorkCompRateClass.ele('Exposure', activity_code.payroll);
                    const acivityCodeInsurerQuestions = await this.get_insurer_questions_by_activitycodes([activity_code.id]);
                    if(acivityCodeInsurerQuestions && acivityCodeInsurerQuestions.length > 0){
                        const WorkCompRateClassExt = WorkCompRateClass.ele('WorkCompRateClassExt');
                        // eslint-disable-next-line no-loop-func
                        acivityCodeInsurerQuestions.forEach((iq) => {
                            const question = this.questions[iq.talageQuestionId];
                            if(question){
                                try{
                                    QuestionAnswer = WorkCompRateClassExt.ele('QuestionAnswer');
                                    QuestionAnswer.ele('QuestionCd', iq.identifier);
                                    QuestionAnswer.ele('YesNoCd', question.get_answer_as_boolean() ? 'YES' : 'NO');
                                }
                                catch(err){
                                    log.error(`${logPrefix}Issue with Talage Question ${iq.talageQuestionId} for InsurerQuestion : ${iq.identifier} error: ${err} question object ${JSON.stringify(question)}. ${__location}`);
                                }
                            }
                            else {
                                log.error(`${logPrefix}Missing expected Talage Question ${iq.talageQuestionId} for InsurerQuestion : ${iq.identifier}. ${__location}`);
                            }
                        });
                    }
                    else {
                        log.warn(`${logPrefix}No Activity Code questions for activityCodeId ${activity_code.id}. ${__location}`);
                    }

                    // </WorkCompRateClass>
                }
                // </WorkCompLocInfo>
            }
            // </WorkCompRateState>
        }

        // <Coverage>
        const Coverage = WorkCompLineBusiness.ele('Coverage');
        Coverage.ele('CoverageCd', 'EL');

        // <Limit>
        let Limit = Coverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[0]);
        Limit.ele('LimitAppliesToCd', 'BIEachOcc');
        // </Limit>

        // <Limit>
        Limit = Coverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[2]);
        Limit.ele('LimitAppliesToCd', 'DisEachEmpl');
        // </Limit>

        // <Limit>
        Limit = Coverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[1]);
        Limit.ele('LimitAppliesToCd', 'DisPol');
        // </Limit>
        // </Coverage>
        //. Policy.
        //WorkCompLineBusiness
        const processedUniversalQList = [];
        // Loop through each of the special questions separated by identifier and print them here (all are boolean)
        for (const index in codedQuestionsByIdentifier) {
            if (Object.prototype.hasOwnProperty.call(codedQuestionsByIdentifier, index)) {
                const identifier = codedQuestionsByIdentifier[index];
                const question = this.get_question_by_identifier(identifier);
                if (question) {
                    try{
                        processedUniversalQList.push(question.id);
                        // <QuestionAnswer>
                        QuestionAnswer = WorkCompLineBusiness.ele('QuestionAnswer');
                        QuestionAnswer.ele('QuestionCd', identifier);
                        QuestionAnswer.ele('YesNoCd', question.get_answer_as_boolean() ? 'YES' : 'NO');
                        // </QuestionAnswer>
                    }
                    catch(err){
                        log.error(`${logPrefix}Issue withTalage Question ${question.id} for InsurerQuestion : ${identifier} error: ${err}. ${__location}`);
                    }
                }
            }
        }
        // process universal.s
        this.insurerQuestionList.forEach((iq) => {
            if(processedUniversalQList.indexOf(iq.talageQuestionId) === -1){
                const question = this.get_question_by_identifier(iq.identifier);
                if (question) {
                    try{
                        processedUniversalQList.push(question.id);
                        // <QuestionAnswer>
                        QuestionAnswer = Policy.ele('QuestionAnswer');
                        QuestionAnswer.ele('QuestionCd', iq.identifier);
                        QuestionAnswer.ele('YesNoCd', question.get_answer_as_boolean() ? 'YES' : 'NO');
                        // </QuestionAnswer>
                    }
                    catch(err){
                        log.error(`${logPrefix}Issue withTalage Question ${iq.talageQuestionId} for InsurerQuestion : ${iq.identifier} error: ${err}. ${__location}`);
                    }
                }

            }
        });
        // </WorkCompLineBusiness>
        // </PolicyRq>
        // </InsuranceSvcRq>
        // </ACORD>

        // Get the XML structure as a string
        const xml = ACORD.end({'pretty': true});

        let auth = null;
        try {
            auth = await getLibertyOAuthToken();
        }
        catch (e) {
            log.error(`${logPrefix}${e}${__location}`);
            return this.client_error(`${e}`, __location);
        }

        const host = 'apis.us-east-1.libertymutual.com';
        const quotePath = `/bl-partnerships/quotes?partnerID=${this.username}`;

        let result = null;
        try {
            result = await this.send_xml_request(host, quotePath, xml, {
                'Authorization': `Bearer ${auth.access_token}`
            });
        }
        catch (e) {
            const errorMessage = `An error occurred while trying to hit the Liberty Quote API endpoint: ${e}. `;
            log.error(logPrefix + errorMessage + __location);
            return this.client_error(errorMessage, __location);
        }
        // Parse the various status codes and take the appropriate action
        let res = result.ACORD;

        // Check that there was success at the root level
        if (res.Status[0].StatusCd[0] !== '0') {
            log.error(`${logPrefix}Insurer's API Responded With Status ${res.Status[0].StatusCd[0]}: ${res.Status[0].StatusDesc[0]} ${__location}`);
            this.reasons.push(`Insurer's API Responded With Status ${res.Status[0].StatusCd[0]}: ${res.Status[0].StatusDesc[0]}`);
            return this.return_result('error');
        }

        // Refine our selector
        res = res.InsuranceSvcRs[0].PolicyRs[0];

        // If the status wasn't success, stop here
        if (res.MsgStatus[0].MsgStatusCd[0] !== 'SuccessWithInfo') {

            // Check if this was an outage
            if (res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0].indexOf('services being unavailable') >= 0) {
                log.error(`${logPrefix}Insurer's API Responded With services being unavailable ${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0]} ${__location}`);
                this.reasons.push(`${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0]}`);
                return this.return_result('outage');
            }

            // Check if quote was declined because there was a pre-existing application for this customer
            const existingAppErrorMsg = "We are unable to provide a quote at this time due to an existing application for this customer.";
            if(res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0].toLowerCase().includes(existingAppErrorMsg.toLowerCase())) {
                this.reasons.push(`blocked - ${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0]}`);
                return this.return_result('declined');
            }

            // This was some other sort of error
            log.error(`${logPrefix}Insurer's API Responded With ${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusCd[0]}: ${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0]} ${__location}`);
            this.reasons.push(`${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusCd[0]}: ${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0]}`);
            return this.return_result('error');
        }

        // Get the status from the insurer
        const status = res.Policy[0].QuoteInfo[0].UnderwritingDecisionInfo[0].SystemUnderwritingDecisionCd[0];
        if (status !== 'Accept') {
            this.indication = true;
        }

        // Attempt to get the quote number
        try {
            this.number = res.Policy[0].QuoteInfo[0].CompanysQuoteNumber[0];
        }
        catch (e) {
            log.error(`${logPrefix}Integration Error: Quote structure changed. Unable to find quote number.` + __location);
        }

        let quoteProposalId = null;
        try {
            quoteProposalId = res.Policy[0].PolicyExt[0]['com.libertymutual.ci_QuoteProposalId'];
        }
        catch (e) {
            log.warn(`${logPrefix}Integration Error: Quote structure changed. Unable to find quote proposal number. ${__location}`);
        }

        let quoteResult = null;
        if (quoteProposalId) {
            // Liberty's quote proposal endpoint has a tendency to throw 503 (service unavailable), retry up to 5 times to get the quote proposal
            const MAX_RETRY_ATTEMPTS = 5;
            let retry = 0;
            let error = false;
            do {
                retry++;
                try {
                    quoteResult = await getLibertyQuoteProposal(quoteProposalId, auth);
                }
                catch (e) {
                    log.error(`${logPrefix}ATTEMPT ${retry}: ${e}${__location}`);
                    error = true;
                    if (retry <= MAX_RETRY_ATTEMPTS) {
                        continue;
                    }
                    else {
                        break;
                    }
                }

                error = false;
            } while (error);
        }

        // comes back as a string, so we search for the XML BinData field and substring it out
        if (quoteResult !== null) {
            const start = quoteResult.indexOf("<BinData>") + 9;
            const end = quoteResult.indexOf("</BinData>");

            if (start === 8 || end === -1) {
                log.warn(`${logPrefix}Quote Proposal Letter not provided, or quote result structure has changed. ${__location}`);
            }
            else {
                const quoteLetter = quoteResult.substring(start, end).toString('base64');

                if (quoteLetter) {
                    this.quote_letter = {
                        content_type: "application/base64",
                        data: quoteLetter,
                        file_name: `${this.insurer.name}_${this.policy.type}_quote_letter.pdf`
                    };
                }
            }
        }
        else {
            log.warn(`${logPrefix}Unable to get Quote Proposal Letter. ${__location}`);
        }

        // Attempt to get the amount of the quote
        if (status !== 'Reject') {
            try {
                this.amount = parseInt(res.Policy[0].QuoteInfo[0].InsuredFullToBePaidAmt[0].Amt[0], 10);
            }
            catch (e) {
                log.error(`${logPrefix}Unable to get an amount . Error: ${e} ` + __location);
                // This is handled in return_result()
            }
        }

        // Attempt to get the reasons
        try {
            // Capture Reasons
            res.Policy[0].QuoteInfo[0].UnderwritingDecisionInfo[0].UnderwritingRuleInfo[0].UnderwritingRuleInfoExt.forEach((rule) => {
                this.reasons.push(`${rule['com.libertymutual.ci_UnderwritingDecisionName']}: ${rule['com.libertymutual.ci_UnderwritingMessage']}`);
            });
        }
        catch (e) {
            if (status === 'Reject') {
                log.error(`${logPrefix}Integration Error: Quote structure changed. Unable to find reasons.` + __location);
            }
        }

        // Grab the limits info
        try {
            res.WorkCompLineBusiness[0].Coverage.forEach((coverageBlock) => {
                if (coverageBlock.CoverageCd[0] === 'EL') {
                    coverageBlock.Limit.forEach((limit) => {
                        switch (limit.LimitAppliesToCd[0]) {
                            case 'BIEachOcc':
                                this.limits[1] = parseInt(limit.FormatCurrencyAmt[0].Amt[0],10);
                                break;
                            case 'DisEachEmpl':
                                this.limits[2] = parseInt(limit.FormatCurrencyAmt[0].Amt[0],10);
                                break;
                            case 'DisPol':
                                this.limits[3] = parseInt(limit.FormatCurrencyAmt[0].Amt[0],10);
                                break;
                            default:
                                log.warn(`${logPrefix}Integration Error: Unexpected limit found in response` + __location);
                                break;
                        }
                    });
                }
            });
        }
        catch (e) {
            // This is handled in return_result()
            log.error(`${logPrefix}Error getting limits. Error: ${e} ` + __location);
        }

        //find payment plans
        const insurerPaymentPlans =
          res.Policy[0]?.QuoteInfo[0]?.QuoteInfoExt[0]?.PaymentOption?.map(
            ({$, ...rest}) => ({
              PaymentRule: $['com.libertymutual.ci_PaymentRuleInfoRefs'],
              ...rest
            })
          )

        if (insurerPaymentPlans?.length > 0) {
          const [
            Annual,
            ,
            Quarterly,
            TenPay,
            Monthly
        ] = paymentPlanSVC.getList()
          const talageInsurerPaymentPlans = []
          const paymentPlansMap = {
              'FL':Annual,
              'QT': Quarterly,
              'MO': Monthly,
              '10': TenPay,
              '9E': TenPay
          }

          const numberOfPayments = {
            'FL': 1, // Full
            'QT': 4, // Quarterly
            'MO': 12, // Monthly
            '10': 11, // 2 months down + 10 installments
            '9E': 10 // 10% down + 9 equal payments.
          }
          const costFactor = {
              ...numberOfPayments,
              '10': 6
          }

          // Raw insurer payment plans
        this.insurerPaymentPlans = insurerPaymentPlans

          // Talage payment plans
          for (const insurerPaymentPlan of insurerPaymentPlans) {
            const code = insurerPaymentPlan.PaymentPlanCd[0]
            const amount = Number(insurerPaymentPlan.DepositAmt[0].Amt[0])
            const mode = insurerPaymentPlan.PaymentRule
            const talagePaymentPlan = paymentPlansMap[code]
            const total = amount * costFactor[code]
            let installmentPayment = null

            switch (code) {
                case 'FL':
                    installmentPayment = 0
                    break;
                case '10':
                    installmentPayment = amount / 2
                    break;
                default:
                    installmentPayment = amount
            }

            if (talagePaymentPlan) {
              talageInsurerPaymentPlans.push({
                paymentPlanId: talagePaymentPlan.id,
                insurerPaymentPlanId: code,
                insurerPaymentPlanDescription: mode,
                NumberPayments: numberOfPayments[code],
                TotalCost: total,
                TotalPremium: total,
                DownPayment: code === 'FL' ? 0 : amount,
                TotalStateTaxes: 0,
                TotalBillingFees: 0,
                DepositPercent: Number((100 * amount / total).toFixed(2)),
                IsDirectDebit: true,
                installmentPayment: installmentPayment
              })
            }
          }


          this.talageInsurerPaymentPlans = talageInsurerPaymentPlans

        }


        // Send the result of the request
        return this.return_result(status);
    }
};