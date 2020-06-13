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
const Integration = require('../Integration.js');

module.exports = class LibertyWC extends Integration{

	/**
	 * Requests a quote from Liberty and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	_insurer_quote(){

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

		return new Promise(async(fulfill) => {

			// Liberty has us define our own Request ID
			this.request_id = this.generate_uuid();

			// Establish the current time
			const now = moment_timezone.tz('America/Los_Angeles');

			// Prepare limits
			const limits = this.getBestLimits(carrierLimits);
			if(!limits){
				this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
				fulfill(this.return_result('autodeclined'));
				return;
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
								ProducerInfo.ele('ContractNumber', process.env.NODE_ENV === 'production' ? this.app.agencyLocation.insurers[this.insurer.id].agency_id : '4689905').att('SourceSystemRef', 'Talage');
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
										TaxIdentity.ele('TaxId', this.app.business.locations[0].identification_number);
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
							Policy.ele('LOBCd', 'WORK');
							Policy.ele('ControllingStateProvCd', this.app.business.primary_territory);

							if(this.policy.claims.length){
								for(const claim_index in this.policy.claims){
									if(Object.prototype.hasOwnProperty.call(this.policy.claims, claim_index)){
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

								if(this.app.business.years_of_exp){
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
							for(const question_id in this.questions){
								if(Object.prototype.hasOwnProperty.call(this.questions, question_id)){
									const question = this.questions[question_id];
									const QuestionCd = this.question_identifiers[question.id];

									/**
									 * Don't process questions:
									 *  - without a code (not for this insurer)
									 *  - coded questions (one that has a structure hard-coded elsehwere in this file)
									 */
									if(!QuestionCd || codedQuestionsByIdentifier.includes(QuestionCd)){
										continue;
									}

									// For Yes/No questions, if they are not required and the user answered 'No', simply don't send them
									if(question.type === 'Yes/No' && !question.hidden && !question.required && !question.get_answer_as_boolean()){
										continue;
									}

									// Get the answer
									let answer = '';
									try{
										answer = this.determine_question_answer(question);
									}
catch(error){
										this.reasons.push('Talage was unable to determine the answer to a question');
										fulfill(this.return_result('error'));
										return;
									}

									// This question was not answered
									if(!answer){
										continue;
									}

									// Build out the question structure
									QuestionAnswer = Policy.ele('QuestionAnswer');
										QuestionAnswer.ele('QuestionCd', QuestionCd);

									if(question.type === 'Yes/No'){
										let boolean_answer = question.get_answer_as_boolean() ? 'YES' : 'NO';

										// For the question GENRL06, flip the answer
										if(QuestionCd === 'GENRL06'){
											boolean_answer = !boolean_answer;
										}

										QuestionAnswer.ele('YesNoCd', boolean_answer);
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
								if(loc.address2){
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
						territories.forEach((territory) => {

							// <WorkCompRateState>
							const WorkCompRateState = WorkCompLineBusiness.ele('WorkCompRateState');
								WorkCompRateState.ele('StateProvCd', territory);

							this.app.business.locations.forEach((location, index) => {
								// Make sure this location is in the current territory, if not, skip it
								if(location.territory !== territory){
									return;
								}

								// <WorkCompLocInfo>
								const WorkCompLocInfo = WorkCompRateState.ele('WorkCompLocInfo');
									WorkCompLocInfo.att('LocationRef', `l${index + 1}`);

									location.activity_codes.forEach((activity_code) => {
										// <WorkCompRateClass>
										const WorkCompRateClass = WorkCompLocInfo.ele('WorkCompRateClass');
											WorkCompRateClass.att('InsuredOrPrincipalRef', InsuredOrPrincipalUUID);

											WorkCompRateClass.ele('RatingClassificationCd', this.insurer_wc_codes[location.territory + activity_code.id]);
											WorkCompRateClass.ele('Exposure', activity_code.payroll);
										// </WorkCompRateClass>
									});
								// </WorkCompLocInfo>
							});
							// </WorkCompRateState>
						});

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

							// Loop through each of the special questions separated by identifier and print them here (all are boolean)
							for(const index in codedQuestionsByIdentifier){
								if(Object.prototype.hasOwnProperty.call(codedQuestionsByIdentifier, index)){
									const identifier = codedQuestionsByIdentifier[index];
									const question = this.get_question_by_identifier(identifier);
									if(question){
										// <QuestionAnswer>
										QuestionAnswer = WorkCompLineBusiness.ele('QuestionAnswer');
											QuestionAnswer.ele('QuestionCd', identifier);
											QuestionAnswer.ele('YesNoCd', question.get_answer_as_boolean() ? 'YES' : 'NO');
										// </QuestionAnswer>
									}
								}
							}
						// </WorkCompLineBusiness>
					// </PolicyRq>
				// </InsuranceSvcRq>
			// </ACORD>

			// Get the XML structure as a string
			const xml = ACORD.end({'pretty': true});

			// Determine which URL to use
			const host = 'ci-policyquoteapi.libertymutual.com';
			const path = `/v1/quotes?partnerID=${this.username}`;

			// Send the XML to the insurer
			await this.send_xml_request(host, path, xml, {'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`}).then((result) => {
				// Parse the various status codes and take the appropriate action
				let res = result.ACORD;

				// Check that there was success at the root level
				if(res.Status[0].StatusCd[0] !== '0'){
					this.reasons.push(`Insurer's API Responded With Status ${res.Status[0].StatusCd[0]}: ${res.Status[0].StatusDesc[0]}`);
					fulfill(this.return_result('error'));
					return;
				}

				// Refine our selector
				res = res.InsuranceSvcRs[0].PolicyRs[0];

				// If the status wasn't success, stop here
				if(res.MsgStatus[0].MsgStatusCd[0] !== 'SuccessWithInfo'){

					// Check if this was an outage
					if(res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0].indexOf('services being unavailable') >= 0){
						this.reasons.push(`${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0]}`);
						fulfill(this.return_result('outage'));
						return;
					}

					// This was some other sort of error
					this.reasons.push(`${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusCd[0]}: ${res.MsgStatus[0].ExtendedStatus[0].ExtendedStatusDesc[0]}`);
					fulfill(this.return_result('error'));
					return;
				}

				// Get the status from the insurer
				const status = res.Policy[0].QuoteInfo[0].UnderwritingDecisionInfo[0].SystemUnderwritingDecisionCd[0];
				if(status !== 'Accept'){
					this.indication = true;
				}

				// Attempt to get the quote number
				try{
					this.request_id = res.Policy[0].QuoteInfo[0].CompanysQuoteNumber[0];
				}catch(e){
					log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find quote number.`+ __location);
				}

				// Attempt to get the amount of the quote
				try{
					this.amount = parseInt(res.Policy[0].QuoteInfo[0].InsuredFullToBePaidAmt[0].Amt[0], 10);
				}catch(e){
					// This is handled in return_result()
				}

				// Attempt to get the reasons
				try{
					// Capture Reasons
					res.Policy[0].QuoteInfo[0].UnderwritingDecisionInfo[0].UnderwritingRuleInfo[0].UnderwritingRuleInfoExt.forEach((rule) => {
						this.reasons.push(`${rule['com.libertymutual.ci_UnderwritingDecisionName']}: ${rule['com.libertymutual.ci_UnderwritingMessage']}`);
					});
				} catch(e){
					if(status === 'Reject'){
						log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find reasons.`+ __location);
					}
				}

				// Grab the limits info
				try{
					res.WorkCompLineBusiness[0].Coverage.forEach((coverageBlock) => {
						if(coverageBlock.CoverageCd[0] === 'EL'){
							coverageBlock.Limit.forEach((limit) => {
								switch(limit.LimitAppliesToCd[0]){
									case 'BIEachOcc':
										this.limits[1] = limit.FormatCurrencyAmt[0].Amt[0];
										break;
									case 'DisEachEmpl':
										this.limits[2] = limit.FormatCurrencyAmt[0].Amt[0];
										break;
									case 'DisPol':
										this.limits[3] = limit.FormatCurrencyAmt[0].Amt[0];
										break;
									default:
										log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Unexpected limit found in response`+ __location);
										break;
								}
							});
						}
					});
				}
catch(e){
					// This is handled in return_result()
				}

				// Send the result of the request
				fulfill(this.return_result(status));
			}).catch(() => {
				log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to connect to insurer.`);
				fulfill(this.return_result('error'));
			});
		});
	}
};