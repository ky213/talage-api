/**
 * Defines a single industry code
 */

'use strict';

const moment = require('moment');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class Claim{

	constructor(){
		this.amountPaid = 0;
		this.amountReserved = 0;
		this.date = '';

		// Worker's Compensation Claims
		this.missedWork = false;
		this.open = false;
	}

	/**
	 * Populates this object with data from the request
	 *
	 * @param {object} claimBO - The business data
	 * @returns {void}
	 */
	load(claimBO){

        this.amountPaid = claimBO.amount_paid;
		this.amountReserved = claimBO.amount_reserved;
		this.date = moment(claimBO.date);

		// Worker's Compensation Claims
		this.missedWork = Boolean(claimBO.missed_work);
		this.open = Boolean(claimBO.open);
	}

	/**
	 * Checks that the data supplied is valid
	 *
	 * @returns {boolean} True if valid, false otherwise (with error text stored in the error property)
	 */
	validate(){
		return new Promise((fulfill, reject) => {

			/**
			 * Amount Paid (dollar amount)
			 * - >= 0
			 * - < 15,000,000
			 */
			if(this.amountPaid){
				if(!validator.claim_amount(this.amountPaid)){
					reject(serverHelper.requestError('The amount must be a dollar value greater than 0 and below 15,000,000'));
					return;
				}

				// Cleanup this input
				if(typeof this.amountPaid === 'number'){
					this.amountPaid = Math.round(this.amountPaid);
				}
else{
					this.amountPaid = Math.round(parseFloat(this.amountPaid.toString().replace('$', '').replace(/,/g, '')));
				}
			}
else{
				this.amountPaid = 0;
			}

			/**
			 * Amount Reserved (dollar amount)
			 * - >= 0
			 * - < 15,000,000
			 */
			if(this.amountReserved){
				if(!validator.claim_amount(this.amountReserved)){
					reject(serverHelper.requestError('The amountReserved must be a dollar value greater than 0 and below 15,000,000'));
					return;
				}

				// Cleanup this input
				if(typeof this.amountReserved === 'number'){
					this.amountReserved = Math.round(this.amountReserved);
				}
else{
					this.amountReserved = Math.round(parseFloat(this.amountReserved.toString().replace('$', '').replace(/,/g, '')));
				}
			}
else{
				this.amountReserved = 0;
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
			if(this.missedWork){
				// Other than bool?
				if(typeof this.missedWork !== 'boolean'){
					reject(serverHelper.requestError('Invalid format for missedWork. Expected true/false'));
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
			if(!this.open && this.amountReserved){
				reject(serverHelper.requestError('Only open claims can have an amount reserved'));
				return;
			}

			fulfill(true);
		});
	}
};