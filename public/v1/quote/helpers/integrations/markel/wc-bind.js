const Bind = require('../bind');
const axios = require('axios');

class MarkelBind extends Bind {
    async bind() {


        let host = '';
        let path = '';
        let key = '';

        //Determine API
        //api-sandbox.markelcorp.com/smallCommercial/v1
        if (this.insurer.useSandbox) {
            host = 'api-sandbox.markelcorp.com';
            path = '/smallCommercial/v1/bind'
            key = {'apikey': `${this.insurer.get_password()}`};
        }
        else {
            host = 'api.markelcorp.com';
            path = '/smallCommercial/v1/bind';
            key = {'apikey': `${this.insurer.get_password()}`};
        }

        const axiosOptions = {headers: {
            "content-type": "application/json",
            "apikey": key.apikey
        }};

        const bindRequestJson = {
            "applicationId": parseInt(this.quote.requestId,10),
            "billingPlan": "1"
        }
        const requestUrl = `https://${host}${path}`;
        this.quote.log += `--------======= Bind Request to ${requestUrl} =======--------<br><br>`;
        this.quote.log += `Request: <pre>${JSON.stringify(bindRequestJson,null,2)} </pre> <br><br>`;
        this.quote.log += `--------======= End =======--------<br><br>`;

        let result = null;
        try {
            result = await axios.put(requestUrl, JSON.stringify(bindRequestJson), axiosOptions);
        }
        catch (error) {
            log.error(`Markel Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: ${error}  Response ${JSON.stringify(error.response.data)} ${__location}`);
            this.quote.log += `--------======= Bind Response Error =======--------<br><br>`;
            this.quote.log += error;
            this.quote.log += "<br><br>";
            if(error.response && error.response.status === 404){
                this.quote.log += `Markel not found on applicationId: ${this.quote.requestId}`;
                this.quote.log += "<br><br>";
            }
            else if(error.response && error.response.data){
                this.quote.log += JSON.stringify(error.response.data,null,2);
                this.quote.log += "<br><br>";
            }
            return "error";
            //throw new Error(JSON.stringify(error));
        }
        //log response.
        if(result.data){
            this.quote.log += `--------======= Bind Response =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${JSON.stringify(result.data, null, 2)}</pre><br><br>`;
            this.quote.log += `--------======= End =======--------<br><br>`;
            // {
            //     "policyNumber": [
            //         "WC0180435-01"
            //     ],
            //     "policyEffectiveDate": "2020-01-31",
            //     "finalPremium": 1234,
            //     "downPaymentAmount": 123,
            //     "underwritingDecisionCode": "Bind"
            // }
            const MarkelResp = result.data
            if(MarkelResp.underwritingDecisionCode === "Bind"){
                this.policyId = this.quote.requestId;
                if(MarkelResp.policyNumber && MarkelResp.policyNumber.length > 0){
                    this.policyNumber = MarkelResp.policyNumber[0];
                }
                // this.policyName = '';
                this.policyEffectiveDate = MarkelResp.policyEffectiveDate;
                this.policyPremium = MarkelResp.finalPremium;
                return "success"

            }
            else {
                this.quote.log += `--------======= Bind request REJECTED =======--------<br><br>`;
                return "rejected";
            }
        }
        else{
            //unknown response
            this.quote.log += `--------======= Bind Response Unknown no data =======--------<br><br>`;
            return "error"
        }

    }
}

module.exports = MarkelBind;