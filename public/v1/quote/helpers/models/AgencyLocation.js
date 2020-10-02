/**
 * Defines a single agent
 */

'use strict';

const crypt = global.requireShared('./services/crypt.js');
const { JsonWebTokenError } = require('jsonwebtoken');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');

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
        this.additionalInfo = {};
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
            //fix zero or null agency_location id in application
            // eslint-disable-next-line space-in-parens
            // eslint-disable-next-line no-extra-parens
            if((this.id > 0) === false){
                this.id = 1;
            }
            const agencyLocationId = this.id;
            // Define the where clause


            // Stop if there was an error
            if (hadError) {
                return;
            }
            let alInsurerList = null;
            let alTerritoyList = null;

            let agencyLocation = null;
            try{
                const agencyLocationBO = new AgencyLocationBO();
                agencyLocation = await agencyLocationBO.getById(this.id);
                if(agencyLocation.insurers){
                    alInsurerList = agencyLocation.insurers;
                } else {
                    log.error(`Agency location Missing insurers ${this.id} ` + JSON.stringify(agencyLocation) + __location);
                }
                if(agencyLocation.territories){
                    alTerritoyList = agencyLocation.territories;
                    this.territories = agencyLocation.territories;
                    log.debug("alTerritoyList: " + JSON.stringify(alTerritoyList));
                } else {
                    log.error(`Agency territories Missing insurers ${this.id} ` + JSON.stringify(agencyLocation) + __location);
                }
            } catch(err){
                log.error("Error Getting AgencyLocationBO error: " + err + __location);
                reject(err);
                hadError = true;
            }
            //AgencyBO

            let agencyInfo = null;
            try{
                const agencyBO = new AgencyBO();
                agencyInfo = await agencyBO.getById(agencyLocation.agency);
                agencyInfo.email = agencyLocation.email;
                agencyInfo.fname = agencyLocation.fname;
                agencyInfo.additionalInfo = agencyLocation.additionalInfo;
            } catch(err){
                log.error("Error Getting Agency error: " + err + __location);
                reject(err);
                hadError = true;
            }
            // Get the query results
            const insurers = alInsurerList;

            const agency_network = agencyInfo.agency_network;
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkJSON = await agencyNetworkBO.getById(agencyInfo.agency_network).catch(function(err){
                //error = err;
                log.error(`Get AgencyNetwork ${agency_network} AgencyLocation ${agencyLocationId} Error ` + err + __location);
            })
            if(agencyNetworkJSON){
                this.emailBrand = agencyNetworkJSON.email_brand;
            }

            // Extract the agent info, decrypting as necessary
            this.agency = agencyInfo.name;
            this.agencyEmail = agencyInfo.email;
            this.agencyId = agencyInfo.id;
            this.agencyNetwork = agencyInfo.agency_network;
            this.agencyPhone = agencyInfo.phone;
            this.agencyWebsite = agencyInfo.website;

            this.first_name = agencyInfo.fname;
            this.last_name = agencyInfo.lname;
            this.wholesale = Boolean(agencyInfo.wholesale);

            // Extract the insurer info
            for (const insurerId in insurers) {
                if (Object.prototype.hasOwnProperty.call(insurers, insurerId)) {
                    const insurer = insurers[insurerId];
                    // Decrypt the agent's information
                    if(insurer.agencyId){
                        insurer.agency_id = insurer.agencyId;
                    }
                    if(insurer.insurer){
                        insurer.id = insurer.insurer;
                    }
                    if(insurer.agentId){
                        insurer.agent_id = insurer.agentId;
                    }

                    if (!insurer.agency_id) {
                        log.error(`Agency missing Agency ID in configuration. ${JSON.stringify(insurer)}` + __location);
                        //Do not stop quote because one insurer is miss configured.
                        //return;
                    }

                    // Only decrypt agent_id setting if the insurer has enabled the field
                    if (insurer.enable_agent_id) {
                        if (!insurer.agent_id) {
                            log.error(`Agency missing Agent ID in configuration.  ${JSON.stringify(insurer)}` + __location);
                            //Do not stop quote because one insurer is miss configured.
                            // return;
                        }
                    }
                    this.insurers[insurer.id] = insurer;
                }
            }


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
                            log.error(`Agency insurer ID ${insurer} disabled because it was missing the agency_id, agent_id, or both.` + __location);
                            delete this.insurers[insurer];
                        }
                    }
                }

                if (!Object.keys(this.insurers).length) {
                    missing.push('Insurers');
                }
            } else {
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
                // log.debug(`this.territories` + JSON.stringify(this.territories))
                if (!this.territories.includes(location.state_abbr)) {
                    log.error(`Agent does not have ${location.state_abbr} enabled` + __location);
                    reject(serverHelper.requestError(`The specified agent is not setup to support this application in territory ${location.state_abbr}.`));

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
                    log.error(`Agent does not have ${policy.type} policies enabled`);
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


    shouldNotifyTalage(insureId){
        //  const insurerIdTest = insureId.toString;
        let notifyTalage = false;
        if(this.insurers){
            if(this.insurers[insureId] && this.insurers[insureId].policy_type_info){
                try{
                    if(this.insurers[insureId].policy_type_info.notifyTalage === true){
                        notifyTalage = true;
                    }
                } catch(e){
                    log.error(`Error getting notifyTalage from agencyLocation ${this.id} insureid ${insureId} ` + e + __location);
                }
            } else if(this.insurers[insureId] && !this.insurers[insureId].policy_type_info){
                log.error(`Quote Agency Location no policy_type_info for insurer ${insureId} in shouldNotifyTalage ` + __location);
            }
        } else {
            log.error("Quote Agency Location no insurers in shouldNotifyTalage " + __location);
        }
        return notifyTalage;


    }
};
