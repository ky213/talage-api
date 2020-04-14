/**
 * Defines a single industry code
 */

'use strict';

const Claim = require('./Claim.js');
const RestifyError = require('restify-errors');
const moment = require('moment');

module.exports = class Policy{

	constructor(app){
		this.app = app;

		// All Policies
		this.claims = [];
		this.effective_date = '';
		this.expiration_date = '';
		this.insurers = [];
		this.limits = '';
		this.json = '';
		this.type = '';

		// BOP and GL Only
		this.gross_sales = 0;

		// BOP Only
		this.coverage_lapse_non_payment = null;

		// GL Only
		this.deductible = 0;

		// WC Only
		this.coverage_lapse = null;
	}

	/**
	 * Populates this object with data from the request
	 *
	 * @param {object} data - The business data
	 * @returns {void}
	 */
	load(data){
		Object.keys(this).forEach((property) => {
			if(!Object.prototype.hasOwnProperty.call(data, property)){
				return;
			}

			// Trim whitespace
			if(typeof data[property] === 'string'){
				data[property] = data[property].trim();
			}

			switch(property){
				case 'claims':
					data[property].forEach((c) => {
						const claim = new Claim();
						claim.load(c);
						this.claims.push(claim);
					});
					break;
				case 'effective_date':
					this[property] = moment(data[property], 'MM-DD-YYYY', true);
					this.expiration_date = moment(this[property]).add(1, 'years');
					break;
				case 'insurers':
					if(Array.isArray(data[property])){
						this[property] = data[property].map(function(id){
							return parseInt(id, 10);
						});
					}else{
						// Pass through for validation
						this[property] = data[property];
					}
					break;
				default:
					this[property] = data[property];
					break;
			}
		});
	}

	/**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
	validate(){
		return new Promise(async(fulfill, reject) => {
			// Validate effective_date
			if(this.effective_date){
				// Check for mm-dd-yyyy formatting

				if(!this.effective_date.isValid()){
					reject(new RestifyError.BadRequestError('Invalid formatting for property: effective_date. Expected mm-dd-yyyy'));
					return;
				}

				// Check if this date is in the past
				if(this.effective_date.isBefore(moment().startOf('day'))){
					reject(new RestifyError.BadRequestError('Invalid property: effective_date. The effective date cannot be in the past'));
					return;
				}

				// Check if this date is too far in the future
				if(this.effective_date.isAfter(moment().startOf('day').add(90, 'days'))){
					reject(new RestifyError.BadRequestError('Invalid property: effective_date. The effective date cannot be more than 90 days in the future'));
					return;
				}
			}else{
				reject(new RestifyError.BadRequestError('Missing property: effective_date'));
				return;
			}

			// Validate insurers (optional, contains ID's of insurers)
			if(Array.isArray(this.insurers)){
				if(this.insurers.length){
					let matched_insurer_count = 0;
					await this.app.insurers.forEach((insurer) => {
						if(this.insurers.includes(insurer.id) && insurer.policy_types.includes(this.type)){
							matched_insurer_count++;
						}
					});
					if(this.insurers.length !== matched_insurer_count){
						reject(new RestifyError.BadRequestError(`Specified insurer does not support ${this.type}.`));
						return;
					}
				}
			}else{
				reject(new RestifyError.BadRequestError(`Insurers must be specified as an array of IDs.`));
				return;
			}

			// Validate claims
			const claim_promises = [];
			if(this.claims.length){
				this.claims.forEach(function(claim){
					claim_promises.push(claim.validate());
				});
			}
			await Promise.all(claim_promises).catch(function(error){
				reject(error);
			});

			// Limits: If this is a WC policy, check if further limit controls are needed
			const territories = this.app.business.getTerritories();
			if(this.type === 'WC'){
				// In CA, force limits to be at least 1,000,000/1,000,000/1,000,000
				if(territories.includes('CA')){
					if(this.limits !== '2000000/2000000/2000000'){
						this.limits = '1000000/1000000/1000000';
					}

				// In OR force limits to be at least 500,000/500,000/500,000
				}else if(territories.includes('OR')){
					if(this.limits === '100000/500000/100000'){
						this.limits = '500000/500000/500000';
					}
				}
			}

			// Validate type
			if(this.type){
				const valid_types = ['BOP',
					'GL',
					'WC'];
				if(valid_types.indexOf(this.type) < 0){
					reject(new RestifyError.BadRequestError('Invalid policy type'));
					return;
				}
			}else{
				reject(new RestifyError.BadRequestError('You must provide a policy type'));
				return;
			}

			// BOP & GL Specific Properties
			if(this.type === 'BOP' || this.type === 'GL'){

				/**
				 * Gross Sales Amount
				 */
				if(this.gross_sales){
					if(!validator.gross_sales(this.gross_sales)){
						reject(new RestifyError.BadRequestError('The gross sales amount must be a dollar value greater than 0 and below 100,000,000'));
						return;
					}

					// Cleanup this input
					if(typeof this.gross_sales === 'number'){
						this.gross_sales = Math.round(this.gross_sales);
					}else{
						this.gross_sales = Math.round(parseFloat(this.gross_sales.toString().replace('$', '').replace(/,/g, '')));
					}
				}else{
					reject(new RestifyError.BadRequestError('Gross sales amount must be provided'));
					return;
				}
			}

			// BOP Specific Properties
			if(this.type === 'BOP'){

				/**
				 * Coverage Lapse Due To Non-Payment
				 * - Boolean
				 */
				if(this.coverage_lapse_non_payment === null){
					reject(new RestifyError.BadRequestError('coverage_lapse_non_payment is required, and must be a true or false value'));
					return;
				}
			}else if(this.type === 'GL'){
				// GL Specific Properties

				/**
				 * Deductible
				 * - Integer (enforced with parseInt() on load())
				 * - Only accepted in AR, AZ, CA, CO, ID, NM, NV, OK, OR, TX, UT, or WA
				 * - Must be one of:
				 * 		- 500
				 * 		- 1000
				 * 		- 1500
				 */
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
					if(!this.deductible){
						reject(new RestifyError.BadRequestError('You must supply a deductible for GL policies in AR, AZ, CA, CO, ID, NM, NV, OK, OR, TX, UT, or WA. The deductible can be 500, 1000, or 1500'));
						return;
					}
					if(!validator.deductible(this.deductible)){
						reject(new RestifyError.BadRequestError('The policy deductible you supplied is invalid. It must be one of 500, 1000, or 1500.'));
						return;
					}
					this.deductible = parseInt(this.deductible, 10);
				}else{
					// Default the deductible
					this.deductible = 500;
				}
			}else if(this.type === 'WC'){
				// WC Specific Properties

				/**
				 * Coverage Lapse
				 * - Boolean
				 */
				if(this.coverage_lapse === null){
					reject(new RestifyError.BadRequestError('coverage_lapse is required, and must be a true or false value'));
					return;
				}
			}

			// Limits
			if(!validator.limits(this.limits, this.type)){
				reject(new RestifyError.BadRequestError('The policy limits you supplied are invalid.'));
				return;
			}

			fulfill(true);
		});
	}
};