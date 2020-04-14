/**
 * Defines a single insurer
 */

'use strict';

const crypt = requireShared('./services/crypt.js');
const RestifyError = require('restify-errors');
const moment_timezone = require('moment-timezone');

module.exports = class Insurer {

	constructor() {
		this.id = 0;
		this.logo = '';
		this.name = '';
		this.outage = false;
		this.packages = [];
		this.password = '';
		this.payment_options = [];
		this.policy_types = [];
		this.rating = '';
		this.slug = '';
		this.state = 1;
		this.test_mode = process.env.NODE_ENV === 'production' ? 0 : 1;
		this.test_password = '';
		this.test_username = '';
		this.username = '';
	}

	/**
	 * Returns the decrypted password for authenticating to this insurer's API. If
	 * we are in test mode, the test password will be returned instead.
	 *
	 * @return {string} - The password used to sign in to this insurer's API
	 */
	get_password() {
		if (this.test_mode) {
			return crypt.decrypt(this.test_password);
		}
		return crypt.decrypt(this.password);
	}

	/**
	 * Returns the decrypted username for authenticating to this insurer's API. If
	 * we are in test mode, the test username will be returned instead.
	 *
	 * @return {string} - The username used to sign in to this insurer's API
	 */
	get_username() {
		if (this.test_mode) {
			return crypt.decrypt(this.test_username);
		}
		return crypt.decrypt(this.username);
	}

	/**
	 * Initializes the insurer, getting the information we need about them from the database
	 *
	 * @param {int} id - The ID of the insurer
	 * @returns {Promise.<object, Error>} True on success, Error on failure.
	 */
	init(id) {
		return new Promise(async (fulfill, reject) => {
			// Validate the provided ID
			if (!await validator.insurer(id)) {
				reject(new RestifyError.BadRequestError('Invalid insurer'));
				return;
			}

			// Build a query to get some basic information about this insurer from the database
			const sql = `
				SELECT \`i\`.\`id\`, \`i\`.\`state\`, \`i\`.\`logo\`, \`i\`.\`name\`, \`i\`.\`slug\`, \`i\`.\`rating\`, \`i\`.\`test_username\`, \`i\`.\`test_password\`, \`i\`.\`username\`, \`i\`.\`password\`, GROUP_CONCAT(DISTINCT \`ipt\`.\`policy_type\`) AS\'policy_types\', GROUP_CONCAT(DISTINCT \`io\`.\`id\`) AS \'outages\'
				FROM \`#__insurers\` AS \`i\`
				LEFT JOIN \`#__insurer_policy_types\` AS \`ipt\` ON \`ipt\`.\`insurer\` = \`i\`.\`id\`
				LEFT JOIN \`#__outages\` AS \`io\` ON \`i\`.\`id\` = \`io\`.\`insurer\` AND ('${moment_timezone.tz('America/Los_Angeles').format('YYYY/MM/DD HH:mm:ss')}' BETWEEN \`io\`.\`start\` AND \`io\`.\`end\`)
				WHERE \`i\`.\`id\` = ${db.escape(parseInt(id, 10))}
				GROUP BY \`i\`.\`id\`;
			`;

			// Run that query
			let had_error = false;
			const rows = await db.query(sql).catch(function (error) {
				log.error(error);
				had_error = true;
			});

			// Make sure we found the insurer, if not, the ID is bad
			if (had_error || !rows || rows.length !== 1) {
				reject(new RestifyError.BadRequestError('Invalid insurer'));
				return;
			}

			// Load the results of the query into this object
			for (const property in rows[0]) {
				// Make sure this property is part of the rows[0] object and that it is alsoa. property of this object
				if (Object.prototype.hasOwnProperty.call(rows[0], property) && Object.prototype.hasOwnProperty.call(this, property)) {
					switch (property) {
						case 'outages':
							this[property] = Boolean(rows[0][property]);
							continue;
						case 'policy_types':
							this[property] = rows[0][property].split(',');
							continue;
						default:
							this[property] = rows[0][property];
					}
				}
			}

			// Construct a query to get all of the payment plans for this insurer
			const payment_plan_sql = `
				SELECT \`pp\`.\`id\`, \`pp\`.\`name\`, \`pp\`.\`description\`, \`ipp\`.\`premium_threshold\`
				FROM \`#__insurer_payment_plans\` AS \`ipp\`
				LEFT JOIN \`#__payment_plans\` AS \`pp\` ON \`pp\`.\`id\` = \`ipp\`.\`payment_plan\`
				WHERE \`ipp\`.\`insurer\` = ${db.escape(this.id)};
			`;

			// Run that query
			const payment_plans = await db.query(payment_plan_sql).catch(function (error) {
				log.error(error);
				had_error = true;
			});

			// Make sure we found some payment plans
			if (had_error || !payment_plans || payment_plans.length <= 0) {
				log.error(`No payment plans set for ${this.name}`);
				reject(new RestifyError.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
				return;
			}

			// Loop through the results and store them in this object
			for (const i in payment_plans) {
				// Make sure this property is a direct child of its parent
				if (Object.prototype.hasOwnProperty.call(payment_plans, i)) {
					this.payment_options.push({
						'description': payment_plans[i].description,
						'id': payment_plans[i].id,
						'name': payment_plans[i].name,
						'threshold': payment_plans[i].premium_threshold
					});
				}
			}

			// Construct a query to get all of the packages for this insurer
			const packages_sql = `
				SELECT \`id\`, \`description\`, \`name\`
				FROM \`#__insurer_package_types\`
				WHERE \`insurer\` = ${db.escape(this.id)};
			`;

			// Run that query
			const packages = await db.query(packages_sql).catch(function (error) {
				log.error(error);
				had_error = true;
			});

			// Make sure no errors occured
			if (had_error) {
				reject(new RestifyError.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
				return;
			}

			// Loop through the results and store them in this object
			if (packages && packages.length > 0) {
				for (const i in packages) {
					// Make sure this property is a direct child of its parent
					if (Object.prototype.hasOwnProperty.call(packages, i)) {
						this.packages.push({
							'description': packages[i].description,
							'id': packages[i].id,
							'name': packages[i].name
						});
					}
				}
			}

			fulfill(this);
		});
	}
};