const Bind = require('../bind');
/**
 * NOTE: Need to use node-libcurl for Employers because they are sending
 * non-compliant HTTP headers. And node-libcurl handles this better due to
 * using curl versus the node HTTP library when parsing HTTP responses.
 * 
 * Hopefully at some point Employers will update their code and we can
 * move this to use Axios.
 */
const { curly } = require('node-libcurl');

class EmployersBind extends Bind {
    async bind() {
        const headers = {
            httpHeader: [
                `appKey: ${global.settings.EMPLOYERS_APP_KEY}`,
                `appToken: ${global.settings.EMPLOYERS_APP_TOKEN}`,
                'Accept: application/json',
            ]
        }
        let host = this.insurer.useSandbox ? 'api-qa.employers.com' : 'api.employers.com';
        /** See Note above about using curly for Employers. */
        const result = await curly.put(`https://${host}/DigitalAgencyServices/quote/${this.quote.requestId}/bind`, headers);
        if (!result.data.success) {
            throw new Error(JSON.stringify(result.data.errors));
        }
        return result.data;
    }
}

module.exports = EmployersBind;
