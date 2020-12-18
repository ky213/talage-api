const Bind = require('../bind');

class EmployersBind extends Bind {
    async bind(quote_id) {
        const headers = {
            httpHeader: [
                `appKey: ${global.settings.EMPLOYERS_APP_KEY}`,
                `appToken: ${global.settings.EMPLOYERS_APP_TOKEN}`,
                'Accept: application/json',
            ]
        }
        let host = this.insurer.useSandbox ? 'api-qa.employers.com' : 'api.employers.com';
        const result = await curly.put(`https://${host}/quote/${request_id}/bind`, headers);
        return JSON.parse(result.data);
    }
}

module.exports = EmployersBind;
