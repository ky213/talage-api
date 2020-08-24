/**
 * Defines a single agent
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class AgencyLocation {

    constructor(appBusiness, appPolicies) {
        //this.app = app;
        this.business = appBusiness;
        this.appPolicies = appPolicies;
        this.agency = '';
        this.agencyEmail = '';
        this.agencyId = 0;
        this.agencyNetwork = '';
        this.agencyPhone = '';
        this.agencyWebsite = '';
        this.emailBrand = '';
        this.first_name = '';
        this.id = 0;
        this.key = '';
        this.insurers = {};
        this.last_name = '';
        this.territories = [];
        this.wholesale = false;
    }

    /**
	 * Initializes an agent, getting the information we need about them from the database
	 *
	 * @returns {Promise.<object, Error>} True on success, Error on failure.
	 */
    init() {
        return new Promise(async(fulfill, reject) => {
            // Make sure we can load the agency data
            if (!this.id) {
                reject(new Error('You must set an agency location ID before running init.'));
                return;
            }

            // Track errors
            let hadError = false;

            // Array for tracking queries
            const queries = [];

            // Define the where clause
            // const where = `a.id = ${db.escape(parseInt(this.id, 10))}`;
            const where = `a.id = ${this.id}`

            // SQL for getting agency / location details
            queries.push(`
				SELECT ag.id, ag.agency_network, an.email_brand, a.email, a.fname, a.lname, ag.name, ag.phone, ag.website, ag.wholesale
				FROM clw_talage_agency_locations a
				LEFT JOIN clw_talage_agencies ag ON a.agency = ag.id
				INNER JOIN clw_talage_agency_networks an ON ag.agency_network = an.id
				WHERE ${where} LIMIT 1;
			`);

            // SQL for getting agency insurers
            queries.push(`
				SELECT ai.insurer id, ai.agency_id, i.agent_login, ai.agent_id, ai.policy_type_info, ai.bop, ai.gl, ai.wc, i.enable_agent_id
				FROM clw_talage_agency_location_insurers AS ai
				LEFT JOIN clw_talage_agency_locations AS a ON ai.agency_location = a.id
				LEFT JOIN clw_talage_insurers AS i ON i.id = ai.insurer
				WHERE ${where} AND i.state > 0;
			`);

            // SQL for getting agency territories
            queries.push(`
				SELECT at.territory
				FROM clw_talage_agency_location_territories AS at
				LEFT JOIN clw_talage_agency_locations AS a ON at.agency_location = a.id
				WHERE ${where};
			`);

            // Wait for all queries to return
            const results = await Promise.all(queries.map((sql) => db.query(sql))).catch(function(error) {
                log.error("DB queries error: " + error + __location);
                reject(error);
                hadError = true;
            });

            // Stop if there was an error
            if (hadError) {
                return;
            }

            // Get the query results
            const agencyInfo = results[0];
            const insurers = results[1];
            const territories = results[2];

            // Extract the agent info, decrypting as necessary
            this.agency = agencyInfo[0].name;
            this.agencyEmail = await crypt.decrypt(agencyInfo[0].email);
            this.agencyId = agencyInfo[0].id;
            this.agencyNetwork = agencyInfo[0].agency_network;
            this.agencyPhone = await crypt.decrypt(agencyInfo[0].phone);
            this.agencyWebsite = await crypt.decrypt(agencyInfo[0].website);
            this.emailBrand = agencyInfo[0].email_brand;
            this.first_name = await crypt.decrypt(agencyInfo[0].fname);
            this.last_name = await crypt.decrypt(agencyInfo[0].lname);
            this.wholesale = Boolean(agencyInfo[0].wholesale);

            // Extract the insurer info
            for (const insurerId in insurers) {
                if (Object.prototype.hasOwnProperty.call(insurers, insurerId)) {
                    const insurer = insurers[insurerId];

                    // Decrypt the agent's information
                    if (!insurer.agency_id) {
                        log.warn('Agency missing Agency ID in configuration.' + __location);
                        return;
                    }
                    insurer.agency_id = await crypt.decrypt(insurer.agency_id); // eslint-disable-line no-await-in-loop

                    // Only decrypt agent_id setting if the insurer has enabled the field
                    if (insurer.enable_agent_id) {
                        if (!insurer.agent_id) {
                            log.warn('Agency missing Agent ID in configuration.' + __location);
                            return;
                        }
                        insurer.agent_id = await crypt.decrypt(insurer.agent_id.toString()); // eslint-disable-line no-await-in-loop
                    }

                    // Parse the JSON for easy access
                    if(insurer.policy_type_info){
                        insurer.policy_type_info = JSON.parse(insurer.policy_type_info);
                    }
                    this.insurers[insurer.id] = insurer;
                }
            }

            // Extract the territory info
            territories.forEach((row) => {
                this.territories.push(row.territory);
            });

            // Check that we have all of the required data
            const missing = [];
            if (!this.agency) {
                missing.push('Agency Name');
            }
            if (!this.agencyEmail) {
                missing.push('Agency Email');
            }
            if (!this.first_name) {
                missing.push('Agent First Name');
            }
            if (!this.last_name) {
                missing.push('Agent Last Name');
            }
            if (!this.territories) {
                missing.push('Territories');
            }

            // Check that each insurer has API settings
            if (this.insurers) {
                for (const insurer in this.insurers) {
                    if (Object.prototype.hasOwnProperty.call(this.insurers, insurer)) {
                        if (!this.insurers[insurer].agency_id || this.insurers[insurer].enable_agent_id && !this.insurers[insurer].agent_id) {
                            log.warn(`Agency insurer ID ${insurer} disabled because it was missing the agency_id, agent_id, or both.` + __location);
                            delete this.insurers[insurer];
                        }
                    }
                }

                if (!Object.keys(this.insurers).length) {
                    missing.push('Insurers');
                }
            }
            else {
                missing.push('Insurers');
            }

            if (missing.length) {
                log.error(`Agency application failed because the Agent was not fully configured. Missing: ${missing.join(', ')}` + __location);
                reject(new Error('Agent not fully configured. Please contact us.'));
                return;
            }

            fulfill(true);
        });
    }

    /**
	 * Populates this object with data from the request
	 *
	 * @param {object} data - The business data
	 * @returns {Promise.<object, Error>} A promise that returns an object containing an example API response if resolved, or an Error if rejected
	 */
    load(data) {
        return new Promise((fulfill) => {
            Object.keys(this).forEach((property) => {
                if (!Object.prototype.hasOwnProperty.call(data, property)) {
                    return;
                }

                // Trim whitespace
                if (typeof data[property] === 'string') {
                    data[property] = data[property].trim();
                }

                // Load the property into the object
                this[property] = data[property];
            });
            fulfill(true);
        });
    }

    /**
	 * Checks whether or not this agent can support the application that was submitted
	 *
	 * @returns {Promise.<object, Error>} A promise that returns true if this application is supported, rejects with a RestifyError.BadRequestError if not
	 */
    supports_application() {
        return new Promise((fulfill, reject) => {
            // Territories
            this.business.locations.forEach((location) => {
                if (!this.territories.includes(location.territory)) {
                    log.info(`Agent does not have ${location.territory} enabled`);
                    reject(serverHelper.requestError('The specified agent is not setup to support this application.'));

                }
            });

            // Policy Types
            this.appPolicies.forEach((policy) => {
                let match_found = false;
                for (const insurer in this.insurers) {
                    if (Object.prototype.hasOwnProperty.call(this.insurers, insurer)) {
                        if (this.insurers[insurer][policy.type.toLowerCase()] === 1) {
                            match_found = true;
                        }
                    }
                }
                if (!match_found) {
                    log.info(`Agent does not have ${policy.type} policies enabled`);
                    reject(serverHelper.requestError('The specified agent is not setup to support this application.'));

                }
            });

            fulfill(true);
        });
    }

    /**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns a boolean indicating whether or not this record is valid, or an Error if rejected
	 */
    validate() {
        return new Promise(async(fulfill, reject) => {

            /**
			 * Key (required) - This is how we uniquelly identify agents
			 */
            if (this.key) {
                // Check formatting
                if (!await validator.agent(this.key)) {
                    reject(serverHelper.requestError('Invalid agent provided.'));
                    return;
                }
            }

            fulfill(true);
        });
    }
};