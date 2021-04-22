/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
const Bind = require('../bind');
const axios = require('axios');
const amtrustClient = require('./amtrust-client.js');
const moment = require('moment');

class AmTrustBind extends Bind {
    async getAuthToken(){
        let credentials = null;
        try {
            credentials = JSON.parse(await this.insurer.get_password());
        }
        catch (err) {
            log.error(`AMTrust Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: Could not load AmTrust API credentials ${err} ${__location}`);
            throw new Error("Could not load AmTrust API credentials");
        }
        const alInsurer = this.agencyLocation.insurers.find((ali) => ali.insurerId = this.insurer.insurerId)
        if(!alInsurer){
            log.error(`AMTrust Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: Could not find AmTrust info for AgencyLocation ${__location}`);
            throw new Error("Could not find AmTrust info for AgencyLocation ");
        }
        log.debug()
        //let agencyId = alInsurer.agencyId.trim();
        const agentUserNamePassword = alInsurer.agentId.trim();

        // Ensure the agent ID is a number (required for the API request)
        // try {
        //     agencyId = parseInt(agencyId, 10);
        // }
        // catch (err) {
        //     throw new Error(`Invalid AmTrust agent ID '${agencyId}'`, __location, {error: err});
        // }
        // if (agencyId === 0) {
        //     throw new Error(`Invalid AmTrust agent ID '${agencyId}'`, __location);
        // }

        // Split the comma-delimited username,password field.
        const commaIndex = agentUserNamePassword.indexOf(',');
        if (commaIndex <= 0) {
            log.error(`AmTrust username and password are not comma-delimited. commaIndex ${commaIndex} insurerId: ${this.insurer.insurerId} agentId: ${agentUserNamePassword} alInsurer: ${JSON.stringify(alInsurer)} ` + __location);
            log.error(`AmTrust username and password are not comma-delimited.  this.agencyLocation: ${JSON.stringify(this.agencyLocation)} ` + __location);
            throw new Error(`AmTrust username and password are not comma-delimited. commaIndex ${commaIndex} insurerId: ${this.insurer.insurerId} agentId: ${agentUserNamePassword} al: ${JSON.stringify(alInsurer)}`, __location);
        }
        const agentUsername = agentUserNamePassword.substring(0, commaIndex).trim();
        const agentPassword = agentUserNamePassword.substring(commaIndex + 1).trim();
        // eslint-disable-next-line no-unused-vars
        let error = null;

        const accessToken = await amtrustClient.authorize(credentials.clientId, credentials.clientSecret, agentUsername, agentPassword, credentials.mulesoftSubscriberId, this.insurer.useSandbox).catch((err) => {error = err});
        if (!accessToken || error) {
            log.error(`Authorization with AmTrust server failed ${error}` + __location);
            throw new Error("Authorization with AmTrust server failed");
        }

        // eslint-disable-next-line object-shorthand
        return {accessToken, credentials};
    }


    async bind() {
        //const appKeyAMTrust = await this.insurer.get_username()
        //const appTokenAMTrust = await this.insurer.get_password()
        //Auth.......
        // Load the API credentials
        log.debug('AMTrust getting credentials' + __location);
        const {accessToken, credentials} = await this.getAuthToken();
        if(!accessToken){
            log.error(`AMTrust Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind could not get accessToken ${__location}`);
            this.quote.log += "Could not get AMtrsut accessToken";
            throw new Error(`Could not get AMTrust accessToken`);
        }

        log.debug('AMTrust GOT credentials' + __location);
        const baseUrl = this.insurer.useSandbox ? 'utgateway.amtrustgroup.com/DigitalAPI_Usertest' : 'gateway.amtrustgroup.com/DigitalAPI';
        const axiosOptions = {headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "subscriber_id": credentials.mulesoftSubscriberId
        }};
        //responseType: "application/json",
        //log.debug("headers \n" + JSON.stringify(axiosOptions) + "\n" + __location)
        //get agencyContractId
        const getGetByContractPath = `/api/v1/quotes/${this.quote.quoteNumber}/agent-contact`
        let requestUrl = `https://${baseUrl}${getGetByContractPath}`;
        this.quote.log += `--------======= Get AGencyContract Request to ${requestUrl} @ ${moment().toISOString()} =======--------<br><br>`;
        this.quote.log += `Request:\n <pre>NO BODY</pre><br><br>\n`;
        this.quote.log += `--------======= End =======--------<br><br>`;
        let agencyContactId = null;
        let result = null;
        try {
            result = await axios.get(requestUrl, axiosOptions);
        }
        catch (err) {
            log.error(`AMTrust Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: ${err} Response ${JSON.stringify(err.response.data)}${__location}`);
            this.quote.log += `--------======= Bind Request Error =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${err}</br> Response ${JSON.stringify(err.response.data)}</pre><br><br>`;
            this.quote.log += `--------======= End =======--------<br><br>`;
            return "error";
        }
        if(result && result.data && result.data.Data){
            agencyContactId = result.data.Data.Id;
        }
        if(!agencyContactId) {
            this.quote.log += "\nCould not retrieve agencyContactId\n";
            if(result){
                log.error("AMTrust Could not retrieve agencyContactId agent-contact response " + JSON.stringify(result.data) + __location)
            }
            log.error(`AMTrust Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request Error: Could not retrieve agencyContractId ${__location}`);
            return "error";
        }
        let paymentPlanId = 1
        let numberOfPlanments = 1
        let IsDirectDebit = false;
        let DepositPercent = 0;
        switch(this.quote.paymentPlanId){
            case 2:
                paymentPlanId = 2;
                numberOfPlanments = 2;
                DepositPercent = 50;
                break;
            case 5:
                paymentPlanId = 7;
                numberOfPlanments = 12;
                IsDirectDebit = true;
                DepositPercent = 8.33;
                break;
            default:
        }
        const paymentPlanJSON = {
            "BillingType": "Direct",
            "DepositPercent": DepositPercent,
            "NumberPayments": numberOfPlanments,
            "IsDirectDebit": IsDirectDebit,
            "PaymentPlanId": paymentPlanId,
            "PaymentPlan": {
                "PaymentPlanType": "None"
            }
        };

