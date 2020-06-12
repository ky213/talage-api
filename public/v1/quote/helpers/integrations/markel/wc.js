/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Worker's Compensation Integration for Markel
 */

'use strict';


const builder = require('xmlbuilder');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');

module.exports = class MarkelWC extends Integration{

	/**
	 * Requests a quote from Markel and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	_insurer_quote(){

		// These are the statuses returned by the insurer and how they map to our Talage statuses
		this.possible_api_responses.Declined = 'declined';
		this.possible_api_responses.Incomplete = 'error';
		this.possible_api_responses.Submitted = 'referred';
		this.possible_api_responses.Quoted = 'quoted';

		// These are the limits supported by AF Group
		const carrierLimits = [
			'100000/500000/100000',
			'500000/500000/500000',
			'500000/1000000/500000',
			'1000000/1000000/1000000',
			'2000000/2000000/2000000'
		];

		// Build the Promise
		return new Promise(async(fulfill) => {
			// Check for excessive losses in DE, HI, MI, PA and VT
			const excessive_loss_states = [
				'DE',
				'HI',
				'MI',
				'PA',
				'VT'
			];

			// Prepare limits
			const limits = this.getBestLimits(carrierLimits);
			if(!limits){
				this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
				fulfill(this.return_result('autodeclined'));
				return;
			}

			// Check the number of claims
			if(excessive_loss_states.indexOf(this.app.business.primary_territory) !== -1){
				if(this.policy.claims.length > 2){
					this.reasons.push(`Too many past claims`);
					fulfill(this.return_result('autodeclined'));
					return;
				}
			}

			// Check for excessive losses in South Dakota
			if(this.app.business.primary_territory === 'SD'){
				if(this.policy.claims.length > 4){
					this.reasons.push(`Too many past claims`);
					fulfill(this.return_result('autodeclined'));
					return;
				}
			}

			// Markel has us define our own Request ID
			this.request_id = this.generate_uuid();

			// Get a timestamp for the request and format it correctly
			const timestamp = moment_timezone.tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ss');

			// Build the XML Request

			// <ACORD>
			const ACORD = builder.create('ACORD').att('xmlns', 'http://www.ACORD.org/standards/PC_Surety/ACORD1/xml/');

				// <SignonRq>
				const SignonRq = ACORD.ele('SignonRq');

					// <SignonPswd>
					const SignonPswd = SignonRq.ele('SignonPswd');

						// <CustId>
						const CustId = SignonPswd.ele('CustId');
						CustId.ele('SPName', 'com.markel');
						CustId.ele('CustLoginId', this.username);
						// </CustId>

						// <CustPswd>
						const CustPswd = SignonPswd.ele('CustPswd');
						CustPswd.ele('EncryptionTypeCd', 'NONE');
						CustPswd.ele('Pswd', this.password);
						// </CustPswd>

					// </SignonPswd>

					SignonRq.ele('ClientDt', timestamp);
					SignonRq.ele('CustLangPref', 'en-US');

					// <ClientApp>
					const ClientApp = SignonRq.ele('ClientApp');
					ClientApp.ele('Org', 'Talage Insurance');
					ClientApp.ele('Name', 'Talage');
					ClientApp.ele('Version', '2.0');
					// </ClientApp>

				// </SignonRq>

				// <InsuranceSvcRq>
				const InsuranceSvcRq = ACORD.ele('InsuranceSvcRq');
					InsuranceSvcRq.ele('RqUID', this.generate_uuid());

					// <WorkCompPolicyQuoteInqRq>
					const WorkCompPolicyQuoteInqRq = InsuranceSvcRq.ele('WorkCompPolicyQuoteInqRq');
						WorkCompPolicyQuoteInqRq.ele('RqUID', this.request_id);
						WorkCompPolicyQuoteInqRq.ele('TransactionRequestDt', timestamp);
						WorkCompPolicyQuoteInqRq.ele('CurCd', 'USD');

						// <InsuredOrPrincipal>
						const InsuredOrPrincipal = WorkCompPolicyQuoteInqRq.ele('InsuredOrPrincipal');

							// <GeneralPartyInfo>
							const GeneralPartyInfo = InsuredOrPrincipal.ele('GeneralPartyInfo');

								// <NameInfo>
								const NameInfo = GeneralPartyInfo.ele('NameInfo');

									// <CommlName>
									NameInfo.ele('CommlName').ele('CommercialName', this.app.business.name);
									// </CommlName>

									// <TaxIdentity>
									const TaxIdentity = NameInfo.ele('TaxIdentity');
										TaxIdentity.ele('TaxIdTypeCd', this.app.business.entity_type === 'Sole Proprietorship' ? 'SSN' : 'FEIN');
										TaxIdentity.ele('TaxId', this.app.business.locations[0].identification_number);
									// </TaxIdentity>

								if(this.app.business.dba){
									// <SupplementaryNameInfo>
									const SupplementaryNameInfo = NameInfo.ele('SupplementaryNameInfo');
										SupplementaryNameInfo.ele('SupplementaryNameCd', 'DBA');
										SupplementaryNameInfo.ele('SupplementaryName', this.app.business.dba);
									// </SupplementaryNameInfo>
								}
								// </NameInfo>

								// <Addr>
								const Addr = GeneralPartyInfo.ele('Addr');
									Addr.ele('Addr1', this.app.business.locations[0].address);
									if(this.app.business.locations[0].address2){
										Addr.ele('Addr2', this.app.business.locations[0].address2);
									}
									Addr.ele('City', this.app.business.locations[0].city);
									Addr.ele('StateProvCd', this.app.business.locations[0].territory);
									Addr.ele('PostalCode', this.app.business.locations[0].zip);
								// </Addr>

							// </GeneralPartyInfo>

							// <InsuredOrPrincipalInfo>
							InsuredOrPrincipal.ele('InsuredOrPrincipalInfo').ele('InsuredOrPrincipalRoleCd', 'Insured');
							// </InsuredOrPrincipalInfo>

						// </InsuredOrPrincipal>

						// <CommlPolicy>
						const CommlPolicy = WorkCompPolicyQuoteInqRq.ele('CommlPolicy');
							CommlPolicy.ele('LOBCd', 'WORK');

							// <ContractTerm>
							const ContractTerm = CommlPolicy.ele('ContractTerm');
								ContractTerm.ele('EffectiveDt', this.policy.effective_date.format('YYYY-MM-DD'));

							// </ContractTerm>

							// <CommlPolicySupplement>
							const CommlPolicySupplement = CommlPolicy.ele('CommlPolicySupplement');
								CommlPolicySupplement.ele('OperationsDesc', this.app.business.locations[0].activity_codes[0].description);
							// <CommlPolicySupplement>

						// </CommlPolicy>

						// <Location>
						this.app.business.locations.forEach(function(location, index){
							const Location = WorkCompPolicyQuoteInqRq.ele('Location');
							Location.att('id', `loc_${index + 1}`);

							// <ItemIdInfo>
							Location.ele('ItemIdInfo');
							// </ItemIdInfo>

							// <Addr>
							const LocAddr = Location.ele('Addr');
								LocAddr.ele('Addr1', location.address);
								if(location.address2){
									LocAddr.ele('Addr2', location.address2);
								}
								LocAddr.ele('City', location.city);
								LocAddr.ele('StateProvCd', location.territory);
								LocAddr.ele('PostalCode', location.zip);
							// </Addr>
						});

						// <WorkCompLineBusiness>
						const WorkCompLineBusiness = WorkCompPolicyQuoteInqRq.ele('WorkCompLineBusiness');
							WorkCompLineBusiness.ele('LOBCd', 'WORK');

							// Get the claims organized by year
							const claims_by_year = this.claims_to_policy_years();

							// Iterate through each year of claims
							for(const year in claims_by_year){
								if(year <= 4){

									// <WorkCompLossOrPriorPolicy>
									const WorkCompLossOrPriorPolicy = WorkCompLineBusiness.ele('WorkCompLossOrPriorPolicy');

										// <AnnualAmt>
										const AnnualAmt = WorkCompLossOrPriorPolicy.ele('AnnualAmt');
											AnnualAmt.ele('Amt', 0);
										// </AnnualAmt>

										WorkCompLossOrPriorPolicy.ele('EffectiveDt', claims_by_year[year].effective_date.format('YYYY-MM-DD'));
										WorkCompLossOrPriorPolicy.ele('ExpirationDt', claims_by_year[year].expiration_date.format('YYYY-MM-DD'));

										// <PaidTotalAmt>
										const PaidTotalAmt = WorkCompLossOrPriorPolicy.ele('PaidTotalAmt');
											PaidTotalAmt.ele('Amt', claims_by_year[year].amountPaid);
										// </PaidTotalAmt>

										// Markel does not support amount reserved
										WorkCompLossOrPriorPolicy.ele('NumClaims', claims_by_year[year].count);
										WorkCompLossOrPriorPolicy.ele('NumMedicalClaimsPaid', claims_by_year[year].count - claims_by_year[year].missedWork);
									// <WorkCompLossOrPriorPolicy>
								}
							}

							// Add class code information
							this.app.business.locations.forEach((location, index) => {
								location.activity_codes.forEach((activity_code) => {

									// <WorkCompRateState>
									const WorkCompRateState = WorkCompLineBusiness.ele('WorkCompRateState');

										// <WorkCompLocInfo>
										const WorkCompLocInfo = WorkCompRateState.ele('WorkCompLocInfo');
										WorkCompLocInfo.att('LocationRef', `loc_${index + 1}`);

											// <WorkCompRateClass>
											const WorkCompRateClass = WorkCompLocInfo.ele('WorkCompRateClass');
											WorkCompRateClass.ele('NumEmployeesFullTime', location.full_time_employees);
											WorkCompRateClass.ele('NumEmployeesPartTime', location.part_time_employees);
											WorkCompRateClass.ele('RatingClassificationCd', this.insurer_wc_codes[location.territory + activity_code.id]);
											WorkCompRateClass.ele('Exposure', activity_code.payroll);
											WorkCompRateClass.ele('RatingClassificationDesc', activity_code.description);
											// </WorkCompRateClass>

										// </WorkCompLocInfo>

									// </WorkCompRateState>
								});
							});

							// <CommlCoverage>
							const CommlCoverage = WorkCompLineBusiness.ele('CommlCoverage');
								CommlCoverage.ele('CoverageCd', 'INEL');

								// <Limit>
								const Limit1 = CommlCoverage.ele('Limit');
								Limit1.ele('FormatInteger', limits[0]);
								Limit1.ele('LimitAppliesToCd', 'PerAcc');
								// </Limit>

								// <Limit>
								const Limit2 = CommlCoverage.ele('Limit');
								Limit2.ele('FormatInteger', limits[1]);
								Limit2.ele('LimitAppliesToCd', 'DisPol');
								// </Limit>

								// <Limit>
								const Limit3 = CommlCoverage.ele('Limit');
								Limit3.ele('FormatInteger', limits[2]);
								Limit3.ele('LimitAppliesToCd', 'DisEachEmpl');
								// </Limit>

							// </CommlCoverage>

							/* ---=== Begin Questions ===--- */

							const unique_territories = [];
							this.app.business.locations.forEach(function(location){
								if(unique_territories.indexOf(location.territory) === -1){
									unique_territories.push(location.territory);
								}
							});

							// Loop through each question
							for(const question_id in this.questions){
								if(Object.prototype.hasOwnProperty.call(this.questions, question_id)){
									const question = this.questions[question_id];
									const QuestionCd = this.question_identifiers[question.id];

									// If there is no question code, this question is for another insurer, just move on
									if(!QuestionCd){
										continue;
									}

									// Get the answer
									let answer = '';
									try{
										answer = this.determine_question_answer(question);
									}
catch(error){
										this.reasons.push(`Unable to determine answer for question ${question.id}`);
										fulfill(this.return_result('error'));
										return;
									}

									// This question was not answered
									if(!answer && !this.universal_questions.includes(question_id)){
										continue;
									}

									// Special rules for Question 1045
									if(question_id === 1045){

										// Replace any percentages that are present
										if(typeof answer === 'string'){
											answer = answer.replace('%', '');
										}

										// Make sure the answer is numeric
										if(/^\d+$/.test(answer)){
											const answerInt = parseInt(answer, 10);

											if(answerInt < 15){
												answer = 'Less than 15';
											}
else if(answerInt < 25){
												answer = 'Greater than 15 but less than 25';
											}
else{
												answer = 'Greater than 25';
											}
										}
else{
											this.reasons.push('User provided an invalid percentage for the subcontractors question (not numeric)');
											fulfill(this.return_result('error'));
											return;
										}
									}

									// Build out the question structure
									const QuestionAnswer = WorkCompLineBusiness.ele('QuestionAnswer');
										QuestionAnswer.ele('QuestionCd', QuestionCd);

									// Determine how to send the answer
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
									// </QuestionAnswer>
								}
							}

							// <QuestionAnswer>
							const QuestionAnswerEMod = WorkCompLineBusiness.ele('QuestionAnswer');
								QuestionAnswerEMod.ele('QuestionCd', 'com.markel.uw.questions.submission.EMod');
								QuestionAnswerEMod.ele('YesNoCd', 'NA');
								QuestionAnswerEMod.ele('Explanation', this.app.business.experience_modifier);
							// </QuestionAnswer>

							// <QuestionAnswer>
							const QuestionAnswerEOS = WorkCompLineBusiness.ele('QuestionAnswer');
								QuestionAnswerEOS.ele('QuestionCd', 'com.markel.uw.questions.submission.ExposureOutsideState');
								QuestionAnswerEOS.ele('YesNoCd', 'NA');
								QuestionAnswerEOS.ele('Explanation', 'None'); // TO DO: Fix this
							// </QuestionAnswer>

							// <QuestionAnswer>
							const QuestionAnswerYWC = WorkCompLineBusiness.ele('QuestionAnswer');
								QuestionAnswerYWC.ele('QuestionCd', 'com.markel.uw.questions.submission.YearsWithWC');
								QuestionAnswerYWC.ele('YesNoCd', 'NA');
								QuestionAnswerYWC.ele('Num', this.get_years_in_business());
							// </QuestionAnswer>

							// <QuestionAnswer> Is there a labor interchange with any other business/subsidiary?
							const QuestionCGL05 = WorkCompLineBusiness.ele('QuestionAnswer');
								QuestionCGL05.ele('QuestionCd', 'CGL05');
								QuestionCGL05.ele('YesNoCd', 'NO');
							// </QuestionAnswer>

							// <QuestionAnswer> Any other insurance with this carrier?
							const QuestionGENRL22 = WorkCompLineBusiness.ele('QuestionAnswer');
								QuestionGENRL22.ele('QuestionCd', 'GENRL22');
								QuestionGENRL22.ele('YesNoCd', 'NO');
							// </QuestionAnswer>

							// <QuestionAnswer> Do/have past, present or discontinued operations involve(d) storing, treating, discharging, applying, or transporting of hazardous materials?
							const QuestionWORK16 = WorkCompLineBusiness.ele('QuestionAnswer');
								QuestionWORK16.ele('QuestionCd', 'WORK16');
								QuestionWORK16.ele('YesNoCd', 'NO');
							// </QuestionAnswer>

							// <QuestionAnswer> If the prior policy effective date's month and day different than the current policy?
							const Question1524 = WorkCompLineBusiness.ele('QuestionAnswer');
								Question1524.ele('QuestionCd', 'com.markel.uw.questions.Question1524');
								Question1524.ele('YesNoCd', 'NO');
							// </QuestionAnswer>

							// <QuestionAnswer> Any lapse in coverage?
							const Question1590 = WorkCompLineBusiness.ele('QuestionAnswer');
								Question1590.ele('QuestionCd', 'com.markel.uw.questions.Question1590');
								Question1590.ele('YesNoCd', this.policy.coverage_lapse ? 'YES' : 'NO');
							// </QuestionAnswer>

							// <QuestionAnswer> Is the applicant a member of NFIB?
							const Question1781 = WorkCompLineBusiness.ele('QuestionAnswer');
								Question1781.ele('QuestionCd', 'com.markel.uw.questions.Question1781');
								Question1781.ele('YesNoCd', 'NO');
							// </QuestionAnswer>

							// <QuestionAnswer> Are you or the insured aware of any losses in the last four years?
							const Question29 = WorkCompLineBusiness.ele('QuestionAnswer');
								Question29.ele('QuestionCd', 'com.markel.uw.questions.Question29');
								Question29.ele('YesNoCd', this.policy.claims.length ? 'YES' : 'NO');
							// </QuestionAnswer>

							// Multi-State?
							if(unique_territories.length > 1){
								// <QuestionAnswer> Does insured have any locations outside of this state?
								const Question30 = WorkCompLineBusiness.ele('QuestionAnswer');
									Question30.ele('QuestionCd', 'com.markel.uw.questions.Question30');
									Question30.ele('YesNoCd', 'YES');
								// </QuestionAnswer>

								// <QuestionAnswer> What states do they have locations in?
								const Question1551 = WorkCompLineBusiness.ele('QuestionAnswer');
									Question1551.ele('QuestionCd', 'com.markel.uw.questions.Question1551');
									Question1551.ele('YesNoCd', 'NA');
									Question1551.ele('Explanation', unique_territories.join(','));
								// </QuestionAnswer>
							}
else{
								// <QuestionAnswer> Does insured have any locations outside of this state?
								const Question30 = WorkCompLineBusiness.ele('QuestionAnswer');
									Question30.ele('QuestionCd', 'com.markel.uw.questions.Question30');
									Question30.ele('YesNoCd', 'NO');
								// </QuestionAnswer>
							}

							// <QuestionAnswer> Does the Insured have a website?
							const Question870 = WorkCompLineBusiness.ele('QuestionAnswer');
								Question870.ele('QuestionCd', 'com.markel.uw.questions.Question870');
								Question870.ele('YesNoCd', this.app.business.website ? 'YES' : 'NO');
							// </QuestionAnswer>

							if(this.app.business.website){
								// <QuestionAnswer> Website address
								const Question1041 = WorkCompLineBusiness.ele('QuestionAnswer');
									Question1041.ele('QuestionCd', 'com.markel.uw.questions.Question1041');
									Question1041.ele('YesNoCd', 'NA');
									Question1041.ele('Explanation', this.app.business.website);
								// </QuestionAnswer>
							}

							// TO DO: Move all of this! Should be handled in validation where possible

							/* ---=== Begin State Specific Questions ===--- */

							// Certified Safety Committee Notification?
							// TO DO: Document that we defaulted this

							const safety_committee_states = [
								'AZ',
								'DE',
								'KY',
								'NJ',
								'PA',
								'UT',
								'WI'
							];
							if(safety_committee_states.indexOf(this.app.business.primary_territory) !== -1){
								// <QuestionAnswer>
								const QuestionAnswerSafetyCommittee = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerSafetyCommittee.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.CertSafetyCommNotification');
									QuestionAnswerSafetyCommittee.ele('YesNoCd', 'NO');
								// </QuestionAnswer>
							}

							// NumberOfClaims within last 3 years
							const number_of_claims_states = [
								'DE',
								'HI',
								'MI',
								'PA',
								'SD',
								'VT'
							];
							if(number_of_claims_states.indexOf(this.app.business.primary_territory) !== -1){
								let total_claims = 0;
								for(const year in claims_by_year){
									if(year <= 3){
										total_claims += claims_by_year[year].count;
									}
								}

								// <QuestionAnswer>
								const QuestionAnswerStateClaims = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerStateClaims.ele('QuestionCd', `com.markel.uw.questions.stateSpecific.${this.app.business.primary_territory.toLowerCase()}.NumberOfClaims`);
									QuestionAnswerStateClaims.ele('YesNoCd', 'NA');
									QuestionAnswerStateClaims.ele('Num', total_claims);
								// </QuestionAnswer>
							}

							// Alabama
							if(this.app.business.primary_territory === 'AL'){

								// How many claims were within the last year?
								// <QuestionAnswer>
								const QuestionAnswerAL1 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerAL1.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.al.NumberOfClaimsLastYear');
									QuestionAnswerAL1.ele('YesNoCd', 'NA');
									QuestionAnswerAL1.ele('Num', Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0);
								// </QuestionAnswer>

								// How many claims were within the last 2 years?
								// <QuestionAnswer>
								const QuestionAnswerAL2 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerAL2.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.al.NumberOfClaimsLast2Years');
									QuestionAnswerAL2.ele('YesNoCd', 'NA');
									QuestionAnswerAL2.ele('Num', (Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0) + (Object.prototype.hasOwnProperty.call(claims_by_year, 2) ? claims_by_year[2].count : 0));
								// </QuestionAnswer>
							}

							// Colorado
							if(this.app.business.primary_territory === 'CO'){

								// How many loss time claims were within the last year?
								// <QuestionAnswer>
								const QuestionAnswerCO1 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerCO1.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.co.NumberOfLossTimeClaimsLastYr');
									QuestionAnswerCO1.ele('YesNoCd', 'NA');
									QuestionAnswerCO1.ele('Num', Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].missedWork : 0);
								// </QuestionAnswer>

								// How many medical claims of $250 or more were within the last?
								// <QuestionAnswer>
								const QuestionAnswerCO2 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerCO2.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.co.NumberOfMedClaimsLastYr');
									QuestionAnswerCO2.ele('YesNoCd', 'NA');
									QuestionAnswerCO2.ele('Num', Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0);
								// </QuestionAnswer>

								// Certified Risk Management Program
								// <QuestionAnswer>
								const QuestionAnswerCO3 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerCO3.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.co.CRMPFlag');
									QuestionAnswerCO3.ele('YesNoCd', 'NO');
								// </QuestionAnswer>
							}

							// Delaware
							if(this.app.business.primary_territory === 'DE'){
								if(this.app.business.bureau_number === 0){

									// Do you know the DCRB file number?
									// <QuestionAnswer>
									const QuestionAnswerDE1 = WorkCompLineBusiness.ele('QuestionAnswer');
										QuestionAnswerDE1.ele('QuestionCd', 'com.markel.uw.questions.Question1206');
										QuestionAnswerDE1.ele('YesNoCd', 'NO');
									// </QuestionAnswer>
								}
else{

									// Do you know the DCRB file number?
									// <QuestionAnswer>
									const QuestionAnswerDE1 = WorkCompLineBusiness.ele('QuestionAnswer');
										QuestionAnswerDE1.ele('QuestionCd', 'com.markel.uw.questions.Question1206');
										QuestionAnswerDE1.ele('YesNoCd', 'YES');
									// </QuestionAnswers>

									// Please enter the DCRB file number
									// <QuestionAnswer>
									const QuestionAnswerDE2 = WorkCompLineBusiness.ele('QuestionAnswer');
										QuestionAnswerDE2.ele('QuestionCd', 'com.markel.uw.questions.Question1207');
										QuestionAnswerDE2.ele('YesNoCd', 'NA');
										QuestionAnswerDE2.ele('Explanation', this.app.business.bureau_number);
									// </QuestionAnswers>

								}
							}

							// Hawaii
							if(this.app.business.primary_territory === 'HI'){

								// TO DO: Document that we defaulted this
								// Default to NO
								// <QuestionAnswer>
								const QuestionAnswerHI1 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerHI1.ele('QuestionCd', 'com.markel.uw.questions.Question1783');
									QuestionAnswerHI1.ele('YesNoCd', 'NO');
								// </QuestionAnswer>

								// You can contact the DOL for assistance in obtaining or verifying a DOL number by calling 808-586-8914
								// <QuestionAnswer>
								const QuestionAnswerHI2 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerHI2.ele('QuestionCd', 'com.markel.uw.questions.Question1784');
									QuestionAnswerHI2.ele('YesNoCd', 'NA');
									QuestionAnswerHI2.ele('Explanation', 'OK');
								// </QuestionAnswer>

							}

							// Kentucky
							if(this.app.business.primary_territory === 'KY'){

								// Does the applicant wish to select a deductible?
								// <QuestionAnswer>
								const QuestionAnswerKT = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerKT.ele('QuestionCd', 'com.markel.uw.questions.Question1638');
									QuestionAnswerKT.ele('YesNoCd', 'NO');
								// </QuestionAnswer>
							}

							// Pennsylvania
							if(this.app.business.primary_territory === 'PA'){
								if(this.app.business.bureau_number){
									// Do you know the PCRB file number?
									// <QuestionAnswer>
									const QuestionAnswerPA1 = WorkCompLineBusiness.ele('QuestionAnswer');
										QuestionAnswerPA1.ele('QuestionCd', 'com.markel.uw.questions.Question1204');
										QuestionAnswerPA1.ele('YesNoCd', 'YES');
									// </QuestionAnswer>

									// Please enter the PCRB file number
									// <QuestionAnswer>
									const QuestionAnswerPA2 = WorkCompLineBusiness.ele('QuestionAnswer');
										QuestionAnswerPA2.ele('QuestionCd', 'com.markel.uw.questions.Question1205');
										QuestionAnswerPA2.ele('YesNoCd', 'NA');
										QuestionAnswerPA2.ele('Explanation', this.app.bureau_number);
									// </QuestionAnswer>

								}
else{
									// Do you know the PCRB file number?
									// <QuestionAnswer>
									const QuestionAnswerPA1 = WorkCompLineBusiness.ele('QuestionAnswer');
										QuestionAnswerPA1.ele('QuestionCd', 'com.markel.uw.questions.Question1204');
										QuestionAnswerPA1.ele('YesNoCd', 'NO');
									// </QuestionAnswer>
								}
							}

							// Rhode Island
							if(this.app.business.primary_territory === 'RI'){
								// Consecutive years with no losses (between 0 and 6 inclusive)
								// <QuestionAnswer>
								const QuestionAnswerRI1 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerRI1.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.ri.ClaimFreeYearNumber');
									QuestionAnswerRI1.ele('YesNoCd', 'NA');
									QuestionAnswerRI1.ele('Num', this.get_years_since_claim());
								// </QuestionAnswer>
							}


							// Texas
							if(this.app.business.primary_territory === 'TX'){

								// How many claims were within the last year?
								// <QuestionAnswer>
								const QuestionAnswerTX1 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerTX1.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.tx.NumberOfClaimsLastYear');
									QuestionAnswerTX1.ele('YesNoCd', 'NA');
									QuestionAnswerTX1.ele('Num', Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0);
								// </QuestionAnswer>

								// How many claims were within the last 2 years?
								// <QuestionAnswer>
								const QuestionAnswerTX2 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerTX2.ele('QuestionCd', 'com.markel.uw.questions.stateSpecific.tx.NumberOfClaimsLast2Years');
									QuestionAnswerTX2.ele('YesNoCd', 'NA');
									QuestionAnswerTX2.ele('Num', (Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0) + (Object.prototype.hasOwnProperty.call(claims_by_year, 2) ? claims_by_year[2].count : 0));
								// </QuestionAnswer>

								// Any lapse in coverage?
								// <QuestionAnswer>
								const QuestionAnswerTX3 = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerTX3.ele('QuestionCd', 'com.markel.uw.questions.Question1594');
									QuestionAnswerTX3.ele('YesNoCd', this.policy.coverage_lapse ? 'YES' : 'NO');
								// </QuestionAnswer>
							}

							/* ---=== End State Specific Questions ===--- */


						/*
						 *---=== Special Markel Question ===---
						 * Markel asks one question that we do not support because it is unnecessary.
						 * Below, we add in support for that question so Markel still receives an
						 * answer as it desires.
						 */

							const special_activity_codes = {
							'AK': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'AL': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'AR': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'CA': ['8868',
							'8875',
							'9014',
							'9015',
							'9016',
							'9031',
							'9048',
							'9053',
							'9059',
							'9061',
							'9063',
							'9180'],
							'CO': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9053',
							'9059',
							'9061',
							'9063',
							'9180',
							'9186'],
							'CT': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'DE': ['0891',
							'0968',
							'0978',
							'8861',
							'8864',
							'8869',
							'9015',
							'9016',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'FL': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'GA': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'HI': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9013',
							'9014',
							'9015',
							'9016',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'IA': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'IL': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'IN': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'KS': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'KY': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'LA': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'MA': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9063'],
							'MD': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'MI': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'MN': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'MO': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'MS': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'NC': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'NE': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'NH': ['8842',
							'8864',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'NJ': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'NM': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9180',
							'9186'],
							'NV': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9016',
							'9048',
							'9059',
							'9061',
							'9063',
							'9110',
							'9180',
							'9186'],
							'OK': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9063'],
							'PA': ['0884',
							'0891',
							'0965',
							'0971',
							'0978',
							'0986'],
							'RI': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9063'],
							'SC': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9063'],
							'SD': ['8842',
							'8864',
							'8868',
							'9014',
							'9015',
							'9063'],
							'TN': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9063'],
							'TX': ['8868',
							'9014',
							'9015',
							'9063'],
							'UT': ['8842',
							'8864',
							'8868',
							'9014',
							'9015',
							'9063'],
							'VA': ['8842',
							'8861',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9063'],
							'VT': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9063'],
							'WI': ['8842',
							'8864',
							'8868',
							'8869',
							'9014',
							'9015',
							'9063'],
							'WV': ['8842',
							'8864',
							'8869',
							'9014',
							'9015',
							'9063']
							};

						if(Object.prototype.hasOwnProperty.call(special_activity_codes, this.app.business.primary_territory)){
							let match = false;
							const codes = special_activity_codes[this.app.business.primary_territory];
							this.app.business.locations.forEach(function(location){
								location.activity_codes.forEach(function(activity_code){
									let short_code = activity_code.id;
									while(short_code > 9999){
										short_code = Math.floor(short_code / 10);
									}

									if(codes.indexOf(short_code) !== -1){
										match = true;
									}
								});
							});

							if(match){
								// Add the additional question

								// <QuestionAnswer>
								const QuestionAnswerAQ = WorkCompLineBusiness.ele('QuestionAnswer');
									QuestionAnswerAQ.ele('QuestionCd', 'com.markel.uw.questions.Question1203');
									QuestionAnswerAQ.ele('YesNoCd', 'NO');
								// </QuestionAnswer>
							}
						}

			// Get the XML structure as a string
			const xml = ACORD.end({'pretty': true});

			// Determine which URL to use
			let host = '';
			if(this.insurer.test_mode){
				host = 'portal-beta.markelinsurance.com';
			}
