/**
 * Worker's Compensation Integration for Accident Fund
 */

'use strict';

const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

module.exports = class AccidentfundWC extends Integration{

    /**
	 * Makes a request to Accident Fund to bind a policy.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing bind result information if resolved, or an Error if rejected
	 */
    _bind(){
        const CompwestWC = require('../compwest/wc.js');
        const integration = new CompwestWC(this.app, this.insurer, this.policy);

        // Make the bind request
        return integration._bind();
    }

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    /**
	 * Requests a quote from Accident Fund and returns. This is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    _insurer_quote(){
        // Accident Fund and CompWest are the same company, just refer this over to the CompWest code for processing
        const CompwestWC = require('../compwest/wc.js');
        const integration = new CompwestWC(this.app, this.insurer, this.policy, this.quoteId);

        // Run the quote
        return integration.quote();
    }
};