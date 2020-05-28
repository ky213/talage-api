/**
 * Defines a single industry code
 */

'use strict';

const util = require('util');
const email = global.requireShared('./services/email.js');
const slack = global.requireShared('./services/slack.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const get_questions = global.requireShared('./helpers/getQuestions.js');

const htmlentities = require('html-entities').Html5Entities;
const AgencyLocation = require('./AgencyLocation.js');
const Business = require('./Business.js');
const Insurer = require('./Insurer.js');
const Policy = require('./Policy.js');
const Question = require('./Question.js');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class Application{

	constructor(){
		this.agencyLocation = null;
		this.business = null;
		this.id = 0;
		this.insurers = [];
		this.policies = [];
		this.questions = {};
		this.test = false;
	}

	/**
	 * Returns an array of IDs that represent the active insurance carriers (limited by the selections in the API request)
	 *
	 * @returns {array} - An array of integers that are insurer IDs
	 */
	get_insurer_ids(){
		return this.insurers.map(function(insurer){
			return insurer.id;
		});
	}

	/**
	 * Returns a list of the active insurers in the Talage System. Will return only desired insurers based on the request
	 * received from the user. If no desired insurers are specified, will return all insurers.
	 *
	 * @param {object} requestedInsurers - Array of insurer slugs
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
	get_insurers(requestedInsurers){
		return new Promise(async(fulfill, reject) => {
			// Get a list of desired insurers
			let desired_insurers = [];
			let stop = false;
			this.policies.forEach((policy) => {
				if(Array.isArray(policy.insurers)){
					policy.insurers.forEach((insurer) => {
						if(desired_insurers.indexOf(insurer) === -1){
							// Check that the agent supports this insurer for this policy type
							let match_found = false;
							for(const agent_insurer in this.agencyLocation.insurers){
								if(Object.prototype.hasOwnProperty.call(this.agencyLocation.insurers, agent_insurer)){
									// Find the matching insurer
									if(this.agencyLocation.insurers[agent_insurer].id === parseInt(agent_insurer, 10)){
										// Check the policy type
										if(this.agencyLocation.insurers[agent_insurer][policy.type.toLowerCase()] === 1){
											match_found = true;
										}
									}
								}
							}

							if(match_found){
								desired_insurers.push(insurer);
							}else{
								log.info(`Agent does not support ${policy.type} policies through insurer ${insurer}`);
								reject(serverHelper.requestError('Agent does not support this request'));
								stop = true;
							}
						}
					});
				}
			});
			if(stop){
				return;
			}

			// Limit insurers to those supported by the Agent
			if(desired_insurers.length){
				// Make sure these match what the agent can support
				const agent_insurers = Object.keys(this.agencyLocation.insurers);

				let some_unsupported = false;
				desired_insurers.forEach((insurer) => {
					if(!agent_insurers.includes(insurer.toString())){
						some_unsupported = true;
					}
				});
				if(some_unsupported){
					log.info('Agent does not support one or more of the insurers requested.');
					reject(serverHelper.requestError('Agent does not support this request'));
					return;
				}
			}else{
				// Only use the insurers supported by this agent
				desired_insurers = Object.keys(this.agencyLocation.insurers);
			}

			// Loop through each desired insurer
			let insurers = [];
			const insurer_promises = [];
			desired_insurers.forEach((id) => {
				// Create a new insurer object
				const insurer = new Insurer();

				// Initialize the insurer
				insurer_promises.push(insurer.init(id));

				// Add the insurer to the local list
				insurers.push(insurer);
			});

			// Wait for all the insurers to initialize
			await Promise.all(insurer_promises);

			// Filter the allowed insurers to only those that are requested
			if(requestedInsurers && requestedInsurers.length > 0){
				insurers = insurers.filter((insurer) => requestedInsurers.includes(insurer.slug));
			}

			// Store and return the insurers
			this.insurers = insurers;
			fulfill(insurers);
		});
	}

	/**
	 * Returns an array of the Talage WC Codes that were included in this application
	 *
	 * @returns {array} - An array of integers that are the IDs of Talage WC Codes
	 */
	get_wc_codes(){
		const ids = [];
		this.business.locations.forEach(function(location){
			location.activity_codes.forEach(function(activity_code){
				ids.push(activity_code.id);
			});
		});
		return ids;
	}

	/**
	 * Checks whether or not the incoming request includes the specified policy type
	 *
	 * @param {string} policy_type - The policy type (BOP, GL, or WC)
	 * @returns {boolean} - True if a policy of the specified type was requested, false otherwise
	 */
	has_policy_type(policy_type){
		let rtn = false;

		// Loop through each policy in the request
		this.policies.forEach((policy) => {
			if(policy.type === policy_type){
				rtn = true;
			}
		});

		return rtn;
	}

	/**
	 * Populates this object with data from the request
	 *
	 * @param {object} data - The application data
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
	load(data){
		log.verbose('Loading data into Application');
		return new Promise(async(fulfill, reject) => {
			// Agent
			this.agencyLocation = new AgencyLocation(this);
			// Note: The front-end is sending in 'agent' but this is really a reference to the 'agency location'
			if(data.agent){
				await this.agencyLocation.load({'id': data.agent});
			}else{
				await this.agencyLocation.load({'id': 1}); // This is Talage's agency location record
			}

			// Load the business information
			this.business = new Business(this);
			await this.business.load(data.business).catch(function(error){
				reject(error);
			});

			// ID
			this.id = parseInt(data.id, 10);

			// Load the policy information
			data.policies.forEach((policy) => {
				const p = new Policy(this);
				p.load(policy);
				this.policies.push(p);
			});

			this.questions = data.questions;

			// Get the test flag
			this.test = data.test === true;

			fulfill();
		});
	}

	/**
	 * Generate an example API response
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing an example API response if resolved, or an Error if rejected
	 */
	run_test(){
		log.info('Returning test data');

		return new Promise((fulfill) => {
			// Generate example quotes for each policy type
			const quotes = [];
			this.policies.forEach((policy) => {

				// Generate example quotes for each insurer for the given policy type
				this.insurers.forEach(function(insurer){

					// Check that the insurer supports this policy type
					if(insurer.policy_types.indexOf(policy.type) >= 0){
						// Determine the amount
						const amount = Math.round(Math.random() * (10000 - 6000) + 6000);

						const limits = {};
						if(policy.type === 'WC'){
							limits['Employers Liability Disease Per Employee'] = 1000000;
							limits['Employers Liability Disease Policy Limit'] = 1000000;
							limits['Employers Liability Per Occurrence'] = 1000000;
						}else{
							limits['Damage to Rented Premises'] = '1000000';
							limits['Each Occurrence'] = '1000000';
							limits['General Aggregate'] = '1000000';
							limits['Personal & Advertising Injury'] = '1000000';
							limits['Products & Completed Operations'] = '1000000';
							limits['Medical Expense'] = '15000';
						}

						// Prepare a list of payment options
						const payment_options = [];
						if(insurer.payment_options.length){
							insurer.payment_options.forEach(function(payment_option){
								if(amount > payment_option.threshold){
									payment_options.push({
										'description': payment_option.description,
										'id': payment_option.id,
										'name': payment_option.name
									});
								}
							});
						}

						// Build the quote
						quotes.push({
							'amount': amount,
							'id': quotes.length + 1,
							'instant_buy': Math.random() >= 0.5,
							'insurer': {
								'id': insurer.id,
								'logo': `${global.settings.SITE_URL}/${insurer.logo}`,
								'name': insurer.name,
								'rating': insurer.rating
							},
							'limits': limits,
							'payment_options': payment_options,
							'policy_type': policy.type
						});
					}
				});
			});

			// Check for no quotes
			if(quotes.length < 1){
				fulfill(serverHelper.requestError('The request submitted will not result in quotes. Please check the insurers specified and ensure they support the policy types selected.'));
				return;
			}

			const json = {
				'done': true,
				'quotes': quotes
			};

			fulfill(json);
		});
	}

	/**
	 * Begins the process of getting and returning quotes from insurers
	 *
	 * @param {object} socket - The socket.io socket to use for asynchronous quote returns (optional - when ommitted will compile all quotes before returning)
	 * @returns {Promise.<object, Error>} A promise that returns an object containing an example API response if resolved, or an Error if rejected
	 */
	run_quotes(socket = false){
		log.verbose('Running quotes');

		return new Promise(async(fulfill, reject) => {
			// Generate quotes for each policy type
			const fs = require('fs');
			const quote_promises = [];
			const socket_quotes = [];
			const policyTypeReferred = {};
			const policyTypeQuoted = {};
			let quotes_done = 0;
			let total_quotes_requested = 0;

			this.policies.forEach((policy) => {

				// Generate quotes for each insurer for the given policy type
				this.insurers.forEach((insurer) => {

					// Check that the given policy type is enabled for this insurer
					if(insurer.policy_types.indexOf(policy.type) >= 0){
						// Check if the integration file for this insurer exists
						const normalizedPath = `${__dirname}/../integrations/${insurer.slug}/${policy.type.toLowerCase()}.js`;
						if(fs.existsSync(normalizedPath)){
							// Require the integration file and add the response to our promises
							const IntegrationClass = require(normalizedPath);
							const integration = new IntegrationClass(this, insurer, policy);
							total_quotes_requested++;
							if(socket){
								integration.quote().then((quote) => {
									// Record the quote and send it to the user
									socket_quotes.push(quote);
									log.verbose('Quote Received');
									socket.emit('quote', quote);

									// Determine the result of this quote
									if(Object.prototype.hasOwnProperty.call(quote, 'amount') && quote.amount){
										// Quote
										policyTypeQuoted[quote.policy_type] = true;
									}else if(Object.prototype.hasOwnProperty.call(quote, 'status') && quote.status === 'referred'){
										// Referred
										policyTypeReferred[quote.policy_type] = true;
									}

									// Increment the counter
									quotes_done++;

									// If this was the last quote we are expecting, close the socket
									if(quotes_done === total_quotes_requested){
										this.send_notifications(socket_quotes);

										// Update the application state
										this.updateApplicationState(this.policies.length, Object.keys(policyTypeQuoted).length, Object.keys(policyTypeReferred).length);

										// Indicate we are done processing and disconnect
										socket.emit('status', 'done');
										socket.disconnect();
									}

									// Strip out file data and log
									if(Object.prototype.hasOwnProperty.call(quote, 'letter') && Object.prototype.hasOwnProperty.call(quote.letter, 'data')){
										quote.letter.data = '...';
									}
									log.verbose(util.inspect(quote, false, null));
								});
							}else{
								quote_promises.push(integration.quote());
							}
						}else{
							log.warn(`Insurer integration file does not exist: ${insurer.name} ${policy.type}`);
						}
					}
				});
			});

			// Wait for all quotes to finish
			const quotes = [];
			await Promise.all(quote_promises).then(function(all_quotes){
				all_quotes.forEach(function(quote){
					quotes.push(quote);

					// Determine the result of this quote
					if(Object.prototype.hasOwnProperty.call(quote, 'amount') && quote.amount){
						// Quote
						policyTypeQuoted[quote.policy_type] = true;
					}else if(Object.prototype.hasOwnProperty.call(quote, 'status') && quote.status === 'referred'){
						// Referred
						policyTypeReferred[quote.policy_type] = true;
					}
				});
			}).catch(function(error){
				reject(error);
			});

			// Check for no quotes
			if(quotes.length < 1){
				fulfill(serverHelper.requestError('The request submitted will not result in quotes. Please check the insurers specified and ensure they support the policy types selected.'));
				return;
			}

			// Update the application state
			this.updateApplicationState(this.policies.length, Object.keys(policyTypeQuoted).length, Object.keys(policyTypeReferred).length);

			// Send a notification to Slack about this application
			this.send_notifications(quotes);

			// Build the final JSON
			const json = {
				'done': true,
				'quotes': quotes
			};

			fulfill(json);
		});
	}

	/**
	 * Sends a email and slack notifications based on the quotes returned
	 *
	 * @param {array} quotes - An array of quote objects
	 * @returns {void}
	 */
	async send_notifications(quotes){

		if(global.settings.ENV === 'development'){
			log.info('!!! Skipping sending notification (slack and email) due to development environment. !!!');
			return;
		}

		// Determine which message will be sent
		let all_had_quotes = true;
		let some_quotes = false;
		await quotes.forEach(function(quote){
			if(quote.amount){
				some_quotes = true;
				return;
			}
			all_had_quotes = false;
		});

		// Send an emails if there were no quotes generated
		if(!all_had_quotes && !some_quotes){

			// Get the email information from the database
			const sql = `SELECT
				\`email_brand\` AS emailBrand,
				JSON_EXTRACT(\`custom_emails\`, '$.no_quotes_agency') as agency,
				JSON_EXTRACT(\`custom_emails\`, '$.no_quotes_customer') as customer,
				(SELECT JSON_EXTRACT(\`custom_emails\`, '$.no_quotes_agency') FROM \`clw_talage_agency_networks\` WHERE id = 1) AS defaultAgency,
				(SELECT JSON_EXTRACT(\`custom_emails\`, '$.no_quotes_customer') FROM \`clw_talage_agency_networks\` WHERE id = 1) AS defaultCustomer
			FROM \`clw_talage_agency_networks\`
			WHERE \`id\` = ${db.escape(this.agencyLocation.agencyNetwork)}
			LIMIT 1;`;

			let emailData = await db.query(sql).catch(function(){
				log.error('Unable to get No Quote email content from the database');
			});

			if(emailData && emailData[0]){

				// Reduce the result for easier reference
				emailData = emailData[0];


				/* ---=== Email to Insured === --- */

				// Decode the customer email JSON
				const customerEmailData = emailData.customer ? JSON.parse(emailData.customer) : null;
				const defaultCustomerEmailData = emailData.defaultCustomer ? JSON.parse(emailData.defaultCustomer) : null;

				// Determine the branding to use for this email
				let brand = emailData.emailBrand === 'wheelhouse' ? 'agency' : `${emailData.emailBrand}-agency`;

				// If this is Talage, update the brand
				if(this.agencyLocation.agencyId <= 2){
					brand = 'talage';
				}

				// Determine which message and subject to use
				let message = customerEmailData && Object.prototype.hasOwnProperty.call(customerEmailData, 'message') && customerEmailData.message ? customerEmailData.message : defaultCustomerEmailData.message;
				let subject = customerEmailData && Object.prototype.hasOwnProperty.call(customerEmailData, 'subject') && customerEmailData.subject ? customerEmailData.subject : defaultCustomerEmailData.subject;

				// Perform content replacements
				message = message.replace(/{{Agency}}/g, this.agencyLocation.agency);
				message = message.replace(/{{Agency Email}}/g, this.agencyLocation.agencyEmail);
				message = message.replace(/{{Agency Phone}}/g, formatPhone(this.agencyLocation.agencyPhone));
				message = message.replace(/{{Agency Website}}/g, `<a href="${this.agencyLocation.agencyWebsite}"  rel="noopener noreferrer" target="_blank">${this.agencyLocation.agencyWebsite}</a>`);
				subject = subject.replace(/{{Agency}}/g, this.agencyLocation.agency);

				// Send the email message
				email.send(this.business.contacts[0].email, subject, message, {
					'agencyLocation': this.agencyLocation.id,
					'application': this.id
				}, brand, this.agencyLocation.agencyId);


				/* ---=== Email to Agency === --- */

				// Do not send if this is Talage
				if(this.agencyLocation.agencyId > 2){

					// Determine the portal login link
					let portalLink = '';
					switch(global.settings.ENV){
						case 'development':
							portalLink = global.settings.PORTAL_URL;
							break;
						case 'test':
						case 'staging':
						case 'demo':
						case 'production':
						default:
							portalLink = this.agencyLocation.agencyNetwork === 2 ? global.settings.DIGALENT_AGENTS_URL : global.settings.TALAGE_AGENTS_URL;
							break;
					}

					// Decode the agency email JSON
					const agencyEmailData = emailData.agency ? JSON.parse(emailData.agency) : null;
					const defaultAgencyEmailData = emailData.defaultAgency ? JSON.parse(emailData.defaultAgency) : null;

					// Determine which message and subject to use
					message = agencyEmailData && Object.prototype.hasOwnProperty.call(agencyEmailData, 'message') && agencyEmailData.message ? agencyEmailData.message : defaultAgencyEmailData.message;
					subject = agencyEmailData && Object.prototype.hasOwnProperty.call(agencyEmailData, 'subject') && agencyEmailData.subject ? agencyEmailData.subject : defaultAgencyEmailData.subject;

					// Perform content replacements
					const capitalizedBrand = emailData.emailBrand.charAt(0).toUpperCase() + emailData.emailBrand.substring(1);
					message = message.replace(/{{Agency Portal}}/g, `<a href="${portalLink}" target="_blank" rel="noopener noreferrer">${capitalizedBrand} Agency Portal</a>`);
					message = message.replace(/{{Agency}}/g, this.agencyLocation.agency);
					message = message.replace(/{{Agent Login URL}}/g, this.agencyLocation.insurers[quotes[0].insurer.id].agent_login);
					message = message.replace(/{{Brand}}/g, capitalizedBrand);
					message = message.replace(/{{Business Name}}/g, this.business.name);
					message = message.replace(/{{Contact Email}}/g, this.business.contacts[0].email);
					message = message.replace(/{{Contact Name}}/g, `${this.business.contacts[0].first_name} ${this.business.contacts[0].last_name}`);
					message = message.replace(/{{Contact Phone}}/g, formatPhone(this.business.contacts[0].phone));
					message = message.replace(/{{Industry}}/g, this.business.industry_code_description);
					message = message.replace(/{{Quote Result}}/g, quotes[0].status.charAt(0).toUpperCase() + quotes[0].status.substring(1));

					// Send the email message
					email.send(this.agencyLocation.agencyEmail, subject, message, {
						'agencyLocation': this.agencyLocation.id,
						'application': this.id
					}, emailData.emailBrand, this.agencyLocation.agencyId);
				}
			}
		}

		// Only send Slack messages on Talage applications
		if(this.agencyLocation.agencyId <= 2){

			// Build out the 'attachment' for the Slack message
			const attachment = {
				'application_id': this.id,
				'fields': [
					{
						'short': false,
						'title': 'Business Name',
						'value': this.business.name + (this.business.dba ? ` (dba. ${this.business.dba})` : '')
					}, {
						'short': false,
						'title': 'Industry',
						'value': this.business.industry_code_description
					}
				],
				'text': `${this.business.name} from ${this.business.primary_territory} completed an application for ${this.policies.map(function(policy){
					return policy.type;
				}).join(' and ')}`
			};

			// Send a message to Slack
			if(all_had_quotes){
				slack('customer_success', 'ok', 'Application completed and the user received ALL quotes', attachment);
			}else if(some_quotes){
				slack('customer_success', 'ok', 'Application completed and only SOME quotes returned', attachment);
			}else{
				slack('customer_success', 'warning', 'Application completed, but the user received NO quotes', attachment);
			}
		}
	}

	/**
	 * Updates the state of the application as follows:
	 *   1 - New Application (no change, this is default)
	 *   12 - Referred (Application did not receive quotes and had at least one referral per policy type)
	 *   13 - Quoted (Application received at least one quote per policy type)
	 *
	 * @param {int} numPolicyTypesRequested - The number of policy types requested in the application
	 * @param {int} numPolicyTypesQuoted - The number of policy types that got quotes
	 * @param {int} numPolicyTypesReferred - THe number of policy types that referred
	 * @return {void}
	 */
	updateApplicationState(numPolicyTypesRequested, numPolicyTypesQuoted, numPolicyTypesReferred){
		// Determine the application status
		let state = 1; // New
		if(numPolicyTypesRequested === numPolicyTypesQuoted){
			state = 13; // Quoted
		}else if(numPolicyTypesRequested === numPolicyTypesReferred){
			state = 12; // Referred
		}

		// Update the application status in the database (1 is default, so that can be skipped)
		if(state > 1){
			const sql = `
				UPDATE #__applications
				SET state = ${state}
				WHERE id = ${this.id}
				LIMIT 1;
			`;
			db.query(sql).catch(() => {
				log.error('Unable to update application status.');
			});
		}
	}

	/**
	 * Checks that the data supplied is valid
	 *
	 * @param {object} requestedInsurers - Array of insurer slugs
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
	validate(requestedInsurers){
		return new Promise(async(fulfill, reject) => {
			let stop = false;

			// Agent
			await this.agencyLocation.validate().catch(function(error){
				reject(error);
				stop = true;
			});
			if(stop){
				return;
			}

			// Initialize the agent so it is ready for later
			await this.agencyLocation.init().catch(function(error){
				reject(error);
				stop = true;
			});

			// Validate the ID (on test applications, don't validate)
			if(!this.test){
				if(!await validator.application(this.id)){
					reject(serverHelper.requestError('Invalid application ID specified.'));
					return;
				}
			}

			// Get a list of insurers and wait for it to return
			const insurers = await this.get_insurers(requestedInsurers).catch(async(error) => {
				if(error === 'Agent does not support this request'){
					if(this.agencyLocation.wholesale){
						// Switching to the Talage agent
						this.agencyLocation = new AgencyLocation(this);
						await this.agencyLocation.load({'id': 1}); // This is Talage's agency location record

						// Initialize the agent so we can use it
						await this.agencyLocation.init().catch(function(init_error){
							reject(init_error);
							stop = true;
						});

						// Try to get the insurers again
						return this.get_insurers();
					}

					reject(serverHelper.requestError('The Agent specified cannot support this policy.'));
					stop = true;
				}else{
					reject(error);
					stop = true;
				}
			});
			if(stop){
				return;
			}
			if(!insurers || insurers.length === 0 || Object.prototype.toString.call(insurers) !== '[object Array]'){
				reject(serverHelper.requestError('Invalid insurer(s) specified in policy.'));
				return;
			}

			// Validate the business
			await this.business.validate().catch(function(error){
				reject(error);
				stop = true;
			});
			if(stop){
				return;
			}

			// Validate all policies
			const policy_types = [];
			const policy_promises = [];
			this.policies.forEach(function(policy){
				policy_promises.push(policy.validate());
				policy_types.push(policy.type);
			});
			await Promise.all(policy_promises).catch(function(error){
				reject(error);
				stop = true;
			});
			if(stop){
				return;
			}

			// Get a list of all questions the user may need to answer
			const insurer_ids = this.get_insurer_ids();
			const wc_codes = this.get_wc_codes();
			const questions = await get_questions(wc_codes, this.business.industry_code, this.business.getZips(), policy_types, insurer_ids).catch(function(error){
				reject(error);
			});

			// Grab the answers the user provided to our questions and reset the question object
			const user_questions = this.questions;
			this.questions = {};

			// Convert each question from the databse into a question object and load in the user's answer to each
			let has_error = false;
			if(questions){
				await questions.forEach((question) => {
					// Prepare a Question object based on this data and store it
					const q = new Question();
					q.load(question);

					// Load the user's answer
					if(user_questions){
						if(Object.prototype.hasOwnProperty.call(user_questions, q.id)){
							const user_answer = user_questions[q.id];

							q.set_answer(user_answer).catch(function(error){
								reject(error);
								has_error = true;
							});
						}
					}

					// Store the question object in the Application for later use
					this.questions[q.id] = q;
				});
			}
			if(has_error){
				return;
			}

			// Enforce required questions (this must be done AFTER all questions are loaded with their answers)
			if(this.questions){
				for(const question_id in this.questions){
					if(Object.prototype.hasOwnProperty.call(this.questions, question_id)){
						const question = this.questions[question_id];

						// Hidden questions are not required
						if(question.hidden){
							continue;
						}

						if(question.parent){
							// Get the parent question
							const parent_question = this.questions[question.parent];

							// If no parent was found, throw an error
							if(!parent_question){
								log.error(`Question ${question.id} has invalid parent setting. (${htmlentities.decode(question.text).replace('%', '%%')})`);
								reject(serverHelper.requestError('An unexpected error has occurred. Our team has been alerted and will contact you.'));
								return;
							}

							// If this question's parent_answer is equal to the answer given for the parent, it is required
							if(parent_question.answer_id === question.parent_answer){
								question.required = true;
							}
						}else{
							question.required = true;
						}

						// If required, check that this question was answered by the user
						if(question.required && (!user_questions || !Object.prototype.hasOwnProperty.call(user_questions, question.id))){
							reject(serverHelper.requestError(`Question ${question.id} missing from request. (${htmlentities.decode(question.text).replace('%', '%%')})`));
							return;
						}
					}
				}
			}

			// Validate all of the questions
			if(this.questions){
				const question_promises = [];
				for(const question_id in this.questions){
					if(Object.prototype.hasOwnProperty.call(this.questions, question_id)){
						question_promises.push(this.questions[question_id].validate());
					}
				}
				await Promise.all(question_promises).catch(function(error){
					reject(error);
					stop = true;
				});
				if(stop){
					return;
				}
			}

			// (id: 1015 should have been removed as it was not required). What is the correct way to handle this?
			// Note: we cannot hurt questions where a child must be sent

			// Check agent support
			await this.agencyLocation.supports_application().catch(function(error){
				reject(error);
				stop = true;
			});
			if(stop){
				return;
			}

			fulfill(true);
		});
	}
};