else{
				host = 'portal.markelinsurance.com';
			}
			const path = '/api/v1/submission/acord';

			// Send the XML to the insurer
			await this.send_xml_request(host, path, xml).then((result) => {
				// Parse the various status codes and take the appropriate action
				let message_status = null;
				let res = result.ACORD;
				let status = parseInt(res.Status[0].StatusCd[0], 10);
				switch(status){
					case 1740:
						this.reasons.push('Error 1740: Authentication Failed');
						fulfill(this.return_result('error'));
						return;
					case 1980:
						this.reasons.push('Error 1980: Unsupported Application ID');
						fulfill(this.return_result('error'));
						return;
					case 400:
						this.reasons.push(`Error 400: ${res.Status[0].StatusDesc[0]}`);
						fulfill(this.return_result('error'));
						return;
					case 0:
						res = res.InsuranceSvcRs[0].WorkCompPolicyQuoteInqRs[0];

						// Additional Error Checking
						message_status = res.MsgStatus[0];
						if(message_status.MsgStatusCd[0] === 'Error'){
							this.reasons.push(message_status.MsgErrorCd[0]);
							fulfill(this.return_result('error'));
							return;
						}

						// Determine the status
						status = res.PolicySummaryInfo[0].PolicyStatusCd[0];

						// Attempt to get the amount of the quote
						try{
							this.amount = parseInt(res.PolicySummaryInfo[0].FullTermAmt[0].Amt[0], 10);
						}
catch(e){
							// This is handled in return_result()
						}

						// Grab the limits info
						try{
							res.WorkCompLineBusiness[0].CommlCoverage.forEach((coverage_block) => {
								if(coverage_block.CoverageCd[0] === 'INEL'){
									coverage_block.Limit.forEach((limit) => {
										switch(limit.LimitAppliesToCd[0]){
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
						return;

					default:
						this.reasons.push(`API returned unknown status code of ${status}`);
						fulfill(this.return_result('error'));

				}
			}).catch(() => {
				log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to connect to insurer.`+ __location);
				fulfill(this.return_result('error'));
			});
		});
	}
};