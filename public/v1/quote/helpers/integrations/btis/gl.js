/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * General Liability Integration for BTIS
 */

'use strict';

const Integration = require('../Integration.js');
const moment = require('moment');
const util = require('util');

module.exports = class BtisGL extends Integration{

	/**
	 * Requests a quote from BTIS and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	_insurer_quote(){
		// Define how legal entities are mapped for BTIS (/GL/v1/gateway/lookup/businesstypes)
		const entity_matrix = {
			'Association': 4,
			'Corporation': 2,
			'Limited Liability Company': 5,
			'Limited Partnership': 3,
			'Partnership': 6,
			'Sole Proprietorship': 1
		};

		// Build the Promise
		return new Promise(async(fulfill) => {
			// Determine which URL to use
			let host = '';
			if(this.insurer.test_mode){
				host = 'api-sandbox.btisinc.com';
			}else{
				host = 'api.btisinc.com';
			}

			// Get a token from their auth server
			let had_error = false;
			const token_request_data = JSON.stringify({
				'client_id': this.username,
				'client_secret': this.password,
				'grant_type': 'client_credentials'
			});
			const token_response = await this.send_json_request(host, '/v1/authentication/connect/token', token_request_data).catch((error) => {
				log.error(error.message);
				had_error = true;
				fulfill(this.return_error('error', 'Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
			});
			if(had_error){
				return;
			}

			// Verify that we got back what we expected
			if(!Object.prototype.hasOwnProperty.call(token_response, 'success') || token_response.success !== true || !Object.prototype.hasOwnProperty.call(token_response, 'token') || !token_response.token){
				fulfill(this.return_error('error', 'Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
				return;
			}
			const token = token_response.token;

			// Build an object of data to send to BTIS
			const data = {};
			data.ProposedEffectiveDate = this.policy.effective_date.format('YYYY-MM-DD');

			// Set a default for the deductible
			let deductible_id = 2000500;

			// If allowed, check the deductible and return the appropriate ID
			if(['AR',
				'AZ',
				'CA',
				'CO',
				'ID',
				'NM',
				'NV',
				'OK',
				'OR',
				'TX',
				'UT',
				'WA'].includes(this.app.business.primary_territory)){
				switch(this.policy.deductble){
					case 500:
						deductible_id = 2000500;
						break;
					case 1000:
						deductible_id = 2001000;
						break;
					default:
						// 1500, defaulted value
						deductible_id = 2001500;
						break;
				}
			}

			// Deductible
			data.DeductibleId = deductible_id;

			// Spanish
			data.ProvideSpanishInspection = false;

			// Determine the limits ID
			const carrierLimits = await this.send_json_request(host, `/GL/v1/gateway/lookup/limits/?stateName=${this.app.business.primary_territory}&effectiveDate=${this.policy.effective_date.format('YYYY-MM-DD')}`, null, {'x-access-token': token}).catch((error) => {
				log.error(error.message);
				fulfill(this.return_error('error', 'Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
			});

			// Get the best limits
			const limits = this.getBestLimits(carrierLimits.map(function(carrierLimit){
				return carrierLimit.text.replace(/,/g, '');
			}));
			if(!limits){
				this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
				fulfill(this.return_result('autodeclined'));
				return;
			}

			// Determine the limits ID
			let limitsId = 0;
			carrierLimits.forEach((limit) => {
				if(parseInt(limit.limits.occurrence.replace(/,/g, ''), 10) === limits[0] && parseInt(limit.limits.aggregate.replace(/,/g, ''), 10) === limits[1] && parseInt(limit.limits.perproject.replace(/,/g, ''), 10) === limits[2]){
					limitsId = limit.limitId;
				}
			});

			data.LimitsId = limitsId;

			// InsuredInformation
			const phone = this.app.business.contacts[0].phone.toString();
			data.InsuredInformation = {};
			data.InsuredInformation.FirstName = this.app.business.contacts[0].first_name;
			data.InsuredInformation.LastName = this.app.business.contacts[0].last_name;
			data.InsuredInformation.Email = this.app.business.contacts[0].email;
			data.InsuredInformation.PhoneNumber = `(${phone.substring(0, 3)})${phone.substring(3, 6)}-${phone.substring(phone.length - 4)}`;

			// Business Information
			data.BusinessInformation = {};
			data.BusinessInformation.DBA = this.app.business.dba ? this.app.business.dba : this.app.business.name;
			if(!(this.app.business.entity_type in entity_matrix)){
				log.error('BTIS GL Integration File: Invalid Entity Type');
				fulfill(this.return_error('error', 'We have no idea what went wrong, but we\'re on it'));
				return;
			}
			data.BusinessInformation.BusinessEntityTypeId = entity_matrix[this.app.business.entity_type];
			data.BusinessInformation.NumberOfOwners = this.app.business.num_owners;
			data.BusinessInformation.NumberOfFullTimeEmployees = this.get_total_full_time_employees();

			// Determine the BusinessExperienceId
			// As of December 26, 2019
			// 1 = New in business
			// 2 = 1-59 days lapse in coverage
			// 3 = 60+ days lapse in coverage
			// 4 - 1 year of coverage, no lapses and no losses
			// 5 - 2 years of coverage, no lapses and no losses
			// 6 - 3+ years of coverage, no lapses and no losses
			// 9 - No prior coverage
			let BusinessExperienceId = 6;
			if(this.app.business.founded.isAfter(moment().subtract(6, 'months'))){
				BusinessExperienceId = 1;
			}
			// TO DO: Finish this logic
			data.BusinessInformation.BusinessExperienceId = BusinessExperienceId;

			// Continue Business Information
			data.BusinessInformation.NumberOfPartTimeEmployees = this.get_total_part_time_employees();
			data.BusinessInformation.EmployeePayroll = this.get_total_payroll();
			data.BusinessInformation.LaborerPayroll = 0;

			if(Object.prototype.hasOwnProperty.call(this.questions, '970')){
				let subcontractor_costs = this.questions['970'].answer;
				if(subcontractor_costs / this.policy.gross_sales > 0.5){
					log.info('BTIS declined due to subcontractor costs being too high.');
					fulfill(this.return_error('declined', `${this.insurer.name} has declined to offer you coverage at this time`));
					return;
				}
				if(typeof subcontractor_costs !== 'string'){
					subcontractor_costs = String(subcontractor_costs);
				}
				subcontractor_costs = parseInt(subcontractor_costs.replace('$', '').replace(/,/g, ''), 10);
				data.BusinessInformation.SubcontractorCosts = subcontractor_costs ? subcontractor_costs : 0;
			}else{
				data.BusinessInformation.SubcontractorCosts = 0;
			}

			// The applicant has not completed any work involving apartment conversions, construction work involving condominiums, town homes or time shares in the past 10 years, nor does the applicant plan to in the future.
			data.BusinessInformation.PerformNewResidentialWork = !this.questions['948'].get_answer_as_boolean();
			data.BusinessInformation.DescriptionOfOperations = this.get_operation_description();

			// Primary Address
			data.BusinessInformation.PrimaryAddress = {};
			data.BusinessInformation.PrimaryAddress.Line1 = this.app.business.locations[0].address;
			data.BusinessInformation.PrimaryAddress.Line2 = this.app.business.locations[0].address2;
			data.BusinessInformation.PrimaryAddress.City = this.app.business.locations[0].city;
			data.BusinessInformation.PrimaryAddress.State = this.app.business.locations[0].territory;
			data.BusinessInformation.PrimaryAddress.Zip = this.app.business.locations[0].zip;

			// Mailing Address
			data.BusinessInformation.MailingAddress = {};
			data.BusinessInformation.MailingAddress.Line1 = this.app.business.mailing_address;
			data.BusinessInformation.MailingAddress.Line2 = this.app.business.mailing_address2;
			data.BusinessInformation.MailingAddress.City = this.app.business.mailing_city;
			data.BusinessInformation.MailingAddress.State = this.app.business.mailing_territory;
			data.BusinessInformation.MailingAddress.Zip = this.app.business.mailing_zip;

			// Gross Receipts
			data.BusinessInformation.GrossReceipts = [];
			data.BusinessInformation.GrossReceipts[0] = {};
			data.BusinessInformation.GrossReceipts[0].Type = 'OneYearGrossReceipts';
			data.BusinessInformation.GrossReceipts[0].Amount = this.policy.gross_sales;

			// TO DO: OPTIONAL COVERAGES (we may not support these?)

			// Classifications
			data.Classifications = [];
			data.Classifications[0] = {};
			data.Classifications[0].ClassCode = this.industry_code.cgl;
			data.Classifications[0].Name = this.industry_code.description;
			data.Classifications[0].Percentage = 100;


			// Questions (in BTIS speak, "qualifying statements")

			// Get the identifiers for each question
			const question_identifiers = await this.get_question_identifiers().catch((error) => {
				log.error(`BTIS GL is unable to get question identifiers. ${error}`);
				fulfill(this.return_error('error', 'Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
			});

			// Loop through and send each
			data.QualifyingStatements = [];
			for(const question_id in this.questions){
				if(Object.prototype.hasOwnProperty.call(this.questions, question_id)){
					const question = this.questions[question_id];
					const QuestionCd = question_identifiers[question.id];

					// Don't process questions without a code (not for this insurer)
					if(!QuestionCd){
						continue;
					}

					const q = {};
					q.QuestionId = QuestionCd;
					q.Answer = question.get_answer_as_boolean();

					data.QualifyingStatements.push(q);
				}
			}

			// Specially Handled Questions

			// Are your gross receipts below $1,500,000 in each of the past 2 years?
			const gross_q = {};
			gross_q.QuestionId = 1;
			gross_q.Answer = this.policy.gross_sales < 1500000;
			data.QualifyingStatements.push(gross_q);

			// How many years of experience do you have?
			const exp_q = {};
			exp_q.QuestionId = 7;
			exp_q.Answer = this.get_years_in_business() >= 2 ? true : this.app.business.years_of_exp >= 2;
			data.QualifyingStatements.push(exp_q);

			// Determine the API Path for this request
			const path = '/GL/v1/gateway/submit';

			// Send JSON to the insurer
			await this.send_json_request(host, path, JSON.stringify(data), {'x-access-token': token}).then((result) => {

				if(result.success){
					// Get the quote ID
					this.request_id = result.submissionid;

					if(Object.prototype.hasOwnProperty.call(result, 'submission')){

						// Make an additional 'Quote' call to take this app out of submitted status, don't wait b/c we really don't care
						this.send_json_request(host, `/GL/v1/gateway/quote?submissionId=${this.request_id}`, JSON.stringify(data), {'x-access-token': token}, 'PUT').catch((error) => {
							log.error(`BTIS Quote Endpoint Returned Error ${util.inspect(error, false, null)}`);
						});

						// Get the amount of the quote (from the Silver package only, per Adam)
						let amount = 0;
						try{
							amount = result.submission.results.total_premium;
						}catch(e){
							log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to quote amount.`);
							this.reasons.push('A quote was generated, but our API was unable to isolate it.');
							fulfill(this.return_error('error', 'Our bad. Something went wrong, but we\'re on it. Expect to hear from us'));
							return;
						}

						// Grab the limits info
						try{
							let limits_string = result.submission.criteria.limits;

							// Remove the commas
							limits_string = limits_string.replace(/,/g, '');

							// Break the limits into an array
							const policy_limits = limits_string.split('/');

							// Build out the limits how our system expects to see them
							this.limits = {
								'4': policy_limits[0],
								'8': policy_limits[1],
								'9': policy_limits[2]
							};
						}catch(e){
							log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find limits.`);
						}

						// Return the quote
						this.log += `--------======= Success! =======--------<br><br>Quote: ${amount}<br>Application ID: ${this.request_id}`;
						fulfill(this.return_quote(amount));
					}else{
						this.log += `--------======= Application Referred =======--------<br><br>`;
						result.referralReasons.forEach((reason) => {
							this.log += `- ${reason}<br>`;
							this.reasons.push(reason);
							log.warn(`Referred by Insurer With Message: ${reason}`);
						});
						fulfill(this.return_error('referred', `${this.insurer.name} needs a little more time to make a decision`));
					}
				}else{
					log.error(`BTIS Submit Endpoint Returned Error ${result.message}`);
					this.reasons.push(result.message);
					fulfill(this.return_error('error', 'We have no idea what went wrong, but we\'re on it'));
				}
			}).catch((error) => {
				log.error(`BTIS Submit Endpoint Returned Error ${util.inspect(error, false, null)}`);
				this.reasons.push('Problem connecting to insurer');
				fulfill(this.return_error('error', 'We have no idea what went wrong, but we\'re on it'));
			});
		});
	}
};