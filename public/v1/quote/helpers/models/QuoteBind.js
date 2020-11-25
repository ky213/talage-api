/**
 * Defines a single quote
 */

'use strict';
const ApplicationBO = global.requireShared('./models/Application-BO.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const Insurer = require('./Insurer.js');

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
	 * Binds this quote, if possible
	 *
	 * @returns {Promise.<string, ServerError>} A promise that returns a string containing bind result (either 'Bound' or 'Referred') if resolved, or a ServerError on failure
	 */
    bind(){
        return new Promise(async(fulfill, reject) => {
            if(!this.quoteDoc){
                log.error('Missing QuoteDoc ' + __location);
                reject(new Error('Qoute not Found. No action taken.'));
                return;
            }
            // Make sure this quote is not already bound
            if(this.quoteDoc && this.quoteDoc.bound){
                log.info('Quote already bound' + __location);
                reject(new Error('Quote already bound. No action taken.'));
                return;
            }

            // Make sure that this quote was quoted by the API
            if(this.quoteDoc.apiResult !== 'quoted'){
                // If this was a price indication, let's send a Slack message
                if(this.quoteDoc.apiResult === 'referred_with_price'){
                    this.send_slack_notification('indication');
                }

                // Return an error
                log.info(`Quotes with an api_result of '$this.quoteDoc.apiResult}' are not eligible to be bound.`);
                reject(new Error('Quote not eligible for binding'));
                return;
            }
            // NO auto binding as of Oct 24, 2020.
            // // Check that an integration file exists for this insurer and store a reference to it for later use
            // const path = `${__dirname}/../integrations/${this.insurer.slug}/${this.quoteDoc.policyType.toLowerCase()}.js`;
            // if(fs.existsSync(path)){

            //     // Create an instance of the Integration class
            //     const IntegrationClass = require(path);
            //     const integration = new IntegrationClass(this.app, this.insurer, this.policy);
            //     // Begin the binding process
            //     await integration.bind().then((result) => {
            //         this.send_slack_notification(result.toLowerCase());
            //         fulfill(result);
            //     }, (error) => {
            //         this.send_slack_notification('requested');
            //         reject(error);
            //     });
            // }
            // else{
            //     // The insurer does not support bind, just send a requested Slack message
            //     log.error(`bind request: Invalid path to integration ${path}` + __location);
            //     this.send_slack_notification('requested');
            //     reject(new Error("Invalid path to integration"));
            // }

            this.send_slack_notification('requested');
            fulfill("NotBound");
            return
        });
    }

    /**
	 * Populates this object with data from the database
	 *
	 * @param {int} id - The ID of the quote
	 * @param {int} payment_plan - The ID of the payment plan selected by the user
	 * @returns {Promise.<null, ServerError>} A promise that fulfills on success or returns a ServerError on failure
	 */
    load(id, payment_plan){
        return new Promise(async(fulfill, reject) => {
            // Validate the ID
            if(!await validator.isID(id)){
                reject(new Error('Invalid quote ID'));
                return;
            }

            // Validate the payment plan
            if(!await validator.payment_plan(payment_plan)){
                reject(new Error('Invalid payment plan'));
                return;
            }


            // Attempt to get the details of this quote from the database
            let had_error = false;
            //USE BO's
            const quoteModel = new QuoteBO();
            this.quoteDoc = await quoteModel.getMongoDocbyMysqlId(parseInt(id, 10)).catch(function(err) {
                log.error(`Loading quote for bind request quote ${id} error:` + err + __location);
                //reject(err);
                //return;
                had_error = true;
            });

            if(had_error){
                return;
            }
            if(!this.quoteDoc){
                log.error(`No quoteDoc quoteId ${id} ` + __location);
                return;
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
            this.agencyJSON = await agencyBO.getById(this.applicationDoc.agencyId).catch(function(err) {
                log.error("Agency load for bind error " + err + __location);
                had_error = true;
            });


            if(had_error){
                return;
            }

            // Load up an insurer based on the ID found
            const insurer = new Insurer();
            this.insurer = await insurer.init(this.quoteDoc.insurerId).catch(function(error){
                had_error = true;
                reject(error);
            });
            if(had_error){
                return;
            }


            // Check that this payment plan belongs to the insurer
            const payment_plan_sql = `SELECT COUNT(\`id\`) FROM \`#__insurer_payment_plans\` WHERE \`payment_plan\` = ${db.escape(parseInt(payment_plan, 10))} AND \`insurer\` = ${db.escape(parseInt(this.insurer.id, 10))} LIMIT 1;`;
            const payment_plan_rows = await db.query(payment_plan_sql).catch(function(error){
                log.error("DB payment plan SELECT error: " + error + __location);
                had_error = true;
            });
            if(had_error || !payment_plan_rows || payment_plan_rows.length !== 1 || !Object.prototype.hasOwnProperty.call(payment_plan_rows[0], 'COUNT(`id`)') || payment_plan_rows[0]['COUNT(`id`)'] !== 1){
                reject(new Error('Payment plan does not belong to the insurer who provided this quote'));
                return;
            }
            this.payment_plan = payment_plan;

            fulfill();
        });
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