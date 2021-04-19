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

        const requestUrl = `https://${host}/DigitalAgencyServices/quote/${this.quote.requestId}/bind`;
        this.quote.log += `--------======= Bind Request to ${requestUrl} =======--------<br><br>`;
        this.quote.log += `Request: NO BODY <br><br>`;
        this.quote.log += `--------======= End =======--------<br><br>`;

        let result = null;
        try {
            result = await axios.put(requestUrl, null, axiosOptions);
        }
        catch (error) {
            log.error(`Employers Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: ${error}  Response ${JSON.stringify(error.response.data)} ${__location}`);
            this.quote.log += `--------======= Bind Response Error =======--------<br><br>`;
            this.quote.log += error;
            this.quote.log += "<br><br>";
            return "error";
            //throw new Error(JSON.stringify(error));
        }
        if (result.data && !result.data.success) {
            log.error(`Employers Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Rejected: ${JSON.stringify(result.data)} ${__location}`);
            this.quote.log += `--------======= Bind Response Declined =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${JSON.stringify(result.data, null, 2)}</pre><br><br>`;
            this.quote.log += "<br><br>";
            return "rejected";

            //Quote log ???
            //throw new Error(JSON.stringify(result.data.errors));
        }
        //log response.
        if(result.data){
            this.quote.log += `--------======= Bind Response =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${JSON.stringify(result.data, null, 2)}</pre><br><br>`;
            this.quote.log += `--------======= End =======--------<br><br>`;
            const employersResp = result.data
            this.policyId = employersResp.id;
            this.policyNumber = employersResp.policyNumber;
            this.policyUrl = employersResp.policyURL;
            // this.policyName = '';
            this.policyEffectiveDate = employersResp.effectiveDate;
            this.policyPremium = employersResp.totalPremium;
            return "success"
        }
        else{
            //unknown response
            this.quote.log += `--------======= Bind Response Unknown no data =======--------<br><br>`;
            return "error"
        }

    }
}

module.exports = EmployersBind;