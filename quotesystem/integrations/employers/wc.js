/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Worker's Compensation Integration for Employers
 *
 * This integration file has answers to the following questions hard-coded in:
 * - I attest that the Insured (my client) has complied with the applicable workers' compensation laws of the states shown in Item 3.A of the policy information page, and I will maintain and make available upon request all required documentation in the Agency file.
 */

'use strict';

const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const EmployersWCJSON = require('./wc-json');
const EmployersWCXML = require('./wc-xml');

module.exports = class EmployersWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    /*
	/**
	 * Requests a quote from Employers and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    _insurer_quote() {
        if (global.settings.EMPLOYERS_WC_USE_XML && global.settings.EMPLOYERS_WC_USE_XML === "YES") {
            const WCXML = new EmployersWCXML(this.app, this.insurer, this.policy, this.quoteId, this.applicationDocData);
            return WCXML.quote();
        }
        else {
            const WCJSON = new EmployersWCJSON(this.app, this.insurer, this.policy, this.quoteId, this.applicationDocData);
            return WCJSON.quote();
        }
    }
};