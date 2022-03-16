/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * General Liability Integration for Hiscox
 */

'use strict';

const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const HiscoxInt = require('./gl_v4');

module.exports = class HiscoxBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
    }

    /*
	/**
	 * Requests a quote from Hiscox and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    _insurer_quote() {
        const GLJSON = new HiscoxInt(this.app, this.insurer, this.policy, this.quoteId, this.applicationDocData);
        return GLJSON.quote();
    }
};