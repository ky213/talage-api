/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * General Liability Integration for Hiscox
 */

'use strict';

const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const HiscoxGLXML = require('./gl_old');
const HiscoxGLJSON = require('./gl_v4');

module.exports = class HiscoxGL extends Integration {

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
        // const v4SwitchDate = new Date(2023, 3, 28);
        // const today = new Date();
        // remove environment check to go live in production.
        if (global.settings.ENV && global.settings.ENV === 'production' || global.settings.ENV && global.settings.ENV === 'demo') {
            const GLXML = new HiscoxGLXML(this.app, this.insurer, this.policy, this.quoteId, this.applicationDocData);
            return GLXML.quote();
        }
        else {
            const GLJSON = new HiscoxGLJSON(this.app, this.insurer, this.policy, this.quoteId, this.applicationDocData);
            return GLJSON.quote();
        }
    }
};