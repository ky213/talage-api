/**
 * Defines a single insurer
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
//const moment_timezone = require('moment-timezone');
const validator = global.requireShared('./helpers/validator.js');
const InsurerOutageBO = global.requireShared('./models/InsurerOutage-BO.js');


module.exports = class Insurer {
    constructor() {
        this.id = 0;
        this.logo = '';
        this.name = '';
        this.outage = false;
        //this.packages = [];
        this.password = '';
        //this.payment_options = [];
        this.policy_types = [];
        this.policy_type_details = {};
        this.rating = '';
        this.slug = '';
        this.state = 1;
        this.useSandbox = global.settings.ENV === 'production' ? 0 : 1;
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
        if (this.useSandbox) {
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
        if (this.useSandbox) {
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
    async init(id) {
        // Validate the provided ID
        if (!await validator.insurer(id)) {
            log.error(`Could not validate insurer ${id} ${__location}`);
            return new Error('Invalid insurer');
        }

        // Build a query to get some basic information about this insurer from the database
        const sql = `
				SELECT i.id, i.state, i.logo, i.name, i.slug, i.rating, i.test_username, i.test_password, i.username
					,i.password, GROUP_CONCAT(DISTINCT ipt.policy_type) AS 'policy_types'
					,ipt.slug as policyslug
				FROM clw_talage_insurers AS i
					 LEFT JOIN clw_talage_insurer_policy_types AS ipt ON ipt.insurer = i.id
				WHERE i.id = ${db.escape(parseInt(id, 10))}
				GROUP BY i.id;
			`;

        // Run that query
        let rows = null;
        try {
            rows = await db.query(sql);
        }
        catch (error) {
            log.error(`Could not query the database for insurer ${id} information: ${error} ${__location}`);
            return new Error('Database error');
        }
        // Make sure we found the insurer, if not, the ID is bad
        if (!rows || rows.length !== 1) {
            log.error(`Empty results when querying the database for insurer ${id} information ${__location}`);
            return new Error('Invalid insurer');
        }
        //override slug with policyslug if policyslug exists.
        if (rows[0] && rows[0].policyslug && rows[0].policyslug.length > 0) {
            rows[0].slug = rows[0].policyslug;
        }
        // Load the results of the query into this object
        for (const property in rows[0]) {
            // Make sure this property is part of the rows[0] object and that it is alsoa. property of this object
            if (Object.prototype.hasOwnProperty.call(rows[0], property) && Object.prototype.hasOwnProperty.call(this, property)) {
                switch (property) {
                    case 'policy_types':
                        this[property] = rows[0][property].split(',');
                        continue;
                    default:
                        this[property] = rows[0][property];
                }
            }
        }
        const insurerOutageBO = new InsurerOutageBO();
        this.outage = await insurerOutageBO.isInOutage(parseInt(id, 10));


        // Construct a query to get all the acord and api support data for all supported policy types
        const policy_type_details_sql = `SELECT ipt.insurer, ipt.policy_type, ipt.api_support, ipt.acord_support
							FROM clw_talage_insurer_policy_types ipt
							WHERE ipt.insurer = ${this.id}`;

        let policy_type_details = null;
        try {
            policy_type_details = await db.query(policy_type_details_sql)
        }
        catch (error) {
            log.error(`Database error retrieving policy type details for insurer: ${id}` + error + __location);
            return new Error('Database error');
        }

        if (policy_type_details) {
            policy_type_details.forEach(policy_type_detail => {
                this.policy_type_details[policy_type_detail.policy_type] = {
                    'api_support': policy_type_detail.api_support,
                    'acord_support': policy_type_detail.acord_support
                }
            })
        }

        return this;
    }
};