/**
 * Defines a single quote
 */

'use strict';

const QuoteBO = global.requireShared('./models/Quote-BO.js');
const AgencyNetworkBO = global.requireShared('./models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const InsurerPaymentPlanBO = global.requireShared('./models/InsurerPaymentPlan-BO.js');

const Insurer = require('./Insurer.js');
const fs = require('fs');

//const fs = require('fs');
const slack = global.requireShared('./services/slacksvc.js');


module.exports = class QuoteBind{

    constructor(){
        this.applicationDoc = {}
        this.quoteDoc = {};
        this.agencyJSON = {};
        this.insurer = {};
        this.paymnet_plan = 0;
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
        let quoteStatus = '';
        if(this.quoteDoc.aggregatedStatus){
            quoteStatus = this.quoteDoc.aggregatedStatus;
        }
        else if (this.quoteDoc.status){
            quoteStatus = this.quoteDoc.status;
        }
        else if (this.quoteDoc.apiResult){
            quoteStatus = this.quoteDoc.apiResult
        }
        switch(quoteStatus){
            case 'acord_emailed':
            case 'bind_requested':
            case 'quoted':
            case 'quoted_referred':
            case 'referred':
            case 'referred_with_price':
            case 'request_to_bind':
            case 'request_to_bind_referred:':
                statusWithinBindingRange = true;
                break;
            default:
                break;
        }

        // Make sure that this quote was quoted by the API
        if(!statusWithinBindingRange){
            // If this was a price indication, let's send a Slack message
            // if(this.quoteDoc.apiResult === 'referred_with_price'){
            //     await this.send_slack_notification('indication');
            // }

            // Return an error
            log.info(`Quotes with an api_result of '${this.quoteDoc.apiResult}' are not eligible to be bound.`);
            throw new Error(`Quote ${this.quoteDoc.quoteId} is not eligible for binding with status ${this.quoteDoc.aggregatedStatus}`);
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

        // Only do API-bind if we support API bind. Otherwise we will just do
        // manual bind.
        if (fs.existsSync(path)) {
            // Create an instance of the Integration class
            const BindClass = require(path);

            const bindWorker = new BindClass(this.quoteDoc, this.insurer, this.agencyLocation);
            // Begin the binding process
            try {
                // response: "success", "error", "rejected"
                const quoteResp = await bindWorker.bind();
                //save log.
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
	 * @param {int} id - The ID of the quote
	 * @param {int} payment_plan_id - The ID of the payment plan selected by the user
      @param {int} requestUserId - The Agency Portal user ID that requested the bind.
	 * @returns {Promise.<null, ServerError>} A promise that fulfills on success or returns a ServerError on failure
	 */
    async load(id, payment_plan_id, requestUserId){
        this.requestUserId = requestUserId;
        // Attempt to get the details of this quote from the database
        //USE BO's
        const quoteModel = new QuoteBO();
        try {
            const returnModel = true
            this.quoteDoc = await quoteModel.getById(id,returnModel)
        }
        catch (err) {
            log.error(`Loading quote for bind request quote ${id} error:` + err + __location);
            //throw err;
            return;
        }

        if(!this.quoteDoc){
            log.error(`No quoteDoc quoteId ${id} ` + __location);
            throw new Error(`No quoteDoc quoteId ${id}`);
        }
        if(this.quoteDoc.paymentPlanId && !payment_plan_id){
            payment_plan_id = this.quoteDoc.paymentPlanId;
        }
        if(!payment_plan_id){
            payment_plan_id = 1;
        }
        //QuoteBind is reference by ApplicationBO. So the ApplicationBO cannot be at top.
        const ApplicationBO = global.requireShared('./models/Application-BO.js');
        const applicationBO = new ApplicationBO();
        try{
            this.applicationDoc = await applicationBO.getfromMongoByAppId(this.quoteDoc.applicationId);
            log.debug("Quote Application added applicationData" + __location)
        }
        catch(err){
            log.error("Unable to get applicationData for binding appId: " + id + __location);
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
        this.insurer = await insurer.init(this.quoteDoc.insurerId);

        // Validate the payment plan
        // - Only set payment plan if passed in.
        if (payment_plan_id) {
            const insurerPaymentPlanBO = new InsurerPaymentPlanBO();
            let insurerPaymentPlan = null;
            try {
                insurerPaymentPlan = await insurerPaymentPlanBO.getById(parseInt(payment_plan_id, 10));
            }
            catch (err) {
                log.error(`Could not get insurer payment plan for payment_plan: ${payment_plan_id}:` + err + __location);
            }
            if(!insurerPaymentPlan){
                throw new Error('Payment plan does not belong to the insurer who provided this quote');
            }
            this.payment_plan = payment_plan_id;
        }
        else{
            log.error(`Could not get insurer payment plan for payment_plan: ${payment_plan_id}:` + __location);
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
        if(type === 'bound'){
            notifiyTalage = true;
        }
        //temporarily notify Talage of all Bound
        // notifyTalage force a hard match on true. in case something beside a boolan got in there
        if(this.applicationDoc.agencyId <= 2 || notifiyTalage === true){
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetwork = await agencyNetworkBO.getById(this.applicationDoc.agencyNetworkId);
            // Build out the 'attachment' for the Slack message
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
                        'value': `$${this.quoteDoc.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
                    },
                    {
                        'short': true,
                        'title': 'Policy Type',
                        'value': this.quoteDoc.policyType
                    }
                ]
            };

            switch(type){
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