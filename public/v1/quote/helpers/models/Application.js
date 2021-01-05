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
//const get_questions = global.requireShared('./helpers/getQuestions.js');
const questionsSvc = global.requireShared('./services/questionsvc.js');

const htmlentities = require('html-entities').Html5Entities;
const AgencyLocation = require('./AgencyLocation.js');
const Business = require('./Business.js');
const Insurer = require('./Insurer.js');
const Policy = require('./Policy.js');
const Question = require('./Question.js');
const validator = global.requireShared('./helpers/validator.js');
const { 
    validateAgencyLocation,
    validateBusiness,
    validatePolicy,
    validateQuestion
} = global.requireShared('./helpers/applicationValidator.js');
const helper = global.requireShared('./helpers/helper.js');

const AgencyBO = global.requireShared('models/Agency-BO.js');
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');

module.exports = class Application {
    constructor() {
        this.agencyLocation = null;
        this.business = null;
        this.id = 0;
        this.insurers = [];
        this.policies = [];
        this.questions = {};
        this.applicationDocData = {};
    }

    /**
	 * Populates this object based on applicationId in the request
	 *
	 * @param {object} data - The application data
     * @param {boolean} forceQuoting - if true age check is skipped.
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
    async load(data, forceQuoting = false) {
        log.debug('Loading data into Application' + __location);
        // ID
        //TODO detect ID type integer or uuid
        this.id = parseInt(data.id, 10);

        // load application from database.
        //let error = null
        let applicationBO = new ApplicationBO();

        try {
            this.applicationDocData = await applicationBO.loadfromMongoBymysqlId(this.id);
            log.debug("Quote Application added applicationData")
        } catch(err){
            log.error("Unable to get applicationData for quoting appId: " + data.id + __location);
            throw err;
        }

        //TODO: move this to an init or translate style function that massages the data into a form the integrations will expect
        this.applicationDocData.founded = moment(this.applicationDocData.founded);

        //age check - add override Age parameter to allow requoting.
        if (forceQuoting === false){
            const bypassAgeCheck = global.settings.ENV === 'development' && global.settings.APPLICATION_AGE_CHECK_BYPASS === 'YES';
            const dbCreated = moment(this.applicationDocData.createdAt);
            const nowTime = moment().utc();
            const ageInMinutes = nowTime.diff(dbCreated, 'minutes');
            log.debug('Application age in minutes ' + ageInMinutes);
            if (!bypassAgeCheck && ageInMinutes > 60) {
                log.warn(`Attempt to update an old application. appid ${this.id}` + __location);
                throw new Error("Data Error: Application may not be updated do to age.");
            }
        }
        //log.debug("applicationBO: " + JSON.stringify(applicationBO));

        // Load the business information
        this.business = new Business();
        try {
            await this.business.load(this.applicationDocData);
        }
        catch (err) {
            log.error(`Unable to load the business for application ${this.id}: ${err} ${__location}`);
            throw err;
        }


        // eslint-disable-next-line prefer-const
        let appPolicyTypeList = [];
        // Load the policy information
        try{
            for (let i = 0; i < this.applicationDocData.policies.length; i++) {
                const policyJSON = this.applicationDocData.policies[i];
                const p = new Policy();
                await p.load(policyJSON, this.business, this.applicationDocData);
                this.policies.push(p);
                appPolicyTypeList.push(policyJSON.type);
            }
        }
        catch(err){
            log.error("Quote Application Model loading policy err " + err + __location);
            throw err;
        }


        //update business with policy type list.
        this.business.setPolicyTypeList(appPolicyTypeList);
        // Agent
        this.agencyLocation = new AgencyLocation(this.business, this.policies);
        // Note: The front-end is sending in 'agent' but this is really a reference to the 'agency location'
        if (this.applicationDocData.agencyLocationId) {
            await this.agencyLocation.load({id: this.applicationDocData.agencyLocationId});
            await this.agencyLocation.init().catch(function(error) {
                log.error('Location.init() error ' + error + __location);
            });
        }
        else {
            log.error(`Missing agencyLocationId application ${this.id} ${__location}`);
            throw new Error(`Missing agencyLocationId application ${this.id}`);
        }

        // TODO Refactor Integration to use full Questions list.
        if(this.applicationDocData.questions && this.applicationDocData.questions.length > 0){
            let questionJSON = {};
            for(const question of this.applicationDocData.questions){
                if (question.questionType.toLowerCase().startsWith('text')
                    || question.questionType === 'Checkboxes' && question.answerValue) {

                    questionJSON[question.questionId] = question.answerValue
                }
                else {
                    questionJSON[question.questionId] = question.answerId
                }
            }
            this.questions = questionJSON
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
                                reject(new Error('Agent does not support this request'));
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
                    reject(new Error('Agent does not support this request'));
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

        // appStatusId > 70 is finished.(request to bind)
        if(this.applicationDocData.appStatusId >= 70){
            log.warn("An attempt to quote application that is finished.")
            throw new Error("Finished Application cannot be quoted")
        }

        // Generate quotes for each policy type
        const fs = require('fs');
        const quote_promises = [];
        const policyTypeReferred = {};
        const policyTypeQuoted = {};

        if(this.policies && this.policies.length === 0){
            log.error(`No policies for Application ${this.id} ` + __location)
        }

        // set the quoting started date right before we start looking for quotes
        let applicationBO = new ApplicationBO();
        await applicationBO.updateMongo(this.applicationDocData.uuid, {quotingStartedDate: moment.utc()});
        this.policies.forEach((policy) => {
            // Generate quotes for each insurer for the given policy type
            this.insurers.forEach((insurer) => {
                // Only run quotes against requested insurers (if present)
                // Check that the given policy type is enabled for this insurer
                if (insurer.policy_types.indexOf(policy.type) >= 0) {

                    // Get the agency_location_insurer data for this insurer from the agency location
                    //log.debug(JSON.stringify(this.agencyLocation.insurers[insurer.id]))
                    if (this.agencyLocation.insurers[insurer.id].policyTypeInfo) {

                        //Retrieve the data for this policy type
                        const agency_location_insurer_data = this.agencyLocation.insurers[insurer.id].policyTypeInfo[policy.type];
                        if (agency_location_insurer_data) {

                            if (agency_location_insurer_data.enabled) {
                                let policyTypeAbbr = '';
                                let slug = '';
                                try{
                                    // If agency wants to send acord, send acord
                                    if (agency_location_insurer_data.useAcord === true && insurer.policy_type_details[policy.type].acord_support === 1) {
                                        slug = 'acord';
                                    }
                                    else if (insurer.policy_type_details[policy.type.toUpperCase()].api_support) {
                                        // Otherwise use the api
                                        slug = insurer.slug;
                                    }
                                    if(policy && policy.type){
                                        policyTypeAbbr = policy.type.toLowerCase()
                                    }
                                    else {
                                        log.error(`Policy Type info not found for agency location: ${this.agencyLocation.id} Insurer: ${insurer.id} Policy ${JSON.stringify(policy)}` + __location);
                                    }
                                }
                                catch(err){
                                    log.error('SLUG ERROR ' + err + __location);
                                }

                                const normalizedPath = `${__dirname}/../integrations/${slug}/${policyTypeAbbr}.js`;
                                if (slug.length > 0 && fs.existsSync(normalizedPath)) {
                                    // Require the integration file and add the response to our promises
                                    const IntegrationClass = require(normalizedPath);
                                    const integration = new IntegrationClass(this, insurer, policy);
                                    quote_promises.push(integration.quote());
                                }
                                else {
                                    log.error(`Database and Implementation mismatch: Integration confirmed in the database but implementation file was not found. Agency location ID: ${this.agencyLocation.id} insurer ${insurer.name} policyType ${policy.type} slug: ${slug} path: ${normalizedPath} app ${this.id} ` + __location);
                                }
                            }
                            else {
                                log.error(`${policy.type} is not enabled for insurer ${insurer.id} for Agency location ${this.agencyLocation.id} app ${this.id}` + __location);
                            }
                        }
                        else {
                            log.error(`Info for policy type ${policy.type} not found for agency location: ${this.agencyLocation.id} Insurer: ${insurer.id} app ${this.id}` + __location);
                        }
                    }
                    else {
                        log.error(`Policy info not found for agency location: ${this.agencyLocation.id} Insurer: ${insurer.id} app ${this.id}` + __location);
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

        //log.info(`${quoteIDs.length} quotes returned for application ${this.id}`);

        // Check for no quotes
        if (quoteIDs.length < 1) {
            log.warn(`No quotes returned for application ${this.id}` + __location);
            return;
        }

        const quoteBO = new QuoteBO();

        // Get the quotes from the database
        let quoteList = null;
        try {
            const query = {"mysqlId": quoteIDs}
            quoteList = await quoteBO.getList(query);
        }
        catch (error) {
            log.error(`Could not retrieve quotes from the database for application ${this.id} ${__location}`);
            return;
        }


        // Determine the type of policy quoted for the application state
        quoteList.forEach((quote) => {
            // Determine the result of this quote
            if (quote.amount) {
                // Quote
                policyTypeQuoted[quote.policyType] = true;
            }
            else if (quote.status === 'referred') {
                // Referred
                policyTypeReferred[quote.policyType] = true;
            }
        });
        // Update the application state  - TODO Us BO.
        await this.updateApplicationState(this.policies.length, Object.keys(policyTypeQuoted).length, Object.keys(policyTypeReferred).length);

        // Send a notification to Slack about this application
        try{
            await this.send_notifications(quoteList);
        }
        catch(err){
            log.error(`Quote Application ${this.id} error sending notifications ` + err + __location);
        }

    }

    /**
	 * Sends a email and slack notifications based on the quotes returned
	 *
	 * @param {array} quoteList - An array of quote objects
	 * @returns {void}
	 */
    async send_notifications(quoteList) {
        // Determine which message will be sent
        let all_had_quotes = true;
        let some_quotes = false;
        let notifiyTalage = false
        quoteList.forEach((quoteDoc) => {
            if (quoteDoc.aggregatedStatus === 'quoted' || quoteDoc.aggregatedStatus === 'quoted_referred') {
                some_quotes = true;
            }
            else {
                all_had_quotes = false;
            }
            //Notify Talage logic Agencylocation ->insures
            try{
                const notifiyTalageTest = this.agencyLocation.shouldNotifyTalage(quoteDoc.insurerId);
                //We only need one AL insure to be set to notifyTalage to send it to Slack.
                if(notifiyTalageTest === true){
                    notifiyTalage = notifiyTalageTest;
                    log.info(`Quote Application ${this.id} sending notification to Talage ` + __location)
                }
            }
            catch(err){
                log.error(`Quote Application ${this.id} Error get notifyTalage ` + err + __location);
            }
        });
        log.info(`Quote Application ${this.id} Sending Notification to Talage is ${notifiyTalage}` + __location)

        // Send an emails if there were no quotes generated
        if (some_quotes === false) {
            let error = null;
            const agencyBO = new AgencyBO();
            const emailContentJSON = await agencyBO.getEmailContentAgencyAndCustomer(this.agencyLocation.agencyId, 'no_quotes_agency', 'no_quotes_customer').catch(function(err) {
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
                        agencyLocationId: this.agencyLocation.id,
                        applicationId: this.id
                    },
                    this.agencyLocation.agencyNetwork,
                    brand,
                    this.agencyLocation.agencyId);

                /* ---=== Email to Agency === --- */

                // Do not send if this is Talage
                if (this.agencyLocation.agencyId > 2) {
                    // Determine the portal login link
                    let portalLink = emailContentJSON.PORTAL_URL;

                    message = emailContentJSON.agencyMessage;
                    subject = emailContentJSON.agencySubject;

                    // Perform content replacements
                    const capitalizedBrand = emailContentJSON.emailBrand.charAt(0).toUpperCase() + emailContentJSON.emailBrand.substring(1);
                    message = message.replace(/{{Agency Portal}}/g, `<a href="${portalLink}" target="_blank" rel="noopener noreferrer">${capitalizedBrand} Agency Portal</a>`);
                    message = message.replace(/{{Agency}}/g, this.agencyLocation.agency);
                    message = message.replace(/{{Agent Login URL}}/g, this.agencyLocation.insurers[quoteList[0].insurerId].agent_login);
                    message = message.replace(/{{Brand}}/g, capitalizedBrand);
                    message = message.replace(/{{Business Name}}/g, this.business.name);
                    message = message.replace(/{{Contact Email}}/g, this.business.contacts[0].email);
                    message = message.replace(/{{Contact Name}}/g, `${this.business.contacts[0].first_name} ${this.business.contacts[0].last_name}`);
                    message = message.replace(/{{Contact Phone}}/g, formatPhone(this.business.contacts[0].phone));
                    message = message.replace(/{{Industry}}/g, this.business.industry_code_description);

                    if (quoteList[0].status) {
                        message = message.replace(/{{Quote Result}}/g, quoteList[0].status.charAt(0).toUpperCase() + quoteList[0].status.substring(1));
                    }
                    log.debug('sending agency email');
                    // Send the email message - development should email. change local config to get the email.
                    await emailSvc.send(this.agencyLocation.agencyEmail,
                        subject,
                        message,
                        {
                            agencyLocationId: this.agencyLocation.id,
                            applicationId: this.id
                        },
                        this.agencyLocation.agencyNetwork,
                        emailContentJSON.emailBrand,
                        this.agencyLocation.agencyId);
                }
            }
            else {
                log.warn(`No Email content for Appid ${this.id} Agency$ {this.agencyLocation.agencyId} for no quotes.` + __location);
            }
        }


        // Only send Slack messages on Talage applications  this.agencyLocation.agency
        if (this.agencyLocation.agencyId <= 2 || notifiyTalage === true) {
            // Build out the 'attachment' for the Slack message
            const attachment = {
                application_id: this.id,
                fields: [
                    {
                        short: false,
                        title: 'Agency Name',
                        value: this.agencyLocation.agency
                    },
                    {
                        short: false,
                        title: 'Business Name',
                        value: this.business.name + (this.business.dba ? ` (dba. ${this.business.dba})` : '')
                    },
                    {
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

            // sending controlled in slacksvc by env SLACK_DO_NOT_SEND
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
        let state = 1; // new record State.
        let appStatusId = 15; // Quoting
        let appStatusDesc = "quoting"
        if (numPolicyTypesRequested === numPolicyTypesQuoted) {
            state = 13; // Quoted
            appStatusId = 60;
            appStatusDesc = "quoted";

        }
        else if (numPolicyTypesRequested === numPolicyTypesReferred) {
            state = 12; // Referred
            appStatusId = 40;
            appStatusDesc = "referred";
        }
        if(state > 1){
            const applicationBO = new ApplicationBO();
            try{
                await applicationBO.updateStatus(this.id, appStatusDesc, appStatusId);
                await applicationBO.updateProgress(this.id, "complete");
                await applicationBO.updateState(this.id, state)
            }
            catch(err){
                log.error(`Could not update the application state to ${state} for application ${this.id}: ${err} ${__location}`);
            }
        }
    }

    /**
	 * Checks that the data supplied is valid
	 *
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
    async validate() {
        return new Promise(async(fulfill, reject) => {

            // Agent
            try {
                await validateAgencyLocation(this.agencyLocation);
            } catch (e) {
                log.error(`validateAgencyLocation() error: ${e}. ` + __location);
                return reject(e);
            }

            // Validate the ID
            let applicationBO = new ApplicationBO();
            if (!await applicationBO.isValidApplicationId(this.applicationDocData.mysqlId)) {
                // if applicationId suppled in the starting quoting requeset was bad
                // the quoting process would have been stopped before validate was called.
                log.error(`Error validating application ID: ${this.applicationDocData.mysqlId}. ` + __location);
            }

            // Get a list of insurers and wait for it to return
            // Determine if WholeSale shoud be used.  (this might have already been determined in the app workflow.)
            let insurers = null;
            try { 
                insurers = await this.get_insurers();
            } catch (e) {
                if (e.toLowerCase() === 'agent does not support this request') {
                    if (this.agencyLocation.wholesale) {
                        // Switching to the Talage agent
                        log.info(`Quote Application model Switching to the Talage agent appId: ${this.applicationDocData.mysqlId}` + __location)
                        this.agencyLocation = new AgencyLocation(this);
                        await this.agencyLocation.load({id: 1}); // This is Talage's agency location record

                        // Initialize the agent so we can use it
                        try {
                            await this.agencyLocation.init();
                        } catch (e) {
                            log.error(`Error in this.agencyLocation.init(): ${e}. ` + __location);
                            return reject(init_error);
                        }

                        // Try to get the insurers again
                        try {
                            insurers = await this.get_insurers();
                        } catch (e) {
                            log.error(`Error in get_insurers: ${e}. ` + __location);
                            return reject(e);
                        }
                    }

                    return reject(new Error('The Agent specified cannot support this policy.'));
                } else {
                    log.error(`Error in get_insurers: ${e}. ` + __location);
                    return reject(e);
                }
            }
            
            if (!insurers || !Array.isArray(insurers) || insurers.length === 0) {
                log.error('Invalid insurer(s) specified in policy. ' + __location);
                return reject(new Error('Invalid insurer(s) specified in policy.'));
            }

            // Validate the business
            try {
                await validateBusiness(this.applicationDocData);
            } catch (e) {
                log.error(`Error in validateBusiness: ${e}. ` + __location);
                return reject(error);
            }

            /**
             * Rules related Business rules based on application level data.
			 * Management Structure (required only for LLCs in MT)
			 * - Must be either 'member' or 'manager'
			 */
            if (
                this.has_policy_type('WC') && 
                this.applicationDocData.entityType === 'Limited Liability Company' && 
                this.applicationDocData.mailingState === 'MT'
            ) {
                if (this.applicationDocData.management_structure) {
                    if (!validator.management_structure(this.applicationDocData.management_structure)) {
                        log.warn(`Invalid management structure. Must be either "member" or "manager."` + this.applicationDocData.mysqlId + __location)
                        return reject(new Error('Invalid management structure. Must be either "member" or "manager."'));
                    }
                } else {
                    return reject(new Error('Missing required field: management_structure'));
                }
            }

            /**
			 * Corporation type (required only for WC for Corporations in PA that are excluding owners)
			 * - Must be one of 'c', 'n', or 's'
			 */
            if (
                this.has_policy_type('WC') && 
                this.applicationDocData.entityType === 'Corporation' && 
                this.applicationDocData.mailingState === 'PA' && 
                !this.applicationDocData.ownersCovered
            ) {
                // TODO: this will always fail because current mongoose schema doesn't have corporationType
                if (this.applicationDocData.corporationType) {
                    // eslint-disable-next-line array-element-newline
                    const paCorpValidTypes = ['c', 'n', 's'];
                    if (!paCorpValidTypes.includes(this.applicationDocData.corporationType)) {
                        log.warn(`Invalid corporation type. Must be "c" (c-corp), "n" (non-profit), or "s" (s-corp). ${this.applicationDocData.mysqlId}. ` + __location)
                        return reject(new Error('Invalid corporation type. Must be "c" (c-corp), "n" (non-profit), or "s" (s-corp).'));
                    }
                } else {
                    return reject(new Error('Missing required field: corporationType'));
                }
            }

            /**
			 * Owners (conditionally required)
			 * - Only used for WC policies, ignored otherwise
			 * - Only required if ownersCovered is false
			 */
            if (this.has_policy_type('WC') && !this.applicationDocData.ownersCovered) {
                if (this.applicationDocData.owners.length) {
                    // TODO: Owner validation is needed here
                } else {
                    return reject(new Error('The names of owners must be supplied if they are not included in this policy.'));
                }
            }

            /**
			 * Unincorporated Association (Required only for WC, in NH, and for LLCs and Corporations)
			 */
            if (
                this.has_policy_type('WC') && 
                (this.applicationDocData.entityType === 'Corporation' || this.applicationDocData.entityType === 'Limited Liability Company') && 
                this.applicationDocData.mailingState === 'NH'
            ) {

                // This is required
                if (this.applicationDocData.unincorporated_association === null) {
                    return reject(new Error('Missing required field: unincorporated_association'));
                }

                // Validate
                if (!validator.boolean(this.applicationDocData.unincorporated_association)) {
                    return reject(new Error('Invalid value for unincorporated_association, please use a boolean value'));
                }

                //TODO: validation functions should NOT update the value being validated, that is not their responsability.
                //      This should be updated to happen before validation is called, or after.
                this.applicationDocData.unincorporated_association = helper.convert_to_boolean(this.applicationDocData.unincorporated_association);
            }


            // Validate all policies
            const policy_types = [];
            for (const [i, policy] of this.applicationDocData.policies.entries()) {
                policy_types.push(policy.type);
                try {
                    // validatePolicy updates the policy
                    // TODO: validation functions should NOT update the value being validated, that is not their responsability.
                    //       This should be updated to happen before validation is called, or after. 
                    const newPolicy = validatePolicy(applicationDocData, policy);
                    this.policies[i] = newPolicy;
                } catch (e) {
                    log.error('Policy Validation error. ' + e + __location);
                    return reject(e);
                }
            }

            // Get a list of all questions the user may need to answer
            const insurer_ids = this.get_insurer_ids();
            const wc_codes = this.get_wc_codes();

            // TODO: Move this to a translate method
            let questions = null;
            try {
                questions = await questionsSvc.GetQuestionsForBackend(wc_codes, this.business.industry_code, this.business.getZips(), policy_types, insurer_ids, true);
            } catch (e) {
                log.error(`Error in get_questions: ${e}. ` + __location);
                return reject(e);
            }

            // Grab the answers the user provided to our questions and reset the question object
            const user_questions = this.questions;
            this.questions = {};

            // TODO: Move this to a translate method
            // Convert each question from the database into a question object and load in the user's answer to each
            if (questions) {
                //await questions.forEach((question) => {
                for (const question of questions) {
                    // Prepare a Question object based on this data and store it
                    const q = new Question();
                    q.load(question);

                    // Load the user's answer
                    if (user_questions) {
                        if (Object.prototype.hasOwnProperty.call(user_questions, q.id)) {
                            const user_answer = user_questions[q.id];

                            try {
                                q.set_answer(user_answer);
                            } catch (e) {
                                return reject(e);
                            }
                        }
                    }

                    // Store the question object in the Application for later use
                    this.questions[q.id] = q;
                }
            }

            // TODO: Move this to a translate method
            // Enforce required questions (this must be done AFTER all questions are loaded with their answers)
            if (this.applicationDocData.questions) {
                for (const questionId in this.applicationDocData.questions) {
                    if (Object.prototype.hasOwnProperty.call(this.applicationDocData.questions, questionId)) {
                        const question = this.applicationDocData.questions[questionId];

                        // Hidden questions are not required
                        if (question.hidden) {
                            continue;
                        }

                        if (question.parent) {
                            // Get the parent question
                            const parent_question = this.questions[question.parent];

                            // If no parent was found, throw an error
                            if (!parent_question) {
                                // No one question issue should stop quoting with all insureres - BP 2020-10-04
                                log.error(`Question ${question.id} has invalid parent setting. (${htmlentities.decode(question.text).replace('%', '%%')})` + __location);
                            }
                        }

                    }
                }
            }

            // Validate all of the questions
            if (this.applicationDocData.questions) {
                for (const questionId in this.applicationDocData.questions) {
                    if (Object.prototype.hasOwnProperty.call(this.applicationDocData.questions, questionId)) {
                        const question = this.applicationDocData.questions.find(q => q.questionId === questionId);

                        if (!question.hidden) {
                            try {
                                validateQuestion(question);
                            } catch (e) {
                                log.error(`Error validating question ${question.questionId}: ${e}. ` + __location);
                            }
                        }
                    }
                }
            }

            // Check agent support
            await this.agencyLocation.supports_application().catch(function(error) {
                // This issue should not result in a stoppage of quoting with all insureres - BP 2020-10-04
                log.error('agencyLocation.supports_application() error ' + error + __location);
            });

            fulfill(true);
        });
    }
};