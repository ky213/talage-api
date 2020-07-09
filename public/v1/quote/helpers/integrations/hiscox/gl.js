/**
 * General Liability Integration for Hiscox
 */

'use strict';

const Integration = require('../Integration.js');
const moment = require('moment');
const util = require('util');

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

		// Define how legal entities are mapped for Hiscox
		const entity_matrix = {
			'Association': 'Corporation or other Organization (other than the above)',
			'Corporation': 'Corporation or other Organization (other than the above)',
			'Limited Liability Company': 'Limited Liability Company',
			'Limited Partnership': 'Partnership',
			'Other': 'Corporation or other Organization (other than the above)',
			'Partnership': 'Partnership',
			'Sole Proprietorship': 'Individual/Sole Proprietor'
		};

		// Build the Promise that will be returned
		return new Promise(async(fulfill) => {
			// Hiscox has us define our own Request ID
			this.request_id = this.generate_uuid();

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

			// Render the template into XML and remove any empty lines (artifacts of control blocks)
			const xml = hiscoxGLTemplate.render(this).replace(/\n\s*\n/g, '\n');





			log.debug(xml);
			return;
		});
	}
};