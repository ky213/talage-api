/* eslint-disable object-property-newline */
/* eslint-disable prefer-const */
/* eslint-disable no-catch-shadow */


const moment = require('moment');
const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
//const get_questions = global.requireShared('./helpers/getQuestions.js');
const questionsSvc = global.requireShared('./services/questionsvc.js');

const status = global.requireShared('./models/status/applicationStatus.js');
const AgencyLocation = require('./AgencyLocation.js');
const Business = require('./Business.js');
const Insurer = require('./Insurer.js');
const Policy = require('./Policy.js');
const Question = require('./Question.js');
const validator = global.requireShared('./helpers/validator.js');
const {
    validateAgencyLocation,
    validateBusiness,
    validatePolicies,
    validateQuestion,
    validateContacts,
    validateLocations,
    validateClaims,
    validateActivityCodes
} = require('./applicationValidator.js');

//const helper = global.requireShared('./helpers/helper.js');

const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
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
        this.quoteInsurerId = null;
    }

    /**
	 * Populates this object based on applicationId in the request
	 *
	 * @param {object} data - Object with appId, quoting options
     * @param {boolean} forceQuoting - if true age check is skipped.
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
    async load(data, forceQuoting = false) {
        log.debug('Loading data into Application' + __location);
        // date example
        // data = {
        //     id:  12123, //mysqlId
        //     insurerId: 1,
        //     agencyPortalQuote: true
        // }

        // ID
        //TODO detect ID type integer or uuid
        this.id = data.id;
        if(data.insurerId){
            this.quoteInsurerId = parseInt(data.insurerId,10);
        }
        // data.agencyPortalQuote = true
        // for quoting trigger by AgencyPortal.
        // Emails are not send for AgencyPortal trigger quotes.
        // Slack message are sent.
        this.agencyPortalQuote = data.agencyPortalQuote ? data.agencyPortalQuote : false;

        // load application from database.
        //let error = null
        let applicationBO = new ApplicationBO();

        try {
            //getById does uuid vs integer check...
             
            this.applicationDocData = await applicationBO.loadById(data.id);
            log.debug("Quote Application added applicationData" + __location)
        }
        catch(err){
            log.error("Unable to get applicationData for quoting appId: " + data.id + __location);
            throw err;
        }
        if(!this.applicationDocData){
            throw new Error(`Failed to load application ${data.id} `)
        }
        if(this.applicationDocData.mysqlId > 0){
            this.id = this.applicationDocData.mysqlId;
        }
        else {
            log.error(`bad appDoc ${JSON.stringify(this.applicationDocData)} ` + __location);
            throw new Error(`Bad application doc: ${data.id} `)
        }

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
        try {
            for (let i = 0; i < this.applicationDocData.policies.length; i++) {
                const policyJSON = this.applicationDocData.policies[i];
                const p = new Policy();
                await p.load(policyJSON, this.business, this.applicationDocData);
                this.policies.push(p);
                appPolicyTypeList.push(policyJSON.policyType);
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

        //: Eventually, this will need to take place on the applicationDocData, not the model data
        try {
            await this.translate();
        }
        catch (e) {
            log.error(`Error translating application: ${e}` + __location);
            //throw e;
        }
    }

    /**
     * This method is used to translate the existing model data into what the integrations expect
     *
     * Previously, this was done in the validation methods (which was incorrect). However, although we now validate off
     *      the applicationDocData (mongo record) instead of the model data, we still feed the model data (which is hydrated
     *      by the mongo data) to the integrations. Therefor, this method translates the model data structures. Eventually,
     *      we will need to modify this to translate this.applicationDocData once integrations start consuming that instead.
     *
     * NOTE: We may want to put this logic into a new load() method on Application.model.js, or we can keep it being called
     *      from Application.js load() function.
    */

    async translate() {

        /************** BUSINESS DATA TRANSLATION ***************/

        // DBA length check
        // NOTE: Do not stop the quote over dba name. Different insurers have different rules.
        if (this.business.dba && this.business.dba.length > 100) {
            log.warn(`Translate Warning: DBA exceeds maximum length of 100 characters applicationId ${this.id}` + __location);
            this.applicationDocData.dba = this.applicationDocData.dba.substring(0, 100);
        }

        // Mailing Address check, check for maximum length
        if (this.business.mailing_address && this.business.mailing_address.length > 100) {
            log.error('Translate Warning: Mailing address exceeds maximum of 100 characters');
            this.applicationDocData.mailingAddress = this.applicationDocData.mailingAddress.substring(0, 100);
        }
        if(!this.applicationDocData.numOwners && this.applicationDocData.owners.length > 0){
            this.applicationDocData.numOwners = this.applicationDocData.owners.length
        }

        // Adjust phone to remove formatting.  (not should be a integration issue, not app wide.)
        if(this.business && this.business.phone){
            this.business.phone = this.business.phone.replace(/[^0-9]/ig, '');
        }
        //this.business.phone = parseInt(this.business.phone, 10);
        //business contact cleanup
        if(this.business.contacts && this.business.contacts.length > 0){
            for(let contact of this.business.contacts){
                contact.phone = contact.phone.replace(/[^0-9]/ig, '');
            }
        }

        // If website is invalid, clear it
        if (this.business && this.business.website) {
            // Check formatting
            if (!validator.isWebsite(this.business.website)) {
                log.info(`Translate warning: Invalid formatting for property: website. Expected a valid URL for ${this.id}`)
                this.business.website = '';
            }

            // Check length if too long eliminate from qoute app
            if (this.business.website.length > 100) {
                log.info(`Translate Warning: Invalid value for property: website. over 100 characters for ${this.id}`)
                this.business.website = '';
            }
        }

        /************** LOCATION DATA TRANSLATION ***************/

        const unemployment_number_states = [
            'CO',
            'HI',
            'ME',
            'MN',
            'NJ',
            'RI',
            'UT'
        ];

        this.business.locations.forEach(location => {
            // identification number modification
            location.identification_number_type = this.applicationDocData.hasEin ? 'EIN' : 'SSN';

            // default unemployment_num to 0
            if (!location.unemployment_num || !unemployment_number_states.includes(location.state_abbr)) {
                location.unemployment_num = 0;
            }
        });

        /************** ACTIVITY CODES DATA TRANSLATION ***************/

        for (const location of this.business.locations) {
            for (const activityCode of location.activity_codes) {
                // Check that the ID is valid
                let result = null;
                try {
                    result = await db.query(`SELECT description FROM clw_talage_activity_codes WHERE id = ${activityCode.id} LIMIT 1;`);
                    if (!result || result.length !== 1) {
                        throw new Error(`Data Error: The activity code you selected (ID: ${activityCode.id}) is not valid.`);
                    }
                }
                catch (e) {
                    log.error(`Translation Error: DB SELECT activity codes error: ${e}. ` + __location);
                    //TODO Consistent error types
                    throw e;
                }

                // assign the description to the activity code
                if (result[0].description) {
                    activityCode.description = result[0].description;
                }
                else {
                    // this should never hit, but putting a log just in case...
                    log.warn("Translate Warning: activity code result does not contain a description, skipping...")
                }
            }
        }

        /************** POLICY DATA TRANSLATION ***************/

        this.policies.forEach(policy => {
            // store a temporary limit '/' deliniated, because for some reason, we don't store it that way in mongo...
            let indexes = [];
            for (let i = 1; i < policy.limits.length; i++) {
                if (policy.limits[i] !== "0") {
                    indexes.push(i);
                }
            }
            let limits = policy.limits.split("");
            limits.splice(indexes[1], 0, "/");
            limits.splice(indexes[0], 0, "/");
            limits = limits.join("");

            // Limits: If this is a WC policy, check if further limit controls are needed (IFF we have territory information)
            if (policy.type === 'WC' && policy.territories) {
                if (policy.territories.includes('CA')) {
                    // In CA, force limits to be at least 1,000,000/1,000,000/1,000,000
                    if (limits !== '2000000/2000000/2000000') {
                        limits = '1000000/1000000/1000000';
                    }
                }
                else if (policy.territories.includes('OR')) {
                    // In OR force limits to be at least 500,000/500,000/500,000
                    if (limits === '100000/500000/100000') {
                        limits = '500000/500000/500000';
                    }
                }
            }

            // explicitly set the policy's limits
            policy.limits = limits;

            // Determine the deductible
            if (typeof policy.deductible === "string") {
                // Parse the deductible string
                try {
                    policy.deductible = parseInt(policy.deductible, 10);
                }
                catch (e) {
                    // Default to 500 if the parse fails
                    log.warn(`Translation Warning: applicationId: ${policy.applicationId} policyType: ${policy.type} Could not parse deductible string '${policy.deductible}': ${e}. Defaulting to 500.`);
                    policy.deductible = 500;
                }
            }
        });

        /************** CLAIM DATA TRANSLATION ***************/

        this.policies.forEach(policy => {
            policy.claims.forEach(claim => {

                /**
                 * Amount Paid (dollar amount)
                 * - >= 0
                 * - < 15,000,000
                 */
                if (claim.amountPaid) {
                    if (!validator.claim_amount(claim.amountPaid)) {
                        throw new Error('Data Error: The amount must be a dollar value greater than 0 and below 15,000,000');
                    }

                    // Cleanup this input
                    if (typeof claim.amountPaid === 'number') {
                        claim.amountPaid = Math.round(claim.amountPaid);
                    }
                    else {
                        claim.amountPaid = Math.round(parseFloat(claim.amountPaid.toString().replace('$', '').replace(/,/g, '')));
                    }
                }
                else {
                    claim.amountPaid = 0;
                }

                /**
                 * Amount Reserved (dollar amount)
                 * - >= 0
                 * - < 15,000,000
                 */
                if (claim.amountReserved) {
                    if (!validator.claim_amount(claim.amountReserved)) {
                        throw new Error('Data Error: The amountReserved must be a dollar value greater than 0 and below 15,000,000');
                    }

                    // Cleanup this input
                    if (typeof claim.amountReserved === 'number') {
                        claim.amountReserved = Math.round(claim.amountReserved);
                    }
                    else {
                        claim.amountReserved = Math.round(parseFloat(claim.amountReserved.toString().replace('$', '').replace(/,/g, '')));
                    }
                }
                else {
                    claim.amountReserved = 0;
                }
            });
        });

        /************** QUESTION DATA TRANSLATION ***************/
        // NOTE: Some of this logic now uses applicationDocData simply because the logic is greatly simplified doing so

        const policyList = [];
        this.policies.forEach(policy => {
            policyList.push({
                type: policy.type,
                effectiveDate: policy.effective_date
            });
        });

        // Ensure we have the list of insurers for this application
        this.insurers = await this.get_insurers();

        // Get a list of all questions the user may need to answer. These top-level questions are "general" questions.
        const insurer_ids = this.get_insurer_ids();
        const wc_codes = this.get_wc_codes();
        let talageQuestionDefList = null;
        try {
            log.info(`Quoting Application Model loading questions for ${this.id} ` + __location)
            talageQuestionDefList = await questionsSvc.GetQuestionsForBackend(wc_codes, this.business.industry_code, this.business.getZips(), policyList, insurer_ids, "general", true);
            log.info(`Got questions Quoting Application Model loading questions for ${this.id} ` + __location)
        }
        catch (e) {
            log.error(`Translation Error: GetQuestionsForBackend: ${e}. ` + __location);
            //throw e;
        }
        // Grab the answers the user provided to our questions and reset the question object
        const user_questions = this.questions;
        this.questions = {};

        // Convert each question from the database into a question object and load in the user's answer to each
        if (talageQuestionDefList) {
            //await questions.forEach((question) => {
            for (const questionDef of talageQuestionDefList) {
                // Prepare a Question object based on this data and store it
                const q = new Question();
                q.load(questionDef);

                // Load the user's answer
                if (user_questions) {
                    if (Object.prototype.hasOwnProperty.call(user_questions, q.id)) {
                        const user_answer = user_questions[q.id];

                        try {
                            q.set_answer(user_answer);
                        }
                        catch (e) {
                            throw e;
                        }
                    }
                }

                // Store the question object in the Application for later use
                this.questions[q.id] = q;
            }
        }
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
        return new Promise(async(fulfill) => {
            // Get a list of desired insurers
            let desired_insurers = [];
            this.policies.forEach((policy) => {
                if (Array.isArray(policy.insurers)) {
                    policy.insurers.forEach((insurer) => {
                        if (desired_insurers.indexOf(insurer) === -1) {
                            // Check that the agent supports this insurer for this policy type
                            let match_found = false;
                            //log.debug("this.agencyLocation.insurers " + JSON.stringify(this.agencyLocation.insurers))
                            for (const agent_insurer in this.agencyLocation.insurers) {
                                if (Object.prototype.hasOwnProperty.call(this.agencyLocation.insurers, agent_insurer)) {
                                    // Find the matching insurer
                                    //if (this.agencyLocation.insurers[agent_insurer].id === parseInt(agent_insurer, 10)) {
                                    //log.debug("this.agencyLocation.insurers[agent_insurer] " + JSON.stringify(this.agencyLocation.insurers[agent_insurer]))
                                    //log.debug("insurer " + JSON.stringify(insurer) + __location)
                                    if (this.agencyLocation.insurers[agent_insurer].id === insurer.id) {
                                        // Check the policy type
                                        if (this.agencyLocation.insurers[agent_insurer][policy.type.toLowerCase()]) {
                                            match_found = true;
                                        }
                                    }
                                }
                            }

                            if (match_found) {
                                if(this.quoteInsurerId && this.quoteInsurerId > 0 && this.quoteInsurerId === insurer.id){
                                    desired_insurers.push(insurer);
                                }
                                else if(!this.quoteInsurerId){
                                    desired_insurers.push(insurer);
                                }
                            }
                            else {
                                log.warn(`Agent does not support ${policy.type} policies through insurer ${insurer}`);
                                //reject(new Error('Agent does not support this request'));
                                //stop = true;
                            }
                        }
                    });
                }
            });

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
                    log.warn('Agent does not support one or more of the insurers requested.');
                    //reject(new Error('Agent does not support this request'));
                    //return;
                }
            }
            else {
                // Only use the insurers supported by this agent
                log.debug("loading all Agency Location insurers " + __location)
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

        if(this.policies && this.policies.length === 0){
            log.error(`No policies for Application ${this.id} ` + __location)
        }

        // set the quoting started date right before we start looking for quotes
        let applicationBO = new ApplicationBO();
        await applicationBO.updateMongo(this.applicationDocData.uuid, {quotingStartedDate: moment.utc()});
        this.policies.forEach((policy) => {
            // Generate quotes for each insurer for the given policy type
            this.insurers.forEach((insurer) => {
                let quoteInsurer = true;
                if(this.quoteInsurerId && this.quoteInsurerId > 0 && this.quoteInsurerId !== insurer.id){
                    quoteInsurer = false;
                }
                // Only run quotes against requested insurers (if present)
                // Check that the given policy type is enabled for this insurer
                if (insurer.policy_types.indexOf(policy.type) >= 0 && quoteInsurer) {

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
                                    if (agency_location_insurer_data.useAcord === true && insurer.policy_type_details[policy.type].acord_support === true) {
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
                                log.info(`${policy.type} is not enabled for insurer ${insurer.id} for Agency location ${this.agencyLocation.id} app ${this.id}` + __location);
                            }
                        }
                        else {
                            log.warn(`Info for policy type ${policy.type} not found for agency location: ${this.agencyLocation.id} Insurer: ${insurer.id} app ${this.id}` + __location);
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


        // Update the application quote metrics
        await applicationBO.recalculateQuoteMetrics(this.applicationDocData.applicationId);

        // Update the application Status
        // Update the application quote progress to "complete"
        try{
            await applicationBO.updateProgress(this.applicationDocData.applicationId, "complete");
        }
        catch(err){
            log.error(`Error update appication progress appId = ${this.applicationDocData.applicationId}  for complete. ` + err + __location);
        }

        // Update the application status
        await status.updateApplicationStatus(this.applicationDocData.applicationId);

        // Get the quotes from the database
        const quoteBO = new QuoteBO();
        let quoteList = null;
        try {
            const query = {"applicationId": this.applicationDocData.applicationId}
            quoteList = await quoteBO.getList(query);
            //if a quote is marked handledByTalage  mark the application as handledByTalage and wholesale = true
            let isHandledByTalage = false
            quoteList.forEach((quoteDoc) => {
                if(quoteDoc.handledByTalage){
                    isHandledByTalage = quoteDoc.handledByTalage;
                }
            });
            if(isHandledByTalage){
                // eslint-disable-next-line object-curly-newline
                const appUpdateJSON = {handledByTalage: true};
                try{
                    await applicationBO.updateMongo(this.applicationDocData.applicationId, appUpdateJSON);
                }
                catch(err){
                    log.error(`Error update appication progress appId = ${this.applicationDocData.applicationId}  for complete. ` + err + __location);
                }
            }
        }
        catch (error) {
            log.error(`Could not retrieve quotes from the database for application ${this.applicationDocData.applicationId} ${__location}`);
        }

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
        let some_quotes = false;
        let notifiyTalage = false
        quoteList.forEach((quoteDoc) => {
            if (quoteDoc.aggregatedStatus === 'quoted' || quoteDoc.aggregatedStatus === 'quoted_referred') {
                some_quotes = true;
            }
            //quote Docs are marked with handledByTalage
            if(quoteDoc.handledByTalage){
                notifiyTalage = quoteDoc.handledByTalage;
            }
        });
        log.info(`Quote Application ${this.id}, some_quotes;: ${some_quotes}:  Sending Notification to Talage is ${notifiyTalage}` + __location)

        // Send an emails if there were no quotes generated
        if (some_quotes === false && this.agencyPortalQuote === false) {
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
                log.info(`AppId ${this.id} sending customer NO QUOTE email`);
                await emailSvc.send(this.business.contacts[0].email,
                    subject,
                    message,
                    {
                        agencyLocationId: this.agencyLocation.id,
                        applicationId: this.applicationDocData.applicationId,
                        applicationDoc: this.applicationDocData
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
                    log.info(`AppId ${this.id} sending agency NO QUOTE email`);
                    // Send the email message - development should email. change local config to get the email.
                    await emailSvc.send(this.agencyLocation.agencyEmail,
                        subject,
                        message,
                        {
                            agencyLocationId: this.agencyLocation.id,
                            applicationId: this.applicationDocData.applicationId,
                            applicationDoc: this.applicationDocData

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
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetwork = await agencyNetworkBO.getById(this.applicationDocData.agencyNetworkId);

            const attachment = {
                application_id: this.id,
                fields: [
                    {
                        short: false,
                        title: 'Agency Network',
                        value: agencyNetwork.name
                    },
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
            // some_quotes === true tells us there is at least one quote.
            // if quoteList is empty, all_had_quotes will equal true.
            if (some_quotes) {
                slack.send('customer_success', 'ok', 'Application completed and got quotes returned', attachment);
            }
            else {
                slack.send('customer_success', 'warning', 'Application completed, but the user received NO quotes', attachment);
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
            // Agent
            try {
                await validateAgencyLocation(this.agencyLocation);
            }
            catch (e) {
                log.error(`validateAgencyLocation() error: ${e}. ` + __location);
                return reject(e);
            }

            // Validate the ID
            // this.applicationDocData loaded we know
            // we have a good application ID.  (happend in Load)


            // Get a list of insurers and wait for it to return
            // Determine if WholeSale shoud be used.  (this might have already been determined in the app workflow.)
            let insurers = null;
            try {
                insurers = await this.get_insurers();
            }
            catch (e) {
                if (e.toLowerCase() === 'agent does not support this request') {
                    if (this.agencyLocation.wholesale) {
                        // Switching to the Talage agent
                        log.info(`Quote Application model Switching to the Talage agent appId: ${this.applicationDocData.mysqlId}` + __location)
                        this.agencyLocation = new AgencyLocation(this);
                        await this.agencyLocation.load({id: 1}); // This is Talage's agency location record

                        // Initialize the agent so we can use it
                        try {
                            await this.agencyLocation.init();
                        }
                        catch (err) {
                            log.error(`Error in this.agencyLocation.init(): ${err}. ` + __location);
                            return reject(e);
                        }

                        // Try to get the insurers again
                        try {
                            insurers = await this.get_insurers();
                        }
                        catch (err) {
                            log.error(`Error in get_insurers: ${err}. ` + __location);
                            return reject(err);
                        }
                    }

                    return reject(new Error('The Agent specified cannot support this policy.'));
                }
                else {
                    log.error(`Error in get_insurers: ${e}. ` + __location);
                    return reject(e);
                }
            }

            if (!insurers || !Array.isArray(insurers) || insurers.length === 0) {
                log.error('Invalid insurer(s) specified in policy. ' + __location);
                return reject(new Error('Invalid insurer(s) specified in policy.'));
            }

            //application level
            /**
             * Industry Code (required)
             * - > 0
             * - <= 99999999999
             * - Must existin our database
             */
            if (this.applicationDocData.industryCode) {
                //this is now loaded from database.
                //industry code should already be validated.
                // this.applicationDocData.industryCode_description = await validator.industry_code(this.applicationDocData.industryCode);
                // if (!this.applicationDocData.industryCode_description) {
                //     throw new Error('The industry code ID you provided is not valid');
                // }
            }
            else {
                return reject(new Error('Missing property: industryCode'));
            }


            // Business (required)
            try {
                await validateBusiness(this.applicationDocData);
            }
            catch (e) {
                return reject(new Error(`Failed validating business: ${e}`));
            }

            // Contacts (required)
            try {
                validateContacts(this.applicationDocData);
            }
            catch (e) {
                return reject(new Error(`Failed validating contacts: ${e}`));
            }

            // Locations (required)
            try {
                validateLocations(this.applicationDocData);
            }
            catch (e) {
                return reject(new Error(`Failed validating locations: ${e}`));
            }

            // Claims (optional)
            try {
                validateClaims(this.applicationDocData);
            }
            catch (e) {
                return reject(new Error(`Failed validating claims: ${e}`));
            }

            // Activity Codes (required)
            if (this.has_policy_type("WC")) {
                try {
                    validateActivityCodes(this.applicationDocData);
                }
                catch (e) {
                    return reject(new Error(`Failed validating activity codes: ${e}`));
                }
            }
            else {
                log.debug('No WC policy type found, skipping Activity Code validation...');
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
                }
                else {
                    return reject(new Error('Missing required field: management_structure'));
                }
            }

            /**
			 * Owners (conditionally required)
			 * - Only used for WC policies, ignored otherwise
			 * - Only required if ownersCovered is false
             *
             * NOTE: This should not stop quoting.
			 */
            // if (this.has_policy_type('WC') && !this.applicationDocData.ownersCovered) {
            //     if (this.applicationDocData.owners.length) {
            //         // TODO: Owner validation is needed here
            //     }
            //     else {
            //         return reject(new Error('The names of owners must be supplied if they are not included in this policy.'));
            //     }
            // }

            // Validate all policies
            try {
                validatePolicies(this.applicationDocData);
            }
            catch (e) {
                return reject(new Error(`Failed validating policy: ${e}`));
            }

            // Validate all of the questions
            if (this.applicationDocData.questions) {
                for (const question of this.applicationDocData.questions) {
                    if (question.questionId && !question.hidden) {
                        try {
                            validateQuestion(question);
                        }
                        catch (e) {
                            // This issue should not result in a stoppage of quoting with all insurers
                            log.error(`Failed validating question ${question.questionId}: ${e}. ` + __location);
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