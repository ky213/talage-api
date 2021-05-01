/* eslint-disable no-unused-vars */
/**
 * Defines a single agent
 */

'use strict';

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
            //const queries = [];
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
            const agencyLocationBO = new AgencyLocationBO();
            const getChildren = true;
            
            try{
                const addAgencyPrimaryLocation = true;
                agencyLocation = await agencyLocationBO.getById(this.id, getChildren, addAgencyPrimaryLocation);
                if(agencyLocation.insurers){
                    alInsurerList = agencyLocation.insurers;
                }
                else {
                    log.error(`Agency location Missing insurers ${this.id} ` + JSON.stringify(agencyLocation) + __location);
                }
                if(agencyLocation.territories){
                    alTerritoyList = agencyLocation.territories;
                    this.territories = agencyLocation.territories;
                    //log.debug("alTerritoyList: " + JSON.stringify(alTerritoyList));
                }
                else {
                    log.error(`Agency territories Missing insurers ${this.id} ` + JSON.stringify(agencyLocation) + __location);
                }
            }
            catch(err){
                log.error("Error Getting AgencyLocationBO error: " + err + __location);
                reject(err);
                hadError = true;
            }
            //AgencyBO

            let agencyInfo = null;
            try{
                const agencyBO = new AgencyBO();
                agencyInfo = await agencyBO.getById(agencyLocation.agencyId);
                agencyInfo.email = agencyLocation.email;
                agencyInfo.fname = agencyLocation.firstName;
                agencyInfo.additionalInfo = agencyLocation.additionalInfo;
            }
            catch(err){
                log.error("Error Getting Agency error: " + err + __location);
                reject(err);
                hadError = true;
            }

            const agency_network = agencyInfo.agency_network;
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkJSON = await agencyNetworkBO.getById(agencyInfo.agency_network).catch(function(err){
                //error = err;
                log.error(`Get AgencyNetwork ${agency_network} AgencyLocation ${agencyLocationId} Error ` + err + __location);
            })
            if(agencyNetworkJSON){
                this.emailBrand = agencyNetworkJSON.email_brand;
            }

            // Extract the agent info
            this.agency = agencyInfo.name;
            this.agencyEmail = agencyInfo.email;
            this.agencyId = agencyInfo.systemId;
            this.agencyNetwork = agencyInfo.agency_network;
            this.agencyPhone = agencyInfo.phone;
            this.agencyWebsite = agencyInfo.website;

            this.first_name = agencyInfo.fname;
            this.last_name = agencyInfo.lname;
            this.wholesale = Boolean(agencyInfo.wholesale);

            // Extract the insurer info
            let talageAgencyLocation = null
            for (const insurer of alInsurerList) {
                //if agency is using talageWholeSale with the insurer.
                //user talage's main location (agencyLocation systemId: 1)
                if(insurer.talageWholesale){
                    if(!talageAgencyLocation){
                        const talageAgencyLocationSystemId = 1;
                        talageAgencyLocation = await agencyLocationBO.getById(talageAgencyLocationSystemId, getChildren);
                    }
                    //Find correct insurer
                    const talageInsurer = talageAgencyLocation.insurers.find((ti) => ti.insurerId === insurer.insurerId);
                    if(talageInsurer){
                        if(talageInsurer.agencyId){
                            insurer.agency_id = talageInsurer.agencyId;
                            insurer.agencyId = talageInsurer.agencyId;
                        }
                        if(talageInsurer.insurerId){
                            insurer.id = talageInsurer.insurerId;
                        }
                        if(talageInsurer.agentId){
                            insurer.agent_id = talageInsurer.agentId;
                            insurer.agentId = talageInsurer.agentId;
                        }
                        log.info(`Agency ${agencyLocation.agencyId} using Talage Wholesale for insurerId ${insurer.insurerId}`);
                    }
                    else {
                        log.error(`Agency ${agencyLocation.agencyId} could not retrieve Talage Wholesale for insurerId ${insurer.insurerId}`);
                    }
                }
                else {
                    if(insurer.agencyId){
                        insurer.agency_id = insurer.agencyId;
                    }
                    if(insurer.insurerId){
                        insurer.id = insurer.insurerId;
                    }
                    if(insurer.agentId){
                        insurer.agent_id = insurer.agentId;
                    }

                    if (!insurer.agency_id) {
                        log.error(`Agency ${agencyLocation.agencyId} missing Agency ID in configuration. ${JSON.stringify(insurer)}` + __location);
                        //Do not stop quote because one insurer is miss configured.
                        //return;
                    }

                    if (insurer.enable_agent_id) {
                        if (!insurer.agent_id) {
                            log.error(`Agency ${agencyLocation.agencyId} missing Agent ID in configuration.  ${JSON.stringify(insurer)}` + __location);
                            //Do not stop quote because one insurer is miss configured.
                        }
                    }
                }
                this.insurers[insurer.id] = insurer;
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
            //Todo use app applicationDoc
            this.business.locations.forEach((location) => {
                // log.debug(`this.territories` + JSON.stringify(this.territories))
                if (!this.territories.includes(location.state)) {
                    log.error(`Agent ${this.agencyId} does not have ${location.state} enabled` + __location);
                    reject(new Error(`The specified agent is not setup to support this application in territory ${location.state}.`));
                }
            });

            // Policy Types
            //this being down twice once here and one on application.get_insurers()
            this.appPolicies.forEach((policy) => {
                let match_found = false;
                // eslint-disable-next-line guard-for-in
                for (const insurerKey in this.insurers) {
                    const insurer = this.insurers[insurerKey];
                    if (insurer.policyTypeInfo && insurer.policyTypeInfo[policy.type.toUpperCase()]
                            && insurer.policyTypeInfo[policy.type.toUpperCase()].enabled === true) {
                        match_found = true;
                    }
                }
                if (!match_found) {
                    log.error(`Agent ${this.agencyId} location ${this.id} does not have ${policy.type} policies enabled` + __location);
                    reject(new Error('The specified agent is not setup to support this application.'));
                }
            });

            fulfill(true);
        });
    }

    shouldNotifyTalage(insureId){
        //  const insurerIdTest = insureId.toString;
        let notifyTalage = false;
        if(this.insurers){
            if(this.insurers[insureId] && this.insurers[insureId].talageWholesale === true){
                notifyTalage = true;
            }
        }
        else {
            log.error("Quote Agency Location no insurers in shouldNotifyTalage " + __location);
        }
        return notifyTalage;
    }
};