/* eslint-disable no-unused-vars */
/**
 * Defines a single agent
 */

const validator = global.requireShared('./helpers/validator.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');

module.exports = class AgencyLocation {

    constructor(appBusiness, appPolicies) {
        //this.app = app;
        this.business = JSON.parse(JSON.stringify(appBusiness));
        this.appPolicies = appPolicies;
        this.agency = '';
        this.agencyEmail = '';
        this.agencyId = 0;
        this.agencyNetwork = 0;
        this.agencyPhone = '';
        this.agencyWebsite = '';
        this.emailBrand = '';
        this.first_name = '';
        this.id = 0;
        this.insurers = {};
        this.insurerList = [];
        this.last_name = '';
        this.territories = [];
        this.wholesale = false; // Flag for the talage wholesale agency (id=2) used for SolePro/AF
        this.additionalInfo = {};
        this.wholesaleAgencyId = 0;
        this.quotingAgencyLocationDB = null;
        this.agencyPrimeAgencyLocationDB = null;
        this.talageWholesaleAgencyLocationDB = null;
        this.isPrimaryAgency = false;
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
            let agencyId = null;
            try{
                const addAgencyPrimaryLocation = true;
                agencyLocation = await agencyLocationBO.getById(this.id, getChildren, addAgencyPrimaryLocation);
                log.debug(`AGency Location Model - ${agencyLocation}}`)
                alInsurerList = agencyLocation?.insurers;
                agencyId = agencyLocation.agencyId
                //this is for using all of Agency Prime's appointments
                if(agencyLocation.useAgencyPrime){
                    //Agency Network's prime agency's prime location
                    const respAgencyObj = await this.getPrimaryAgencyAndLocation(agencyId)
                    this.quotingAgencyLocationDB = respAgencyObj.agencyLocationJSON;
                    this.agencyPrimeAgencyLocationDB = respAgencyObj.agencyLocationJSON;
                    agencyId = respAgencyObj.agencyJSON?.systemId;
                }
                else {
                    this.quotingAgencyLocationDB = agencyLocation;
                }
                //Insurer are set at Agency Network Prime Agency, so we need the quoting location.
                //Talage wholesale is set at the insurer level.  See below.
                if(this.quotingAgencyLocationDB.insurers){
                    alInsurerList = this.quotingAgencyLocationDB.insurers;
                }
                else {
                    log.error(`Agency location Missing insurers ${this.id} ` + JSON.stringify(agencyLocation) + __location);
                }
                //Territory has set at agency not Talage Wholesale or Agency Network Prime Agency.
                if(agencyLocation.territories){
                    alTerritoyList = agencyLocation.territories;
                    this.territories = agencyLocation.territories;
                    //log.debug("alTerritoyList: " + JSON.stringify(alTerritoyList));
                }
                else {
                    log.error(`Agency territories Missing  Application Id ${this.id} ` + JSON.stringify(agencyLocation) + __location);
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
                agencyInfo = await agencyBO.getById(this.quotingAgencyLocationDB.agencyId);
                agencyInfo.email = this.quotingAgencyLocationDB.email ? this.quotingAgencyLocationDB.email : agencyInfo.email;
                agencyInfo.fname = this.quotingAgencyLocationDB.firstName ? this.quotingAgencyLocationDB.firstName : agencyInfo.fname;
                agencyInfo.lname = this.quotingAgencyLocationDB.lastName ? this.quotingAgencyLocationDB.lastName : agencyInfo.lname;
                agencyInfo.additionalInfo = this.quotingAgencyLocationDB.additionalInfo ? this.quotingAgencyLocationDB.additionalInfo : agencyInfo.additionalInfo;
                agencyInfo.phone = this.quotingAgencyLocationDB.phone ? this.quotingAgencyLocationDB.phone : agencyInfo.phone;

                if(this.quotingAgencyLocationDB.agencyId === 1 || agencyInfo.primaryAgency){
                    this.isPrimaryAgency = true
                }
            }
            catch(err){
                log.error("Error Getting Agency error: " + err + __location);
                reject(err);
                hadError = true;
            }

            const agencyNetworkId = agencyInfo.agency_network;
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkJSON = await agencyNetworkBO.getById(agencyInfo.agency_network).catch(function(err){
                //error = err;
                log.error(`Get AgencyNetwork ${agencyNetworkId} AgencyLocation ${agencyLocationId} Error ` + err + __location);
            })
            if(agencyNetworkJSON){
                this.emailBrand = agencyNetworkJSON.email_brand;
            }

            // Extract the agent info
            this.agency = agencyInfo.name;
            this.agencyEmail = agencyInfo.email;
            this.agencyId = agencyInfo.systemId;
            this.agencyNetwork = agencyInfo.agencyNetworkId;
            this.agencyPhone = agencyInfo.phone;
            this.agencyWebsite = agencyInfo.website;

            this.first_name = agencyInfo.fname;
            this.last_name = agencyInfo.lname;
            //Digalent use talage wholesale agency  - Obsolete
            this.wholesale = Boolean(agencyInfo.wholesale);

            for (const insurer of alInsurerList) {
                try{
                    //if agency is using talageWholeSale with the insurer.
                    //user talage's main location (agencyLocation systemId: 1)
                    //Tracks if there is a wholesale miss.
                    let addInsurer = true;
                    if(insurer.talageWholesale || insurer.useAgencyPrime){
                        if(agencyInfo.agencyNetworkId === 1){
                            insurer.talageWholesale = true;
                            insurer.useAgencyPrime = false;
                        }
                        // Extract the insurer info
                        let agencyPrimeAgencyLocation = null
                        if(insurer.useAgencyPrime){
                            if(this.agencyPrimeAgencyLocationDB === null){
                                const agencyPrimeLocationDB = await agencyLocationBO.getAgencyPrimeLocation(this.agencyId,agencyNetworkId);
                                if(agencyPrimeLocationDB){
                                    //const primaryAgencyLocationSystemId = agencyPrimeLocationDB.systemId;
                                    //this.agencyPrimeAgencyLocationDB = await agencyLocationBO.getById(primaryAgencyLocationSystemId, getChildren);
                                    this.agencyPrimeAgencyLocationDB = agencyPrimeLocationDB
                                }

                                if(agencyInfo.agencyNetworkId === 1){
                                    insurer.talageWholesale = true;
                                }
                            }
                            if(this.agencyPrimeAgencyLocationDB){
                                agencyPrimeAgencyLocation = this.agencyPrimeAgencyLocationDB
                                const wholesaleInsurer = agencyPrimeAgencyLocation.insurers.find((ti) => ti.insurerId === insurer.insurerId);
                                //agencyPrime is using talageWhole - Load TalageWhole.
                                if(wholesaleInsurer.talageWholesale){
                                    insurer.talageWholesale = wholesaleInsurer.talageWholesale;
                                }
                            }
                        }
                        if(insurer.talageWholesale){
                            if(this.talageWholesaleAgencyLocationDB === null){
                                const talageAgencyLocationSystemId = 1;
                                this.talageWholesaleAgencyLocationDB = await agencyLocationBO.getById(talageAgencyLocationSystemId, getChildren);
                            }
                            agencyPrimeAgencyLocation = this.talageWholesaleAgencyLocationDB
                        }
                        //Find correct insurer
                        if(agencyPrimeAgencyLocation){
                            const wholesaleInsurer = agencyPrimeAgencyLocation.insurers.find((ti) => ti.insurerId === insurer.insurerId);
                            if(wholesaleInsurer){
                                if(wholesaleInsurer.agencyId){
                                    insurer.agency_id = wholesaleInsurer.agencyId;
                                    insurer.agencyId = wholesaleInsurer.agencyId;
                                    insurer.agencyCred3 = wholesaleInsurer.agencyCred3;
                                }
                                if(wholesaleInsurer.insurerId){
                                    insurer.id = wholesaleInsurer.insurerId;
                                }
                                if(wholesaleInsurer.agentId){
                                    insurer.agent_id = wholesaleInsurer.agentId;
                                    insurer.agentId = wholesaleInsurer.agentId;
                                    insurer.agencyCred3 = wholesaleInsurer.agencyCred3;
                                }
                                if(wholesaleInsurer.talageWholesale){
                                    insurer.talageWholesale = wholesaleInsurer.talageWholesale;
                                }
                                log.info(`Agency ${agencyLocation.agencyId} using Wholesaler for insurerId ${insurer.insurerId}` + __location);
                            }
                            else {
                                log.error(`Agency ${agencyLocation.agencyId} could not retrieve Wholesaler for insurerId ${insurer.insurerId}. Contact Customer Success - Bad Primary Agency Configuration` + __location);
                                addInsurer = false;
                            }
                        }
                        else {
                            if(insurer.talageWholesale){
                                log.error(`Agency ${agencyInfo.name} LocId: ${agencyLocation.agencyId} could not retrieve Talage Wholesale Agency Location for insurerId ${insurer.insurerId}` + __location);
                            }
                            else {
                                log.error(`Agency ${agencyInfo.name} LocId: ${agencyLocation.agencyId} could not retrieve Wholesaler for insurerId ${insurer.insurerId}. Contact Customer Success - Bad Primary Agency Configuration for Agency Network ${agencyNetworkJSON.name}` + __location);
                            }
                            addInsurer = false;
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

                        if (insurer.enable_cred3) {
                            if (!insurer.agencyCred3 && insurer.insurerId !== 19) {
                                log.error(`Agency ${agencyLocation.agencyId} missing agencyCred3 in configuration.  ${JSON.stringify(insurer)}` + __location);
                                //Do not stop quote because one insurer is miss configured.
                            }
                        }
                    }

                    //Tiered Quoting Setup - failing back to Primary Agency Tiers
                    //log.debug(`QUOTING AGENCY LOCATION tiering:  ${this.isPrimaryAgency}: this.isPrimaryAgency  agencyNetworkJSON?.featureJson?.enableTieredQuoting ${agencyNetworkJSON?.featureJson?.enableTieredQuoting} ` + __location)
                    if(!this.isPrimaryAgency && agencyNetworkJSON?.agencyNetworkId > 1
                        && agencyNetworkJSON?.featureJson?.enableTieredQuoting
                        && (agencyNetworkJSON?.featureJson?.enableTieredQuotingAgencyLevel === false || agencyInfo.enableTieredQuoting === false)){
                        // User Primary agency tier for
                        try{
                            const responseAgencyAndAgencyLocation = await this.getPrimaryAgencyAndLocation(agencyLocation.agencyId)
                            const primaryAgencyLocationJSON = responseAgencyAndAgencyLocation?.agencyLocationJSON
                            //loop through policytypes and get tier info.
                            for(const ptCode in insurer.policyTypeInfo){
                                //reset to tier 1 in case primary agency is not set.
                                if(insurer.policyTypeInfo[ptCode]){
                                    insurer.policyTypeInfo[ptCode].quotingTierLevel = 1
                                    if(primaryAgencyLocationJSON?.insurers){
                                        const wholesaleInsurer = primaryAgencyLocationJSON.insurers.find((ti) => ti.insurerId === insurer.insurerId);
                                        if(wholesaleInsurer?.policyTypeInfo[ptCode] && wholesaleInsurer?.policyTypeInfo[ptCode].quotingTierLevel > 0){
                                            insurer.policyTypeInfo[ptCode].quotingTierLevel = wholesaleInsurer?.policyTypeInfo[ptCode].quotingTierLevel
                                        }
                                        else {
                                            log.error(`Agency ${agencyLocation.agencyId} primary agency ${primaryAgencyLocationJSON.agencyId} no tiering for ${insurer.name} ${ptCode}` + __location);
                                        }
                                    }
                                    else {
                                        log.error(`Agency ${agencyLocation.agencyId} primary agency ${primaryAgencyLocationJSON.agencyId} does not have insurers` + __location);
                                    }
                                }
                            }
                        }
                        catch(err){
                            log.error(`Agency ${agencyLocation.agencyId} error setting up tiering insurerId ${insurer.insurerId} error: ${err}` + __location);
                        }
                    }
                    else if(!this.isPrimaryAgency && this.quotingAgencyLocationDB.agencyId > 1 && agencyInfo.enableTieredQuoting !== true) {
                        //reset everything to 1
                        log.debug(`QUOTING AGENCY LOCATION tiering resetting to 1` + __location)
                        for(const ptCode in insurer.policyTypeInfo){
                            //reset to tier 1 in case primary agency is not set.
                            if(insurer.policyTypeInfo[ptCode]){
                                insurer.policyTypeInfo[ptCode].quotingTierLevel = 1
                            }
                        }
                    }
                    if(addInsurer){
                        this.insurers[insurer.id] = insurer;
                        this.insurerList.push(insurer)
                    }
                }
                catch(err){
                    log.error(`Agency ${agencyLocation.agencyId} error adding insurerId ${insurer.insurerId} error: ${err}` + __location);
                }
            }
            log.debug(`QUOTING AGENCY LOCATION this.insurerList ${JSON.stringify(this.insurerList)}`)


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

    async getPrimaryAgencyAndLocation(agencyId){
        const responseObj = {};
        try{
            const agencyBO = new AgencyBO();
            let agencyNetworkId = 0;
            const agencyJSON = await agencyBO.getById(agencyId);
            if(agencyJSON){
                responseObj.agencyJSON = agencyJSON
                agencyNetworkId = agencyJSON.agencyNetworkId;
            }
            else {
                log.error(`getPrimaryAgencyAndLocation: Could not find secondary agency ${agencyId}` + __location)
            }
            const agencyLocationBO = new AgencyLocationBO();
            if(agencyNetworkId > 0){
                //Get newtorks prime agency.
                const queryAgency = {
                    "agencyNetworkId": agencyNetworkId,
                    "primaryAgency": true
                }
                const agencyList = await agencyBO.getList(queryAgency);
                if(agencyList && agencyList.length > 0){
                    const agencyPrime = agencyList[0];
                    //get agency's prime location
                    // return prime location's insurers.
                    const returnChildren = true;
                    const agencyLocationPrime = await agencyLocationBO.getByAgencyPrimary(agencyPrime.systemId, returnChildren);
                    if(agencyLocationPrime){
                        responseObj.agencyLocationJSON = agencyLocationPrime
                    }
                    else {
                        log.error(`Agency Prime id ${agencyPrime.systemId} as no insurers ` + __location)
                    }
                }
                else {
                    log.error(`No Agency Prime for secondary agency ${agencyId}  agencyNetworkId ${agencyNetworkId}` + __location)
                }

            }
            else {
                log.error(`getPrimaryAgencyAndLocation: No agency Network ${agencyNetworkId} for secondary agency ${agencyId}` + __location)
            }
        }
        catch(err){
            log.error(`Error getting AgencyPrime's insurers secondary agency ${agencyId} ` + err + __location);
        }
        return responseObj;
    }
};