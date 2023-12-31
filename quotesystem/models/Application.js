/* eslint-disable object-property-newline */
/* eslint-disable prefer-const */
/* eslint-disable no-catch-shadow */


const moment = require('moment');
const axios = require('axios');
//const _ = require('lodash');

const emailSvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const formatPhone = global.requireShared('./helpers/formatPhone.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const emailTemplateProceSvc = global.requireShared('./services/emailtemplatesvc.js');

const runQuoting = require('../run-quoting.js');
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
    validateBOPPolicies,
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
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
const {applicationStatus} = global.requireShared('./models/status/applicationStatus.js');

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
        this.quickQuoteOnly = false;
        this.appPolicyTypeList = [];
        this.agencyNetworkJson = {};
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
        // for quoting trigger by AgencyPortal or API .
        // QuoteApp agencyPortalQuote = false;
        // Emails are not send for AgencyPortal or API product trigger quotes.
        // Slack message are sent.
        this.agencyPortalQuote = data.agencyPortalQuote ? data.agencyPortalQuote : false;

        // load application from database.
        //let error = null
        let applicationBO = new ApplicationBO();

        try {
            //getById does uuid vs integer check...

            const applicationDocDataDB = await applicationBO.loadById(data.id);
            //get copy and pure JSON.  also prevent accident saves.
            this.applicationDocData = JSON.parse(JSON.stringify(applicationDocDataDB))
            // Behavior for No Quote notifications.
            if(this.applicationDocData.agencyPortalCreated && this.applicationDocData.apiCreated){
                this.agencyPortalQuote = true;
            }
            log.debug("Quote Application added applicationDocData" + __location)
        }
        catch(err){
            log.error("Unable to get applicationDocData for quoting appId: " + data.id + __location);
            throw err;
        }
        if(!this.applicationDocData){
            throw new Error(`Failed to load application ${data.id} `)
        }
        this.id = this.applicationDocData.applicationId;

        //Fix all ZipCode to 5 digits before anything is loaded from the data
        try{
            if(this.applicationDocData?.mailingZipcode){
                this.applicationDocData.mailingZipcode = this.applicationDocData.mailingZipcode.slice(0,5);
            }
            for(const location of this.applicationDocData.locations){
                if(location.zipcode){
                    location.zipcode = location.zipcode.slice(0,5)
                }
            }
            for(const policy of this.applicationDocData.policies){
                if(policy.waiverSubrogationList?.length > 0){
                    for(const waiverSub of policy.waiverSubrogationList){
                        if(waiverSub.zipcode){
                            waiverSub.zipcode = waiverSub.zipcode.slice(0,5)
                        }
                    }
                }
            }
        }
        catch(err){
            log.error(`appId: ${this.id} Error processing zipcodes for 5 digits ` + err + __location);
        }


        const agencyNetworkBO = new AgencyNetworkBO();
        let agencyNetworkDB = {}
        try{
            agencyNetworkDB = await agencyNetworkBO.getById(this.applicationDocData.agencyNetworkId)
        }
        catch(err){
            log.error("Error getting agencyNetworkBO " + err + __location);

        }
        if(agencyNetworkDB){
            this.agencyNetworkJson = agencyNetworkDB
            this.quickQuoteOnly = agencyNetworkDB.featureJson.quickQuoteOnly;
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
                throw new Error("Data Error: Application may not be updated due to age.");
            }
        }

        // Load the business information
        this.business = new Business();
        try {
            await this.business.load(this.applicationDocData);
        }
        catch (err) {
            log.error(`Unable to load the business for application ${this.id}: ${err} ${__location}`);
            throw err;
        }


        // Load the policy information
        try {
            for (let i = 0; i < this.applicationDocData.policies?.length; i++) {
                const policyJSON = this.applicationDocData.policies[i];
                if (!policyJSON.expirationDate && policyJSON.effectiveDate) {
                    try{
                        policyJSON.expirationDate = moment(policyJSON.effectiveDate).clone().add(1,"years");
                        log.info(`POLICY fixed policy.expirationDate ${policyJSON.expirationDate.toISOString()}` + __location)
                    }
                    catch(err){
                        log.error(`Quoting error fixing expirationDate ${err}` + __location)
                    }
                }
                const p = new Policy();
                await p.load(policyJSON, this.business, this.applicationDocData);
                this.policies.push(p);
                this.appPolicyTypeList.push(policyJSON.policyType);
            }
        }
        catch(err){
            log.error("Quote Application Model loading policy err " + err + __location);
            throw err;
        }
        //update business with policy type list.
        this.business.setPolicyTypeList(this.appPolicyTypeList);
        // Agent
        this.agencyLocation = new AgencyLocation(this.business, this.policies, this.applicationDocData.applicationId);
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
        if(this.applicationDocData.questions && this.applicationDocData.questions?.length > 0){
            let questionJSON = {};
            for(const question of this.applicationDocData.questions){
                if (question.questionType && (question.questionType.toLowerCase().startsWith('text')
                    || question.questionType === 'Checkboxes' && question.answerValue)) {

                    questionJSON[question.questionId] = question.answerValue
                }
                else {
                    questionJSON[question.questionId] = question.answerId
                }
            }
            //dead.....
            this.questions = questionJSON
        }

        //: Eventually, this will need to take place on the applicationDocData, not the model data
        try {
            await this.translate();
        }
        catch (e) {
            if (e.message && e.message.includes('Agency does not cover application territory')){
                log.warn(`Error translating application: ${e}` + __location);
            }
            else {
                log.error(`Error translating application: ${e}` + __location);
            }
            throw e;
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

        if(this.applicationDocData.ein){
            this.applicationDocData.ein = stringFunctions.santizeNumber(this.applicationDocData.ein);
        }

        let applicationBO = new ApplicationBO();

        /************** BUSINESS DATA TRANSLATION ***************/

        // DBA length check
        // NOTE: Do not stop the quote over dba name. Different insurers have different rules.
        if (this.business.dba && this.business.dba.length > 100) {
            log.warn(`Translate Warning: DBA exceeds maximum length of 100 characters applicationId ${this.id}` + __location);
            this.applicationDocData.dba = this.applicationDocData.dba.substring(0, 100);
        }

        // Mailing Address check, check for maximum length
        if (this.business.mailing_address && this.business.mailing_address?.length > 100) {
            log.error('Translate Warning: Mailing address exceeds maximum of 100 characters');
            this.applicationDocData.mailingAddress = this.applicationDocData.mailingAddress.substring(0, 100);
        }
        if(!this.applicationDocData.numOwners && this.applicationDocData.owners?.length > 0){
            this.applicationDocData.numOwners = this.applicationDocData.owners.length
            this.applicationDocData.owners.forEach((owner) => {
                // do not auto set percent ownership.
                // it may be an officer/Manager who does
                // not own any part of Crop (LLC that has hired a manager)
                if(!owner.ownership){
                    owner.ownership = 0;
                }
            });

        }

        // Adjust phone to remove formatting.  (not should be a integration issue, not app wide.)
        if(this.business && this.business.phone){
            this.business.phone = this.business.phone.replace(/[^0-9]/ig, '');
        }
        if(this.applicationDocData && this.applicationDocData.phone){
            this.applicationDocData.phone = this.applicationDocData.phone.replace(/[^0-9]/ig, '');
        }
        //this.business.phone = parseInt(this.business.phone, 10);
        //business contact cleanup
        if(this.business.contacts && this.business.contacts?.length > 0){
            for(let contact of this.business.contacts){
                if(typeof contact.phone === 'string'){
                    contact.phone = contact.phone.replace(/[^0-9]/ig, '');
                }
            }
        }
        //also replace in AppDoc
        for(const contact of this.applicationDocData.contacts){
            if(contact.phone){
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
            if (this.business.website?.length > 100) {
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
            // default unemployment_num to 0  - Why is this necessary? -BP
            if (!location.unemployment_num || !unemployment_number_states.includes(location.state_abbr)) {
                location.unemployment_num = 0;
            }
        });

        /************** ACTIVITY CODES DATA TRANSLATION ***************/

        for (const location of this.business.locations) {
            for (const activityCode of location.activity_codes) {
                // Check that the ID is valid
                try {

                    const ActivityCodeBO = global.requireShared('./models/ActivityCode-BO.js');
                    const activityCodeBO = new ActivityCodeBO();
                    const activityCodeJson = await activityCodeBO.getById(activityCode.id)
                    if(activityCodeJson){
                        activityCode.description = activityCodeJson.description;
                    }
                    else {
                        // this should never hit, but putting a log just in case...
                        log.warn("Translate Warning: activity code result does not contain a description, skipping...")
                    }
                }
                catch (e) {
                    log.error(`Translation Error: DB getById ${activityCode.id} activity codes for appId ${this.id} error: ${e}. ` + __location);
                    //throw e;
                }
            }
        }

        /************** POLICY DATA TRANSLATION ***************/
        //  THIS IS FOR BACKWARD CAPABILITY WITH OLDER INTEGRATIONS.
        // NEW INTEGRATIONS  Should use the AppDoc data directly.
        this.policies.forEach(policy => {
            // other policy type stores limit differently.
            const policyTypesWithLimits = [
                'BOP',
                'GL',
                'WC'
            ];

            // store a temporary limit '/' deliniated, because for some reason, we don't store it that way in mongo...
            if (policyTypesWithLimits.includes(policy.policyType)) {
                let indexes = [];
                for (let i = 1; i < policy.limits?.length; i++) {
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
                        // needs to update appDoc data.
                        if (limits !== '2000000/2000000/2000000') {
                            limits = '1000000/1000000/1000000';
                        }
                    }
                    else if (policy.territories.includes('OR')) {
                        // In OR force limits to be at least 500,000/500,000/500,000
                        // needs to update appDoc data.
                        if (limits === '100000/500000/100000') {
                            limits = '500000/500000/500000';
                        }
                    }
                }

                // explicitly set the policy's limits
                policy.limits = limits;
            }

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

                    // Cleanup this input
                    if (typeof claim.amountPaid === 'number') {
                        claim.amountPaid = Math.round(claim.amountPaid);
                    }
                    else if(typeof claim.amountPaid === 'string') {
                        claim.amountPaid = Math.round(parseFloat(claim.amountPaid.toString().replace('$', '').replace(/,/g, '')));
                    }
                    else {
                        claim.amountPaid = 0;
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
                    // Cleanup this input
                    if (typeof claim.amountReserved === 'number') {
                        claim.amountReserved = Math.round(claim.amountReserved);
                    }
                    else if (typeof claim.amountReserved === 'string') {
                        claim.amountReserved = Math.round(parseFloat(claim.amountReserved.toString().replace('$', '').replace(/,/g, '')));
                    }
                    else {
                        claim.amountReserved = 0;
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
        const industryCodeStringArray = [];
        if(this.applicationDocData.industryCode){
            industryCodeStringArray.push(this.applicationDocData.industryCode);
        }
        const bopPolicy = this.applicationDocData.policies.find((p) => p.policyType === "BOP")
        if(bopPolicy && bopPolicy.bopIndustryCodeId){
            industryCodeStringArray.push(bopPolicy.bopIndustryCodeId.toString());
        }

        let talageQuestionDefList = null;
        try {
            const zipCodeArray = [];
            const stateList = [];
            for (let i = 0; i < this.applicationDocData.locations?.length; i++) {
                zipCodeArray.push(this.applicationDocData.locations[i].zipcode);
                if (stateList.indexOf(this.applicationDocData.locations[i].state) === -1) {
                    stateList.push(this.applicationDocData.locations[i].state)
                }
            }

            log.info(`Quoting Application Model loading questions for ${this.id} ` + __location)
            const skipAgencyCheck = true;
            const returnHidden = true;
            const keepPossibleAnswers = true;
            const questionsObject = await applicationBO.GetQuestions(this.applicationDocData.applicationId, [this.applicationDocData.agencyId], "general", null,[] , skipAgencyCheck, [], null, returnHidden, keepPossibleAnswers)
            talageQuestionDefList = questionsObject.questionList;
            log.info(`Got questions Quoting Application Model loading questions for  ` + __location)
        }
        catch (e) {
            log.error(`Translation Error: GetQuestionsForBackend: ${e}. ` + __location);
            //throw e;
        }
        // Grab the answers the user provided to our questions and reset the question object
        this.questions = {};
        // Convert each question from the database into a question object and load in the user's answer to each
        if (talageQuestionDefList) {
            //await questions.forEach((question) => {
            for (const questionDef of talageQuestionDefList) {
                //log.debug(`questionDef ${JSON.stringify(questionDef)}`)
                // Prepare a Question object based on this data and store it
                const q = new Question();
                q.load(questionDef,this.applicationDocData.applicationId);
                // Load the user's answer
                //work with Application dataa
                if (this.applicationDocData.questions.length > 0) {
                    const appQuestionJSON = this.applicationDocData.questions.find((appQ) => appQ.questionId === questionDef.talageQuestionId)
                    if (appQuestionJSON) {
                        try {
                            //log.debug(`setting answer for \nQuestionDef:\n ${JSON.stringify(questionDef)}\n QUESTION:\n ${JSON.stringify(q)}\nAPpQuestionJSON:\n ${JSON.stringify(appQuestionJSON)}\n`)
                            q.set_answer(appQuestionJSON);
                        }
                        catch (e) {
                            //do not stop porcess with throwing an error.  Caused Production problem.
                            //log the issue
                            //throw e;
                            log.error(`AppId: ${this.id} set answer for ${q.id} problem ${e} ` + __location);
                        }
                    }
                    else {
                        // add question to Application Talage Question List - might be a hidden question client did not send in.
                        // use default answer if hidden
                        // Question Svc Enhancment
                        const talageQuestion = JSON.parse(JSON.stringify(questionDef))
                        talageQuestion.questionId = talageQuestion.talageQuestionId;
                        talageQuestion.questionType = talageQuestion.typeDesc;
                        if(talageQuestion.answers && talageQuestion.hidden){
                            for(const answer of talageQuestion.answers){
                                if(answer.default){
                                    talageQuestion.answerId = answer.answerId
                                    talageQuestion.answerValue = answer.answer
                                }
                            }
                        }
                        try {
                            q.set_answer(talageQuestion);
                        }
                        catch (e) {
                            //do not stop porcess with throwing an error.  Caused Production problem.
                            //log the issue
                            //throw e;
                            log.error(`AppId: ${this.id} set answer for ${q.id} problem ${e} ` + __location);
                        }
                        this.applicationDocData.questions.push(talageQuestion)

                    }
                }

                // Store the question object in the Application for later use
                // NOTE this technique may result in the JSON property by a string or an integer.  - causes problems.
                //          TODO convert quoting to use array not JSON object
                this.questions[q.id] = q;
            }
        }

        /************** AGENCY LOCATION SELECTION ***************/
        // fix bad selection.
        const resp = await applicationBO.setAgencyLocation(this.applicationDocData.applicationId)
        if(resp !== true){
            if (resp && resp.includes('Agency does not cover application territory')){
                log.warn(`Translation Error: setAgencyLocation: ${resp}. ` + __location);
            }
            else {
                log.error(`Translation Error: setAgencyLocation: ${resp}. ` + __location);
            }
            throw new Error(`Data Error: setAgencyLocation: ${resp}`);
        }
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
                            // eslint-disable-next-line guard-for-in
                            for (const agent_insurer_index in this.agencyLocation.insurers) {
                                if (Object.prototype.hasOwnProperty.call(this.agencyLocation.insurers, agent_insurer_index)) {
                                    const agentInsurer = this.agencyLocation.insurers[agent_insurer_index];
                                    // Find the matching insurer
                                    //if (this.agencyLocation.insurers[agent_insurer].id === parseInt(agent_insurer, 10)) {
                                    //log.debug("this.agencyLocation.insurers[agent_insurer] " + JSON.stringify(this.agencyLocation.insurers[agent_insurer]))
                                    //log.debug("insurer " + JSON.stringify(insurer) + __location)
                                    if (agentInsurer.id === insurer.id) {
                                        // Check the policy type
                                        if (policy.type && agentInsurer[policy.type.toLowerCase()]
                                            && agentInsurer[policy.type.toLowerCase()].enabled === true) {
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

            // Limit insurers to those supported by the Agent - is redundant see above.
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

            //Ghost Policy Check - SolePro Autoadd.

            if(desired_insurers.length > 0){
                try {
                    let applicationBO = new ApplicationBO();
                    const ghostInsurers = await applicationBO.GhostPolicyCheckAndInsurerUpdate(this.applicationDocData, desired_insurers)
                    if(ghostInsurers?.length > 0){
                        log.debug(`Ghost Policy Check - SolePro auto-add changed insurers to ${ghostInsurers}` + __location)

                        for(const ghostInsurerId of ghostInsurers){
                            if(desired_insurers.includes(ghostInsurerId) === false){
                                this.setupGhostInsurerInAgencyLocation(ghostInsurerId)
                            }
                        }
                        desired_insurers = ghostInsurers
                    }
                }
                catch(err){
                    log.error(`Ghost Policy Check - SolePro Autoadd check error appId: $(this.applicationDocData.applicationId} error: $[err}` + __location);
                    throw err;
                }
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

    async setupGhostInsurerInAgencyLocation(insurerId){
        //only available to wheelhouse agency
        if(this.applicationDocData.agencyNetworkId === 1){
            const wholesaleAgencyLocationId = 1;

            const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
            const agencyLocationBO = new AgencyLocationBO();
            const getChildren = true;
            const agencyPrimeAgencyLocation = await agencyLocationBO.getById(wholesaleAgencyLocationId, getChildren);
            //Find correct insurer
            const wholesaleInsurer = agencyPrimeAgencyLocation.insurers.find((ti) => ti.insurerId === insurerId);
            if(wholesaleInsurer){
                if(wholesaleInsurer.agencyId){
                    wholesaleInsurer.agency_id = wholesaleInsurer.agencyId;
                }
                if(wholesaleInsurer.insurerId){
                    wholesaleInsurer.id = wholesaleInsurer.insurerId;
                }
                if(wholesaleInsurer.agentId){
                    wholesaleInsurer.agent_id = wholesaleInsurer.agentId;
                }
                this.agencyLocation.insurers[insurerId] = wholesaleInsurer;
                this.agencyLocation.insurerList.push(wholesaleInsurer)
                log.debug(`Added Ghost insurer ${insurerId} ${JSON.stringify(wholesaleInsurer)}`)
            }
        }

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

    has_any_of_policy_types(policyTypeList) {
        let rtn = false;
        for(let i = 0; i < policyTypeList.length; i++){
            if(this.has_policy_type(policyTypeList[i])){
                rtn = true;
                break;
            }
        }
        return rtn;
    }

    /**
	 * Begins the process of getting and returning price_indications from insurers
	 *
	 * @returns {void}
	 */
    async run_priceindications() {

        // appStatusId > 70 is finished.(request to bind)
        if(this.applicationDocData.appStatusId >= 70){
            log.warn("An attempt to quote application that is finished.")
            throw new Error("Finished Application cannot be quoted")
        }

        // Generate quotes for each policy type
        const fs = require('fs');
        const pricing_promises = [];

        if(this.policies && this.policies.length === 0){
            log.error(`No policies for Application ${this.id} ` + __location)
        }

        // set the quoting started date right before we start looking for quotes
        let applicationBO = new ApplicationBO();
        await applicationBO.updateMongo(this.applicationDocData.uuid, {quotingStartedDate: moment.utc()});
        this.policies.forEach((policy) => {
            let policyTypeAbbr = '';
            if(policy?.type){
                policyTypeAbbr = policy.type.toLowerCase()
            }
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
                        if (agency_location_insurer_data && insurer.policy_type_details[policy.type.toUpperCase()].pricing_support) {

                            if (agency_location_insurer_data.enabled) {
                                let slug = insurer.slug;
                                const normalizedPath = `${__dirname}/../integrations/${slug}/${policyTypeAbbr}.js`;
                                try{
                                    if (slug.length > 0 && fs.existsSync(normalizedPath)) {
                                        // Require the integration file and add the response to our promises
                                        const IntegrationClass = require(normalizedPath);
                                        const integration = new IntegrationClass(this, insurer, policy);
                                        pricing_promises.push(integration.pricing());
                                    }
                                    else {
                                        log.error(`Database and Implementation mismatch: Integration confirmed in the database but implementation file was not found. Agency location ID: ${this.agencyLocation.id} insurer ${insurer.name} policyType ${policy.type} slug: ${slug} path: ${normalizedPath} app ${this.id} ` + __location);
                                    }
                                }
                                catch(err){
                                    log.error(`Error getting Insurer integration file ${normalizedPath} ${err} ` + __location)
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
        let pricingIds = null;
        try {
            pricingIds = await Promise.all(pricing_promises);
        }
        catch (error) {
            log.error(`Quoting did not complete successfully for application ${this.id}: ${error} ${__location}`);
            return;
        }

        //log.info(`${quoteIDs.length} quotes returned for application ${this.id}`);

        // Check for no quotes
        if (pricingIds?.length < 1) {
            log.warn(`No quotes returned for application ${this.id}` + __location);
            return;
        }

        return true;
    }


    /**
     * Begins the process of getting and returning quotes from insurers
     *
     * @returns {void}
     */
    async run_quotes() {
        if (global.settings.ENABLE_QUOTE_API_SERVER === 'YES') {
            const axiosOptions = {
                timeout: 15000, // Timeout after 15 seconds
                headers: {Accept: "application/json"}
            };
            const postParams = {
                id: this.id,
                insurerId: this.quoteInsurerId,
                agencyPortalQuote: this.agencyPortalQuote
            }
            let requestUrl = `http://localhost:4000/v1/run-quoting`;
            if (global.settings.ENV !== 'development') {
                //use ${ENV}quote.internal.talageins.com
                requestUrl = `https://${global.settings.ENV}quote.internal.talageins.com/v1/run-quoting`;
            }
            //if global.settings.QUOTE_SERVER_URL is set it wins....
            if(global.settings.QUOTE_SERVER_URL && global.settings.QUOTE_PUBLIC_API_PORT){
                requestUrl = `${global.settings.QUOTE_SERVER_URL}:${global.settings.QUOTE_PUBLIC_API_PORT}/v1/run-quoting`;
            }
            else if(global.settings.QUOTE_SERVER_URL){
                requestUrl = `${global.settings.QUOTE_SERVER_URL}/v1/run-quoting`;
            }

            try {
                log.debug(`calling ${requestUrl} for quoting` + __location)
                const respJSON = await axios.post(requestUrl, postParams, axiosOptions);
                return respJSON?.data;
            }
            catch (ex) {
                // If a timeout occurred.
                if (ex.code === 'ECONNABORTED') {
                    log.error(`Timeout to quoting server: ${requestUrl}: ${ex} ${__location}`);
                }
                // or if a 500 or other REST error was returned.
                else {
                    log.error(`Error when calling quoting server: ${requestUrl}: ${ex} ${__location}`);
                }

                // Run quoting manually if we are unable to run quoting via the quote server.
                return runQuoting.runQuoting(this);
            }
        }
        else {
            return runQuoting.runQuoting(this);
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

        const agencyNetworkBO = new AgencyNetworkBO();
        let agencyNetworkDB = {}
        try{
            agencyNetworkDB = await agencyNetworkBO.getById(this.applicationDocData.agencyNetworkId)
        }
        catch(err){
            log.error("Error getting agencyNetworkBO " + err + __location);

        }
        if(!agencyNetworkDB){
            agencyNetworkDB = {featureJson : {
                quoteEmailsCustomer : true,
                quoteEmailsAgency: true,
                agencyNetworkQuoteEmails: false,
                quickQuoteOnly: false
            }}
        }
        quoteList.forEach((quoteDoc) => {
            if (quoteDoc.quoteStatusId === quoteStatus.quoted.id
                || quoteDoc.quoteStatusId === quoteStatus.quoted_referred.id
                || quoteDoc.quoteStatusId === quoteStatus.priceIndication.id) {
                some_quotes = true;
            }
            //quote Docs are marked with handledByTalage
            if(quoteDoc.handledByTalage){
                notifiyTalage = quoteDoc.handledByTalage;
            }
        });
        log.info(`Quote Application ${this.id}, some_quotes;: ${some_quotes}:  Sending Notification to Talage is ${notifiyTalage}` + __location)

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

            if (emailContentJSON && emailContentJSON.emailBrand) {
                // Determine the branding to use for this email
                let brand = 'agency';
                // If this is Talage, update the brand
                if (this.agencyLocation.agencyId <= 2) {
                    brand = 'talage';
                }

                // Update when configure Application Statuses are implemented
                let appStatus = this.applicationDocData?.status
                for(const appStatusProp in applicationStatus){
                    if(this.applicationDocData?.status === applicationStatus[appStatusProp].appStatusDesc){
                        appStatus = applicationStatus[appStatusProp].appStatusText;
                    }
                }

                let message = '';
                let subject = '';

                /* ---=== Email to Insured === --- */
                if(agencyNetworkDB.featureJson.quoteEmailsCustomer === true && this.agencyPortalQuote === false && emailContentJSON.customerMessage && emailContentJSON.customerSubject){
                    message = emailContentJSON.customerMessage;
                    subject = emailContentJSON.customerSubject;

                    // Perform content replacements
                    message = message.replace(/{{Agency}}/g, this.agencyLocation.agency);
                    message = message.replace(/{{Agency Email}}/g, this.agencyLocation.agencyEmail ? this.agencyLocation.agencyEmail : '');
                    message = message.replace(/{{Agency Phone}}/g, this.agencyLocation.agencyPhone ? formatPhone(this.agencyLocation.agencyPhone) : '');
                    message = message.replace(/{{Agency Website}}/g, this.agencyLocation.agencyWebsite ? `<a href="${this.agencyLocation.agencyWebsite}"  rel="noopener noreferrer" target="_blank">${this.agencyLocation.agencyWebsite}</a>` : '');
                    message = message.replace(/{{AppStatus}}/g, appStatus);
                    subject = subject.replace(/{{AppStatus}}/g, appStatus);
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
                }

                /* ---=== Email to Agency === --- */
                if(agencyNetworkDB.featureJson.quoteEmailsAgency === true && this.agencyPortalQuote === false && emailContentJSON.agencyMessage){
                    // Do not send if this is Talage
                    if (this.agencyLocation.agencyId > 2) {
                        log.info(`AppId ${this.id} sending agency NO QUOTE email`);
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

                        if (quoteList[0] && quoteList[0].status) {
                            message = message.replace(/{{Quote Result}}/g, quoteList[0].status.charAt(0).toUpperCase() + quoteList[0].status.substring(1));
                        }

                        // Send the email message - development should email. change local config to get the email.
                        message = message.replace(/{{AppStatus}}/g, appStatus);
                        subject = subject.replace(/{{AppStatus}}/g, appStatus);
                        subject = subject.replace(/{{Agency}}/g, this.agencyLocation.agency);
                        subject = subject.replace(/{{Brand}}/g, capitalizedBrand);
                        subject = subject.replace(/{{Business Name}}/g, this.applicationDocData.businessName);

                        // Applink processing
                        const messageUpdate = await emailTemplateProceSvc.applinkProcessor(this.applicationDocData, agencyNetworkDB, message)
                        if(messageUpdate){
                            message = messageUpdate
                        }
                        const updatedEmailObject = await emailTemplateProceSvc.policyTypeProcessor(this.applicationDocData, agencyNetworkDB, message, subject)
                        if(updatedEmailObject.message){
                            message = updatedEmailObject.message
                        }
                        if(updatedEmailObject.subject){
                            subject = updatedEmailObject.subject
                        }

                        let recipients = this.agencyLocation.agencyEmail;

                        // Sofware Hook
                        const dataPackageJSON = {
                            appDoc: this.applicationDocData,
                            agencyNetworkDB: agencyNetworkDB,
                            htmlBody: message,
                            emailSubject: subject,
                            branding: emailContentJSON.emailBrand,
                            recipients: recipients
                        }
                        const hookName = 'no-qoute-email-agency'
                        try{
                            await global.hookLoader.loadhook(hookName, this.applicationDocData.agencyNetworkId, dataPackageJSON);
                            message = dataPackageJSON.htmlBody
                            subject = dataPackageJSON.emailSubject
                            emailContentJSON.emailBrand = dataPackageJSON.branding
                            recipients = dataPackageJSON.recipients
                        }
                        catch(err){
                            log.error(`Error ${hookName} hook call error ${err}` + __location);
                        }


                        await emailSvc.send(recipients,
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
                    log.debug(`agencyNetworkDB.featureJson.quoteEmailsAgency ${agencyNetworkDB.featureJson.quoteEmailsAgency}  this.agencyPortalQuote  ${this.agencyPortalQuote}   emailContentJSON.agencyMessage ${emailContentJSON.agencyMessage?.length} `)
                }
                //AgencyNetwork
                if(agencyNetworkDB.featureJson.agencyNetworkQuoteEmails === true){
                    const emailContentAgencyNetworkJSON = await agencyNetworkBO.getEmailContent(this.applicationDocData.agencyNetworkId,"no_quotes_agency_network");
                    if(!emailContentAgencyNetworkJSON || !emailContentAgencyNetworkJSON.message || !emailContentAgencyNetworkJSON.subject){
                        log.error(`AgencyNetwork ${agencyNetworkDB.name} missing no_quotes_agency_network email template` + __location)
                    }
                    else {
                        let portalLink = emailContentJSON.PORTAL_URL;

                        message = emailContentAgencyNetworkJSON.message;
                        subject = emailContentAgencyNetworkJSON.subject;

                        // Perform content replacements
                        const capitalizedBrand = emailContentJSON.emailBrand.charAt(0).toUpperCase() + emailContentJSON.emailBrand.substring(1);
                        message = message.replace(/{{Agency Portal}}/g, `<a href="${portalLink}" target="_blank" rel="noopener noreferrer">${capitalizedBrand} Agency Portal</a>`);

                        message = message.replace(/{{Agency}}/g, this.agencyLocation.agency);
                        message = message.replace(/{{Agency Email}}/g, this.agencyLocation.agencyEmail ? this.agencyLocation.agencyEmail : '');
                        message = message.replace(/{{Agency Phone}}/g, this.agencyLocation.agencyPhone ? formatPhone(this.agencyLocation.agencyPhone) : '');


                        message = message.replace(/{{Brand}}/g, capitalizedBrand);
                        message = message.replace(/{{Business Name}}/g, this.business.name);
                        message = message.replace(/{{Contact Email}}/g, this.business.contacts[0].email);
                        message = message.replace(/{{Contact Name}}/g, `${this.business.contacts[0].first_name} ${this.business.contacts[0].last_name}`);
                        message = message.replace(/{{Contact Phone}}/g, formatPhone(this.business.contacts[0].phone));
                        message = message.replace(/{{Industry}}/g, this.business.industry_code_description);
                        message = message.replace(/{{AppStatus}}/g, appStatus);

                        subject = subject.replace(/{{AppStatus}}/g, appStatus);
                        subject = subject.replace(/{{Agency}}/g, this.agencyLocation.agency);
                        subject = subject.replace(/{{Brand}}/g, capitalizedBrand);
                        subject = subject.replace(/{{Business Name}}/g, this.applicationDocData.businessName);
                        if (quoteList[0] && quoteList[0].status) {
                            message = message.replace(/{{Quote Result}}/g, quoteList[0].status.charAt(0).toUpperCase() + quoteList[0].status.substring(1));
                        }

                        //Applink processing
                        const messageUpdate = await emailTemplateProceSvc.applinkProcessor(this.applicationDocData, agencyNetworkDB, message)
                        if(messageUpdate){
                            message = messageUpdate
                        }
                        const updatedEmailObject = await emailTemplateProceSvc.policyTypeProcessor(this.applicationDocData, agencyNetworkDB, message, subject)
                        if(updatedEmailObject.message){
                            message = updatedEmailObject.message
                        }
                        if(updatedEmailObject.subject){
                            subject = updatedEmailObject.subject
                        }


                        log.info(`AppId ${this.id} sending agency network NO QUOTE email`);
                        // Send the email message - development should email. change local config to get the email.
                        let recipientsString = agencyNetworkDB.email
                        //Check for AgencyNetwork users are suppose to get notifications for this agency.
                        if(this.applicationDocData.agencyId){
                            // look up agencyportal users by agencyNotificationList
                            try{
                                const agencynotificationsvc = global.requireShared('services/agencynotificationsvc.js');
                                const anRecipents = await agencynotificationsvc.getUsersByAgency(this.applicationDocData.agencyId,this.appPolicyTypeList)

                                if(anRecipents.length > 2){
                                    recipientsString += `,${anRecipents}`
                                }
                            }
                            catch(err){
                                log.error(`AppId: ${this.applicationDocData.applicationId} agencyId ${this.applicationDocData.agencyId} agencynotificationsvc.getUsersByAgency error: ${err}` + __location)
                            }
                        }

                        // Sofware Hook
                        const dataPackageJSON = {
                            appDoc: this.applicationDocData,
                            agencyNetworkDB: agencyNetworkDB,
                            htmlBody: message,
                            emailSubject: subject,
                            branding: emailContentJSON.emailBrand,
                            recipients: recipientsString
                        }
                        const hookName = 'no-qoute-email-agencynetwork'
                        try{
                            await global.hookLoader.loadhook(hookName, this.applicationDocData.agencyNetworkId, dataPackageJSON);
                            message = dataPackageJSON.htmlBody
                            subject = dataPackageJSON.emailSubject
                            emailContentJSON.emailBrand = dataPackageJSON.branding
                            recipientsString = dataPackageJSON.recipients
                        }
                        catch(err){
                            log.error(`Error ${hookName} hook call error ${err}` + __location);
                        }


                        await emailSvc.send(recipientsString,
                            subject,
                            message,
                            {
                                agencyLocationId: this.agencyLocation.id,
                                applicationId: this.applicationDocData.applicationId,
                                applicationDoc: this.applicationDocData

                            },
                            this.applicationDocData.agencyNetworkId,
                            "Networkdefault",
                            this.applicationDocData.agencyId);
                    }
                }
            }
            else if(!emailContentJSON.emailBrand){
                log.error(`Missing Email Brand for Appid ${this.id} Agency NetworkId ${this.applicationDocData.agencyNetworkId} Agency ${this.agencyLocation.agencyId} for no quotes.` + __location);
            }
            else {
                log.error(`No Email content for Appid ${this.id} Agency$ {this.agencyLocation.agencyId} for no quotes.` + __location);
            }
        }
        // NO WAIT GOT QUOTES
        else if(agencyNetworkDB?.featureJson?.agencyQuoteEmailsNoWaitOnQuote === true && agencyNetworkDB.featureJson.quoteEmailsAgency === true
                || agencyNetworkDB?.featureJson?.agencyNetworkQuoteEmailsNoWaitOnQuote === true && agencyNetworkDB.featureJson.agencyNetworkQuoteEmails === true){
            //call abanddonQuotetask to send agency and agencynetwork emails.
            // Assumes agency network get an immediate notication also.
            const taskAbandonQuote = global.requireRootPath('tasksystem/task-abandonquote.js');
            const InsurerBO = global.requireShared('models/Insurer-BO.js');
            const PolicyTypeBO = global.requireShared('models/PolicyType-BO.js');
            let insurerList = null;
            const insurerBO = new InsurerBO();
            try{
                insurerList = await insurerBO.getList();
            }
            catch(err){
                log.error("Error get InsurerList " + err + __location)
            }
            let policyTypeList = null;
            const policyTypeBO = new PolicyTypeBO()
            try{
                policyTypeList = await policyTypeBO.getList();
            }
            catch(err){
                log.error("Error get policyTypeList " + err + __location)
            }

            // NO WAIT GOT QUOTES AGENCY
            // eslint-disable-next-line no-lonely-if
            if(agencyNetworkDB.featureJson.quoteEmailsAgency === true && agencyNetworkDB?.featureJson?.agencyQuoteEmailsNoWaitOnQuote === true){
                try{
                    const SEND_AGENCY = true
                    await taskAbandonQuote.processAbandonQuote(this.applicationDocData, insurerList, policyTypeList, SEND_AGENCY, !SEND_AGENCY, !SEND_AGENCY)
                }
                catch(err){
                    log.debug('catch error from await ' + err);
                }
            }
            // NO WAIT GOT QUOTES Agency Network
            if(agencyNetworkDB.featureJson.agencyNetworkQuoteEmails === true && agencyNetworkDB?.featureJson?.agencyNetworkQuoteEmailsNoWaitOnQuote === true){
                try{
                    const SEND_AGENCYNETWORK = true
                    await taskAbandonQuote.processAbandonQuote(this.applicationDocData, insurerList, policyTypeList, !SEND_AGENCYNETWORK, SEND_AGENCYNETWORK, !SEND_AGENCYNETWORK)
                }
                catch(err){
                    log.debug('catch error from await ' + err);
                }
            }
        }

        // Only send Slack messages on Talage applications  this.agencyLocation.agency
        if (this.agencyLocation.agencyId <= 2 || notifiyTalage === true) {
            // Build out the 'attachment' for the Slack message
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
            if(some_quotes && this.applicationDocData.metrics?.appValue > 0){
                const amountStr = this.applicationDocData.metrics.appValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                const appValue = {
                    'short': true,
                    'title': 'AppValue',
                    'value': `$${amountStr}`
                }
                attachment.fields.push(appValue)
            }

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
     * @param {boolean} logValidationErrors - true = log.error is written
	 * @returns {Promise.<array, Error>} A promise that returns an array containing insurer information if resolved, or an Error if rejected
	 */
    validate(logValidationErrors = true) {
        return new Promise(async(fulfill, reject) => {

            if(this.quickQuoteOnly){
                return fulfill(true);
            }

            // Agent
            try {
                //Check Agencylocation Choice.
                await validateAgencyLocation(this.applicationDocData, this.agencyLocation, logValidationErrors);
            }
            catch (e) {
                if(logValidationErrors){
                    if(e.message?.includes("Application's Agency Location does not cover")){
                        log.info(`Applicaiton Model: validateAgencyLocation(): ${e.message}. ` + __location);
                    }
                    else {
                        log.error(`Applicaiton Model: validateAgencyLocation() error: ${e}. ` + __location);
                    }
                }
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
                if (e?.toLowerCase() === 'agent does not support this request') {
                    if (this.agencyLocation.wholesale) {
                        // Switching to the Talage agent
                        log.info(`Quote Application model Switching to the Talage agent appId: ${this.applicationDocData.applicationId}` + __location)
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
                if(logValidationErrors){
                    log.error('Invalid insurer(s) specified in policy. ' + __location);
                }
                return reject(new Error('Invalid insurer(s) specified in policy.'));
            }

            //application level
            /**
             * Industry Code (required)
             * - > 0
             * - <= 99999999999
             * - Must existin our database
             */
            if (this.applicationDocData.industryCode && parseInt(this.applicationDocData.industryCode, 10) > 0) {
                //this is now loaded from database.
                //industry code should already be validated.
                // this.applicationDocData.industryCode_description = await validator.industry_code(this.applicationDocData.industryCode);
                // if (!this.applicationDocData.industryCode_description) {
                //     throw new Error('The industry code ID you provided is not valid');
                // }
            }
            // eslint-disable-next-line array-element-newline
            else if (this.has_any_of_policy_types(["WC","GL","BOP","CYBER","PL"])) {
                return reject(new Error('Missing property: industryCode'));

            }

            // Business (required)
            try {
                await validateBusiness(this.applicationDocData, logValidationErrors);
            }
            catch (e) {
                return reject(new Error(`Failed validating business: ${e}`));
            }

            // Contacts (required)
            try {
                await validateContacts(this.applicationDocData,logValidationErrors);
            }
            catch (e) {
                return reject(new Error(`Failed validating contacts: ${e}`));
            }

            // Locations (required)
            try {
                await validateLocations(this.applicationDocData, logValidationErrors);
            }
            catch (e) {
                return reject(new Error(`Failed validating locations: ${e}`));
            }

            // Claims (optional)
            try {
                await validateClaims(this.applicationDocData,logValidationErrors);
            }
            catch (e) {
                return reject(new Error(`Failed validating claims: ${e}`));
            }

            if(!(this.applicationDocData.policies?.length > 0)){
                return reject(new Error(`Must have at least 1 policy`));
            }


            // Activity Codes (required)
            if (this.has_policy_type("WC")) {
                try {
                    validateActivityCodes(this.applicationDocData, logValidationErrors);
                }
                catch (e) {
                    return reject(new Error(`Failed validating activity codes: ${e}`));
                }
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
                validatePolicies(this.applicationDocData, this.agencyNetworkJson, logValidationErrors);
            }
            catch (e) {
                return reject(new Error(`Failed validating policy: ${e}`));
            }
            //validateBOPPolicies
            if(this.has_policy_type('BOP')){
                try {
                    await validateBOPPolicies(this.applicationDocData, this.agencyLocation.insurerList, logValidationErrors);
                }
                catch (e) {
                    return reject(new Error(`Failed validating BOP policy: ${e}`));
                }
            }


            // Validate all of the questions
            if (this.applicationDocData.questions) {
                for (const question of this.applicationDocData.questions) {
                    if (question.questionId && !question.hidden) {
                        try {
                            validateQuestion(this.applicationDocData, question, logValidationErrors);
                        }
                        catch (e) {
                            // This issue should not result in a stoppage of quoting with all insurers
                            if(logValidationErrors){
                                log.error(`AppId ${this.id} Failed validating question ${question.questionId}: ${e}. ` + __location);
                            }
                        }
                    }
                }
            }

            // Check agent support
            await this.agencyLocation.supports_application().catch(function(error) {
                // This issue should not result in a stoppage of quoting with all insureres - BP 2020-10-04
                if(logValidationErrors){
                    log.error(`agencyLocation.supports_application() error ` + error + __location);
                }
            });

            fulfill(true);
        });
    }


    /**
	 * Begins the process of getting and returning pricing from insurers
	 *
	 * @returns {void}
	 */
    async run_pricing() {
        if (global.settings.ENABLE_QUOTE_API_SERVER === 'YES') {
            const axiosOptions = {
                timeout: 55000, // Timeout after 55 seconds - Sync
                headers: {Accept: "application/json"}
            };
            const postParams = {
                id: this.id,
                insurerId: this.quoteInsurerId,
                agencyPortalQuote: this.agencyPortalQuote
            }
            let requestUrl = `http://localhost:4000/v1/run-pricing`;
            if (global.settings.ENV !== 'development') {
                //use ${ENV}quote.internal.talageins.com
                requestUrl = `https://${global.settings.ENV}quote.internal.talageins.com/v1/run-pricing`;
            }
            //if global.settings.QUOTE_SERVER_URL is set it wins....
            if(global.settings.QUOTE_SERVER_URL && global.settings.QUOTE_PUBLIC_API_PORT){
                requestUrl = `${global.settings.QUOTE_SERVER_URL}:${global.settings.QUOTE_PUBLIC_API_PORT}/v1/run-pricing`;
            }
            else if(global.settings.QUOTE_SERVER_URL){
                requestUrl = `${global.settings.QUOTE_SERVER_URL}/v1/run-pricing`;
            }

            try {
                log.debug(`calling ${requestUrl} for quoting` + __location)
                const respJSON = await axios.post(requestUrl, postParams, axiosOptions);
                return respJSON?.data;
            }
            catch (ex) {
                // If a timeout occurred.
                if (ex.code === 'ECONNABORTED') {
                    log.error(`Timeout to quoting server: ${requestUrl}: ${ex} ${__location}`);
                }
                // or if a 500 or other REST error was returned.
                else {
                    log.error(`Error when calling quoting server: ${requestUrl}: ${ex} ${__location}`);
                }

                // Run quoting manually if we are unable to run quoting via the quote server.
                return runQuoting.runPricing(this);
            }
        }
        else {
            return runQuoting.runPricing(this);
        }

    }
};