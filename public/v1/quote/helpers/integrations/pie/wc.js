/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Workers Compensation Policy Integration for Pie
 *
 * Note: Owner Officer information is currently being omitted because we don't have the ownership percentage or birthdate
 */

'use strict';

const Integration = require('../Integration.js');

module.exports = class PieWC extends Integration{

	/**
	 * Requests a quote from Pie and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	_insurer_quote(){

		// These are the statuses returned by the insurer and how they map to our Talage statuses
		/*
		This.possible_api_responses.Accept = 'quoted';
		this.possible_api_responses.Refer = 'referred';
		this.possible_api_responses.Reject = 'declined';
		*/

		// These are the limits supported by Pie
		const carrierLimits = [
			'100000/500000/100000',
			'500000/500000/500000',
			'1000000/1000000/1000000'
		];

		// An association list tying the Talage entity list (left) to the codes used by this insurer (right)
		const entityMatrix = {
			'Association': 'AssociationLaborUnionReligiousOrganization',
			'Corporation': 'Corporation',
			'Joint Venture': 'JointVenture',
			'Limited Liability Company': 'LimitedLiabilityCompany',
			'Limited Liability Partnership': 'LimitedLiabilityPartnership',
			'Limited Partnership': 'LimitedPartnership',
			'Other': 'Other',
			'Partnership': 'Partnership',
			'Sole Proprietorship': 'Individual',
			'Trust - For Profit': 'TrustOrEstate',
			'Trust - Non-Profit': 'TrustOrEstate'
		};

		return new Promise(async(fulfill) => {

			// Determine which URL to use
			let host = '';
			if(this.insurer.test_mode){
				host = 'quote-stg.pieinsurance.com';
			}
else{
				host = 'quote.pieinsurance.com';
			}

			// Prepare limits
			const limits = this.getBestLimits(carrierLimits);
			if(!limits){
				this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
				fulfill(this.return_result('autodeclined'));
				return;
			}

			// If the user want's owners included, Pie cannot write it
			if(this.app.business.owners_included){
				this.reasons.push(`Pie does not support owners being included in a WC policy at this time.`);
				fulfill(this.return_result('autodeclined'));
				return;
			}

			// Get a token from their auth server
			let had_error = false;
			const token_request_data = {
				'client_id': this.username,
				'client_secret': this.password,
				'grant_type': 'client_credentials',
				'scopes': 'api/v1'
			};
			const token_response = await this.send_request(host, '/connect/token', token_request_data, {'Content-Type': 'application/x-www-form-urlencoded'}).catch(() => {
				had_error = true;
				fulfill(this.return_error('error', 'Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
			});
			if(had_error){
				return;
			}
			const token_object = JSON.parse(token_response);
			const token = `${token_object.token_type} ${token_object.access_token}`;

			// Get all territories present in this appilcation
			const territories = this.app.business.getTerritories();

			// Build the JSON Request
			const data = {};
			data.effectiveDate = this.policy.effective_date.format('YYYY-MM-DD');
			data.expirationDate = this.policy.expiration_date.format('YYYY-MM-DD');

			// Begin the 'workersCompensation' data object
			data.workersCompensation = {};

				// Begin the 'legalEntities' data object
				data.workersCompensation.legalEntities = [];

					// We only ever want one legal entity, so let's start building that
					data.workersCompensation.legalEntities[0] = {};

						data.workersCompensation.legalEntities[0].businessType = entityMatrix[this.app.business.entity_type];
						data.workersCompensation.legalEntities[0].states = [];

						// Create an object for each state
						for(const territory_index in territories){
							if(Object.prototype.hasOwnProperty.call(territories, territory_index)){
								const territory = territories[territory_index];
								const state_object = {};
								let unemployment_number = false;

								state_object.code = territory;

								// Experience Modifier
								state_object.experienceModification = {};
								state_object.experienceModification.factor = this.app.business.experience_modifier;
								if(this.app.business.bureau_number){
									state_object.experienceModification.riskId = this.app.business.bureau_number;
								}

								// All of the locations in this state
								let mailing_address_found = false;
								state_object.locations = [];
								for(const loc_index in this.app.business.locations){
									if(Object.prototype.hasOwnProperty.call(this.app.business.locations, loc_index)){
										const loc = this.app.business.locations[loc_index];
										if(loc.territory === territory){
											const location_object = {};

											// Check if there was an unemployment number, and if there was, save it for later
											if(loc.unemployment_number){
												unemployment_number = loc.unemployment_number;
											}

											// Address
											location_object.address = {};
											location_object.address.state = loc.territory;
											location_object.address.country = 'US';
											location_object.address.line1 = loc.address;
											if(loc.address2){
												location_object.address.line2 = loc.address2;
											}
											location_object.address.city = loc.city;
											location_object.address.zip = loc.zip;

											// Exposures
											location_object.exposure = [];
											for(const activity_code_index in loc.activity_codes){
												if(Object.prototype.hasOwnProperty.call(loc.activity_codes, activity_code_index)){
													const activity_code = loc.activity_codes[activity_code_index];
													const exposure_object = {};
													exposure_object.payroll = activity_code.payroll;
													exposure_object.class = this.insurer_wc_codes[loc.territory + activity_code.id];

													// Append this exposure to the location
													location_object.exposure.push(exposure_object);
												}
											}

											// Officers
											location_object.officers = [];
											for(const owner_index in this.app.business.owners){
												if(Object.prototype.hasOwnProperty.call(this.app.business.owners, owner_index)){

													/* Per Pie: Omit this until we can send in an ownership percentage and birthdate
													const owner = this.app.business.owners[owner_index];
													const officer = {};

													officer.included = false;
													officer.name = owner;

													// Append this officer to the location
													location_object.officers.push(officer);
													*/
												}
											}

											location_object.fullTimeEmployeeCount = loc.full_time_employees;
											location_object.partTimeEmployeeCount = loc.part_time_employees;
											if(loc.address === this.app.business.mailing_address){
												location_object.mailingAddress = true;
												mailing_address_found = true;
											}
else{
												location_object.mailingAddress = false;
											}

											// Append the location object to the locations array
											state_object.locations.push(location_object);
										}
									}
								}

								// Hande the mailing address if different from the locations above
								if(!mailing_address_found){
									const address = {
										'city': this.app.business.mailing_city,
										'country': 'US',
										'line1': this.app.business.mailing_address,
										'state': this.app.business.mailing_territory,
										'zip': this.app.business.mailing_zip
									};

									if(this.app.business.mailing_address2){
										address.line2 = this.app.business.mailing_address2;
									}

									state_object.locations.push({
										'address': address,
										'mailingAddress': true
									});
								}

								// Unemployment Number
								if(unemployment_number){
									state_object.uian = unemployment_number;
								}

								// Waiver of Subrogation
								state_object.blanketWaiver = false;

								// Append the state into the states array
								data.workersCompensation.legalEntities[0].states.push(state_object);
							}
						}

						data.workersCompensation.legalEntities[0].name = this.app.business.name;
						if(this.app.business.dba){
							data.workersCompensation.legalEntities[0].doingBusinessAs = [this.app.business.dba];
						}
						data.workersCompensation.legalEntities[0].taxId = this.app.business.locations[0].identification_number;

				// Limits
				data.workersCompensation.employersLiability = {};
				data.workersCompensation.employersLiability.eachAccident = limits[0];
				data.workersCompensation.employersLiability.eachEmployee = limits[2];
				data.workersCompensation.employersLiability.eachPolicy = limits[1];

				// Territories
				data.workersCompensation.otherStates = territories;

				// Claims
				if(this.policy.claims.length){
					data.workersCompensation.lossHistory = [];

					for(const claim_index in this.policy.claims){
						if(Object.prototype.hasOwnProperty.call(this.policy.claims, claim_index)){
							const claim = this.policy.claims[claim_index];
							const loss_object = {};

							loss_object.data = claim.date.format('YYYY-MM-DD');

							// Append the loss to the loss history
							data.workersCompensation.lossHistory.push(loss_object);
						}
					}
				}

			// Contacts
			data.contacts = [];
			for(const contact_index in this.app.business.contacts){
				if(Object.prototype.hasOwnProperty.call(this.app.business.contacts, contact_index)){
					const contact = this.app.business.contacts[contact_index];
					const contact_object = {};
					const phone = contact.phone.toString();

					contact_object.type = 'Client';
					contact_object.firstName = contact.first_name;
					contact_object.lastName = contact.last_name;
					contact_object.phone = `${phone.substring(0, 3)}-${phone.substring(3, 6)}-${phone.substring(phone.length - 4)}`;
					contact_object.email = contact.email;

					// Append the contact to the contacts array
					data.contacts.push(contact_object);
				}
			}

			data.namedInsured = this.app.business.name;
			data.description = this.get_operation_description();
			data.customerKey = this.app.id;
			data.partnerAgentFirstName = 'Adam';
			data.partnerAgentLastName = 'Kiefer';
			data.partnerAgentEmail = 'customersuccess@talageins.com';

			// Send JSON to the insurer
			await this.send_json_request(host, '/api/v1/Quotes', JSON.stringify(data), {'Authorization': token}).then((res) => {

				// Pie only returns indications
				this.indication = true;

				// Attempt to get the quote number
				try{
					this.request_id = res.id;
				}
catch(e){
					log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find quote number.`);
				}

				// Attempt to get the amount of the quote
				try{
					this.amount = parseInt(res.premiumDetails.totalEstimatedPremium, 10);
				}
catch(e){
					// This is handled in return_result()
				}

				// Attempt to grab the limits info
				try{
					for(const limit_name in res.employersLiabilityLimits){
						if(Object.prototype.hasOwnProperty.call(res.employersLiabilityLimits, limit_name)){
							const limit = res.employersLiabilityLimits[limit_name];

							switch(limit_name){
								case 'eachAccident':
									this.limits[1] = limit;
									break;
								case 'eachEmployee':
									this.limits[2] = limit;
									break;
								case 'eachPolicy':
									this.limits[3] = limit;
									break;
								default:
									log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Unexpected limit found in response`);
									break;
							}
						}
					}
				}
catch(e){
					// This is handled in return_result()
				}

				// Grab the writing company
				try{
					this.policy_info.writer = res.insuranceCompany;
				}
catch(e){
					log.warn(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find writing company.`);
				}

				// Dirty? (Indicates a Valen outage)
				if(res.isDirty){
					this.reasons.push('Valen is Down: Quote generated during a Valen outage are less likely to go unrevised by Underwriting.');
				}

				// Send the result of the request
				fulfill(this.return_result('quoted'));
			}).catch(() => {
				fulfill(this.return_result('error'));
			});
		});
	}
};