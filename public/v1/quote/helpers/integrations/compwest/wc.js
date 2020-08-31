/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */
/* eslint no-unreachable: 0 */

/**
 * Worker's Compensation Integration for CompWest (shared with Accident Fund)
 *
 * If Alabama (Merit Rating Credit - MRC) or Maine (Loss Ratio) are turned on, there are additional fields we need to add below
 */

'use strict';

const Integration = require('../Integration.js');
const builder = require('xmlbuilder');
const moment = require('moment');
const util = require('util');
const serverHelper = requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const wcEmodEmail = requireRootPath('./tasksystem/task-wcemodemail');

module.exports = class CompwestWC extends Integration {
    /**
     * Makes a request to Accident Fund to bind a policy.  This method is not intended to be called directly
     *
     * @returns {Promise.<string, ServerError>} A promise that returns a string containing bind result (either 'Bound' or 'Referred') if resolved, or a ServerError if rejected
     */
    async _bind() {
        // May payment plans
        const payment_plans = {
            '1': 'D1', // Annual
            '2': 'D2', // Semi-Annual
            '3': 'D4', // Quarterly
            '4': 'D9' // 10 Pay
        };

        // Temporarily turn off bind
        throw serverHelper.internalError('Bind is currently disabled for this insurer');

        // CompWest has us define our own Request ID
        this.request_id = this.generate_uuid();

        // Build the XML Request

        // <ACORD>
        const ACORD = builder.create('ACORD');
        ACORD.att('xsi:noNamespaceSchemaLocation', 'WorkCompPolicyAddRqXSD.xsd');
        ACORD.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');

        // <InsuranceSvcRq>
        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', this.request_id);

        // <WorkCompPolicyAddRq>
        const WorkCompPolicyAddRq = InsuranceSvcRq.ele('WorkCompPolicyAddRq');

        // <Producer>
        const Producer = WorkCompPolicyAddRq.ele('Producer');

        // <ItemIdInfo>
        const ItemIdInfo = Producer.ele('ItemIdInfo');
        ItemIdInfo.ele('AgencyId', this.app.agencyLocation.insurers[this.insurer.id].agency_id);
        // </ItemIdInfo>

        // <GeneralPartyInfo>
        let GeneralPartyInfo = Producer.ele('GeneralPartyInfo');

        // <NameInfo>
        let NameInfo = GeneralPartyInfo.ele('NameInfo');
        NameInfo.att('id', 'ProducerName');

        // <PersonName>
        const PersonName = NameInfo.ele('PersonName');
        PersonName.ele('Surname', this.app.agencyLocation.last_name);
        PersonName.ele('GivenName', this.app.agencyLocation.first_name);
        // </PersonName>
        // </NameInfo>
        // </GeneralPartyInfo>
        // </Producer>

        // <InsuredOrPrincipal>
        const InsuredOrPrincipal = WorkCompPolicyAddRq.ele('InsuredOrPrincipal');
        InsuredOrPrincipal.att('id', 'n0');

        // <GeneralPartyInfo>
        GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');

        // <NameInfo>
        NameInfo = GeneralPartyInfo.ele('NameInfo');

        // <CommlName>
        const CommlName = NameInfo.ele('CommlName');
        CommlName.ele('CommercialName', this.app.business.name.replace('’', "'").replace('+', '').replace('|', ''));
        // </CommlName>
        // </NameInfo>
        // </GeneralPartyInfo>
        // </InsureredOrPrincipal>

        // <CommlPolicy>
        const CommlPolicy = WorkCompPolicyAddRq.ele('CommlPolicy');
        CommlPolicy.ele('PolicyNumber', this.policy.json.number);

        // <PaymentOption>
        const PaymentOption = CommlPolicy.ele('PaymentOption');
        PaymentOption.ele('PaymentPlanCd', payment_plans[226]);
        // </PaymentOption>
        // </CommlPolicy>

        log.debug('Add additional insureds here');

        // Get the XML structure as a string
        const xml = ACORD.end({ pretty: true });

        // Determine which URL to use
        let host = '';
        if (this.insurer.useSandbox) {
            host = 'npsv.afgroup.com';
        } else {
            log.error(`${this.insurer.name} ERROR: Binding not supported in production`);
            throw serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        }
        const path = '/TEST_DigitalAq/rest/getbindworkcompquote'; // Send the XML to the insurer

        let result = null;
        try {
            result = await this.send_xml_request(host, path, xml, {
                Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
                'Content-Type': 'application/xml'
            });
        } catch (error) {
            log.error(util.inspect(error) + __location);
            log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to connect to insurer.` + __location);
            throw serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        }
        // Begin reducing the response
        const res = result.ACORD;
        let message_type = '';

        const status = res.SignonRs[0].Status[0].StatusCd[0];
        switch (status) {
            case 'BOUND':
            case 'REFERRED':
                message_type = status + status.slice(1).toLowerCase();
                this.log += `--------======= Quote ${message_type} =======--------`;
                log.info(`${this.insurer.name} ${this.policy.type} Quote ${message_type}`);
                return message_type;
            case 'ERRORED':
            case 'SMARTEDITS':
                this.log += `--------======= Bind Error =======--------<br><br>${res.SignonRs[0].Status[0].StatusDesc[0].Desc[0]}`;
                log.error(`${this.insurer.name} ${this.policy.type} Bind Integration Error(s):\n--- ${res.SignonRs[0].Status[0].StatusDesc[0].Desc[0]}` + __location);
                throw serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
            case 'UNAUTHENTICATED':
            case 'UNAUTHORIZED':
                message_type = status === 'UNAUTHENTICATED' ? 'Incorrect' : 'Locked';
                this.log += `--------======= ${message_type} Agency ID =======--------<br><br>We attempted to process a bind request, but the Agency ID set for the agent was ${message_type.toLowerCase()} and no quote could be processed.`;
                log.error(`${this.insurer.name} ${this.policy.type} Bind ${message_type} Agency ID` + __location);
                throw serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
            default:
                this.log += '--------======= Unexpected API Response =======--------';
                this.log += util.inspect(res, false, null);
                log.error(`${this.insurer.name} ${status} Bind - Unexpected response code by API ` + __location);
                throw serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        }
    }

    /**
     * Requests a quote from CompWest and returns. This method is not intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {
        // These are the statuses returned by the insurer and how they map to our Talage statuses
        this.possible_api_responses.DECLINE = 'declined';
        this.possible_api_responses.QUOTED = 'quoted';
        this.possible_api_responses.REFERRALNEEDED = 'referred';

        // Core States
        const afCoreStates = ['AR', 'DC', 'GA', 'IA', 'IL', 'IN', 'KS', 'KY', 'LA', 'MD', 'MI', 'MN', 'MO', 'MS', 'NC', 'NE', 'OK', 'SC', 'SD', 'TN', 'TX', 'VA', 'WI'];

        const cwCoreStates = ['AZ', 'CA', 'CO', 'ID', 'NV', 'OR', 'UT'];

        // These are the limits supported by AF Group
        const carrierLimits = ['100000/500000/100000', '500000/500000/500000', '500000/1000000/500000', '1000000/1000000/1000000', '2000000/2000000/2000000'];

        // Define how legal entities are mapped for Employers
        const entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };

        // CompWest has us define our own Request ID
        this.request_id = this.generate_uuid();

        // Get the activity code to question relationships
        const activity_codes_to_questions = await this.get_activity_codes_to_questions_relationships();

        // Check if this is within a core state, if not, more checking needs to be done
        if (!afCoreStates.includes(this.app.business.primary_territory) && !cwCoreStates.includes(this.app.business.primary_territory)) {
            // If this wasn't the Talage agency, start over as the Talage agency
            if (this.app.agencyLocation.agencyId !== 1) {
                log.info(`TO DO: As this business could not be written by ${this.insurer.name}, we can wholesale it.`);
            }

            // For now, just auto decline
            log.warn(`autodeclined: Non-Core State:  ${this.insurer.name} will not write policies where the primary territory is ${this.app.business.primary_territory} ` + __location);
            this.reasons.push(`Non-Core State: ${this.insurer.name} will not write policies where the primary territory is ${this.app.business.primary_territory}`);
            return this.return_result('autodeclined');
        }

        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            log.warn(`autodeclined: no limits  ${this.insurer.name} does not support the requested liability limits ` + __location);
            this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // Build the XML Request

        // <ACORD>
        const ACORD = builder.create('ACORD');
        ACORD.att('xsi:noNamespaceSchemaLocation', 'WorkCompPolicyQuoteInqRqXSD.xsd');
        ACORD.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');

        // <SignonRq>
        const SignonRq = ACORD.ele('SignonRq');

        // <ClientApp>
        const ClientApp = SignonRq.ele('ClientApp');

        // Org (AF Group has asked us to send in the Channel ID in this field. 2 indicates Digalent Storefront. 1 indicates the Talage Digital Agency)
        ClientApp.ele('Org', this.app.agencyLocation.id === 2 || this.app.agencyLocation.agencyNetwork === 2 ? 2 : 1);

        // </ClientApp>
        // </SignonRq>

        // <InsuranceSvcRq>
        const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
        InsuranceSvcRq.ele('RqUID', this.request_id);

        // <WorkCompPolicyQuoteInqRq>
        const WorkCompPolicyQuoteInqRq = InsuranceSvcRq.ele('WorkCompPolicyQuoteInqRq');

        // <Producer>
        const Producer = WorkCompPolicyQuoteInqRq.ele('Producer');

        // <ItemIdInfo>
        const ItemIdInfo = Producer.ele('ItemIdInfo');
        ItemIdInfo.ele('AgencyId', this.app.agencyLocation.insurers[this.insurer.id].agency_id);
        // </ItemIdInfo>

        // <GeneralPartyInfo>
        let GeneralPartyInfo = Producer.ele('GeneralPartyInfo');

        // <NameInfo>
        let NameInfo = GeneralPartyInfo.ele('NameInfo');
        NameInfo.att('id', 'ProducerName');

        // <PersonName>
        const PersonName = NameInfo.ele('PersonName');
        PersonName.ele('Surname', this.app.agencyLocation.last_name);
        PersonName.ele('GivenName', this.app.agencyLocation.first_name);
        // </PersonName>
        // </NameInfo>
        // </GeneralPartyInfo>
        // </Producer>

        // <InsuredOrPrincipal>
        const InsuredOrPrincipal = WorkCompPolicyQuoteInqRq.ele('InsuredOrPrincipal');
        InsuredOrPrincipal.att('id', 'n0');

        // <GeneralPartyInfo>
        GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');

        // <NameInfo>
        NameInfo = GeneralPartyInfo.ele('NameInfo');

        // <CommlName>
        const CommlName = NameInfo.ele('CommlName');
        CommlName.ele('CommercialName', this.app.business.name.replace('’', "'").replace('+', '').replace('|', ''));
        if (this.app.business.dba) {
            // <SupplementaryNameInfo>
            const SupplementaryNameInfo = CommlName.ele('SupplementaryNameInfo');
            SupplementaryNameInfo.ele('SupplementaryNameCd', 'DBA');
            SupplementaryNameInfo.ele('SupplementaryName', this.app.business.dba.replace('’', "'").replace('+', '').replace('|', ''));
            // </SupplementaryNameInfo>
        }
        // </CommlName>

        if (!(this.app.business.entity_type in entityMatrix)) {
            log.error(`${this.insurer.name} WC Integration File: Invalid Entity Type` + __location);
            this.reasons.push(`${this.insurer.name} WC Integration File: Invalid Entity Type`);
            return this.return_result('error');
        }
        NameInfo.ele('LegalEntityCd', entityMatrix[this.app.business.entity_type]);

        // <TaxIdentity>
        const TaxIdentity = NameInfo.ele('TaxIdentity');
        TaxIdentity.ele('TaxId', this.app.business.locations[0].identification_number);
        // </TaxIdentity>
        // </NameInfo>

        // <Addr>
        let Addr = GeneralPartyInfo.ele('Addr');
        Addr.ele('AddrTypeCd', 'MailingAddress');
        Addr.ele('Addr1', this.app.business.mailing_address);
        if (this.app.business.mailing_address2) {
            Addr.ele('Addr2', this.app.business.mailing_address2);
        }
        Addr.ele('City', this.app.business.mailing_city);
        Addr.ele('StateProvCd', this.app.business.mailing_territory);
        Addr.ele('PostalCode', this.app.business.mailing_zip);
        Addr.ele('CountryCd', 'USA');
        // </Addr>

        // <Communications>
        const Communications = GeneralPartyInfo.ele('Communications');

        // <PhoneInfo>
        const PhoneInfo = Communications.ele('PhoneInfo');
        PhoneInfo.ele('PhoneNumber', this.app.business.contacts[0].phone);
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
        // </InsuredOrPrincipal

        // <CommlPolicy>
        const CommlPolicy = WorkCompPolicyQuoteInqRq.ele('CommlPolicy');
        CommlPolicy.ele('ControllingStateProvCd', this.app.business.primary_territory);
        CommlPolicy.ele('com.afg_TotalEmployees', this.get_total_employees());

        // <ContractTerm>
        const ContractTerm = CommlPolicy.ele('ContractTerm');
        ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
        ContractTerm.ele('ExpirationDt', this.policy.expiration_date.format('YYYY-MM-DD'));
        // </ContractTerm>

        // <CommlPolicySupplement>
        const CommlPolicySupplement = CommlPolicy.ele('CommlPolicySupplement');
        CommlPolicySupplement.ele('OperationsDesc', this.get_operation_description());

        // <LengthTimeInBusiness> They want this in years
        const LengthTimeInBusiness = CommlPolicySupplement.ele('LengthTimeInBusiness');
        LengthTimeInBusiness.ele('NumUnits', moment().diff(this.app.business.founded, 'years'));
        // </LengthTimeInBusiness>

        const has_claims = this.policy.claims.length > 0;

        CommlPolicySupplement.ele('LossDataAvailable', has_claims ? 'Y' : 'N');
        if (has_claims) {
            const claims_data = this.claims_to_policy_years();
            CommlPolicySupplement.ele('NumberClaims', this.get_num_claims(4));
            CommlPolicySupplement.ele('NumberClaims1', claims_data[1].count);
            CommlPolicySupplement.ele('NumberClaims2', claims_data[2].count);
            CommlPolicySupplement.ele('NumberClaims3', claims_data[3].count);
            CommlPolicySupplement.ele('TotalClaimAmount', this.get_total_amount_incurred_on_claims(4));
        }
        // <CommlPolicySupplement>
        // </CommlPolicy>

        this.app.business.locations.forEach((location, index) => {
            // <Location>
            const Location = WorkCompPolicyQuoteInqRq.ele('Location');
            Location.att('id', `l${index + 1}`);

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

            if (location.unemployment_number) {
                // <TaxCodeInfo>
                const TaxCodeInfo = Location.ele('TaxCodeInfo');
                TaxCodeInfo.ele('TaxCd', location.unemployment_number);
                // </TaxCodeInfo>
            }
            // </Location>
        });

        // <WorkCompLineBusiness>
        const WorkCompLineBusiness = WorkCompPolicyQuoteInqRq.ele('WorkCompLineBusiness');

        // Separate out the states
        const territories = this.app.business.getTerritories();
        territories.forEach((territory) => {
            // <WorkCompRateState>
            const WorkCompRateState = WorkCompLineBusiness.ele('WorkCompRateState');
            log.info('TO DO: Determine what we are doing on <com.afg_WorkSafeCredit> - Michigan Only - AF needs to get these rules to us');

            this.app.business.locations.forEach((location, index) => {
                // Make sure this location is in the current territory, if not, skip it
                if (location.territory !== territory) {
                    return;
                }

                // <WorkCompLocInfo>
                const WorkCompLocInfo = WorkCompRateState.ele('WorkCompLocInfo');
                WorkCompLocInfo.att('LocationRef', `l${index + 1}`);

                // Combine the activity codes
                const activityCodes = this.combineLocationActivityCodes(location);

                // Add class code information
                for (const activityCode in activityCodes) {
                    if (Object.prototype.hasOwnProperty.call(activityCodes, activityCode)) {
                        // Split up the class code
                        const classCode = activityCode.substring(0, 4);
                        const subCode = activityCode.substring(4, 6);

                        // <WorkCompRateClass>
                        const WorkCompRateClass = WorkCompLocInfo.ele('WorkCompRateClass');
                        WorkCompRateClass.ele('RatingClassificationCd', classCode);
                        // log.info('TO DO: We need to build in support for this bullshit');
                        WorkCompRateClass.ele('RatingClassificationLetter', '');
                        WorkCompRateClass.ele('RatingClassificationSubCd', subCode);
                        WorkCompRateClass.ele('Exposure', activityCodes[activityCode]);

                        // Handle class specific questions
                        const code_index = location.territory + classCode + subCode;
                        if (Object.prototype.hasOwnProperty.call(activity_codes_to_questions, code_index) && activity_codes_to_questions[code_index].length) {
                            // <ClassCodeQuestions>
                            const ClassCodeQuestions = WorkCompRateClass.ele('ClassCodeQuestions');

                            // Loop through each question
                            activity_codes_to_questions[code_index].forEach((question_id) => {
                                const question = this.questions[question_id];
                                if (!Object.prototype.hasOwnProperty.call(this.question_details, question_id)) {
                                    return;
                                }
                                const question_attributes = this.question_details[question_id].attributes;

                                // <ClassCodeQuestion>
                                const ClassCodeQuestion = ClassCodeQuestions.ele('ClassCodeQuestion');
                                ClassCodeQuestion.ele('QuestionId', question_attributes.id);
                                ClassCodeQuestion.ele('QuestionCd', question_attributes.code);

                                // Determine how to send the answer
                                if (question.type === 'Yes/No') {
                                    ClassCodeQuestion.ele('ResponseInd', question.get_answer_as_boolean() ? 'Y' : 'N');
                                } else {
                                    ClassCodeQuestion.ele('ResponseInd', question.answer);
                                }
                                // </ClassCodeQuestion>
                            });
                            // </ClassCodeQuestions>
                        }
                        // </WorkCompRateClass>
                    }
                }
                // </WorkCompLocInfo>
            });
            // </WorkCompRateState>
        });

        // <CommlCoverage>
        const CommlCoverage = WorkCompLineBusiness.ele('CommlCoverage');
        CommlCoverage.ele('CoverageCd', 'WCEL');
        CommlCoverage.ele('CoverageDesc', 'Employers Liability');

        // <Limit>
        let Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[0]);
        Limit.ele('LimitAppliesToCd', 'EachClaim');
        // </Limit>

        // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[2]);
        Limit.ele('LimitAppliesToCd', 'EachEmployee');
        // </Limit>

        // <Limit>
        Limit = CommlCoverage.ele('Limit');
        Limit.ele('FormatCurrencyAmt').ele('Amt', limits[1]);
        Limit.ele('LimitAppliesToCd', 'PolicyLimit');
        // </Limit>
        // </CommlCoverage>

        /* ---=== Begin Ineligibility and Statement Questions ===--- */

        let QuestionAnswer = null;

        // Make a list of embedded questions
        const embeddedQuestions = {};
        for (const questionId in this.questions) {
            if (Object.prototype.hasOwnProperty.call(this.questions, questionId)) {
                // Get the attributes for this question
                const questionAttributes = this.question_details[questionId].attributes;

                // Check if this is an embedded question
                if (Object.prototype.hasOwnProperty.call(questionAttributes, 'embedded') && questionAttributes.embedded === true) {
                    // Make sure we have the attributes we are expecting
                    if (Object.prototype.hasOwnProperty.call(questionAttributes, 'xml_section') && Object.prototype.hasOwnProperty.call(questionAttributes, 'code')) {
                        embeddedQuestions[`${questionAttributes.xml_section}-${questionAttributes.code}`] = this.questions[questionId];
                    } else {
                        log.error(`The AF Group embedded question "${this.question_details[questionId].identifier}" has invalid attributes.` + __location);
                    }
                }
            }
        }

        // Create one section for each Ineligibility and Statement questions
        ['Ineligibility', 'Statement'].forEach((type) => {
            // <Ineligibility/Statement>
            const root_questions_element = WorkCompLineBusiness.ele(type);

            // Loop through each question
            for (const questionId in this.questions) {
                if (Object.prototype.hasOwnProperty.call(this.questions, questionId)) {
                    // Get the attributes for this question
                    const questionAttributes = this.question_details[questionId].attributes;

                    // If this is an embedded question, skip it
                    if (Object.prototype.hasOwnProperty.call(questionAttributes, 'embedded') && questionAttributes.embedded === true) {
                        continue;
                    }

                    // Make sure we have the attributes we need, and that they match this section
                    if (Object.prototype.hasOwnProperty.call(questionAttributes, 'xml_section') && questionAttributes.xml_section === type) {
                        let answerBoolean = this.questions[questionId].get_answer_as_boolean();

                        // Swap over statement question 7, it is inversed in our system
                        if (this.question_details[questionId].identifier === 'Statement-Q7') {
                            answerBoolean = !answerBoolean;
                        }

                        // <QuestionAnswer>
                        QuestionAnswer = root_questions_element.ele('QuestionAnswer');
                        QuestionAnswer.ele('QuestionCd', this.question_details[questionId].identifier.split('-')[1]);
                        QuestionAnswer.ele('YesNoCd', answerBoolean ? 'Y' : 'N');

                        // If the answer to this question was true, and it has an embedded question, add the answer
                        if (answerBoolean && Object.prototype.hasOwnProperty.call(embeddedQuestions, this.question_details[questionId].identifier)) {
                            const embeddedQuestion = embeddedQuestions[this.question_details[questionId].identifier];

                            // If the answer was null, skip it
                            if (embeddedQuestion.answer === null) {
                                continue;
                            }

                            QuestionAnswer.ele('Explanation', embeddedQuestion.answer);
                        }
                        // </QuestionAnswer>
                    }
                }
            }
            // </Ineligibility/Statement>
        });

        /* ---=== End Ineligibility and Statement Questions ===--- */

        // </WorkCompLineBusiness>
        // </WorkCompPolicyQuoteInqRq>
        // </InsuranceSvcRq>
        // </ACORD>

        // Get the XML structure as a string
        const xml = ACORD.end({ pretty: true });

        // Determine which URL to use
        let host = '';
        let path = '';
        if (this.insurer.useSandbox) {
            host = 'npsv.afgroup.com';
            path = '/TEST_DigitalAq/rest/getworkcompquote';
        } else {
            host = 'psv.afgroup.com';
            path = '/DigitalAq/rest/getworkcompquote';
        }

        // Send the XML to the insurer
        let result = null;
        try {
            result = await this.send_xml_request(host, path, xml, {
                Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
                'Content-Type': 'application/xml'
            });
        } catch (error) {
            log.error(`${this.insurer.name} ${this.policy.type} Integration Error: ${error}` + __location);
            return this.return_result('error');
        }
        // Begin reducing the response
        let res = result.ACORD;

        // Check the status to determine what to do next
        let message_type = '';
        const status = res.SignonRs[0].Status[0].StatusCd[0];
        switch (status) {
            case 'DECLINE':
                this.log += `--------======= Application Declined =======--------<br><br>${this.insurer.name} declined to write this business`;
                this.reasons.push(`${status} - ${res.SignonRs[0].Status[0].StatusDesc[0].Desc[0]}`);
                return this.return_result(status);
            case 'UNAUTHENTICATED':
            case 'UNAUTHORIZED':
                message_type = status === 'UNAUTHENTICATED' ? 'Incorrect' : 'Locked';
                this.log += `--------======= ${message_type} Agency ID =======--------<br><br>We attempted to process a quote, but the Agency ID set for the agent was ${message_type.toLowerCase()} and no quote could be processed.`;
                log.error(`${this.insurer.name} ${this.policy.type} ${message_type} Agency ID` + __location);
                // This was a misconfiguration on the Agent's part, pick it up under the Talage agency for a better user experience
                this.reasons.push(`${status} - ${message_type} Agency ID`);
                return this.return_result('error');
            case 'ERRORED':
            case 'SMARTEDITS':
                this.log += `--------======= Application Error =======--------<br><br>${res.SignonRs[0].Status[0].StatusDesc[0].Desc[0]}`;
                log.error(`${this.insurer.name} ${this.policy.type} Integration Error(s):\n--- ${res.SignonRs[0].Status[0].StatusDesc[0].Desc[0]}` + __location);
                this.reasons.push(`${status} - ${res.SignonRs[0].Status[0].StatusDesc[0].Desc[0]}`);
                // Send notification email if we get an E Mod error back from carrier 
                if (res.SignonRs[0].Status[0].StatusDesc[0].Desc[0].toLowerCase().includes("experience mod")) {
                    wcEmodEmail.sendEmodEmail(this.app.id);
                }
                return this.return_result('error');
            case 'REFERRALNEEDED':
            case 'QUOTED':
                // This is desired, do nothing
                break;
            case 'RESERVED':
                this.log += `--------======= Application Blocked =======--------<br><br>Another agency has already quotetd this business.`;
                log.info(`${this.insurer.name} ${this.policy.type} Application Blocked (business already quoted by another agency)`);
                this.reasons.push(`${status} (blocked) - Another agency has already quoted this business.`);
                return this.return_result('error');
            default:
                this.log += '--------======= Unexpected API Response =======--------';
                this.log += util.inspect(res, false, null);
                log.error(`${this.insurer.name} ${status} - Unexpected response code by API `);
                this.reasons.push(`${status} - Unexpected response code returned by API.`);
                return this.return_result('error');
        }

        // Reduce the response further
        res = res.InsuranceSvcRs[0].WorkCompPolicyAddRs[0];

        if (status === 'QUOTED') {
            // Grab the file info
            try {
                this.quote_letter = {
                    content_type: 'application/pdf',
                    data: res['com.afg_Base64PDF'][0],
                    file_name: `${this.insurer.name}_ ${this.policy.type}_quote_letter.pdf`,
                    length: res['com.afg_Base64PDF'][0].length
                };
            } catch (err) {
                log.error(`${this.insurer.name} integration error: could not locate quote letter attachments. ${__location}`);
                return this.return_result('error');
            }
        }

        // Further reduce the response
        res = res['com.afg_PDFContent'][0].CommlPolicy[0];

        // Attempt to get the policy number
        try {
            this.number = res.PolicyNumber[0];
        } catch (e) {
            log.error(`${this.insurer.name} integration error: could not locate policy number ${__location}`);
            return this.return_result('error');
        }

        // Get the amount of the quote
        if (status === 'QUOTED' || status === 'REFERRALNEEDED') {
            try {
                this.amount = parseInt(res.CurrentTermAmt[0].Amt[0], 10);
            } catch (e) {
                log.error(`${this.insurer.name} Integration Error: Quote structure changed. Unable to quote amount. `);
                return this.return_result('error');
            }
        }

        // Set the limits info
        this.limits[1] = limits[0];
        this.limits[2] = limits[1];
        this.limits[3] = limits[2];

        // Send the result of the request
        return this.return_result(status);
    }
};
