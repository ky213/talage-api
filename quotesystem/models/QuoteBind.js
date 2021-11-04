/* eslint-disable object-curly-newline */
/**
 * Defines a single quote
 */

'use strict';
//remove potential reference conflict
//const QuoteBO = global.requireShared('./models/Quote-BO.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');

const Insurer = require('./Insurer.js');
const fs = require('fs');

//const fs = require('fs');
const slack = global.requireShared('./services/slacksvc.js');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');


module.exports = class QuoteBind{

    constructor(){
        this.applicationDoc = {}
        this.quoteDoc = {};
        this.agencyJSON = {};
        this.insurer = {};
        this.payment_plan = 0;
        this.insurerPaymentPlanId = null;
        this.agencyLocation = null;
        this.requestUserId = null;
        this.policyInfo = {};
    }

    /**
     * Marks this quote as bound. ??? where is the save or update
     * @returns {Promise.<string, ServerError>} Returns a string containing bind result (either 'Bound' or 'Referred') if resolved, or a ServerError on failure
     */
    async checkIfQuoteCanBeBound(){
        if(!this.quoteDoc){
            log.error('Missing QuoteDoc ' + __location);
            throw new Error('Quote not Found. No action taken.');
        }
        // Make sure this quote is not already bound
        if(this.quoteDoc && this.quoteDoc.bound){
            log.info('Quote already bound' + __location);
            throw new Error('Quote already bound. No action taken.');
        }

        let statusWithinBindingRange = false;
        // eslint-disable-next-line no-shadow
        if(this.quoteDoc.quoteStatusId > quoteStatus.declined.id && this.quoteDoc.quoteStatusId < quoteStatus.bound.id){
            statusWithinBindingRange = true;
        }

        // Make sure that this quote was quoted by the API
        if(!statusWithinBindingRange){

            // Return an error
            log.info(`Quotes with an api_result of '${this.quoteDoc.apiResult}' are not eligible to be bound.`);
            throw new Error(`Quote ${this.quoteDoc.quoteId} is not eligible for binding with status ${this.quoteDoc.status} - ${this.quoteDoc.quoteStatusId}`);
        }


        return true;
    }

    // eslint-disable-next-line valid-jsdoc
    /**
     * Binds this quote via API, if possible. If successful, this method
     * returns nothing. If not successful, then an Exception is thrown.
     */
    async bindPolicy(){

        if(!this.quoteDoc){
            log.error(`BindPolicy no quoteDoc ` + __location)
        }
        let oktoBind = false;
        // only have success with API call.
        try {
            oktoBind = await this.checkIfQuoteCanBeBound();
        }
        catch(err){
            log.error(`Binding Error AppId: ${this.quoteDoc.applicationId} QuoteId: ${this.quoteDoc.quoteId} Insurer: ${this.insurer.name} error checking quote status ${err} ${__location}`);
        }
        if(oktoBind === false){
            return "cannot_bind_quote";
        }

        // Check that an integration file exists for this insurer and store a reference to it for later use
        const path = `${__dirname}/../integrations/${this.insurer.slug}/${this.quoteDoc.policyType.toLowerCase()}-bind.js`;
        log.debug(`bindPolicy path ${path}` + __location);
        // Only do API-bind if we support API bind. Otherwise we will just do
        // manual bind.
        if (fs.existsSync(path)) {
            log.debug("bindPolicy" + __location)
            // Create an instance of the Integration class
            const BindClass = require(path);

            const bindWorker = new BindClass(this.quoteDoc, this.insurer, this.agencyLocation);
            // Begin the binding process
            try {
                // response: "success", "error", "rejected"
                const quoteResp = await bindWorker.bind();
                //save log and any other quote update like quote letter for AF
                await this.quoteDoc.save().catch((err) => {
                    log.error(`failed to save quoteDoc after processing ${err}` + __location);
                })
                if(quoteResp === "success"){
                    //save it
                    const policyInfo = {
                        policyId: bindWorker.policyId,
                        policyNumber: bindWorker.policyNumber,
                        policyEffectiveDate: bindWorker.policyEffectiveDate,
                        policyPremium: bindWorker.policyPremium,
                        policyUrl: bindWorker.policyUrl
                    }
                    //in case upstrign need to get access to it.
                    this.policyInfo = policyInfo;
                    log.debug("policyInfo " + JSON.stringify(policyInfo));
                    const QuoteBO = global.requireShared('./models/Quote-BO.js');
                    const quoteBO = new QuoteBO()
                    await quoteBO.markQuoteAsBound(this.quoteDoc.quoteId, this.applicationDoc.applicationId, this.requestUserId, policyInfo);
                    //QuoteBind is reference by ApplicationBO. So the ApplicationBO cannot be at top.
                    const ApplicationBO = global.requireShared('./models/Application-BO.js');
                    const applicationBO = new ApplicationBO();

                    //Quote and application Doc should be updated here to central logic.
                    await applicationBO.updateStatus(this.applicationDoc.applicationId,"bound", 90);
                    // Update Application-level quote metrics when we do a bind.
                    await applicationBO.recalculateQuoteMetrics(this.applicationDoc.applicationId);
                    //notification should be trigger here.
                    await this.send_slack_notification('bound');
                }
                // else if(quoteResp = "rejected") {
                //     //nothing to do
                // } if(quoteResp = "error") {
                //     //nothing to do
                // }
                else if(quoteResp === "rejected"){
                    log.error(`Binding Error AppId: ${this.quoteDoc.applicationId} QuoteId: ${this.quoteDoc.quoteId} Insurer: ${this.insurer.name} rejected submission ${__location}`)
                }
                else if(quoteResp === "updated"){
                    log.info(`Binding AppId: ${this.quoteDoc.applicationId} QuoteId: ${this.quoteDoc.quoteId} Insurer: ${this.insurer.name} updated submission ${__location}`)
                }
                else {
                    //unknown reponse.
                    log.error(`Binding Error AppId: ${this.quoteDoc.applicationId} QuoteId: ${this.quoteDoc.quoteId} Insurer: ${this.insurer.name} Bind Unknown response from Bind Class ${__location}`);
                    return "error";
                }
                return quoteResp;
            }
            catch (error) {
                await this.quoteDoc.save().catch((err) => {
                    log.error(`failed to save quoteDoc after error ${err}` + __location);
                })
                log.debug(`${error}` + __location);
                log.error(`Binding Error AppId: ${this.quoteDoc.applicationId} QuoteId: ${this.quoteDoc.quoteId} Insurer: ${this.insurer.name} Bind request Error: ${error} ${__location}`);
                throw error;
            }
        }
    }


    /**
	 * Populates this object with data from the database
	 *
	 * @param {int} quoteId - The ID of the quote
	 * @param {int} paymentPlanId - The ID of the payment plan selected by the user
     * @param {int} requestUserId - The Agency Portal user ID that requested the bind.
     * @param {int} insurerPaymentPlanId - The ID of the Insurer payment plan selected by the user
	 * @returns {Promise.<null, ServerError>} A promise that fulfills on success or returns a ServerError on failure
	 */
    async load(quoteId, paymentPlanId, requestUserId, insurerPaymentPlanId){
        if(requestUserId){
            this.requestUserId = requestUserId;
        }
        else {
            this.requestUserId = "applicant";
        }

        // Attempt to get the details of this quote from the database
        //USE BO's
        const QuoteBO = global.requireShared('./models/Quote-BO.js');
        const quoteModel = new QuoteBO();
        try {
            const returnModel = true
            this.quoteDoc = await quoteModel.getById(quoteId,returnModel)
        }
        catch (err) {
            log.error(`Loading quote for bind request quote ${quoteId} error:` + err + __location);
            //throw err;
            return;
        }

        if(!this.quoteDoc){
            log.error(`No quoteDoc quoteId ${quoteId} ` + __location);
            throw new Error(`No quoteDoc quoteId ${quoteId}`);
        }
        //If there is an insurer payment plan it overrided the talage paymentplan
        if(insurerPaymentPlanId || this.quoteDoc.insurerPaymentPlanId){
            if(this.quoteDoc.insurerPaymentPlanId && !insurerPaymentPlanId){
                insurerPaymentPlanId = this.quoteDoc.insurerPaymentPlanId;
            }
            else if(this.quoteDoc.insurerPaymentPlanId !== insurerPaymentPlanId) {
                this.quoteDoc.insurerPaymentPlanId = insurerPaymentPlanId;
                await this.quoteDoc.save().catch((err) => {
                    log.error(`failed to save quoteDoc after processing ${err}` + __location);
                })
            }
            paymentPlanId = null
            this.insurerPaymentPlanId = insurerPaymentPlanId;
        }
        else if(this.quoteDoc.paymentPlanId && !paymentPlanId){
            paymentPlanId = this.quoteDoc.paymentPlanId;
        }
        else if(this.quoteDoc.paymentPlanId !== paymentPlanId) {
            this.quoteDoc.paymentPlanId = paymentPlanId;
            await this.quoteDoc.save().catch((err) => {
                log.error(`failed to save quoteDoc after processing ${err}` + __location);
            })
        }
        if(!paymentPlanId && !insurerPaymentPlanId){
            paymentPlanId = 1;
        }
        //QuoteBind is reference by ApplicationBO. So the ApplicationBO cannot be at top.
        const ApplicationBO = global.requireShared('./models/Application-BO.js');
        const applicationBO = new ApplicationBO();
        try{
            this.applicationDoc = await applicationBO.getById(this.quoteDoc.applicationId);
            log.debug("Quote Application added applicationData" + __location)
        }
        catch(err){
            log.error("Unable to get applicationData for binding appId: " + quoteId + __location);
            return;
        }

        const agencyBO = new AgencyBO();
        // Load the request data into it
        try {
            this.agencyJSON = await agencyBO.getById(this.applicationDoc.agencyId)
        }
        catch (err) {
            log.error("Agency load for bind error " + err + __location);
            return;
        }
        //for API credentials.
        //load agencyLocation
        try {
            const agencyLocationBO = new AgencyLocationBO()
            this.agencyLocation = await agencyLocationBO.getById(this.applicationDoc.agencyLocationId)
        }
        catch (err) {
            log.error("Agency Location load for bind error " + err + __location);
            return;
        }

        // Load up an insurer based on the ID found
        const insurer = new Insurer();
        try{
            this.insurer = await insurer.init(this.quoteDoc.insurerId);
        }
        catch(err){
            log.error("Insurer load for bind error " + err + __location);
            throw err;
        }

        // Validate the payment plan
        // - Only set payment plan if passed in. No need to validate insurerPaymentPlanId it came from quote response.
        if (!this.insurerPaymentPlanId && paymentPlanId) {
            const insurerPaymentPlan = this.insurer.insurerDoc.paymentPlans;
            if(!insurerPaymentPlan || !insurerPaymentPlan.length > 0){
                throw new Error(`Payment plan does not belong to the insurer who provided this quote: quoteId ${quoteId} payment_plan: ${paymentPlanId} insurer ${this.quoteDoc.insurerId}`);
            }
            this.payment_plan = paymentPlanId;
        }
        else if(!this.insurerPaymentPlanId){
            log.error(`Could not get insurer payment plan for quoteId ${quoteId} payment_plan: ${paymentPlanId}:` + __location);
        }
    }

    /**
	 * Populates this object with an already loaded quoteDoc - use for notifications
	 *
	 * @param {object} quoteDoc - The quoteDoc - a complete QuoteDoc (post binding)
     * @param {int} requestUserId - The Agency Portal user ID that requested the bind.
	 * @returns {Promise.<null, ServerError>} A promise that fulfills on success or returns a ServerError on failure
	 */
    async loadFromQuoteDoc(quoteDoc, requestUserId){
        if(requestUserId){
            this.requestUserId = requestUserId;
        }
        else {
            this.requestUserId = "applicant";
        }

        if(!quoteDoc){
            log.error(`No quoteDoc for loadFromQuoteDoc ` + __location);
            return;
        }
        this.quoteDoc = quoteDoc;

        this.insurerPaymentPlanId = quoteDoc.insurerPaymentPlanId
        let paymentPlanId = quoteDoc.paymentPlanId
        //If there is an insurer payment plan it overrided the talage paymentplan

        if(!paymentPlanId){
            paymentPlanId = 1;
        }
        this.payment_plan = paymentPlanId;
        //QuoteBind is reference by ApplicationBO. So the ApplicationBO cannot be at top.
        const ApplicationBO = global.requireShared('./models/Application-BO.js');
        const applicationBO = new ApplicationBO();
        try{
            this.applicationDoc = await applicationBO.getById(this.quoteDoc.applicationId);
            log.debug("Quote Application added applicationData" + __location)
        }
        catch(err){
            log.error("Unable to get applicationData for binding appId: " + quoteDoc.quoteId + __location);
            return;
        }

        const agencyBO = new AgencyBO();
        // Load the request data into it
        try {
            this.agencyJSON = await agencyBO.getById(this.applicationDoc.agencyId)
        }
        catch (err) {
            log.error("Agency load for bind error " + err + __location);
            return;
        }
        //for API credentials.
        //load agencyLocation
        try {
            const agencyLocationBO = new AgencyLocationBO()
            this.agencyLocation = await agencyLocationBO.getById(this.applicationDoc.agencyLocationId)
        }
        catch (err) {
            log.error("Agency Location load for bind error " + err + __location);
            return;
        }

        // Load up an insurer based on the ID found
        const insurer = new Insurer();
        try{
            this.insurer = await insurer.init(this.quoteDoc.insurerId);
        }
        catch(err){
            log.error("Insurer load for bind error " + err + __location);
            throw err;
        }
    }

    /**
	 * Posts a notification in Slack. The formatting changes based on the message type
	 *
	 * @param {string} type - The type of message to send (indication, referred, requested, or bound)
	 * @return {void}
	 */
    async send_slack_notification(type){

        // Only send a Slack notification if the agent is Talage or if Agency is marked to notify Talage (channel partners)
        //Determine if notifyTalage is enabled for this AgencyLocation Insurer.
        const agencyLocationBO = new AgencyLocationBO()
        let notifiyTalage = await agencyLocationBO.shouldNotifyTalage(this.applicationDoc.agencyLocationId, this.insurer.id);
        //Temporarily send talage all bound activity.
        if(type === 'bound' || type === 'boundApiCheck'){
            notifiyTalage = true;
        }
        //temporarily notify Talage of all Bound
        // notifyTalage force a hard match on true. in case something beside a boolan got in there
        if(this.applicationDoc.agencyId <= 2 || notifiyTalage === true){
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetwork = await agencyNetworkBO.getById(this.applicationDoc.agencyNetworkId);
            // Build out the 'attachment' for the Slack message
            let amountStr = "";
            try{
                amountStr = this.quoteDoc.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            }
            catch(err){
                log.error(`QuoteBind send_slack_notification amountStr process error ${err} ` + __location);
            }
            const attachment = {
                'application_id': this.applicationDoc.applicationId,
                'fields': [
                    {
                        short: false,
                        title: 'Agency Network',
                        value: agencyNetwork.name
                    },
                    {
                        short: false,
                        title: 'Agency Name',
                        value: this.agencyJSON.name
                    },
                    {
                        'short': false,
                        'title': 'Business Name',
                        'value': this.applicationDoc.businessName + (this.applicationDoc.dba ? ` (dba. ${this.applicationDoc.dba})` : '')
                    },
                    {
                        'short': true,
                        'title': 'Insurer',
                        'value': this.insurer.name
                    },
                    {
                        'short': true,
                        'title': 'Premium',
                        'value': `$${amountStr}`
                    },
                    {
                        'short': true,
                        'title': 'Policy Type',
                        'value': this.quoteDoc.policyType
                    }
                ]
            };

            switch(type){
                //bound app found check insurer API.
                case 'boundApiCheck':
                    try{
                        const appIdField = {
                            'short': true,
                            'title': 'Application Id',
                            'value': this.quoteDoc.applicationId
                        }
                        attachment.fields.push(appIdField)
                    }
                    catch(err){
                        log.error(`QuoteBind send_slack_notification process error ${err} ` + __location);
                    }
                    slack.send('customer_success', 'celebrate', `*Bound Application found on ${this.insurer.name}'s system!*`, attachment);
                    return;
                case 'bound':
                    slack.send('customer_success', 'celebrate', '*Application Bound!*', attachment);
                    return;
                case 'indication':
                    slack.send('customer_success', 'warning', '*Process Manually ASAP! Request to Bind Policy With Price Indication*', attachment);
                    return;
                case 'referred':
                    slack.send('customer_success', 'ok', '*Bind Requested but Referred*', attachment);
                    return;
                case 'requested':
                    slack.send('customer_success', 'celebrate', '*Request to Bind Policy*', attachment);
                    return;
                default:
                    slack.send('alerts', 'error', `Quote API Bind Endpoint encountered unexpected Slack notification type of ${type}`);
            }
        }
    }
};