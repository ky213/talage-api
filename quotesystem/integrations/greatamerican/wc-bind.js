/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
const Bind = require('../bind');
const axios = require('axios');
const moment = require('moment');
const {FSx} = require('aws-sdk');


class GreatAmericanBind extends Bind {
    getApiUrl() {
        if (this.insurer.useSandbox) {
            return 'https://uat01.api.gaig.com';
        }
        return 'https://prod01.api.gaig.com';
    }

    async getAuthToken() {
        const username = this.insurer.get_username();
        const password = this.insurer.get_password();

        if (!username) {
            const err = `Great American Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Request Error: Could not find Great American Username ${__location}`;
            log.error(err);
            throw new Error(err);
        }
        if (!password) {
            const err = `Great American Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Request Error: Could not find Great American Password ${__location}`
            log.error(err);
            throw new Error(err);
        }
        const options = {
            headers: {
                Authorization: `Basic ${Buffer.from(`${this.insurer.get_username()}:${this.insurer.get_password()}`).toString('base64')}`,
                Accept: 'application/json'
            }
        }

        let resp = null;
        try {
            const apiResponse = await axios.post(`${this.getApiUrl()}/oauth/accesstoken?grant_type=client_credentials`, null, options)
            resp = apiResponse.data;
        }
        catch (err) {
            log.error(`Error getting token from Great American ${err} from ${this.getApiUrl()}/oauth/accesstoken?grant_type=client_credentials  ` + __location);
        }
        if (!resp.access_token) {
            log.error(`NO access token returned: ${JSON.stringify(resp, null, 2)} @ ` + __location);
            throw new Error(`NO access token returned: ${JSON.stringify(resp, null, 2)}`);
        }
        return resp.access_token;
    }

    async bind() {
        const logPrefix = `Great American Binding AppId: ${this.quote.applicationId} QuoteId: ${this.quote.quoteId} Bind Request Error: `;
        let token = null;
        try {
            token = await this.getAuthToken();
        }
        catch (err) {
            log.error(`${logPrefix}Could not get Great American access token ${__location}`)
            this.quote.log += "Could not get Great American Access Token";
            return "error";
        }

        const options = {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        }

        if (!this.quote.requestId) {
            log.error(`${logPrefix}Could not find Great American request ID ${__location}`);
            return "error";
        }
        const send = {
            newBusiness: {
                id: this.quote.requestId
            }
        };

        const submitUrl = `${this.getApiUrl()}/shop/api/newBusiness/submit`;
        this.quote.log += `\n----Bind Request: ${submitUrl} -----\n`
        this.quote.log += `<pre>${JSON.stringify(send, null, 2)}</pre>`;

        let submitResponse = null;
        try {
            const apiResponse = await axios.post(submitUrl, send, options);
            submitResponse = apiResponse.data;
        }
        catch (err) {
            log.error(`${logPrefix} Problem calling Great American submit endpoint ${err} from ${submitUrl} ` + __location);
            this.quote.log += "\nError Response: \n ";
            this.quote.log += err;
            this.quote.log += `<pre>Response ${JSON.stringify(err.response.data)}</pre><br><br>`;
            this.quote.log += "\n";
            return "error";
        }

        if (submitResponse) {
            if (submitResponse.newBusiness?.workflowControl.toLowerCase().trim() === 'submitted') {
                this.quote.log += `--------======= Bind Response =======--------<br><br>`;
                this.quote.log += `<pre>${JSON.stringify(submitResponse, null, 2)}</pre>`;
                this.quote.log += `--------======= Bind request ACCEPTED =======--------<br><br>`;
                this.quote.log += `--------======= End =======--------<br><br>`;
                return "success";
            }
            else {
                this.quote.log += `--------======= Bind Response =======--------<br><br>`;
                this.quote.log += `<pre>${JSON.stringify(submitResponse, null, 2)}</pre>`;
                this.quote.log += `--------======= Bind request REJECTED =======--------<br><br>`;
                return "rejected";
            }
        }
        else {
            log.error(`${logPrefix}Problem with response from submit endpoint. Resposne: ${JSON.stringify(submitResponse)}`);
            this.quote.log += `--------======= Bind Response Unknown no data =======--------<br><br>`;
            return "error";
        }
    }
}

module.exports = GreatAmericanBind;