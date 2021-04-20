/**
 * Parent class of any integrations that support the ability to bind policies
 * via API.
 */
module.exports = class Bind {
    constructor(quote, insurer, agencyLocation) {
        this.insurer = insurer;
        this.quote = quote;
        this.agencyLocation = agencyLocation;
        this.policyId = '';
        this.policyName = '';
        this.policyEffectiveDate = null;
        this.policyPremium = 0;
    }

    // eslint-disable-next-line valid-jsdoc
    /** Override this method to perform an API bind. */
    async bind() { }
};
