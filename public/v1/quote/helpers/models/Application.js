/* eslint-disable prefer-const */
/* eslint-disable no-catch-shadow */
/**
 * Defines a single industry code
 */

'use strict';
const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const get_questions = global.requireShared('./helpers/getQuestions.js');

const htmlentities = require('html-entities').Html5Entities;
const AgencyLocation = require('./AgencyLocation.js');
const Business = require('./Business.js');
const Insurer = require('./Insurer.js');
const Policy = require('./Policy.js');
const Question = require('./Question.js');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');
const helper = global.requireShared('./helpers/helper.js');

const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const ApplicationPolicyTypeBO = global.requireShared('./models/ApplicationPolicyType-BO.js');
const ApplicationQuestionBO = global.requireShared('./models/ApplicationQuestion-BO.js');

module.exports = class Application {
    constructor() {
        this.agencyLocation = null;
        this.business = null;
        this.id = 0;
        this.insurers = [];
        this.policies = [];
        this.questions = {};
    }

    /**
	 * Populates this object based on applicationId in the request
	 *
	 * @param {object} data - The application data
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
    async load(data) {
        log.verbose('Loading data into Application');

        // ID
        this.id = parseInt(data.id, 10);

        // load application from database.
        let error = null
        let applicationBO = new ApplicationBO();
        await applicationBO.loadFromId(this.id).catch(function(err) {
            error = err;
            log.error("Unable to get application for quoting appId: " + data.id + __location);
        });

        if (error) {
            throw error;
        }
        //LastStep check.
        const devAllowRequote = global.settings.ENV === 'development' && global.settings.APPLICATION_ALLOW_REQUOTE === 'YES';
        if (devAllowRequote) {
            log.info("###### APPLICATION_ALLOW_REQUOTE is enabled. Bypassing application age and finished checks ######");
        }

        // this.state > 15, 16 is finished.
        if(!devAllowRequote && applicationBO.state > 15){
            log.warn("An attempt to quote application that is finished.")
            throw new Error("Finished Application cannot be quoted")

        }
        //age check - TODO add override Age parameter to allow requoting.
        const dbCreated = moment(applicationBO.created);
        const nowTime = moment().utc();
        const ageInMinutes = nowTime.diff(dbCreated, 'minutes');
        log.debug('Application age in minutes ' + ageInMinutes);
        if(!devAllowRequote && ageInMinutes > 60){
            log.warn(`Attempt to update an old application. appid ${this.id}` + __location);
            throw new Error("Data Error: Application may not be updated do to age.");
        }
        //log.debug("applicationBO: " + JSON.stringify(applicationBO));

        // Load the business information
        this.business = new Business();
        try {
            await this.business.load(applicationBO.business, applicationBO);
        }
        catch (err) {
            log.error(`Unable to load the business for application ${this.id}: ${err} ${__location}`);
            throw err;
        }


        // eslint-disable-next-line prefer-const
        let appPolicyTypeList = [];
        // Load the policy information

        let applicationPolicyTypeBO = new ApplicationPolicyTypeBO()
        let policyTypeList = await applicationPolicyTypeBO.loadFromApplicationId(this.id).catch(function(err) {
            error = err;
            log.error("Unable to load list of applicationPolicyTypeBO for quoting appId: " + data.id + __location);
        });
        if (error) {
            throw error;
        }
        for (let i = 0; i < policyTypeList.length; i++) {
            const policyTypeBO = policyTypeList[i];
            const p = new Policy(this.business);
            await p.load(policyTypeBO, this.id, applicationBO, data.policies);
            this.policies.push(p);
            appPolicyTypeList.push(policyTypeBO.policy_type);
        }

        // data.policies.forEach((policy) => {
        //     const p = new Policy(this.business);
        //     p.load(policy);
        //     this.policies.push(p);
        //     appPolicyTypeList.push(p.type);
        // });
        //update business with policy type list.
        this.business.setPolicyTypeList(appPolicyTypeList);
        // Agent
        this.agencyLocation = new AgencyLocation(this.business, this.policies);
        // Note: The front-end is sending in 'agent' but this is really a reference to the 'agency location'
        if (data.agent) {
            await this.agencyLocation.load({id: data.agent});
        }
        else {
            await this.agencyLocation.load({id: 1}); // This is Talage's agency location record
        }

        //this.questions = data.questions;
        let applicationQuestionBO = new ApplicationQuestionBO();
        const GET_QUESTION_LIST = true;
        this.questions = await applicationQuestionBO.loadFromApplicationId(this.id,GET_QUESTION_LIST).catch(function(err){
            log.error("Quote Application error get question list " + err + __location);
            error = err;
        })
        if (error) {
            throw error;
        }

        //log.debug("Quote Application Model: " + JSON.stringify(this))
        //throw new Error("stop");
    }


    /**
	 * Returns an array of IDs that represent the active insurance carriers (limited by the selections in the API request)
	 *
	 * @returns {array} - An array of integers that are insurer IDs
	 */
    get_insurer_ids() {
        return this.insurers.map(function(insurer) {
            return insurer.id;
        });
    }

    /**
	 * Returns a list of the active insurers in the Talage System. Will return only desired insurers based on the request
	 * received from the user. If no desired insurers are specified, will return all insurers.
	 *
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
    get_insurers() {
        // requestedInsureres not longer sent from Web app.
        //get_insurers(requestedInsurers) {
        return new Promise(async(fulfill, reject) => {
            log.debug("IN GET INSURERS FROM REQUESTED INSURERS")
            // Get a list of desired insurers
            let desired_insurers = [];
            let stop = false;
            this.policies.forEach((policy) => {
                if (Array.isArray(policy.insurers)) {
                    policy.insurers.forEach((insurer) => {
                        if (desired_insurers.indexOf(insurer) === -1) {
                            // Check that the agent supports this insurer for this policy type
                            let match_found = false;
                            for (const agent_insurer in this.agencyLocation.insurers) {
                                if (Object.prototype.hasOwnProperty.call(this.agencyLocation.insurers, agent_insurer)) {
                                    // Find the matching insurer
                                    if (this.agencyLocation.insurers[agent_insurer].id === parseInt(agent_insurer, 10)) {
                                        // Check the policy type
                                        if (this.agencyLocation.insurers[agent_insurer][policy.type.toLowerCase()] === 1) {
                                            match_found = true;
                                        }
                                    }
                                }
                            }

                            if (match_found) {
                                desired_insurers.push(insurer);
                            }
                            else {
                                log.info(`Agent does not support ${policy.type} policies through insurer ${insurer}`);
                                reject(serverHelper.requestError('Agent does not support this request'));
                                stop = true;
                            }
                        }
                    });
                }
            });
            if (stop) {
                return;
            }

            // Limit insurers to those supported by the Agent
            if (desired_insurers.length) {
                // Make sure these match what the agent can support
                const agent_insurers = Object.keys(this.agencyLocation.insurers);

                let some_unsupported = false;
                desired_insurers.forEach((insurer) => {
                    if (!agent_insurers.includes(insurer.toString())) {
                        some_unsupported = true;
                    }
                });
                if (some_unsupported) {
                    log.info('Agent does not support one or more of the insurers requested.');
                    reject(serverHelper.requestError('Agent does not support this request'));
                    return;
                }
            }
            else {
                // Only use the insurers supported by this agent
                desired_insurers = Object.keys(this.agencyLocation.insurers);
            }
            // Loop through each desired insurer
            let insurers = [];
            const insurer_promises = [];
            desired_insurers.forEach((id) => {
                // Create a new insurer object
                const insurer = new Insurer();

                // Initialize the insurer
                insurer_promises.push(insurer.init(id));

                // Add the insurer to the local list
                insurers.push(insurer);
            });

            // Wait for all the insurers to initialize
            await Promise.all(insurer_promises);

            // Store and return the insurers
            this.insurers = insurers;
            fulfill(insurers);
        });
    }

    /**
	 * Returns an array of the Talage WC Codes that were included in this application
	 *
	 * @returns {array} - An array of integers that are the IDs of Talage WC Codes
	 */
    get_wc_codes() {
        const ids = [];
        this.business.locations.forEach(function(location) {
            location.activity_codes.forEach(function(activity_code) {
                ids.push(activity_code.id);
            });
        });
        return ids;
    }

    /**
	 * Checks whether or not the incoming request includes the specified policy type
	 *
	 * @param {string} policy_type - The policy type (BOP, GL, or WC)
	 * @returns {boolean} - True if a policy of the specified type was requested, false otherwise
	 */
    has_policy_type(policy_type) {
        let rtn = false;

        // Loop through each policy in the request
        this.policies.forEach((policy) => {
            if (policy.type === policy_type) {
                rtn = true;
            }
        });

        return rtn;
    }

    /**
	 * Begins the process of getting and returning quotes from insurers
	 *
	 * @returns {void}
	 */
    async run_quotes() {
        // Generate quotes for each policy type
        const fs = require('fs');
        const quote_promises = [];
        const policyTypeReferred = {};
        const policyTypeQuoted = {};

        let requestedInsurer = null;
        if (global.settings.QUOTE_ONLY_INSURER) {
            requestedInsurer = global.settings.QUOTE_ONLY_INSURER;
            log.info('================================================================================');
            log.info(`QUOTE_ONLY_INSURER is set. Running quotes against '${requestedInsurer}'`);
            log.info('================================================================================');
        }

        this.policies.forEach((policy) => {
            // Generate quotes for each insurer for the given policy type
            this.insurers.forEach((insurer) => {
                // Only run quotes against requested insurers (if present)
                if (requestedInsurer && requestedInsurer !== insurer.slug) {
                    return;
                }
                // Check that the given policy type is enabled for this insurer
                if (insurer.policy_types.indexOf(policy.type) >= 0) {
                    if (global.settings.ENV === 'development' && insurer.id === 23) {
                        console.log("##########################################################################################################");
                        console.log("##########################################################################################################");
                        console.log("Hack for hiscox development. If you see this, Scott messed up and committed it. Yell at him.");
                        console.log("##########################################################################################################");
                        console.log("##########################################################################################################");
                        this.agencyLocation.insurers[insurer.id].policy_type_info = {
                            "GL": {
                                "enabled": true,
                                "useAcord": false,
                                "acordInfo": {"sendToEmail": ""}
                            },
                            "WC": {
                                "enabled": false,
                                "useAcord": false,
                                "acordInfo": {"sendToEmail": ""}
                            },
                            "BOP": {
                                "enabled": false,
                                "useAcord": false,
                                "acordInfo": {"sendToEmail": ""}
                            }
                        }
                    }
                    // Get the agency_location_insurer data for this insurer from the agency location
                    if (this.agencyLocation.insurers[insurer.id].policy_type_info) {
                        //Retrieve the data for this policy type
                        const agency_location_insurer_data = this.agencyLocation.insurers[insurer.id].policy_type_info[policy.type];
                        if (agency_location_insurer_data) {
                            if (agency_location_insurer_data.enabled) {
                                let slug = '';
                                // If agency wants to send acord, send acord
                                if (agency_location_insurer_data.useAcord === true && insurer.policy_type_details[policy.type].acord_support === 1) {
                                    slug = 'acord';
                                }
                                else if (insurer.policy_type_details[policy.type.toUpperCase()].api_support === 1) {
                                    // Otherwise use the api
                                    slug = insurer.slug;
                                }

                                const normalizedPath = `${__dirname}/../integrations/${slug}/${policy.type.toLowerCase()}.js`;
                                if (slug.length > 0 && fs.existsSync(normalizedPath)) {
                                    // Require the integration file and add the response to our promises
                                    const IntegrationClass = require(normalizedPath);
                                    const integration = new IntegrationClass(this, insurer, policy);
                                    quote_promises.push(integration.quote());
                                }
                                else {
                                    log.error(`Database and Implementation mismatch: Integration confirmed in the database but implementation file was not found. Agency location ID: ${this.agencyLocation.id} ${insurer.name} ${policy.type} slug: ${slug} path: ${normalizedPath} ` + __location);
                                }
                            }
                            else {
                                log.error(`${policy.type} is not enabled for insurer ${insurer.id} for Agency location ${this.agencyLocation.id}` + __location);
                            }
                        }
                        else {
                            log.error(`Info for policy type ${policy.type} not found for agency location: ${this.agencyLocation.id} Insurer: ${insurer.id}` + __location);
                        }
                    }
                    else {
                        log.error(`Policy info not found for agency location: ${this.agencyLocation.id} Insurer: ${insurer.id}` + __location);
                    }
                }
            });
        });

        // Wait for all quotes to finish
        let quoteIDs = null;
        try {
            quoteIDs = await Promise.all(quote_promises);
        }
        catch (error) {
            log.error(`Quoting did not complete successfully for application ${this.id}: ${error} ${__location}`);
            return;
        }

        log.info(`${quoteIDs.length} quotes returned for application ${this.id}`);

        // Check for no quotes
        if (quoteIDs.length < 1) {
            log.error(`No quotes returned for application ${this.id}` + __location);
            return;
        }

        // Get the quotes from the database
        const sql = `
			SELECT id, policy_type, insurer, amount, aggregated_status, status, api_result
			FROM clw_talage_quotes
			WHERE id IN (${quoteIDs.join(',')});
		`;
        let quotes = null;
        try {
            quotes = await db.query(sql);
        }
        catch (error) {
            log.error(`Could not retrieve quotes from the database for application ${this.id} ${__location}`);
            return;
        }

        // Determine the type of policy quoted for the application state
        quotes.forEach((quote) => {
            // Determine the result of this quote
            if (Object.prototype.hasOwnProperty.call(quote, 'amount') && quote.amount) {
                // Quote
                policyTypeQuoted[quote.policy_type] = true;
            }
            else if (Object.prototype.hasOwnProperty.call(quote, 'status') && quote.status === 'referred') {
                // Referred
                policyTypeReferred[quote.policy_type] = true;
            }
        });
        // Update the application state
        await this.updateApplicationState(this.policies.length, Object.keys(policyTypeQuoted).length, Object.keys(policyTypeReferred).length);

        // Send a notification to Slack about this application
        await this.send_notifications(quotes);
    }

    /**
	 * Sends a email and slack notifications based on the quotes returned
	 *
	 * @param {array} quotes - An array of quote objects
	 * @returns {void}
	 */
    async send_notifications(quotes) {
        // Determine which message will be sent
        let all_had_quotes = true;
        let some_quotes = false;
        quotes.forEach((quote) => {
            if (quote.aggregated_status === 'quoted' || quote.aggregated_status === 'quoted_referred') {
                some_quotes = true;
            }
            else {
                all_had_quotes = false;
            }
        });

        // Send an emails if there were no quotes generated
        if (!some_quotes) {
            let error = null;
            const agencyNetworkBO = new AgencyNetworkBO();
            const emailContentJSON = await agencyNetworkBO.getEmailContentAgencyAndCustomer(this.agencyLocation.agencyNetwork, 'no_quotes_agency', 'no_quotes_customer').catch(function(err) {
                log.error(`Email content Error Unable to get email content for no quotes.  error: ${err}` + __location);
                error = true;
            });
            if (error) {
                return false;
            }

            if (emailContentJSON && emailContentJSON.customerMessage && emailContentJSON.customerSubject && emailContentJSON.emailBrand) {

                /* ---=== Email to Insured === --- */

                // Determine the branding to use for this email
                let brand = emailContentJSON.emailBrand === 'wheelhouse' ? 'agency' : `${emailContentJSON.emailBrand}-agency`;

                // If this is Talage, update the brand
                if (this.agencyLocation.agencyId <= 2) {
                    brand = 'talage';
                }

                let message = emailContentJSON.customerMessage;
                let subject = emailContentJSON.customerSubject;

                // Perform content replacements
                message = message.replace(/{{Agency}}/g, this.agencyLocation.agency);
                message = message.replace(/{{Agency Email}}/g, this.agencyLocation.agencyEmail ? this.agencyLocation.agencyEmail : '');
                message = message.replace(/{{Agency Phone}}/g, this.agencyLocation.agencyPhone ? formatPhone(this.agencyLocation.agencyPhone) : '');
                message = message.replace(/{{Agency Website}}/g, this.agencyLocation.agencyWebsite ? `<a href="${this.agencyLocation.agencyWebsite}"  rel="noopener noreferrer" target="_blank">${this.agencyLocation.agencyWebsite}</a>` : '');
                subject = subject.replace(/{{Agency}}/g, this.agencyLocation.agency);

                // Send the email message
                log.debug('sending customer email');
                await emailSvc.send(this.business.contacts[0].email,
                    subject,
                    message,
                    {
                        agencyLocation: this.agencyLocation.id,
                        application: this.id
                    },
                    brand,
                    this.agencyLocation.agencyId);

                /* ---=== Email to Agency === --- */

                // Do not send if this is Talage
                if (this.agencyLocation.agencyId > 2) {
                    // Determine the portal login link
                    let portalLink = '';
                    switch (global.settings.ENV) {
                        case 'development':
                            portalLink = global.settings.PORTAL_URL;
                            break;
                        case 'test':
                        case 'staging':
                        case 'demo':
                        case 'production':
                        default:
                            portalLink = this.agencyLocation.agencyNetwork === 2 ? global.settings.DIGALENT_AGENTS_URL : global.settings.TALAGE_AGENTS_URL;
                            break;
                    }

                    message = emailContentJSON.agencyMessage;
                    subject = emailContentJSON.agencySubject;

                    // Perform content replacements
                    const capitalizedBrand = emailContentJSON.emailBrand.charAt(0).toUpperCase() + emailContentJSON.emailBrand.substring(1);
                    message = message.replace(/{{Agency Portal}}/g, `<a href="${portalLink}" target="_blank" rel="noopener noreferrer">${capitalizedBrand} Agency Portal</a>`);
                    message = message.replace(/{{Agency}}/g, this.agencyLocation.agency);
                    message = message.replace(/{{Agent Login URL}}/g, this.agencyLocation.insurers[quotes[0].insurer].agent_login);
                    message = message.replace(/{{Brand}}/g, capitalizedBrand);
                    message = message.replace(/{{Business Name}}/g, this.business.name);
                    message = message.replace(/{{Contact Email}}/g, this.business.contacts[0].email);
                    message = message.replace(/{{Contact Name}}/g, `${this.business.contacts[0].first_name} ${this.business.contacts[0].last_name}`);
                    message = message.replace(/{{Contact Phone}}/g, formatPhone(this.business.contacts[0].phone));
                    message = message.replace(/{{Industry}}/g, this.business.industry_code_description);

                    if (quotes[0].status) {
                        message = message.replace(/{{Quote Result}}/g, quotes[0].status.charAt(0).toUpperCase() + quotes[0].status.substring(1));
                    }
                    log.debug('sending agency email');
                    // Send the email message - development should email. change local config to get the email.
                    await emailSvc.send(this.agencyLocation.agencyEmail,
                        subject,
                        message,
                        {
                            agencyLocation: this.agencyLocation.id,
                            application: this.id
                        },
                        emailContentJSON.emailBrand,
                        this.agencyLocation.agencyId);
                }
            }
        }

        // Only send Slack messages on Talage applications
        if (this.agencyLocation.agencyId <= 2) {
            // Build out the 'attachment' for the Slack message
            const attachment = {
                application_id: this.id,
                fields: [
                    {
                        short: false,
                        title: 'Business Name',
                        value: this.business.name + (this.business.dba ? ` (dba. ${this.business.dba})` : '')
                    }, {
                        short: false,
                        title: 'Industry',
                        value: this.business.industry_code_description
                    }
                ],
                text: `${this.business.name} from ${this.business.primary_territory} completed an application for ${this.policies.
                    map(function(policy) {
                        return policy.type;
                    }).
                    join(' and ')}`
            };

            if (global.settings.ENV === 'development') {
                log.info('!!! Skipping sending notification slack due to development environment. !!!');
                return;
            }

            // Send a message to Slack
            if (all_had_quotes) {
                slack.send('customer_success', 'ok', 'Application completed and the user received ALL quotes', attachment);
            }
            else if (some_quotes) {
                slack.send('customer_success', 'ok', 'Application completed and only SOME quotes returned', attachment);
            }
            else {
                slack.send('customer_success', 'warning', 'Application completed, but the user received NO quotes', attachment);
            }
        }
    }

    /**
	 * Updates the state of the application as follows:
	 *   1 - New Application (no change, this is default)
	 *   12 - Referred (Application did not receive quotes and had at least one referral per policy type)
	 *   13 - Quoted (Application received at least one quote per policy type)
	 *
	 * @param {int} numPolicyTypesRequested - The number of policy types requested in the application
	 * @param {int} numPolicyTypesQuoted - The number of policy types that got quotes
	 * @param {int} numPolicyTypesReferred - THe number of policy types that referred
	 * @return {void}
	 */
    async updateApplicationState(numPolicyTypesRequested, numPolicyTypesQuoted, numPolicyTypesReferred) {
        // Determine the application status
        let state = 1; // New
        if (numPolicyTypesRequested === numPolicyTypesQuoted) {
            state = 13; // Quoted
        }
        else if (numPolicyTypesRequested === numPolicyTypesReferred) {
            state = 12; // Referred
        }

        // Update the application status in the database (1 is default, so that can be skipped)
        if (state > 1) {
            const sql = `
				UPDATE #__applications
				SET state = ${state}
				WHERE id = ${this.id}
				LIMIT 1;
			`;
            try {
                await db.query(sql);
            }
            catch (error) {
                log.error(`Unable to update application ${this.id} state: ${error} ${__location}`);
            }
        }
    }

    /**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
    validate() {
        return new Promise(async(fulfill, reject) => {
            let stop = false;

            // Agent
            await this.agencyLocation.validate().catch(function(error) {
                log.error('Location.validate() error ' + error + __location);
                reject(error);
                stop = true;
            });
            if (stop) {
                return;
            }

            // Initialize the agent so it is ready for later
            await this.agencyLocation.init().catch(function(error) {
                log.error('Location.init() error ' + error + __location);
                reject(error);
                stop = true;
            });

            // Validate the ID
            if (!await validator.application(this.id)) {
                log.error('validator.application() ' + this.id + __location);
                reject(serverHelper.requestError('Invalid application ID specified.'));
                return;
            }

            // Get a list of insurers and wait for it to return
            // Determine if WholeSale shoud be used.  (this might have already been determined in the app workflow.)
            const insurers = await this.get_insurers().catch(async(error) => {
                if (error === 'Agent does not support this request') {
                    if (this.agencyLocation.wholesale) {
                        // Switching to the Talage agent
                        log.info("Quote Application model Switching to the Talage agent appId: " + this.id + __location)
                        this.agencyLocation = new AgencyLocation(this);
                        await this.agencyLocation.load({id: 1}); // This is Talage's agency location record

                        // Initialize the agent so we can use it
                        await this.agencyLocation.init().catch(function(init_error) {
                            log.error('Location.init() error ' + init_error + __location);
                            reject(init_error);
                            stop = true;
                        });

                        // Try to get the insurers again
                        return this.get_insurers();
                    }

                    reject(serverHelper.requestError('The Agent specified cannot support this policy.'));
                    stop = true;
                }
                else {
                    log.error('get insurers error ' + error + __location);
                    reject(error);
                    stop = true;
                }
            });
            if (stop) {
                return;
            }
            if (!insurers || insurers.length === 0 || Object.prototype.toString.call(insurers) !== '[object Array]') {
                log.error('Invalid insurer(s) specified in policy. ' + __location);
                reject(serverHelper.requestError('Invalid insurer(s) specified in policy.'));
                return;
            }

            // Validate the business

            await this.business.validate().catch(function(error) {
                log.error('business.validate() error ' + error + __location);
                reject(error);
                stop = true;
            });
            if (stop) {
                return;
            }
            //Rules related Business rules based on application level data.
            /**
			 * Management Structure (required only for LLCs in MT)
			 * - Must be either 'member' or 'manager'
			 */
            if (this.has_policy_type('WC') && this.business.entity_type === 'Limited Liability Company' && this.business.primary_territory === 'MT') {
                if (this.business.management_structure) {
                    if (!validator.management_structure(this.business.management_structure)) {
                        log.warn(`Invalid management structure. Must be either "member" or "manager."` + this.id + __location)
                        reject(serverHelper.requestError('Invalid management structure. Must be either "member" or "manager."'));
                        return;
                    }
                }
                else {
                    reject(serverHelper.requestError('Missing required field: management_structure'));
                    return;
                }
            }

            /**
			 * Corporation type (required only for WC for Corporations in PA that are excluding owners)
			 * - Must be one of 'c', 'n', or 's'
			 */
            if (this.has_policy_type('WC') && this.business.entity_type === 'Corporation' && this.business.primary_territory === 'PA' && !this.business.owners_included) {
                if (this.business.corporation_type) {
                    if (!validator.corporation_type(this.business.corporation_type)) {
                        log.warn(`Invalid corporation type. Must be "c" (c-corp), "n" (non-profit), or "s" (s-corp)." ` + this.id + __location)
                        reject(serverHelper.requestError('Invalid corporation type. Must be "c" (c-corp), "n" (non-profit), or "s" (s-corp).'));
                        return;
                    }
                }
                else {
                    reject(serverHelper.requestError('Missing required field: corporation_type'));
                    return;
                }
            }

            /**
			 * Owners (conditionally required)
			 * - Only used for WC policies, ignored otherwise
			 * - Only required if owners_included is false
			 */
            if (this.has_policy_type('WC') && !this.business.owners_included) {
                if (this.business.owners.length) {
                    // TO DO: Owner validation is needed here
                }
                else {
                    reject(serverHelper.requestError('The names of owners must be supplied if they are not included in this policy.'));
                    return;
                }
            }

            /**
			 * Unincorporated Association (Required only for WC, in NH, and for LLCs and Corporations)
			 */
            if (this.has_policy_type('WC') && (this.business.entity_type === 'Corporation' || this.business.entity_type === 'Limited Liability Company') && this.business.primary_territory === 'NH') {

                // This is required
                if (this.business.unincorporated_association === null) {
                    reject(serverHelper.requestError('Missing required field: unincorporated_association'));
                    return;
                }

                // Validate
                if (!validator.boolean(this.business.unincorporated_association)) {
                    reject(serverHelper.requestError('Invalid value for unincorporated_association, please use a boolean value'));
                    return;
                }

                // Prepare the value for later use
                this.business.unincorporated_association = helper.convert_to_boolean(this.business.unincorporated_association);
            }


            // Validate all policies
            const policy_types = [];
            const policy_promises = [];
            this.policies.forEach(function(policy) {
                policy_promises.push(policy.validate());
                policy_types.push(policy.type);
            });
            await Promise.all(policy_promises).catch(function(error) {
                log.error('Policy Validation error. ' + error + __location);
                reject(error);
                stop = true;
            });
            if (stop) {
                return;
            }

            // Get a list of all questions the user may need to answer
            const insurer_ids = this.get_insurer_ids();
            const wc_codes = this.get_wc_codes();
            const questions = await get_questions(wc_codes, this.business.industry_code, this.business.getZips(), policy_types, insurer_ids).catch(function(error) {
                log.error('get_questions error ' + error + __location);
                reject(error);
            });

            // Grab the answers the user provided to our questions and reset the question object
            const user_questions = this.questions;
            this.questions = {};

            // Convert each question from the databse into a question object and load in the user's answer to each
            let has_error = false;
            if (questions) {
                await questions.forEach((question) => {
                    // Prepare a Question object based on this data and store it
                    const q = new Question();
                    q.load(question);

                    // Load the user's answer
                    if (user_questions) {
                        if (Object.prototype.hasOwnProperty.call(user_questions, q.id)) {
                            const user_answer = user_questions[q.id];

                            q.set_answer(user_answer).catch(function(error) {
                                log.error('set answers error ' + error + __location);
                                reject(error);
                                has_error = true;
                            });
                        }
                    }

                    // Store the question object in the Application for later use
                    this.questions[q.id] = q;
                });
            }
            if (has_error) {
                return;
            }

            // Enforce required questions (this must be done AFTER all questions are loaded with their answers)
            if (this.questions) {
                for (const question_id in this.questions) {
                    if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                        const question = this.questions[question_id];

                        // Hidden questions are not required
                        if (question.hidden) {
                            continue;
                        }

                        if (question.parent) {
                            // Get the parent question
                            const parent_question = this.questions[question.parent];

                            // If no parent was found, throw an error
                            if (!parent_question) {
                                log.error(`Question ${question.id} has invalid parent setting. (${htmlentities.decode(question.text).replace('%', '%%')})` + __location);
                                reject(serverHelper.requestError('An unexpected error has occurred. Our team has been alerted and will contact you.'));
                                return;
                            }

                            // If this question's parent_answer is equal to the answer given for the parent, it is required
                            if (parent_question.answer_id === question.parent_answer) {
                                question.required = true;
                            }
                        }
                        else {
                            question.required = true;
                        }

                        // If required, check that this question was answered by the user
                        if (question.required && (!user_questions || !Object.prototype.hasOwnProperty.call(user_questions, question.id))) {
                            reject(serverHelper.requestError(`Question ${question.id} missing from request. (${htmlentities.decode(question.text).replace('%', '%%')})`));
                            return;
                        }
                    }
                }
            }

            // Validate all of the questions
            if (this.questions) {
                const question_promises = [];
                for (const question_id in this.questions) {
                    if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                        question_promises.push(this.questions[question_id].validate());
                    }
                }
                await Promise.all(question_promises).catch(function(error) {
                    log.error('question_promises error. ' + error + __location);
                    reject(error);
                    stop = true;
                });
                if (stop) {
                    return;
                }
            }

            // (id: 1015 should have been removed as it was not required). What is the correct way to handle this?
            // Note: we cannot hurt questions where a child must be sent

            // Check agent support
            await this.agencyLocation.supports_application().catch(function(error) {
                log.error('agencyLocation.supports_application() error ' + error + __location);
                reject(error);
                stop = true;
            });
            if (stop) {
                return;
            }

            fulfill(true);
        });
    }
};