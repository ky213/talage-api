/**
 * Parent class of any integrations that support the ability to bind policies
 * via API.
 */
module.exports = class Bind {
    constructor(quote, insurer) {
        this.insurer = insurer;
        this.quote = quote;
    }

    /** Override this method to perform an API bind. */
    async bind() { }
};
