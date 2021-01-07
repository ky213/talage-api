/**
 * Defines a single quote
 */

'use strict';
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const InsurerPaymentPlanBO = global.requireShared('./models/InsurerPaymentPlan-BO.js');

const Insurer = require('./Insurer.js');
const fs = require('fs');

//const fs = require('fs');
const slack = global.requireShared('./services/slacksvc.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class QuoteBind{

    constructor(){
        this.applicationDoc = {}
        this.quoteDoc = {};
        this.agencyJSON = {};
        this.insurer = {};
        this.paymnet_plan = 0;
        this.agencyLocation = null;
    }

    /**
     * Marks this quote as bound.
     * @returns {Promise.<string, ServerError>} Returns a string containing bind result (either 'Bound' or 'Referred') if resolved, or a ServerError on failure
     */
    async markAsBind(){
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
            if(this.quoteDoc.apiResult === 'referred_with_price'){
                this.send_slack_notification('indication');
            }

            // Return an error
            log.info(`Quotes with an api_result of '${this.quoteDoc.apiResult}' are not eligible to be bound.`);
            throw new Error(`Quote ${this.quoteDoc.quoteId} is not eligible for binding with status ${this.quoteDoc.aggregatedStatus}`);
        }

        this.send_slack_notification('requested');
        return "NotBound";
    }

    /**
     * Binds this quote via API, if possible. If successful, this method
     * returns nothing. If not successful, then an Exception is thrown.
     */
    async bindPolicy(){
        await this.markAsBind();

        // Check that an integration file exists for this insurer and store a reference to it for later use
        const path = `${__dirname}/../integrations/${this.insurer.slug}/${this.quoteDoc.policyType.toLowerCase()}-bind.js`;

        // Only do API-bind if we support API bind. Otherwise we will just do
        // manual bind.
        if (fs.existsSync(path)) {
            // Create an instance of the Integration class
            const BindClass = require(path);

            const integration = new BindClass(this.quoteDoc, this.insurer);
            // Begin the binding process
            try {
                return await integration.bind();
            }
            catch (error) {
                throw error;
            }
        }
    }


    /**
	 * Populates this object with data from the database
	 *
	 * @param {int} id - The ID of the quote
	 * @param {int} payment_plan - The ID of the payment plan selected by the user
	 * @returns {Promise.<null, ServerError>} A promise that fulfills on success or returns a ServerError on failure
	 */
    async load(id, payment_plan){
        // Validate the ID
        if(!await validator.isUuid(id)){
            throw new Error(`Invalid quote ID: ${id}`);
        }

        // Attempt to get the details of this quote from the database
        //USE BO's
        const quoteModel = new QuoteBO();
        try {
            this.quoteDoc = await quoteModel.getById(id)
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

        const applicationBO = new ApplicationBO();
        try{
            this.applicationDoc = await applicationBO.getfromMongoByAppId(this.quoteDoc.applicationId);
            log.debug("Quote Application added applicationData")
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

        // Load up an insurer based on the ID found
        const insurer = new Insurer();
        this.insurer = await insurer.init(this.quoteDoc.insurerId);

        // Validate the payment plan
        // - Only set payment plan if passed in.
        if (payment_plan) {
            const insurerPaymentPlanBO = new InsurerPaymentPlanBO();
            let insurerPaymentPlan = null;
            try {
                insurerPaymentPlan = await insurerPaymentPlanBO.getById(parseInt(payment_plan, 10));
            }
            catch (err) {
                log.error(`Could not get insurer payment plan for payment_plan: ${payment_plan}:` + err + __location);
            }
            if(!insurerPaymentPlan){
                throw new Error('Payment plan does not belong to the insurer who provided this quote');
            }
            this.payment_plan = payment_plan;
        }
    }

    /**
	 * Posts a notification in Slack. The formatting changes based on the message type
	 *
	 * @param {string} type - The type of message to send (indication, referred, requested, or bound)
	 * @return {void}
	 */
    send_slack_notification(type){

        // Only send a Slack notification if the agent is Talage or if Agency is marked to notify Talage (channel partners)
        //Determine if notifyTalage is enabled for this AgencyLocation Insurer.
        const agencyLocationBO = new AgencyLocationBO()
        const notifiyTalage = agencyLocationBO.shouldNotifyTalage(this.applicationDoc.agencyLocationId, this.insurer.id);
        // notifyTalage force a hard match on true. in case something beside a boolan got in there
        if(this.applicationDoc.agencyId <= 2 || notifiyTalage === true){
            // Build out the 'attachment' for the Slack message
            const attachment = {
                'application_id': this.applicationDoc.applicationId,
                'fields': [
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