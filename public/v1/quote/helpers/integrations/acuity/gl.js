/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * General Liability for Acuity
 */

'use strict';

const builder = require('xmlbuilder');
const moment = require('moment');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

module.exports = class AcuityGL extends Integration {
	/**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	_insurer_quote() {

		// These are the limits supported by Acuity
		const carrierLimits = ['100000/500000/100000',
'500000/500000/500000',
'500000/1000000/500000',
'1000000/1000000/1000000'];

		// Define how corporation types are mapped for Acuity
		const corporationTypeMatrix = {
			c: 'SC',
			n: 'CN',
			s: 'SS'
		};

		// Define how legal entities are mapped for Acuity
		const entityMatrix = {
			Association: 'AS',
			Corporation: 'CP',
			'Limited Liability Company': 'LLC',
			'Limited Partnership': 'LP',
			Partnership: 'PT',
			'Sole Proprietorship': 'IN'
		};

		// These are special questions that are not handled the same as other class questions. They will be skipped when generating QuestionAnswer values.
		// They are likely that they are hard-coded in below somewhere
		const skipQuestions = [1036, 1037];

		// Build the Promise
		return new Promise(async(fulfill) => {
			// Check Industry Code Support
			if (!this.industry_code.cgl) {
				log.error(`${this.insurer.name} ${this.policy.type} Integration File: CGL not set for Industry Code ${this.industry_code.id} ` + __location);
				fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
				return;
			}

			// Prepare limits
			const limits = this.getBestLimits(carrierLimits);
			if (!limits) {
                log.warn(`autodeclined: no limits  ${this.insurer.name} ${this.policy.type} ${this.industry_code.id} ` + __location)
				this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
				fulfill(this.return_result('autodeclined'));
				return;
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
			let InsuredOrPrincipal = GeneralLiabilityPolicyQuoteInqRq.ele('InsuredOrPrincipal');

			// <GeneralPartyInfo>
			GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');

			// <NameInfo>
			NameInfo = GeneralPartyInfo.ele('NameInfo');

			// <CommlName>
			NameInfo.ele('CommlName').ele('CommercialName', this.app.business.name);
			// </CommlName>

			if (!(this.app.business.entity_type in entityMatrix)) {
				log.error(`${this.insurer.name} WC Integration File: Invalid Entity Type ` + __location);
				fulfill(this.return_error('error', "We have no idea what went wrong, but we're on it"));
				return;
			}
			NameInfo.ele('LegalEntityCd', entityMatrix[this.app.business.entity_type]);

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

			// <BusinessInfo>
			const BusinessInfo = InsuredOrPrincipalInfo.ele('BusinessInfo');
			BusinessInfo.ele('NumOwners', this.app.business.num_owners);
			BusinessInfo.ele('NumEmployeesFullTime', this.get_total_full_time_employees());
			BusinessInfo.ele('NumEmployeesPartTime', this.get_total_part_time_employees());
			BusinessInfo.ele('NumMembersMangers', this.get_total_members_managers());
			// </BusinessInfo>
			// </InsuredOrPrincipalInfo>
			// </InsuredOrPrincipal>

			// <InsuredOrPrincipal>
			InsuredOrPrincipal = GeneralLiabilityPolicyQuoteInqRq.ele('InsuredOrPrincipal');

			// <GeneralPartyInfo>
			GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');

			// <NameInfo>
			NameInfo = GeneralPartyInfo.ele('NameInfo');

			// <PersonName>
			const PersonName = NameInfo.ele('PersonName');
			PersonName.ele('GivenName', this.app.business.contacts[0].first_name);
			PersonName.ele('Surname', this.app.business.contacts[0].last_name);
			// </PersonName>
			// </NameInfo>
			// </GeneralPartyInfo>
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

			// <CommlPolicySupplement>
			const CommlPolicySupplement = CommlPolicy.ele('CommlPolicySupplement');
			CommlPolicySupplement.ele('BusinessStartDt', this.app.business.founded.format('YYYY-MM-DD'));
			CommlPolicySupplement.ele('OperationsDesc', this.app.business.locations[0].activity_codes[0].description);
			CommlPolicySupplement.ele('GeneralLiabilityCd', this.industry_code.cgl);
			CommlPolicySupplement.ele('NatureBusinessCd', this.industry_code.attributes.nature_of_business_code);
			CommlPolicySupplement.ele('NumEmployees', this.get_total_employees());

			// <LengthTimeInBusiness> They want this in months
			const LengthTimeInBusiness = CommlPolicySupplement.ele('LengthTimeInBusiness');
			LengthTimeInBusiness.ele('NumUnits', moment().diff(this.app.business.founded, 'months'));
			LengthTimeInBusiness.ele('UnitMeasurementCd', 'MON');
			// </LengthTimeInBusiness>

			// <CommlPolicySupplement>

			/* ---=== Begin Questions ===--- */

			let QuestionAnswer = null;

			const question_identifiers = await this.get_question_identifiers().catch((error) => {
				log.error(`${this.insurer.name} WC is unable to get question identifiers.${error}` + __location);
				fulfill(this.return_error('error', "We have no idea what went wrong, but we're on it"));
			});

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
						fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
						return;
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

			/* ---=== Handle some special questions ===--- */

			const CGL04_answered = false;
			const CGL05_answered = false;

			/*
							If(Object.prototype.hasOwnProperty.call(this.questions, '1036') && this.questions[1036].answer_id){

								// Make sure we have an explanation
								if(!Object.prototype.hasOwnProperty.call(this.questions, '1037') || !this.questions['1037'].answer){
									log.error('Acutiy WC was unable to send leased employee information. No explanation present, although required.');
									fulfill(this.return_error('error', 'We have no idea what went wrong, but we\'re on it'));
									return;
								}

								if(this.questions['1036'].answer_id === 2603 || this.questions['1036'].answer_id === 2605){
									// <QuestionAnswer> Do you lease or borrow employees from other businesses?
									QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
										QuestionAnswer.ele('QuestionCd', 'CGL05');
										QuestionAnswer.ele('YesNoCd', 'YES');
										QuestionAnswer.ele('Explanation', this.questions['1037'].answer);
									// </QuestionAnswer>
									CGL05_answered = true;
								}

								if(this.questions['1036'].answer_id === 2604 || this.questions['1036'].answer_id === 2605){
									// <QuestionAnswer> Lease or lend employees to other businesses?
									QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
										QuestionAnswer.ele('QuestionCd', 'CGL04');
										QuestionAnswer.ele('YesNoCd', 'YES');
										QuestionAnswer.ele('Explanation', this.questions['1037'].answer);
									// </QuestionAnswer>
									CGL04_answered = true;
								}
							}
							*/

			if (!CGL04_answered) {
				// <QuestionAnswer> Lease or lend employees to other businesses?
				QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
				QuestionAnswer.ele('QuestionCd', 'CGL04');
				QuestionAnswer.ele('YesNoCd', 'NO');
				// </QuestionAnswer>
			}

			if (!CGL05_answered) {
				// <QuestionAnswer> Do you lease or borrow employees from other businesses?
				QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
				QuestionAnswer.ele('QuestionCd', 'CGL05');
				QuestionAnswer.ele('YesNoCd', 'NO');
				// </QuestionAnswer>
			}

			/* ---=== Default some questions ===--- */

			// <QuestionAnswer> Any bankruptcies, tax, or credit liens in the past 5 years?
			QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
			QuestionAnswer.ele('QuestionCd', 'com.acuity_999990013');
			QuestionAnswer.ele('YesNoCd', 'NO');
			// </QuestionAnswer>

			// <QuestionAnswer> Insured handles, treats, stores or transports hazardous material
			QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
			QuestionAnswer.ele('QuestionCd', 'WORK16');
			QuestionAnswer.ele('YesNoCd', 'NO');
			// </QuestionAnswer>

			// <QuestionAnswer> Up to how many stories does the insured work?
			QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
			QuestionAnswer.ele('QuestionCd', 'com.acuity_999990041');
			QuestionAnswer.ele('Num', 1);
			// </QuestionAnswer>

			// <QuestionAnswer> Any employees work underground?
			QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
			QuestionAnswer.ele('QuestionCd', 'com.acuity_999990042');
			QuestionAnswer.ele('YesNoCd', 'NO');
			// </QuestionAnswer>

			// <QuestionAnswer> Gaming devices on premises
			QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
			QuestionAnswer.ele('QuestionCd', 'com.acuity_999990050');
			QuestionAnswer.ele('YesNoCd', 'NO');
			// </QuestionAnswer>

			// <QuestionAnswer> Insurer operates any business not insured by Acuity
			QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
			QuestionAnswer.ele('QuestionCd', 'com.acuity_999990014');
			QuestionAnswer.ele('YesNoCd', 'NO');
			// </QuestionAnswer>

			/* ---=== Special Cases ===--- */

			// MT specific (only applies to LLCs in Montana)
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

			// PA specific (only applies to Corporations in Pensylvania that are exlcuding owners)
			if (this.app.business.corporation_type) {
				// <QuestionAnswer> Type of corporate structure
				QuestionAnswer = CommlPolicy.ele('QuestionAnswer');
				QuestionAnswer.ele('QuestionCd', 'com.acuity_WORK209');
				QuestionAnswer.ele('Explanation', corporationTypeMatrix[this.app.business.corporation_type]);
				// </QuestionAnswer>
			}
			// </CommlPolicy>

			// <Location>
			this.app.business.locations.forEach((location, index) => {
				const Location = GeneralLiabilityPolicyQuoteInqRq.ele('Location');
				Location.att('id', `L${index + 1} `);

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

				/* TO DO: That is the method for indicating multiple buildings (sublocations) that exist on the same premises (location).  The ACORD standard is a little repetitive in the case where there is only 1 building per premises, which is probably the majority of cases.
							<SubLocation id="L1S1">
								<Addr>
									<Addr1>326 S 7TH ST</Addr1>
									<City>SPRINGFIELD</City>
									<StateProvCd>IL</StateProvCd>
									<PostalCode>62701</PostalCode>
								</Addr>
							</SubLocation>
*/
			});

			// <GeneralLiabilityLineBusiness>
			const GeneralLiabilityLineBusiness = GeneralLiabilityPolicyQuoteInqRq.ele('GeneralLiabilityLineBusiness');
			GeneralLiabilityLineBusiness.ele('LOBCd', 'CGL');

			// Get the claims organized by year
			const claims_by_year = this.claims_to_policy_years();

			// Loop through all four years and send claims data
			for (let i = 1; i <= 3; i++) {
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

			// <WorkCompIndividuals>
			const WorkCompIndividuals = GeneralLiabilityLineBusiness.ele('WorkCompIndividuals');
			WorkCompIndividuals.ele('IncludedExcludedCd', this.app.business.owners_included ? 'I' : 'E');

			/*
								<NameInfo>
									<PersonName>
										<Surname>Doe</Surname>
										<GivenName>John</GivenName>
									</PersonName>
								</NameInfo>
								<QuestionAnswer>
									<QuestionCd>com.acuity_WORK215</QuestionCd>
									<QuestionText>Status</QuestionText>
									<Explanation>Active</Explanation>
								</QuestionAnswer>
								*/
			// </WorkCompIndividuals>

			// <WorkCompRateState>
			const WorkCompRateState = GeneralLiabilityLineBusiness.ele('WorkCompRateState');
			WorkCompRateState.ele('StateProvCd', this.app.business.primary_territory);

			// NCCI or File Number
			if (this.app.business.bureau_number) {
				WorkCompRateState.ele('RiskID', this.app.business.bureau_number);
			}

			if (this.app.business.experience_modifier !== 1.0) {
				// <CreditOrSurcharge>
				const CreditOrSurcharge = WorkCompRateState.ele('CreditOrSurcharge');
				CreditOrSurcharge.ele('CreditSurchargeCd', 'EXP');
				CreditOrSurcharge.ele('CreditSurchargeAmtDesc', 'Experience Modification Factor');

				// <NumericValue>
				const NumericValue = CreditOrSurcharge.ele('NumericValue');
				NumericValue.ele('FormatModFactor', this.app.business.experience_modifier);
				// </NumericValue>
				// </CreditOrSurcharge>
			}

			this.app.business.locations.forEach((location, index) => {
				// <WorkCompLocInfo>
				const WorkCompLocInfo = WorkCompRateState.ele('WorkCompLocInfo');
				WorkCompLocInfo.att('LocationRef', `L${index + 1}`);

				// Add class code information
				location.activity_codes.forEach((activity_code) => {
					// <WorkCompRateClass>
					const WorkCompRateClass = WorkCompLocInfo.ele('WorkCompRateClass');
					WorkCompRateClass.ele('RatingClassificationCd', this.insurer_wc_codes[location.territory + activity_code.id]);
					WorkCompRateClass.ele('Exposure', activity_code.payroll);
					WorkCompRateClass.ele('RatingClassificationDesc', activity_code.description);
					// </WorkCompRateClass>
				});
				// </WorkCompLocInfo>
			});
			// </WorkCompRateState>
			// <LiabilityInfo>
			const LiabilityInfo = GeneralLiabilityLineBusiness.ele('LiabilityInfo');
			// <CommlCoverage>
			const CommlCoverage = LiabilityInfo.ele('CommlCoverage');
			CommlCoverage.ele('CoverageCd', 'WCEL');
			CommlCoverage.ele('CoverageDesc', 'Policy');

			// <Limit>
			let Limit = CommlCoverage.ele('Limit');
			Limit.ele('FormatInteger', limits[0]);
			Limit.ele('LimitAppliesToCd', 'PerAcc');
			// </Limit>

			// <Limit>
			Limit = CommlCoverage.ele('Limit');
			Limit.ele('FormatInteger', limits[1]);
			Limit.ele('LimitAppliesToCd', 'DisPol');
			// </Limit>

			// <Limit>
			Limit = CommlCoverage.ele('Limit');
			Limit.ele('FormatInteger', limits[2]);
			Limit.ele('LimitAppliesToCd', 'DisEachEmpl');
			// </Limit>

			// </CommlCoverage>
			// </GeneralLiabilityLineBusiness>
			// </GeneralLiabilityPolicyQuoteInqRq>
			// </InsuranceSvcRq>
			// </ACORD>

			// Get the XML structure as a string
			const xml = ACORD.end({pretty: true});

			// Determine which URL to use
			let host = '';
			if (this.insurer.useSandbox) {
				host = 'tptest.acuity.com';
			}
 else {
				host = 'www.acuity.com';
			}
			const path = '/ws/partner/public/irate/rating/RatingService/Talage';

			// Send the XML to the insurer
			await this.send_xml_request(host, path, xml, {
				'X-IBM-Client-Id': this.username,
				'X-IBM-Client-Secret': this.password
			}).
				then((result) => {
					let res = result;

					// Check if there was an error
					if (Object.prototype.hasOwnProperty.call(res, 'errorResponse')) {
						const error_code = parseInt(res.errorResponse.httpCode, 10);
						switch (error_code) {
							case '401':
								this.log += '--------======= Authorization failed =======--------';
								log.error(`${this.insurer.name} 401 - Authorization Failed, Check Headers ` + __location);
								this.reasons.push('Unable to connect to API. Check headers.');
								fulfill(this.return_error('error', 'We are currently unable to connect to this insurer'));
								return;
							case '403':
								this.log += '--------======= Authentication Failed =======--------';
								log.error(`${this.insurer.name} 403 - Authentication Failed ` + __location);
								this.reasons.push('Unable to connect to API. Check credentials.');
								fulfill(this.return_error('error', 'We are currently unable to connect to this insurer'));
								return;
							case '500':
								this.log += '--------======= server. Error =======--------';
								log.warn(`${this.insurer.name} 500 - server. Error ` + __location);
								this.reasons.push('Insurer encountered a server error');
								fulfill(this.return_error('error', 'We are currently unable to connect to this insurer'));
								return;
							case '504':
								this.log += '--------======= Insurer Timeout Error =======--------';
								log.warn(`${this.insurer.name} 504 - Insurer Timeout Error ` + __location);
								this.reasons.push(`Insurer's system timedout (our connection was good).`);
								fulfill(this.return_error('error', 'We are currently unable to connect to this insurer'));
								return;
							default:
								this.log += '--------======= Unexpected API Error =======--------';
								log.error(`${this.insurer.name} ${error_code} - Unexpected error code from API ` + __location);
								this.reasons.push(`Unexpected HTTP error code of ${error_code} returned from API.`);
								fulfill(this.return_error('error', 'We are currently unable to connect to this insurer'));
								return;
						}
					}

					// We didn't get back an error, process the response
					let amount = 0;
					let declined = false;
					const errors = [];
					res = res.ACORD;

					// Const util = require('util');
					// Log.error(util.inspect(res.SignonRs[0]));

					// Parse the various status codes and take the appropriate action
					const status_code = parseInt(res.SignonRs[0].Status[0].StatusCd[0], 10);
					switch (status_code) {
						case 0:
							// Further refine the rersponse object
							res = res.InsuranceSvcRs[0].WorkCompPolicyQuoteInqRs[0];

							// If there are extended status messages, grab them
							if (Object.prototype.hasOwnProperty.call(res.MsgStatus[0], 'ExtendedStatus')) {
								for (const status in res.MsgStatus[0].ExtendedStatus) {
									if (Object.prototype.hasOwnProperty.call(res.MsgStatus[0].ExtendedStatus, status)) {
										errors.push(`${res.MsgStatus[0].ExtendedStatus[status]['com.acuity_ExtendedStatusType'][0]} - ${res.MsgStatus[0].ExtendedStatus[status].ExtendedStatusDesc[0]}`);

										// Check if this was a decline
										if (res.MsgStatus[0].ExtendedStatus[status].ExtendedStatusDesc[0].includes('not a market for the risk')) {
											declined = true;
										}
									}
								}
							}

							// Additional Error Checking
							switch (res.MsgStatus[0].MsgStatusCd[0]) {
								case 'Error':
									// If a decline, just stop
									if (declined) {
										this.log += '--------======= Application Declined =======--------';
										fulfill(this.return_error('declined', 'This insurer has declined to offer you coverage at this time'));
										return;
									}

									// An error other than decline
									this.log += `--------======= Application Error =======--------<br><br>${errors.join('<br>')}`;
									log.error(`${this.insurer.name} Integration Error(s):\n--- ${errors.join('\n--- ')} ` + __location);
									errors.forEach((error) => {
										this.reasons.push(error);
									});
									fulfill(this.return_error('error', "We have no idea what went wrong, but we're on it"));
									return;

								case 'Rejected':
									this.log += '--------======= Application Declined =======--------';
									fulfill(this.return_error('declined', `${this.insurer.name} has declined to offer you coverage at this time`));
									return;

								default:
									break;
							}

							switch (res.PolicySummaryInfo[0].PolicyStatusCd[0]) {
								case 'com.acuity_BindableQuoteIncompleteData':
									this.log += `--------======= Application Quoted But Was Missing Data =======--------<br><br>${errors.join('<br>')}`;
									log.info(`${this.insurer.name} is returning a quote, but indicates data is missing:\n--- ${errors.join('\n--- ')} `);
								// eslint-disable-line no-fallthrough

								case 'com.acuity_BindableQuote':
								case 'com.acuity_BindableQuoteIncompleteData': // eslint-disable-line no-duplicate-case
									// Get the amount of the quote
									try {
										amount = parseInt(res.PolicySummaryInfo[0].FullTermAmt[0].Amt[0], 10);
									}
 catch (e) {
										log.error(`${this.insurer.name} Integration Error: Quote structure changed. Unable to quote amount.` + __location);
										this.reasons.push('A quote was generated, but our API was unable to isolate it.');
										fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
										return;
									}

									// Grab the limits info
									try {
										res.GeneralLiabilityLineBusiness[0].CommlCoverage[0].Limit.forEach((limit) => {
											switch (limit.LimitAppliesToCd[0]) {
												case 'PerAcc':
													this.limits[1] = limit.FormatInteger[0];
													break;
												case 'DisEachEmpl':
													this.limits[2] = limit.FormatInteger[0];
													break;
												case 'DisPol':
													this.limits[3] = limit.FormatInteger[0];
													break;
												default:
													log.warn(`${this.insurer.name} Integration Error: Unexpected limit found in response ` + __location);
													break;
											}
										});
									}
 catch (e) {
										log.warn(`${this.insurer.name} Integration Error: Quote structure changed. Unable to find limits. ` + __location);
									}

									// Grab the file info
									try {

										/*

This section needs to be updated. The policy_info field below is no longer valid. In this case, the insurer returns a URL instead of PDF data.
We store the PDF data. What should we do here? Do we build in support for the URL or do we download the quote letter so we have it and know
it will remain available? The data and file information needs to be stored in this.quote_letter.

									policy_info.files[0].url = res.FileAttachmentInfo[0].WebsiteURL[0];

*/
									}
 catch (e) {
										log.warn(`${this.insurer.name} Integration Error: Quote structure changed. Unable to quote letter.` + __location);
									}

									this.log += `--------======= Success! =======--------<br><br>Quote: ${amount}<br>Application ID: ${this.request_id}`;
									fulfill(this.return_quote(amount));
									return;
								case 'com.acuity_NonBindableQuote':
									this.log += '--------======= Application Referred =======--------<br><br>';
									if (errors) {
										log.warn(`${this.insurer.name} referred with the following messages:\n--- ${errors.join('\n--- ')} ` + __location);
										this.log += `Referred with the following errors:<br>${errors.join('<br>')}`;
									}
									fulfill(this.return_error('referred', `${this.insurer.name} needs a little more time to make a decision`));
									return;
								default:
									this.log += `--------======= Unknown Status	=======--------<br><br>${result.response}<br><br>`;
									log.error(`${this.insurer.name} - Unexpected status code of ${res.PolicySummaryInfo[0].PolicyStatusCd[0]} from API ` + __location);
									fulfill(this.return_error('error', "We have no idea what went wrong, but we're on it"));
									return;
							}
						case 503:
							this.log += '--------======= Insurer Down =======--------<br><br>';
							log.warn(`${this.insurer.name} - Outage in insurer's system ` + __location);
							this.reasons.push(`The insurer's system was unavailable at the time of quote.`);
							fulfill(this.return_error('error', 'We are currently unable to connect to this insurer'));
							return;
						default:
							this.log += '--------======= Unexpected API Error =======--------<br><br>';
							log.error(`${this.insurer.name} - Unexpected status code of ${status_code} from API ` + __location);
							this.reasons.push(`Unknown status of '${status_code}' recieved from API`);
							fulfill(this.return_error('error', 'We are currently unable to connect to this insurer'));
					}
				}).
				catch((error) => {
					log.error(error.message + __location);
					this.reasons.push('Problem connecting to insurer');
					fulfill(this.return_error('error', "We have no idea what went wrong, but we're on it"));
				});
		});
	}
};