        const postPaymentPlanPath = `/api/v2/quotes/${this.quote.quoteNumber}/paymentPlans`
        requestUrl = `https://${baseUrl}${postPaymentPlanPath}`;
        log.debug(`postBind: ${requestUrl}` + __location);
        this.quote.log += `--------======= PaymentPlan Request to ${requestUrl} =======--------<br><br>`;
        this.quote.log += `Request:\n <pre>${JSON.stringify(paymentPlanJSON,null,2)}</pre><br><br>\n`;
        this.quote.log += `--------======= End =======--------<br><br>`;

        result = null;
        try {
            result = await axios.post(requestUrl, JSON.stringify(paymentPlanJSON), axiosOptions);
        }
        catch (err) {
            log.error(`AMTrust Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} PaymentPlan request ${err} ${__location}`);
            log.error(`AMTrust Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} PaymentPlan Response ${JSON.stringify(err.response.data)} ${__location}`);
            //log.error(err.response.data)
            this.quote.log += `--------======= Bind Request Error =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${err} </br> Response ${err.response}</pre><br><br>`;
            this.quote.log += `--------======= End =======--------<br><br>`;
            //log.debug(JSON.stringify(err) + __location);
            return 'error';
        }
        if(result.data){
            // {
            //     "StatusCode": 200,
            //     "Message": "ok",
            //     "AdditionalMessages": [],
            //     "Errors": null
            // }
            if(result.data.Errors){
                this.quote.log += `--------======= Bind Request Errors =======--------<br><br>`;
                this.quote.log += `Response:\n <pre>Response ${JSON.stringify(result.data)}</pre><br><br>`;
                this.quote.log += `--------======= End =======--------<br><br>`;
                return "rejected";
            }
        }


        //request Bind

        const postBindPath = `/api/v2/quotes/${this.quote.quoteNumber}/bind/agent-contact/${agencyContactId}`
        requestUrl = `https://${baseUrl}${postBindPath}`;
        log.debug(`postBind: ${requestUrl}` + __location);
        this.quote.log += `--------======= Bind Request to ${requestUrl} =======--------<br><br>`;
        this.quote.log += `Request:\n <pre>NO BODY</pre><br><br>\n`;
        this.quote.log += `--------======= End =======--------<br><br>`;

        result = null;
        try {
            result = await axios.post(requestUrl, null, axiosOptions);
        }
        catch (err) {

            log.error(`AMTrust Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind request ${err}  Response ${JSON.stringify(err.response.data)}${__location}`);
            log.error(err.response);
            this.quote.log += `--------======= Bind Request Error =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${err}</br> Response ${err.response}</pre><br><br>`;
            this.quote.log += `--------======= End =======--------<br><br>`;
            //log.debug(JSON.stringify(err) + __location);
            return 'error';
        }
        //log response.
        if(result.data){
            this.quote.log += `--------======= Bind Response =======--------<br><br>`;
            this.quote.log += `Response:\n <pre>${JSON.stringify(result.data, null, 2)}</pre><br><br>`;
            this.quote.log += `--------======= End =======--------<br><br>`;
            const insurerbindInfo = result.data;
            if(insurerbindInfo.StatusCode === 200 & insurerbindInfo.Message.toLowerCase() === "ok"){
                log.debug(`insurerbindInfo.Data ${JSON.stringify(insurerbindInfo.Data)}`)
                this.policyId = insurerbindInfo.Data.PolicyId;
                this.policyNumber = insurerbindInfo.Data.Policy;
                this.policyEffectiveDate = insurerbindInfo.Data.EffectiveDate;
                this.policyPremium = insurerbindInfo.Data.AnnualPremium;
                return "success";
            }
            else {
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

module.exports = AmTrustBind;