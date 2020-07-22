/**
 * General Liability Integration for Hiscox
 */

'use strict';

const Integration = require('../Integration.js');
const moment = require('moment');
const momentTimezone = require('moment-timezone');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js'); // eslint-disable-line no-unused-vars
const util = require('util');
const xmlToObj = require('xml2js').parseString;

// Read the template into memory at load
const hiscoxGLTemplate = require('jsrender').templates('./public/v1/quote/helpers/integrations/hiscox/gl.xmlt');

module.exports = class HiscoxGL extends Integration {

	/**
	 * Requests a quote from Hiscox and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	_insurer_quote() {
		// These are the statuses returned by the insurer and how they map to our Talage statuses

		/*this.possible_api_responses.DECLINE = 'declined';
		this.possible_api_responses.INPROGRESS = 'referred';
		this.possible_api_responses.PENDING_REFER = 'referred_with_price';
		this.possible_api_responses.QUICKDECLINE = 'declined';
		this.possible_api_responses.QUOTED = 'quoted';
		this.possible_api_responses.REFER = 'referred';
		this.possible_api_responses.RISKRESVDECLINE = 'declined';*/
		// CHECK SUPPORTED DEDUCTIBLES

		// Define the limits supported by this carrier
		let carrierLimits = [
			'300000/600000',
			'500000/1000000',
			'1000000/2000000',
			'2000000/2000000'
		];

		/**
		 * All classes of business mapped to Hiscox's Small Contractor, Landscape/Janitorial/Retail, and Mobile Food Classes use different limits.
		 * These categories are not returned by their API, but can be found in the Development Guidelines for Quote API on the Reference Data tab.
		 * The following list is in the order in which items appear in that spreadsheet.
		 */
		if([

			// Small Contractors (SC)

			'DS3', // Air conditioning systems installation/repair
			'DS4', // Appliance and accessories installation/repair
			'DS5', // Carpentry (interior only)
			'DS9', // Carpet/furniture/upholstery cleaning(offsite only)
			'DS2', // Clock making/repair
			'DS6', // Door or window installation/repair
			'DSC', // Driveway or sidewalk paving/repaving
			'DSN', // Drywall or wallboard installation/repair
			'DSD', // Electrical work (interior only)
			'DSE', // Fence installation/repair
			'DSF', // Floor covering installation(no ceramic tile/stone)
			'DS7', // Glass installation/repair (no auto work)
			'DSG', // Handyperson (no roof work)
			'DSH', // Heating/air conditioning install/repair(no LPG)
			'DS8', // Interior finishing work
			'DS1', // Locksmiths
			'DSL', // Masonry work
			'DSM', // Painting (interior only)
			'DSO', // Plastering or stucco work
			'DSP', // Plumbing (commercial/industrial)
			'DSQ', // Plumbing (residential/domestic)
			'DSS', // Sign painting/lettering (exterior only)
			'DSR', // Sign painting/lettering (interior only)
			'DST', // Tile/stone/marble/mosaic/terrazzo work(int. only)
			'DSA', // Upholstery work
			'DSU', // Window cleaning (nothing above 15 feet)

			// Landscapers, Janitors and Retailers (LJR)

			'DT1', // Appliance/electronic stores (Retail)
			'DT2', // Clothing/apparel stores (Retail)
			'DSB', // Exterior cleaning services
			'DT3', // Florists (Retail)
			'DT4', // Home furnishing stores (Retail)
			'DSI', // Janitorial/cleaning services
			'DT5', // Jewelry stores (Retail)
			'DSJ', // Landscaping/gardening services
			'DSK', // Lawn care services
			'DT7', // Other stores (with food/drinks) (Retail)
			'DT6', // Other stores (without food/drinks) (Retail)
			'DT8', // Snow blowing and removal (no auto coverage)

			// Mobile Food Services
			'DSV' // Mobile food services
		].includes(this.industry_code.hiscox)){
			carrierLimits = [
				'300000/300000',
				'500000/500000',
				'1000000/2000000',
				'2000000/2000000'
			];
		}

		// Define how legal entities are mapped for Hiscox
		const entityMatrix = {
			'Association': 'Corporation or other organization (other than the above)',
			'Corporation': 'Corporation or other organization (other than the above)',
			'Limited Liability Company': 'Limited liability company',
			'Limited Partnership': 'Partnership',
			'Other': 'Corporation or other organization (other than the above)',
			'Partnership': 'Partnership',
			'Sole Proprietorship': 'Individual/sole proprietor'
		};

		// These are the limits supported by Employers

		// Build the Promise that will be returned
		return new Promise(async(fulfill) => {
			// Determine which URL to use
			let host = '';
			if(this.insurer.test_mode){
				host = 'sdbx.hiscox.com';
			}else{
				log.error('Hiscox production API URL not set. We need to obtain this from Hiscox.' + __location);
				return;
			}

			// Bring the version number into the local scope so it is available in the template
			this.version = version;

			// Hiscox has us define our own Request ID
			this.request_id = this.generate_uuid();

			// Fill in calculated fields
			this.requestDate = momentTimezone.tz('America/Los_Angeles').format('YYYY-MM-DD');

			// Ensure we have an email and phone for this agency, both are required to quote with Hiscox
			if(!this.app.agencyLocation.agencyEmail || !this.app.agencyLocation.agencyPhone){
				log.warn(`Agency Location (ID: ${this.app.agencyLocation.id}) not fully configured for agency ${this.app.agencyLocation.agencyId}. Both an email address and phone number are required to quote with ${this.insurer.name}.`);
				this.reasons.push(`Agency Location not fully configured. Both an email address and phone number are required to quote with ${this.insurer.name}.`);
				fulfill(this.return_result('autodeclined'));
				return;
			}

			// Ensure this entity type is in the entity matrix above
			if(!(this.app.business.entity_type in entityMatrix)){
				this.reasons.push(`${this.insurer.name} does not support the entity type selected by the user`);
				fulfill(this.return_result('autodeclined'));
				return;
			}
			this.entityType = entityMatrix[this.app.business.entity_type];

			// Determine the best limits
			this.bestLimits = this.getBestLimits(carrierLimits);
			if(!this.bestLimits){
				this.reasons.push(`${this.insurer.name} does not support the requested liability limits`);
				fulfill(this.return_result('autodeclined'));
				return;
			}

			// Check and format the effective date (Hiscox only allows effective dates in the next 60 days, while Talage supports 90 days)
			if(this.policy.effective_date.isAfter(moment().startOf('day').add(60, 'days'))){
				this.reasons.push(`${this.insurer.name} does not support effective dates more than 60 days in the future`);
				fulfill(this.return_result('autodeclined'));
				return;
			}
			this.effectiveDate = this.policy.effective_date.format('YYYY-MM-DD');

			// Make a local copy of locations so that any Hiscox specific changes we make don't affect other integrations
			const locations = [...this.app.business.locations];

			// Hiscox requires a county be supplied in three states, in all other states, remove the county
			for(const location of locations){
				if(['FL', 'MO', 'TX'].includes(location.territory)){
					// Hiscox requires a county

					// There are special conditions in Harris County, TX, Jackson County, MO, Clay County, MO, Cass County, MO, and Platte County, MO
					if(location.territory === 'MO' && ['Cass', 'Clay', 'Jackson', 'Platte'].includes(location.county)){
						// For Clay County, MO - Check whether or not we are looking at Kansas City
						if(location.city === 'KANSAS CITY'){
							location.county = `${location.county} county (Kansas City)`;
						}else{
							location.county = `${location.county} county (other than Kansas City)`;
						}
					}else if(location.territory === 'TX' && location.county === 'Harris'){
						// For Harris County, TX - Check whether or not we are looking at Houston
						if(location.city === 'HOUSTON'){
							location.county = 'Harris county (Houston)';
						}else{
							location.county = 'Harris county (other than Houston)';
						}
					}else{
						// Hiscox requires the word 'county' on the end of the county name
						location.county = `${location.county} county`;
					}
				}else{
					// Hiscox does not want a territory, set it to false so the integration doesn't include it
					location.county = false;
				}
			}

			// Determine the primary and secondary locations
			this.primaryLocation = locations[0];
			this.secondaryLocations = false;
			if(this.app.business.locations.length > 1){
				this.secondaryLocations = locations.shift();
			}

			// Get a token from their auth server
			let had_error = false;
			const tokenRequestData = {
				client_id: this.username,
				client_secret: this.password
			};
			const tokenResponse = await this.send_request(host, '/toolbox/auth/accesstoken', tokenRequestData, {'Content-Type': 'application/x-www-form-urlencoded'}).catch((error) => {
				log.error(`${this.insurer.name} ${this.policy.type} Unable to obtain authentication token. API returned error: ${error.message}` + __location);
				had_error = true;
				fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
			});
			if(had_error){
				return;
			}
			const responseObject = JSON.parse(tokenResponse);

			// Verify that we got back what we expected
			if(
				!Object.prototype.hasOwnProperty.call(responseObject, 'status')
				|| responseObject.status !== 'approved'
				|| !Object.prototype.hasOwnProperty.call(responseObject, 'access_token')
				|| !responseObject.access_token
			){
				log.error(`${this.insurer.name} ${this.policy.type} Unable to authenticate with API.` + __location);
				fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
				return;
			}
			const token = responseObject.access_token;

			// Render the template into XML and remove any empty lines (artifacts of control blocks)
			const xml = hiscoxGLTemplate.render(this, {'ucwords': (val) => stringFunctions.ucwords(val.toLowerCase())}).replace(/\n\s*\n/g, '\n');

log.debug(xml);


// AGENCY LOCATION PHONE AND EMAIL ARE REQUIRED TO QUOTE

			// Specify the path to the Quote endpoint
			const path = '/partner/v3/quote';

			log.info(`Sending application to https://${host}${path}. This can take up to 30 seconds.`);

			// Send the XML to the insurer
			await this.send_xml_request(host, path, xml, {'Authorization': `Bearer ${token}`, 'Accept': 'application/xml', 'Content-Type': 'application/xml'})
				.then((result) => {
					// Make sure we got a Quote Response
					if(!Object.prototype.hasOwnProperty.call(result, 'InsuranceSvcRs')
						|| !Object.prototype.hasOwnProperty.call(result.InsuranceSvcRs, 'QuoteRs')
						|| !Array.isArray(result.InsuranceSvcRs.QuoteRs)
						|| result.InsuranceSvcRs.QuoteRs.length !== 1
					){
						log.error(`${this.insurer.name} ${this.policy.type} Integration Error: API did not return an error, but it also did not return a quote. ${JSON.stringify(result)}` + __location);
						this.reasons.push('API did not return an error, but it also did not return a quote.');
						fulfill(this.return_result('error'));
						return;
					}

					// Isolate the quote response object for easier reference
					const quoteRs = result.InsuranceSvcRs.QuoteRs[0];

					// Attempt to get the Request ID
					if(Object.prototype.hasOwnProperty.call(quoteRs, 'RqUID')
						&& Array.isArray(quoteRs.RqUID)
						&& quoteRs.RqUID.length === 1
					){
						this.request_id = quoteRs.RqUID[0];
					}else{
						log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find request ID.` + __location);
						// Even though an error occurred, we may still be able to get a quote, so processing will continue to try and provide a good user experience
					}

					// Attempt to get the Quote ID
					if(Object.prototype.hasOwnProperty.call(quoteRs, 'QuoteID')
						&& Array.isArray(quoteRs.QuoteID)
						&& quoteRs.QuoteID.length === 1
					){
						this.number = quoteRs.QuoteID[0];
					}else{
						log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find quote number.` + __location);
						// Even though an error occurred, we may still be able to get a quote, so processing will continue to try and provide a good user experience
					}

					// Make sure the quote included a General Liability response
					if(!Object.prototype.hasOwnProperty.call(quoteRs, 'ProductQuoteRs')
						|| !Array.isArray(quoteRs.ProductQuoteRs)
						|| quoteRs.ProductQuoteRs.length !== 1
						|| !Object.prototype.hasOwnProperty.call(quoteRs.ProductQuoteRs[0], 'GeneralLiabilityQuoteRs')
						|| !Array.isArray(quoteRs.ProductQuoteRs[0].GeneralLiabilityQuoteRs)
						|| quoteRs.ProductQuoteRs[0].GeneralLiabilityQuoteRs.length !== 1
					){
						log.error(`${this.insurer.name} ${this.policy.type} Integration Error: API returned some quote information, but no actual quote. ${JSON.stringify(result)}` + __location);
						this.reasons.push('API returned some quote information, but no actual quote.');
						fulfill(this.return_result('error'));
						return;
					}

					// Isolate the GL quote response for easier reference
					const generalLiabilityQuoteRs = quoteRs.ProductQuoteRs[0].GeneralLiabilityQuoteRs[0];

					// Attempt to get the Premium
					if(Object.prototype.hasOwnProperty.call(generalLiabilityQuoteRs, 'Premium')
						&& Array.isArray(generalLiabilityQuoteRs.Premium)
						&& generalLiabilityQuoteRs.Premium.length === 1
						&& Object.prototype.hasOwnProperty.call(generalLiabilityQuoteRs.Premium[0], 'Annual')
						&& Array.isArray(generalLiabilityQuoteRs.Premium[0].Annual)
						&& generalLiabilityQuoteRs.Premium[0].Annual.length === 1
					){
						this.amount = generalLiabilityQuoteRs.Premium[0].Annual[0];
					}else{
						log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find premium amount.` + __location);
						// A quote with a zero amount is handled in return_result(), so processing should continue beyond this point
					}

					// Attempt to get the Limits
					if(Object.prototype.hasOwnProperty.call(generalLiabilityQuoteRs, 'RatingResult')
						&& Array.isArray(generalLiabilityQuoteRs.RatingResult)
						&& generalLiabilityQuoteRs.RatingResult.length === 1
					){

						// Isolate the limits for easier reference
						const limits = generalLiabilityQuoteRs.RatingResult[0];

						// Attempt to get the Each Occurrence (LOI) Limit
						if(Object.prototype.hasOwnProperty.call(limits, 'LOI')
							&& Array.isArray(limits.LOI)
							&& limits.LOI.length === 1
						){
							this.limits[4] = parseInt(limits.LOI[0], 10);
						}else{
							log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find each occurance limit.` + __location);
						}

						// Attempt to get the General Aggregate (AggLOI) Limit
						if(Object.prototype.hasOwnProperty.call(limits, 'AggLOI')
							&& Array.isArray(limits.AggLOI)
							&& limits.AggLOI.length === 1
						){
							this.limits[8] = parseInt(limits.AggLOI[0], 10);
						}else{
							log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find general aggregate limit.` + __location);
						}
					}else{
						log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find any limits.` + __location);
						// Even though an error occurred, we may still be able to get a quote, so processing will continue to try and provide a good user experience
					}

					// Send the result of the request
					fulfill(this.return_result('quoted'));
				})
				.catch((err) => {
					// Check if we have an HTTP status code to give us more information about the error encountered
					if(Object.prototype.hasOwnProperty.call(err, 'httpStatusCode')){

						if(err.httpStatusCode === 422 && Object.prototype.hasOwnProperty.call(err, 'response')){

							// Convert the response to XML
							xmlToObj(err.response, (e, xmlResponse) => {
								// Check if there was an error parsing the XML
								if(e){
									log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to parse 422 error returned from API (response may not be XML)` + __location);
									log.info(err.response);
									this.reasons.push('Unable to parse 422 error returned from API (response may not be XML)');
									fulfill(this.return_result('error'));
									return;
								}

								// Check for a validation error
								if(Object.prototype.hasOwnProperty.call(xmlResponse, 'InsuranceSvcRq')
									&& Object.prototype.hasOwnProperty.call(xmlResponse.InsuranceSvcRq, 'Validations')
									&& Array.isArray(xmlResponse.InsuranceSvcRq.Validations)
									&& xmlResponse.InsuranceSvcRq.Validations.length > 0
									&& Object.prototype.hasOwnProperty.call(xmlResponse.InsuranceSvcRq.Validations[0], 'Validation')
									&& Array.isArray(xmlResponse.InsuranceSvcRq.Validations[0].Validation)
									&& xmlResponse.InsuranceSvcRq.Validations[0].Validation.length > 0
								){
									// Localize the validation errors for easier reference
									const validationErrors = xmlResponse.InsuranceSvcRq.Validations[0].Validation;

									// Loop through and capture each validation message
									for(const validationError of validationErrors){
										if(Object.prototype.hasOwnProperty.call(validationError, 'DataItem')
											&& Object.prototype.hasOwnProperty.call(validationError, 'Status')
											&& Object.prototype.hasOwnProperty.call(validationError, 'XPath')
										){
											const reason = `${validationError.Status} (${validationError.DataItem}) at ${validationError.XPath}`;
											log.error(`${this.insurer.name} ${this.policy.type} Integration Error: ${reason}`);
											this.reasons.push(reason);
										}else{
											log.error(`${this.insurer.name} ${this.policy.type} Integration Error: API returned validation errors, but not as an array as expected. ${JSON.stringify(validationError)}` + __location);
											this.reasons.push(`API returned an error that could not be parsed. Validation object missing one of the following: DataItem, Status, XPath`);
										}
									}
								}else if(Object.prototype.hasOwnProperty.call(xmlResponse, 'InsuranceSvcRq')
									&& Object.prototype.hasOwnProperty.call(xmlResponse.InsuranceSvcRq, 'Errors')
									&& Array.isArray(xmlResponse.InsuranceSvcRq.Errors)
									&& xmlResponse.InsuranceSvcRq.Errors.length > 0
									&& Object.prototype.hasOwnProperty.call(xmlResponse.InsuranceSvcRq.Errors[0], 'Error')
									&& Array.isArray(xmlResponse.InsuranceSvcRq.Errors[0].Error)
									&& xmlResponse.InsuranceSvcRq.Errors[0].Error.length > 0
								){
									// Check for an error response (this includes declined applications)

									// Localize the validation errors for easier reference
									const errorResponses = xmlResponse.InsuranceSvcRq.Errors[0].Error;

									// Loop through and capture each error
									for(const errorResponse of errorResponses){
										if(Object.prototype.hasOwnProperty.call(errorResponse, 'Code')
											&& Object.prototype.hasOwnProperty.call(errorResponse, 'Description')
										){
											if(errorResponse.Code[0].startsWith('DECLINE')){
												// Return an error result
												fulfill(this.return_result('declined'));
												return;
											}else{
												// Non-decline error
												const reason = `${errorResponse.Description[0]} (${errorResponse.Code[0]})`;
												log.error(`${this.insurer.name} ${this.policy.type} Integration Error: ${reason}`);
												this.reasons.push(reason);
											}
										}else{
											log.error(`${this.insurer.name} ${this.policy.type} Integration Error: API returned validation errors, but not as an array as expected. ${JSON.stringify(validationError)}` + __location);
											this.reasons.push(`API returned an error that could not be parsed. Validation object missing one of the following: DataItem, Status, XPath`);
										}
									}
								}else if(Object.prototype.hasOwnProperty.call(xmlResponse, 'fault') && Object.prototype.hasOwnProperty.call(xmlResponse.fault, 'faultstring')){
									// Check for a system fault
									log.error(`${this.insurer.name} ${this.policy.type} Integration Error: API returned 422 error with message: ${xmlResponse.fault.faultstring[0]}` + __location);
									this.reasons.push(`API returned 422 error with message: ${xmlResponse.fault.faultstring[0]}`);
								}else{
									log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to parse 422 error returned from API (XML did not contain fault object or the Validations object was missing or malformed): ${JSON.stringify(xmlResponse)}` + __location);
									this.reasons.push('Unable to parse 422 error returned from API (XML did not contain fault object or the Validations object was missing or malformed)');
								}

								// Return an error result
								fulfill(this.return_result('error'));
							});
						}else{
							// An HTTP error was encountered other than a 422 error
							log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to connect to insurer. API returned error code: ${err.httpStatusCode}` + __location);
							this.reasons.push(`Unable to connect to insurer. API returned error code: ${err.httpStatusCode}`);
							fulfill(this.return_result('error'));
						}
					}else{
						// There is no response from the API server to help us understand the error
						log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to connect to insurer. An unknown error was encountered.` + __location);
						this.reasons.push('Unable to connect to insurer. An unknown error was encountered.');
						fulfill(this.return_result('error'));
					}
				});
		});
	}
};