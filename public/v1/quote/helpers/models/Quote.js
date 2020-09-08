/**
 * Defines a single quote
 */

'use strict';

const AgencyLocation = require('./AgencyLocation.js');
const Business = require('./Business.js');
const Application = require('./Application.js');
const Insurer = require('./Insurer.js');
const Policy = require('./Policy.js');
const fs = require('fs');
const slack = global.requireShared('./services/slacksvc.js');
const serverHelper = require('../../../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

module.exports = class Quote{

    constructor(){
        this.amount = 0;
        this.api_result = '';
        this.app = new Application();
        this.bound = 0;
        this.id = 0;
        this.insurer = 0;
        this.paymnet_plan = 0;
        this.policy = new Policy(null);
    }

    /**
	 * Binds this quote, if possible
	 *
	 * @returns {Promise.<string, ServerError>} A promise that returns a string containing bind result (either 'Bound' or 'Referred') if resolved, or a ServerError on failure
	 */
    bind(){
        return new Promise(async(fulfill, reject) => {

            // Make sure this quote is not already bound
            if(this.bound){
                log.info('Quote already bound' + __location);
                reject(serverHelper.requestError('Quote already bound. No action taken.'));
                return;
            }

            // Make sure that this quote was quoted by the API
            if(this.api_result !== 'quoted'){
                // If this was a price indication, let's send a Slack message
                if(this.api_result === 'referred_with_price'){
                    this.send_slack_notification('indication');
                }

                // Return an error
                log.info(`Quotes with an api_result of '${this.api_result}' are not eligible to be bound.`);
                reject(serverHelper.requestError('Quote not eligible for binding'));
                return;
            }

            // Check that an integration file exists for this insurer and store a reference to it for later use
            const path = `${__dirname}/../integrations/${this.insurer.slug}/${this.policy.type.toLowerCase()}.js`;
            if(fs.existsSync(path)){

                // Create an instance of the Integration class
                const IntegrationClass = require(path);
                const integration = new IntegrationClass(this.app, this.insurer, this.policy);

                // Begin the binding process
                await integration.bind().then((result) => {
                    this.send_slack_notification(result.toLowerCase());
                    fulfill(result);
                }, (error) => {
                    this.send_slack_notification('requested');
                    reject(error);
                });
            }
            else{
                // The insurer does not support bind, just send a requested Slack message
                log.error(`bind request: Invalid path to integration ${path}` + __location);
                this.send_slack_notification('requested');
                reject(new Error("Invalid path to integration"));
            }
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
                reject(serverHelper.requestError('Invalid quote ID'));
                return;
            }

            // Validate the payment plan
            if(!await validator.payment_plan(payment_plan)){
                reject(serverHelper.requestError('Invalid payment plan'));
                return;
            }

            // Add an agent and business to the application
            this.app.agencyLocation = new AgencyLocation();
            this.app.business = new Business();

            // Attempt to get the details of this quote from the database
            let had_error = false;
            const sql = `
				SELECT
					\`a\`.\`agency_location\`,
					\`a\`.\`business\`,
					\`a\`.\`wholesale\`,
					\`q\`.\`insurer\`,
					\`q\`.\`amount\`,
					\`q\`.\`api_result\`,
					\`q\`.\`application\`,
					\`q\`.\`bound\`,
					\`q\`.\`id\`,
					\`q\`.\`policy_type\`
				FROM \`#__quotes\` AS \`q\`
				LEFT JOIN \`#__applications\` AS \`a\` ON \`a\`.\`id\` = \`q\`.\`application\`
				WHERE \`q\`.\`id\` = ${db.escape(parseInt(id, 10))} AND \`q\`.\`state\` = 1 LIMIT 1;`;
            const rows = await db.query(sql).catch(function(error){
                log.error("load quote error " + error + __location);
                had_error = true;
            });

            // Make sure we found the quote, if nott, the ID is bad
            if(had_error || !rows || rows.length !== 1){
                reject(serverHelper.requestError('Invalid quote ID'));
                return;
            }

            // Store the data locally
            for(const property in rows[0]){
                // Make sure this property is part of the rows[0] object
                if(!Object.prototype.hasOwnProperty.call(rows[0], property)){
                    continue;
                }

                switch(property){
                    case 'agency_location':
                        // Add the agent as an ID of the agent
                        this.app.agencyLocation.id = rows[0].wholesale === 1 || rows[0][property] === null ? 1 : rows[0][property];
                        continue;
                    case 'application':
                        // Store the application as the ID of the application object
                        this.app.id = rows[0][property];
                        continue;
                    case 'business':
                        // Initialize the business with this ID
                        await this.app.business.load_by_id(rows[0][property]).catch(function(error){// eslint-disable-line no-await-in-loop,no-loop-func
                            reject(error);
                            had_error = true;
                        });
                        continue;
                    default:
                        // Check if this is an policy property
                        if(property.startsWith('policy_')){
                            const policy_property = property.replace('policy_', '');

                            // Check if this is a property of the insurer object, and if it is, add it
                            if(Object.prototype.hasOwnProperty.call(this.policy, policy_property)){
                                this.policy[policy_property] = rows[0][property];
                            }
                        }

                        // This may be a property of this object, if it is, save the property locally
                        if(Object.prototype.hasOwnProperty.call(this, property)){
                            this[property] = rows[0][property];
                        }
                        break;
                }
            }
            if(had_error){
                return;
            }

            // Load up an insurer based on the ID found
            const insurer = new Insurer();
            this.insurer = await insurer.init(this.insurer).catch(function(error){
                had_error = true;
                reject(error);
            });
            if(had_error){
                return;
            }

            // Translate JSON - does not look like policy.json is used any more.
            if(this.policy.json){
                this.policy.json = JSON.parse(this.policy.json);
            }

            // Check that this payment plan belongs to the insurer
            const payment_plan_sql = `SELECT COUNT(\`id\`) FROM \`#__insurer_payment_plans\` WHERE \`payment_plan\` = ${db.escape(parseInt(payment_plan, 10))} AND \`insurer\` = ${db.escape(parseInt(this.insurer.id, 10))} LIMIT 1;`;
            const payment_plan_rows = await db.query(payment_plan_sql).catch(function(error){
                log.error("DB payment plan SELECT error: " + error + __location);
                had_error = true;
            });
            if(had_error || !payment_plan_rows || payment_plan_rows.length !== 1 || !Object.prototype.hasOwnProperty.call(payment_plan_rows[0], 'COUNT(`id`)') || payment_plan_rows[0]['COUNT(`id`)'] !== 1){
                reject(serverHelper.requestError('Payment plan does not belong to the insurer who provided this quote'));
                return;
            }
            this.payment_plan = payment_plan;

            // Initialize the agent
            await this.app.agencyLocation.init().catch(function(error){
                reject(error);
                had_error = true;
            });
            if(had_error){
                return;
            }

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

        // notifyTalage force a hard match on true. in case something beside a boolan got in there
        if(this.app.agencyLocation.agencyId <= 2 || this.app.agencyLocation.notifiyTalage === true){
            // Build out the 'attachment' for the Slack message
            const attachment = {
                'application_id': this.app.id,
                'fields': [
                    {
                        'short': false,
                        'title': 'Business Name',
                        'value': this.app.business.name + (this.app.business.dba ? ` (dba. ${this.app.business.dba})` : '')
                    },
                    {
                        'short': true,
                        'title': 'Insurer',
                        'value': this.insurer.name
                    },
                    {
                        'short': true,
                        'title': 'Premium',
                        'value': `$${this.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
                    },
                    {
                        'short': true,
                        'title': 'Policy Type',
                        'value': this.policy.type
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