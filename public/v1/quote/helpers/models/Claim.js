/**
 * Defines a single industry code
 */

'use strict';

const moment = require('moment');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class Claim{

	constructor(){
		this.amount = 0;
		this.amount_reserved = 0;
		this.date = '';

		// Worker's Compensation Claims
		this.missed_time = false;
		this.open = false;
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
				case 'date':
					this[property] = moment(data[property], 'YYYY-MM-DD');
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
	 * @returns {boolean} True if valid, false otherwise (with error text stored in the error property)
	 */
	validate(){
		return new Promise((fulfill, reject) => {

			/**
			 * Amount (dollar amount)
			 * - >= 0
			 * - < 15,000,000
			 */
			if(this.amount){
				if(!validator.claim_amount(this.amount)){
					reject(serverHelper.requestError('The amount must be a dollar value greater than 0 and below 15,000,000'));
					return;
				}

				// Cleanup this input
				if(typeof this.amount === 'number'){
					this.amount = Math.round(this.amount);
				}else{
					this.amount = Math.round(parseFloat(this.amount.toString().replace('$', '').replace(/,/g, '')));
				}
			}

			/**
			 * Amount Reserved (dollar amount)
			 * - >= 0
			 * - < 15,000,000
			 */
			if(this.amount_reserved){
				if(!validator.claim_amount(this.amount_reserved)){
					reject(serverHelper.requestError('The amount_reserved must be a dollar value greater than 0 and below 15,000,000'));
					return;
				}

				// Cleanup this input
				if(typeof this.amount_reserved === 'number'){
					this.amount_reserved = Math.round(this.amount_reserved);
				}else{
					this.amount_reserved = Math.round(parseFloat(this.amount_reserved.toString().replace('$', '').replace(/,/g, '')));
				}
			}

			/**
			 * Date
			 * - Date (enforced with moment() on load())
			 * - Cannot be in the future
			 */
			if(this.date){
				//  Valid date
				if(!this.date.isValid()){
					reject(serverHelper.requestError('Invalid date of claim. Expected YYYY-MM-DD'));
					return;
				}

				// Confirm date is not in the future
				if(this.date.isAfter(moment())){
					reject(serverHelper.requestError('Invalid date of claim. Date cannot be in the future'));
					return;
				}
			}

			/**
			 * Missed Time
			 * - Boolean
			 */
			if(this.missed_time){
				// Other than bool?
				if(typeof this.missed_time !== 'boolean'){
					reject(serverHelper.requestError('Invalid format for missed_time. Expected true/false'));
					return;
				}
			}

			/**
			 * Open
			 * - Boolean
			 */
			if(this.open){
				// Other than bool?
				if(typeof this.open !== 'boolean'){
					reject(serverHelper.requestError('Invalid format for open claims. Expected true/false'));
					return;
				}
			}

			/**
			 * Only open claims can have an amount reserved
			 */
			if(!this.open && this.amount_reserved !== 0){
				reject(serverHelper.requestError('Only open claims can have an amount reserved'));
				return;
			}

			fulfill(true);
		});
	}
};