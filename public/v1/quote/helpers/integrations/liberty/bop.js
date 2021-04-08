/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Simple BOP Policy Integration for Liberty Mutual
 */

'use strict';

const builder = require('xmlbuilder');
const moment = require('moment');
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

        // liberty can have multiple insurer industry codes tied to a single talage industry code
        // this will set this.industry_code to a list that will be handled in each Liberty BOP integration
        await this._getLibertyIndustryCodes();

        const BOPSimple = new LibertyBOPSimple(this.app, this.insurer, this.policy);
        const BOPCommercial = new LibertyBOPCommercial(this.app, this.insurer, this.policy);

        let quoteResponses = [];
        quoteResponses.push(BOPSimple.quote());
        quoteResponses.push(BOPCommercial.quote());

        quoteResponses = await Promise.all(quoteResponses);
        
        // just return the first quote response, we don't care about this information
        return quoteResponses[0];

    }

    async _getLibertyIndustryCodes() {

        const InsurerIndustryCodeModel = require('mongoose').model('InsurerIndustryCode');
        const policyEffectiveDate = moment(this.policy.effective_date).format(db.dbTimeFormat());
        const applicationDocData = this.app.applicationDocData;

        const logPrefix = `Liberty Mutual SBOP (Appid: ${applicationDocData.mysqlId}): `

        // eslint-disable-next-line prefer-const
        const industryQuery = {
            insurerId: this.insurer.id,
            talageIndustryCodeIdList: applicationDocData.industryCode,
            territoryList: applicationDocData.mailingState,
            effectiveDate: {$lte: policyEffectiveDate},
            expirationDate: {$gte: policyEffectiveDate},
            active: true
        }

        // eslint-disable-next-line prefer-const
        const orParamList = [];
        const policyTypeCheck = {policyType: this.policyTypeFilter};
        const policyTypeNullCheck = {policyType: null}
        orParamList.push(policyTypeCheck)
        orParamList.push(policyTypeNullCheck)
        industryQuery.$or = orParamList;

        // eslint-disable-next-line prefer-const
        let insurerIndustryCodeList = null;
        try {
            insurerIndustryCodeList = await InsurerIndustryCodeModel.find(industryQuery);
        } catch (e) {
            log.error(`${logPrefix}Error re-retrieving Liberty industry codes. Falling back to original code.`);
            return;
        }

        if (insurerIndustryCodeList && insurerIndustryCodeList.length > 0) {
            this.industry_code = insurerIndustryCodeList;
        } else {
            log.warn(`${logPrefix}No industry codes were returned while attempting to re-retrieve Liberty inudstry codes. Falling back to original code.`);
        }

    }
     
}