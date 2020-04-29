/**
 * Defines a single industry code
 */

'use strict';

const ActivityCode = require('./ActivityCode.js');
const serverHelper = require('../../../../../server.js');

module.exports = class Location {

	constructor() {
		this.app = null;

		this.activity_codes = [];
		this.address = '';
		this.address2 = '';
		this.city = '';
		this.full_time_employees = 0;
		this.identification_number = '';
		this.identification_number_type = null;
		this.part_time_employees = 0;
		this.square_footage = 0;
		this.territory = '';
		this.zip = 0;

		// WC Only
		this.unemployment_number = 0;
	}

	/**
	 * Populates this object with data from the request
	 *
	 * @param {object} data - The business data
	 * @returns {void}
	 */
	load(data) {
		Object.keys(this).forEach((property) => {
			if (!Object.prototype.hasOwnProperty.call(data, property)) {
				return;
			}

			// Trim whitespace
			if (typeof data[property] === 'string') {
				data[property] = data[property].trim();
			}

			// Perform property specific tasks
			switch (property) {
				case 'activity_codes':
					data[property].forEach((c) => {
						// Check if we have already seen this activity code
						let match = false;
						const tmp_id = parseInt(c.id, 10);
						this.activity_codes.forEach(function (code) {
							if (tmp_id === code.id) {
								match = true;

								// Seems convoluted, but we need to sanitize this payroll value
								const tmp_payroll = code.payroll;
								code.load(c);
								code.payroll += tmp_payroll;
							}
						});

						// If the activity code is new, add it
						if (!match) {
							const activity_code = new ActivityCode();
							activity_code.app = this.app;
							activity_code.load(c);
							this.activity_codes.push(activity_code);
						}
					});
					break;
				case 'full_time_employees':
				case 'part_time_employees':
				case 'square_footage':
				case 'year_built':
					this[property] = parseInt(data[property], 10);
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
	validate() {
		return new Promise(async (fulfill, reject) => {

			// Validate address
			if (this.address) {
				// Check for maximum length
				if (this.address.length > 100) {
					reject(serverHelper.RequestError('Address exceeds maximum of 100 characters'));
					return;
				}
			} else {
				reject(serverHelper.RequestError('Missing required field: address'));
				return;
			}

			// Validate address2
			if (this.address2) {
				// Check for maximum length
				if (this.address2.length > 20) {
					reject(serverHelper.RequestError('Address exceeds maximum of 20 characters'));
					return;
				}
			}

			// Validate activity_codes
			if (this.app.has_policy_type('WC')) {
				if (this.activity_codes.length) {
					const activity_code_promises = [];
					this.activity_codes.forEach(function (activity_code) {
						activity_code_promises.push(activity_code.validate());
					});
					await Promise.all(activity_code_promises).catch(function (error) {
						reject(error);
					});
				} else {
					reject(serverHelper.RequestError('At least 1 class code must be provided per location'));
					return;
				}
			}

			/*
			 * Identification Number
			 */
			if (this.identification_number) {
				if (validator.ein(this.identification_number)) {
					this.identification_number_type = 'EIN';
				} else if (this.app.business.entity_type === 'Sole Proprietorship' && validator.ssn(this.identification_number)) {
					this.identification_number_type = 'SSN';
				} else {
					reject(serverHelper.RequestError('Invalid formatting for property: identification number.'));
					return;
				}

				// Strip out the slashes, insurers don't like slashes
				this.identification_number = this.identification_number.replace(/-/g, '');
			} else {
				reject(serverHelper.RequestError('Identification Number is required'));
				return;
			}

			/**
			 * Full-Time Employees
			 * - Integer (enforced with parseInt() on load())
			 * - >= 0
			 * - <= 99,999
			 */
			if (isNaN(this.full_time_employees) || this.full_time_employees < 0 || this.full_time_employees > 255) {
				reject(serverHelper.RequestError('full_time_employees must be an integer between 0 and 255 inclusive'));
				return;
			}

			/**
			 * Part-Time Employees
			 * - Integer (enforced with parseInt() on load())
			 * - >= 0
			 * - <= 99,999
			 */
			if (isNaN(this.part_time_employees) || this.part_time_employees < 0 || this.part_time_employees > 255) {
				reject(serverHelper.RequestError('part_time_employees must be an integer between 0 and 255 inclusive'));
				return;
			}

			/*
			 * Validate square footage
			 * BOP specific
			 * - Integer (enforced with parseInt() on load())
			 * - >= 100
			 * - <= 99,999
			 */
			if (this.app.has_policy_type('BOP')) {
				if (!validator.isSqFtg(this.square_footage) || this.square_footage < 100 || this.square_footage > 99999) {
					return reject(serverHelper.RequestError('square_footage must be an integer between 100 and 99,999 inclusive'));
				}
			}

			// Validate zip
			if (this.zip) {
				if (!validator.isZip(this.zip)) {
					reject(serverHelper.RequestError('Invalid formatting for property: zip. Expected 5 digit format'));
					return;
				}

				// Make sure we have match in our database
				await db.query(`SELECT \`city\`, \`territory\` FROM \`#__zip_codes\` WHERE \`zip\` = ${this.zip} LIMIT 1;`).then((row) => {
					if (row) {
						this.city = row[0].city;
						this.territory = row[0].territory;
					} else {
						reject(serverHelper.RequestError('The zip code you entered is not valid'));
					}
				}).catch(function (error) {
					log.warn(error);
					reject(serverHelper.RequestError('The zip code you entered is not valid'));
				});
			} else {
				reject(serverHelper.RequestError('Missing required field: zip'));
				return;
			}


			// Validate unemployment_number (WC only)
			if (this.app.has_policy_type('WC')) {
				const unemployment_number_states = [
					'CO',
					'HI',
					'ME',
					'MN',
					'NJ',
					'RI',
					'UT'
				];

				// Check if an unemployment number is required
				if (unemployment_number_states.includes(this.territory)) {
					if (this.unemployment_number === 0) {
						reject(serverHelper.RequestError(`Unemployment Number is required for all locations in ${unemployment_number_states.join(', ')}`));
						return;
					}
					if (!Number.isInteger(this.unemployment_number)) {
						reject(serverHelper.RequestError('Unemployment Number must be an integer'));
						return;
					}
				} else {
					if (this.territory === 'MI' && this.unemployment_number && !Number.isInteger(this.unemployment_number)) {
						reject(serverHelper.RequestError('Unemployment Number must be an integer'));
						return;
					}
					this.unemployment_number = 0;
				}
			} else {
				this.unemployment_number = 0;
			}

			fulfill(true);
		});
	}
};