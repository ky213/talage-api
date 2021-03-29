const Integration = require('../Integration.js');
//const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


module.exports = class CompwestWC extends Integration {

    /**
     * Requests a quote from Great America and returns. This request is not
     * intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object
     *   containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {
        const gl = require('./gl.js');
        const integration = new gl(this.app, this.insurer, this.policy);

        // Run the quote
        return integration.quote();
    }

}