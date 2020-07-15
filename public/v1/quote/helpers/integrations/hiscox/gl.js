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
			'Association': 'Corporation or other Organization (other than the above)',
			'Corporation': 'Corporation or other Organization (other than the above)',
			'Limited Liability Company': 'Limited Liability Company',
			'Limited Partnership': 'Partnership',
			'Other': 'Corporation or other Organization (other than the above)',
			'Partnership': 'Partnership',
			'Sole Proprietorship': 'Individual/Sole Proprietor'
		};

		// These are the limits supported by Employers

		// Build the Promise that will be returned
		return new Promise(async(fulfill) => {
			// Determine which URL to use
			let host = '';
			if(this.insurer.test_mode){
				host = 'sdbx.hiscox.com';
			}else{
				log.error('Hiscox production API URL not set. We need to obtain this from Hiscox.');
				return;
			}

			// Get a token from their auth server
			let had_error = false;
			const tokenRequestData = {
				client_id: this.username,
				client_secret: this.password
			};
			const tokenResponse = await this.send_request(host, '/toolbox/auth/accesstoken', tokenRequestData, {'Content-Type': 'application/x-www-form-urlencoded'}).catch((error) => {
				log.error(error.message + __location);
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
				log.error('Unable to authenticate with Hiscox (GL integration). ' + __location);
				fulfill(this.return_error('error', 'Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
				return;
			}
			const token = responseObject.access_token;

			// Hiscox has us define our own Request ID
			this.request_id = this.generate_uuid();

			// Fill in calculated fields
			this.requestDate = momentTimezone.tz('America/Los_Angeles').format('YYYY-MM-DD');

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

			// Determine the primary and secondary locations
			this.primaryLocation = this.app.business.locations[0];
			this.secondaryLocations = false;
			if(this.app.business.locations.length > 1){
				this.secondaryLocations = [...this.app.business.locations];
				this.secondaryLocations.shift();
			}

			// Render the template into XML and remove any empty lines (artifacts of control blocks)
			const xml = hiscoxGLTemplate.render(this, {'ucwords': (val) => stringFunctions.ucwords(val.toLowerCase())}).replace(/\n\s*\n/g, '\n');

			// Specify the path to the Quote endpoint
			const path = '/partner/v3/quote';

			log.info(`Sending application to https://${host}${path}. This can take up to 30 seconds.`);

			// Send the XML to the insurer
			await this.send_xml_request(host, path, xml, {'Authorization': `Bearer ${token}`, 'Accept': 'application/xml', 'Content-Type': 'application/xml'})
				.then((result) => {
					// Parse the various status codes and take the appropriate action
					log.debug('---------------');
					log.debug(util.inspect(res));
					/*let res = result['soap:Envelope']['soap:Body'][0]['eig:getWorkCompPolicyResponse'][0].response[0];
					const status_code = res.PolicyRs[0].MsgStatus[0].MsgStatusCd[0];*/







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
									fulfill(this.return_result('error'));
									return;
								}

								// Attempt to extract the details of the fault encountered
								if(Object.prototype.hasOwnProperty.call(xmlResponse, 'fault') && Object.prototype.hasOwnProperty.call(xmlResponse.fault, 'faultstring')){
									log.error(`${this.insurer.name} ${this.policy.type} Integration Error: API returned 422 error with message: ${xmlResponse.fault.faultstring[0]}` + __location);
									this.reasons.push(`API returned 422 error with message: ${xmlResponse.fault.faultstring[0]}`);
								}else{
									log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to parse 422 error returned from API (XML did not contain fault object)` + __location);
								}

								// Return an error result
								fulfill(this.return_result('error'));
							});
						}else{
							// An HTTP error was encountered other than a 422 error
							log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to connect to insurer. API returned error code: ${res.httpStatusCode}` + __location);
							fulfill(this.return_result('error'));
						}
					}else{
						// There is no response from the API server to help us understand the error
						log.error(`${this.insurer.name} ${this.policy.type} Integration Error: Unable to connect to insurer. An unknown error was encountered.` + __location);
						fulfill(this.return_result('error'));
					}
				});
		});
	}
};