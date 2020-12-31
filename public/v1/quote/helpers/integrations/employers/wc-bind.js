const Bind = require('../bind');
const axios = require('axios');

class EmployersBind extends Bind {
    async bind() {
        const appKeyEmployers = await this.insurer.get_username()
        const appTokenEmployers = await this.insurer.get_password()
        const axiosOptions = {headers: {
            "appKey": appKeyEmployers,
            "appToken": appTokenEmployers,
            "Accept": "application/json"
        }};
        const host = this.insurer.useSandbox ? 'api-qa.employers.com' : 'api.employers.com';

        let result = null;
        try {
            result = await axios.put(`https://${host}/DigitalAgencyServices/quote/${this.quote.requestId}/bind`, null, axiosOptions);
        }
        catch (error) {
            log.error(`Employers Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: ${error} ${__location}`);
            throw new Error(JSON.stringify(error));
        }
        if (!result.data.success) {
            log.error(`Employers Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request failed: ${JSON.stringify(result.data)} ${__location}`);
            throw new Error(JSON.stringify(result.data.errors));
        }
        return result.data;
    }
}

module.exports = EmployersBind;