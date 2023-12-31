/* eslint-disable no-trailing-spaces */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Simple BOP Policy Integration for Liberty Mutual
 */

'use strict';

const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
global.requireShared('./helpers/tracker.js');
const LibertyBOPSimple = require('./bop-simple.js');
const LibertyBOPCommercial = require('./bop-commercial.js');

module.exports = class LibertySBOP extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;

        this.requiresProductPolicyTypeFilter = true;
        this.policyTypeFilter = 'BOP';
    }

	/**
	 * Requests a quote from Liberty and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
	async _insurer_quote() {
        let quoteResponses = [];

        const BOPSimple = new LibertyBOPSimple(this.app, this.insurer, this.policy, this.quoteId, this.applicationDocData);
        quoteResponses.push(BOPSimple.quote());
        
        const BOPCommercial = new LibertyBOPCommercial(this.app, this.insurer, this.policy, this.quoteId, this.applicationDocData);
        quoteResponses.push(BOPCommercial.quote());

        quoteResponses = await Promise.all(quoteResponses);
        
        //need for Tiered Quoting Checks
        this.quoteStatusId = BOPCommercial.quoteStatusId
        if(this.quoteStatusId <= 40 && BOPSimple.quoteStatusId > 40){
            this.quoteStatusId = BOPSimple.quoteStatusId
        }


        // just return the first quote response, we don't care about this information
        return quoteResponses[0];
    }
     
}