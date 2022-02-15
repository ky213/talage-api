/* eslint-disable object-curly-newline */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * General Liability Policy Integration for Liberty
 */

'use strict';

const builder = require('xmlbuilder');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
const paymentPlanSVC = global.requireShared('./services/paymentplansvc');
global.requireShared('./helpers/tracker.js');
const {getLibertyOAuthToken, getLibertyQuoteProposal} = require('./api');

module.exports = class LibertyGL extends Integration{

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;

        this.requiresProductPolicyTypeFilter = true;
        this.policyTypeFilter = 'GL';
    }

	/**
	 * Requests a quote from Liberty and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	async _insurer_quote(){
        const appDoc = this.applicationDocData

		// These are the statuses returned by the insurer and how they map to our Talage statuses
		this.possible_api_responses.Accept = 'quoted';
		this.possible_api_responses.Refer = 'referred';
		this.possible_api_responses.Reject = 'declined';

		// These are the limits supported by Liberty
		const carrierLimits = [
			'500000/1000000/1000000',
			'1000000/1000000/1000000',
			'1000000/2000000/1000000',
			'1000000/2000000/2000000'
		];

		// // The structure for these questions were hard coded into the request and should not be asked with the general class specific questions
		// const codedQuestionsByIdentifier = [
		// 	'CCP123',
		// 	'UWQ5944',
		// 	'UWQ5943',
		// 	'UWQ5946'
		// ];
		// const codedQuestionsById = [
		// 	'1306',
		// 	'1307',
		// 	'1308',
		// 	'1309'
		// ];

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

        const logPrefix = `Liberty Mutual GL (Appid: ${this.app.id}): `;

        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        if(!limits){
            log.warn(`${logPrefix}autodeclined: no limits  ${this.insurer.name} does not support the requested liability limits ` + __location)
            this.reasons.push(`Insurer does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // Check Industry Code Support
        if(!this.industry_code.cgl){
            log.error(`${logPrefix}Talage does not have a CGL set for Industry code ${this.industry_code.id}.` + __location)
            this.reasons.push(`Talage does not have a CGL set for Industry code ${this.industry_code.id}.`);
            return this.return_result('autodeclined');
        }

        // Liberty requires a 'premiumBasis' be set for every code
        if(!this.industry_code.attributes){
            log.error(`${logPrefix}Talage is missing required attributes for Industry Code ${this.industry_code.id}. Check the insurer's data for updates.` + __location);
            this.reasons.push(`Talage is missing required attributes for Industry Code ${this.industry_code.id}. Check the insurer's data for updates.`);
            return this.return_result('error');
        }
        if(!Object.prototype.hasOwnProperty.call(this.industry_code.attributes, 'premiumBasis')){
            log.error(`${logPrefix}Talage is missing a required attribute of 'premiumBasis' for Industry Code ${this.industry_code.id}. Check the insurer's data for updates.` + __location)
            this.reasons.push(`Talage is missing a required attribute of 'premiumBasis' for Industry Code ${this.industry_code.id}. Check the insurer's data for updates.`);
            return this.return_result('autodeclined');
        }

        // for EIN
        if (!appDoc.ein) {
            log.warn(`${logPrefix}Insurer requires FEIN for GL. ${__location}`)
            this.reasons.push(`Insurer requires FEIN for GL.`);
            return this.return_result('error');
        }

        // Liberty has us define our own Request ID
        this.request_id = this.generate_uuid();

        // Establish the current time
        const now = moment_timezone.tz('America/Los_Angeles');

        // Build the XML Request

        log.info('TO DO: Determine if Liberty supports deductible (currently ignored)');

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
                                if(this.app.business.mailing_address2){
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
                        Policy.ele('LOBCd', 'CGL');
                        Policy.ele('ControllingStateProvCd', this.app.business.primary_territory);

                        // <ContractTerm>
                        const ContractTerm = Policy.ele('ContractTerm');
                            ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));
                        // </ContractTerm>

                        // <PolicySupplement>
                        const PolicySupplement = Policy.ele('PolicySupplement');
                            PolicySupplement.ele('NumEmployees', this.get_total_employees());

                            // <AnnualSalesAmt>
                            const AnnualSalesAmt = PolicySupplement.ele('AnnualSalesAmt');
                                AnnualSalesAmt.ele('Amt', this.policy.gross_sales);
                            // </AnnualSalesAmt>

                            // Pull out the insurer question identifiers for easy reference
                            const insurer_question_identifiers = Object.values(this.question_identifiers);

                            // Gross Receipts
                            let AnnualGrossReceiptsAmt = null;
                            let GrossReceipts = null;

                            const gross_receipt_questions = {
                                'BOP482': 'OFFPR', // Off-premises
                                'BOP52': 'AMMFIRE', // Ammunition and firearms
                                'BOP63': 'ADULT', // Adult materials
                                'BOP82': 'FUEL', // Gasoline
                                'CCP129': 'SVCLP', // Liquefied petroleum gas
                                'CCP178': 'USETIRES', // Used tires
                                'CCP86': 'SUBCNTRT', // Subcontracted work
                                'UWQ141': 'APPLIN', // Washing machine, diswasher, and icemaker installation
                                'UWQ147': 'FOODTRK', // Food trucks or carts
                                'UWQ5301': 'LIQUR' // Alcohol
                            };

                            // Process each possible gross receipts question
                            for(const question_identifier in gross_receipt_questions){

                                // Check whether or not this question was included in the application
                                if(insurer_question_identifiers.includes(question_identifier)){
                                    // <GrossReceipts>
                                    GrossReceipts = PolicySupplement.ele('GrossReceipts');
                                        GrossReceipts.ele('OperationsCd', gross_receipt_questions[question_identifier]);

                                        // <AnnualGrossReceiptsAmt>
                                        AnnualGrossReceiptsAmt = GrossReceipts.ele('AnnualGrossReceiptsAmt');
                                            AnnualGrossReceiptsAmt.ele('Amt', this.questions[this.get_key_by_value(this.question_identifiers, question_identifier)].answer);
                                        // </AnnualGrossReceiptsAmt>
                                    // </GrossReceipts>
                                }
                            }

                            const policySupplementQuestions = [];
                            // const question_attributes = {};
                            // let had_error = false;
                            // // Get the question attributes
                            // const query = {
                            //         "insurerId": this.insurer.id,
                            //         "policyType": this.policy.type,
                            //         "talageQuestionId": {$in: Object.keys(this.questions)}
                            // }
                            // const InsurerQuestionModel = global.mongoose.InsurerQuestion;
                            // const insurerQuestionList = await InsurerQuestionModel.find(query).catch((error) => {
                            //     log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} is unable to get question attributes. ${error}` + __location);
                            //     this.reasons.push('System error - Unable to get question attributes');
                            //     had_error = true;
                            // });
                            // if(had_error){
                            //     fulfill(this.return_result('error'));
                            //     return;
                            // }
                            // insurerQuestionList.forEach((insurerQuestion) => {
                            //     if(insurerQuestion.attributes){
                            //         question_attributes[insurerQuestion.talageQuestionId] = insurerQuestion.attributes;
                            //     }
                            // });

                            //for(const question_id in this.questions){
                            for(const insurerQuestion of this.insurerQuestionList){
                                if(Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)){
                                    const question = this.questions[insurerQuestion.talageQuestionId];
                                    if(!question){
                                        continue;
                                    }
                                    // Find the attributes for this question
                                    const attributes = insurerQuestion.attributes;
                                    if(typeof attributes === 'object'){
                                        // Make sure the question has the appropriate attributes
                                        if(Object.prototype.hasOwnProperty.call(attributes, 'Underwriting Question Code')){
                                            if(insurerQuestion.identifier === attributes['Underwriting Question Code']){
                                                if(Object.prototype.hasOwnProperty.call(attributes, 'XML Path')){
                                                    question['XML Path'] = attributes['XML Path'];
                                                    policySupplementQuestions.push(question);
                                                }
                                                else{
                                                    log.warn(`${logPrefix}Encountered an error. Insurer question missing required XML Path attribute. (Insurer Question ${insurerQuestion.identifier})` + __location);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Support for Years of Experience (required if business is under 3 years old)
                            if(this.app.business.years_of_exp){
                                policySupplementQuestions.push({
                                    'XML Path': 'com.libertymutual.ci_NumYrsManagementExperience',
                                    'answer': this.app.business.years_of_exp
                                });
                            }

                            if(policySupplementQuestions.length){
                            // <PolicySupplementExt>
                            const PolicySupplementExt = PolicySupplement.ele('PolicySupplementExt');
                                policySupplementQuestions.forEach((question) => {
                                    PolicySupplementExt.ele(question['XML Path'], question.answer);
                                });
                            // </PolicySupplementExt>
                            }
                        // </PolicySupplement>

                        // Handle some questions that are answered by other elements of our system separately

                        // Year Business Started
                        // <QuestionAnswer>
                        let QuestionAnswer = Policy.ele('QuestionAnswer');
                            QuestionAnswer.ele('QuestionCd', 'BOP1');
                            QuestionAnswer.ele('YesNoCd', 'NA');
                            QuestionAnswer.ele('Explanation', this.app.business.founded.format('YYYY'));
                        // </QuestionAnswer>

                        // Loop through each question
                        //for(const question_id in this.questions){
                        for(const insurerQuestion of this.insurerQuestionList){
                            if(Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)){
                                const question = this.questions[insurerQuestion.talageQuestionId];
                                if(!question){
                                    continue;
                                }

                                /** Don't process questions:
                                 *  - without a code (not for this insurer)
                                 *  - coded questions (one that has a structure hard-coded elsehwere in this file)
                                 */
                                // if(!insurerQuestion.identifier || codedQuestionsById.includes(question.id) || codedQuestionsByIdentifier.includes(insurerQuestion.identifier)){
                                // 	continue;
                                // }

                                if(!insurerQuestion.identifier){
                                    continue;
                                }

                                // For Yes/No questions, if they are not required and the user answered 'No', simply don't send them
                                // if(question.type === 'Yes/No' && !question.required && !question.get_answer_as_boolean()){
                                // 	continue;
                                // }

                                // Get the answer
                                let answer = '';
                                try{
                                    answer = this.determine_question_answer(question);
                                }
                                catch(error){
                                    log.error(`${logPrefix}Could not determine question ${insurerQuestion.talageQuestionId} answer: ${error} ${__location}`);
                                    //this.reasons.push('Talage was unable to determine the answer to a question');
                                    //fulfill(this.return_result('error'));
                                    //return;
                                }

                                // This question was not answered
                                if(!answer){
                                    continue;
                                }

                                // Build out the question structure
                                QuestionAnswer = Policy.ele('QuestionAnswer');
                                    QuestionAnswer.ele('QuestionCd', insurerQuestion.identifier);

                                if(question.type === 'Yes/No'){
                                    QuestionAnswer.ele('YesNoCd', question.get_answer_as_boolean() ? 'YES' : 'NO');
                                }
                                else{
                                    // Other Question Type
                                    QuestionAnswer.ele('YesNoCd', 'NA');

                                    // Check if the answer is a number
                                    if(/^\d+$/.test(answer)){
                                        QuestionAnswer.ele('Num', answer);
                                    }
                                    else{
                                        QuestionAnswer.ele('Explanation', answer);
                                    }
                                }
                            }
                        }

                        const LossQuestionAnswer = Policy.ele('QuestionAnswer');

                        LossQuestionAnswer.ele('QuestionCd','LMGENRL649');
                        LossQuestionAnswer.ele('YesNoCd', 'NO');


                    // </Policy>

                    this.app.business.locations.forEach((loc, index) => {
                    // <Location>
                    const Location = PolicyRq.ele('Location');
                        Location.att('id', `l${index + 1}`);

                        Addr = Location.ele('Addr');
                            Addr.ele('Addr1', loc.address.substring(0, 30));
                            if(loc.address2){
                                Addr.ele('Addr2', loc.address2.substring(0, 30));
                            }
                            Addr.ele('City', loc.city);
                            Addr.ele('StateProvCd', loc.territory);
                            Addr.ele('PostalCode', loc.zip);
                    // </Location>
                    });

                    // <GeneralLiabilityLineBusiness id="GAu8UERc4fAx5v9revpb1A">
                    const GeneralLiabilityLineBusiness = PolicyRq.ele('GeneralLiabilityLineBusiness');
                        GeneralLiabilityLineBusiness.att('id', this.generate_uuid());
                        GeneralLiabilityLineBusiness.ele('LOBCd', 'CGL');

                        // <LiabilityInfo LocationRef="Wc3a968def7d94ae0acdabc4d95c34a86W">
                        const LiabilityInfo = GeneralLiabilityLineBusiness.ele('LiabilityInfo');

                            // <CommlCoverage>
                            const CommlCoverage = LiabilityInfo.ele('CommlCoverage');
                                CommlCoverage.ele('CoverageCd', 'GO');

                                // Per Occurance Limit
                                let Limit = CommlCoverage.ele('Limit');
                                    Limit.ele('LimitAppliesToCd', 'PerOcc');
                                    Limit.ele('FormatCurrencyAmt').ele('Amt', limits[0]);

                                // Aggregate Limit
                                Limit = CommlCoverage.ele('Limit');
                                    Limit.ele('LimitAppliesToCd', 'Aggregate');
                                    Limit.ele('FormatCurrencyAmt').ele('Amt', limits[1]);


                                // Products and Completed Operations Limit
                                Limit = CommlCoverage.ele('Limit');
                                    Limit.ele('LimitAppliesToCd', 'ProductsCompletedOperations');
                                    Limit.ele('FormatCurrencyAmt').ele('Amt', limits[2]);
                            // </CommlCoverage>

                        this.app.business.locations.forEach((loc, index) => {
                            // <GeneralLiabilityClassification LocationRef="Wc3a968def7d94ae0acdabc4d95c34a86W" InsuredOrPrincipalRef="ABCD">
                            const GeneralLiabilityClassification = LiabilityInfo.ele('GeneralLiabilityClassification');
                                GeneralLiabilityClassification.att('LocationRef', `l${index + 1}`);
                                GeneralLiabilityClassification.att('InsuredOrPrincipalRef', InsuredOrPrincipalUUID);
                                GeneralLiabilityClassification.ele('ClassCd', this.industry_code.cgl);

                                // <ExposureInfo>
                                const ExposureInfo = GeneralLiabilityClassification.ele('ExposureInfo');

                                    // Determine the appropriate exposure amount
                                    let exposure = 0;
                                    switch(this.industry_code.attributes.premiumBasis){
                                        case 'Acre(s)':
                                            exposure = this.questions['1307'].answer;
                                            break;
                                        case 'Dollars Of Gross Sales':
                                            exposure = this.policy.gross_sales;
                                            break;
                                        case 'Dollars Of Payroll':
                                            exposure = this.get_total_payroll();
                                            break;
                                        case 'Gallon(s)':
                                            exposure = this.questions['1306'].answer;
                                            break;
                                        case 'Member(s)':
                                            exposure = this.questions['1308'].answer;
                                            break;
                                        case 'Square Feet Of Area':
                                            exposure = this.get_total_square_footage();
                                            break;
                                        case 'Unit(s)':
                                            exposure = this.questions['1309'].answer;
                                            break;
                                        default:
                                            this.reasons.push(`Encountered unsupported premium basis of ${this.industry_code.attributes.premiumBasis}`);
                                            return this.return_result('error');
                                    }
                                    if(!exposure || exposure <= 0){
                                        this.reasons.push(`Bad exposure amount (less than or equal to 0) in application`);
                                        return this.return_result('error');
                                    }
                                    ExposureInfo.ele('Exposure', Math.round(exposure / this.app.business.locations.length));
                                    // <ExposureInfoExt>
                                    const ExposureInfoExt = ExposureInfo.ele('ExposureInfoExt');
                                        ExposureInfoExt.ele('com.libertymutual.ci_EmployeeRemunerationCategoryCd', 'Empl'); // Per Liberty, this is required and set to EMPL
                                    // </ExposureInfoExt>
                                // </ExposureInfo>
                            // </GeneralLiabilityClassification>
                        });
                        // </LiabilityInfo>

                        // <GeneralLiabilityLineBusinessExt>
                        const GeneralLiabilityLineBusinessExt = GeneralLiabilityLineBusiness.ele('GeneralLiabilityLineBusinessExt');

                            // CCP123 - What is the insureds percent of work in or around hospitals?
                            const CCP123 = this.get_question_by_identifier('CCP123');
                            if(CCP123){
                                GeneralLiabilityLineBusinessExt.ele('com.libertymutual.ci_SalesFromWorkDoneAroundHospitalsPct', CCP123.answer);
                            }

                            // UWQ5944 - What percent of Applicants business is cleaning of kitchen flues or hoods?
                            const UWQ5944 = this.get_question_by_identifier('UWQ5944');
                            if(UWQ5944){
                                GeneralLiabilityLineBusinessExt.ele('com.libertymutual.ci_SalesFromCleaningKitchenFluesHoodsPct', UWQ5944.answer);
                            }

                            // UWQ5943 - What percent of Applicants business is for construction site clean up & debris removal?
                            const UWQ5943 = this.get_question_by_identifier('UWQ5943');
                            if(UWQ5943){
                                GeneralLiabilityLineBusinessExt.ele('com.libertymutual.ci_SalesFromConstructionSiteCleanUpDebrisRemovalPct', UWQ5943.answer);
                            }
                        // </GeneralLiabilityLineBusinessExt>
                    // </GeneralLiabilityLineBusiness>

                    log.info('TO DO: Determine when the following block should be sent');

                    /* // <LocationUWInfo id="6ebc57658a0b46a1ba834f93b7ed6a8a">
                    const LocationUWInfo = PolicyRq.ele('LocationUWInfo');
                        LocationUWInfo.att('id', this.generate_uuid());

                        // UWQ5946 - What percent of Applicants business is for installation of ceramic floor covering material?
                        // <GrossReceipts>
                        GrossReceipts = LocationUWInfo.ele('GrossReceipts');
                            GrossReceipts.ele('OperationsCd', 'CERMCFLR');

                            // <AnnualGrossReceiptsAmt>
                            AnnualGrossReceiptsAmt = GrossReceipts.ele('AnnualGrossReceiptsAmt');
                                AnnualGrossReceiptsAmt.ele('Amt', 0); // TO DO: Show answer
                            // </AnnualGrossReceiptsAmt>
                        // </GrossReceipts>
                    // </LocationUWInfo>*/
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
        if(res.Status[0].StatusCd[0] !== '0'){
            this.reasons.push(`Insurer's API Responded With Status ${res.Status[0].StatusCd[0]}: ${res.Status[0].StatusDesc[0]}`);
            return this.return_result('error');
        }

        // Refine our selector
        res = res.InsuranceSvcRs[0].PolicyRs[0];

        // If the status wasn't success, stop here
        if(res.MsgStatus[0].MsgStatusCd[0] !== 'SuccessWithInfo'){
            // Check if this was an outage
            if(res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0].indexOf('services being unavailable') >= 0){
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
            this.reasons.push(`${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusCd[0]}: ${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0]}`);
            return this.return_result('error');
        }

        // Get the status from the insurer
        const status = res.Policy[0].QuoteInfo[0].UnderwritingDecisionInfo[0].SystemUnderwritingDecisionCd[0];
        if(status !== 'Accept'){
            this.indication = true;
        }

        // Attempt to get the quote number
        try {
            this.number = res.Policy[0].QuoteInfo[0].CompanysQuoteNumber[0];
        }
        catch(e){
            log.warn(`${logPrefix}Integration Error: Quote structure changed. Unable to find quote number. ${__location}`);
        }

        let quoteProposalId = null;
        try {
            quoteProposalId = res.Policy[0].PolicyExt[0]['com.libertymutual.ci_QuoteProposalId'];
        }
        catch (e) {
            log.warn(`${logPrefix}Integration Error: Quote structure changed. Unable to find quote proposal number. ${__location}`);
        }

        // Attempt to get the amount of the quote
        if (status !== 'Reject') {
            try{
                this.amount = parseInt(res.Policy[0].QuoteInfo[0].InsuredFullToBePaidAmt[0].Amt[0], 10);
            }
            catch(e){
                // This is handled in return_result()
            }
        }

        // Attempt to grab the limits info
        try{
            let limit_set = '';
            res.GeneralLiabilityLineBusiness[0].LiabilityInfo[0].Coverage.forEach((coverage_obj) => {
                if(coverage_obj.CoverageCd[0] === 'GO'){
                    limit_set = coverage_obj.Limit;
                }
            });

            limit_set.forEach((limit_obj) => {
                const limit = parseInt(limit_obj.FormatCurrencyAmt[0].Amt[0],10);
                switch(limit_obj.LimitAppliesToCd[0]){
                    case 'Aggregate':
                        this.limits[8] = limit;
                        break;
                    case 'FireDam':
                        this.limits[5] = limit;
                        break;
                    case 'Medical':
                        this.limits[6] = limit;
                        break;
                    case 'PerOcc':
                        this.limits[4] = limit;
                        break;
                    case 'PersInjury':
                        this.limits[7] = limit;
                        break;
                    case 'ProductsCompletedOperations':
                        this.limits[9] = limit;
                        break;
                    default:
                        log.warn(`${logPrefix}Integration Error: Unexpected limit found in response` + __location);
                        break;
                }
            });
        }
        catch(e){
            // This is handled in return_result()
        }

        //find payment plans
        const insurerPaymentPlans =
          res.Policy[0]?.QuoteInfo[0]?.QuoteInfoExt[0]?.PaymentOption?.map(
            ({$, ...rest}) => ({
              PaymentRule: $['com.libertymutual.ci_PaymentRuleInfoRefs'],
              ...rest
            })
          )
        log.info('insurer payment plans result --> '+insurerPaymentPlans[0])
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

        // Attempt to get the reasons
        try{
            // Capture Reasons
            res.Policy[0].QuoteInfo[0].UnderwritingDecisionInfo[0].UnderwritingRuleInfo[0].UnderwritingRuleInfoExt.forEach((rule) => {
                this.reasons.push(`${rule['com.libertymutual.ci_UnderwritingDecisionName']}: ${rule['com.libertymutual.ci_UnderwritingMessage']}`);
            });
        }
        catch(e){
            if(status === 'Reject'){
                log.warn(`${logPrefix}Integration Error: Quote structure changed. Unable to find reasons.` + __location);
            }
        }

        // Send the result of the request
        return this.return_result(status);
	}
};
