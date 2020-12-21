const Bind = require('../bind');
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
        const result = await curly.put(`https://${host}/DigitalAgencyServices/quote/${this.quote.requestId}/bind`, headers);
        if (!result.data.success) {
            throw new Error(JSON.stringify(result.data.errors));
        }
        return result.data;
    }
}

module.exports = EmployersBind;
