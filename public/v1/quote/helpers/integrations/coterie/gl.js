/* eslint-disable prefer-const */
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const moment = require('moment');
const axios = require('axios');
const log = global.log;
//const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


module.exports = class CompwestWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = true;
    }



    /**
     * Requests a quote from Great America and returns. This request is not
     * intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object
     *   containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {

        log.debug('Coterie GL Quote starting ' + __location)
        const appDoc = this.app.applicationDocData;

        // product array
        let policyTypeArray = [];
        policyTypeArray.push(this.policy.type.toUpperCase())

        let locationArray = [];
        //location array
        appDoc.locations.forEach((location) => {
            let subLoc = {
                "street": location.address,
                "city": location.city,
                "state": location.state,
                "zip": location.zipcode
            }
            if(this.policy.type.toUpperCase() === 'BOP'){
                //log.debug(`this.policy ${JSON.stringify()}`)
                if(location.businessPersonalPropertyLimit){
                    subLoc.bppLimit = location.businessPersonalPropertyLimit
                }
                else {
                    subLoc.bppLimit = this.policy.bopCoverage;
                }
                if(location.buildingLimit){
                    subLoc.buildingLimit = location.buildingLimit;
                }
            }
            locationArray.push(subLoc)
        });

        //get primary contact
        let primaryContact = {}
        appDoc.contacts.forEach((appContact) => {
            if(appContact.primary){
                primaryContact = appContact;
            }
        });
        //look up coterie industry Code from InsurerIndustryCode Doc attributes.
        let coterieIndustryId = 0;
        if(this.insurerIndustryCode && this.insurerIndustryCode.attributes){
            coterieIndustryId = parseInt(this.insurerIndustryCode.attributes["Coterie ID"],10);
        }
        log.debug('this.policy.limits ' + this.policy.limits + __location)
        const requestedLimits = this.getSplitLimits(this.policy.limits);
        log.debug('requestedLimits ' + requestedLimits + __location)
        this.limits[4] = parseInt(requestedLimits[0],10);
        this.limits[8] = parseInt(requestedLimits[3],10);
        this.limits[9] = parseInt(requestedLimits[4],10);

        //leave out policyEnddate per coterie - Defaults to yearly.
        let submissionJSON = {
            "metadata": appDoc.applicationId,
            "applicationTypes": policyTypeArray,
            "grossAnnualSales": appDoc.grossSalesAmt,
            "glLimit": requestedLimits[0],
            "glAggregateLimit": requestedLimits[3],
            "glAggregatePcoLimit": requestedLimits[4],
            "policyStartDate": this.policy.effective_date.toISOString(),
            //"policyEndDate": this.policy.expiration_date.toISOString(),
            "zip": appDoc.mailingZipcode,
            "numEmployees": this.get_total_employees(),
            "industryId": coterieIndustryId,
            "AKHash":this.insurerIndustryCode.code,
            "contactEmail": primaryContact.email,
            "businessName": appDoc.businessName,
            "contactFirstName": primaryContact.firstName,
            "contactLastName": primaryContact.lastName,
            "contactPhone": primaryContact.phone,
            "mailingAddressStreet": appDoc.mailingAddress,
            "mailingAddressCity": appDoc.mailingCity,
            "mailingAddressState": appDoc.mailingState,
            "mailingAddressZip": appDoc.mailingZipcode,
            "locations": locationArray
        }
        let coterieDeductible = 0;
        if(this.policy.deductible >= 0){
            //submissionJSON.bppDeductible = appDoc.policies[].deductible
            coterieDeductible = 500;
            coterieDeductible = this.policy.deductible;
            if(coterieDeductible > 1000 && coterieDeductible < 2501){
                coterieDeductible = 2500
            }
            else if (coterieDeductible > 2500) {
                coterieDeductible = 5000
            }
            if(this.policy.type.toUpperCase() === 'BOP'){
                submissionJSON.bppDeductible = coterieDeductible;
            }
            // else {
            //     submissionJSON.propertyDamageLiabilityDeductible = coterieDeductible;
            // }
            submissionJSON.propertyDamageLiabilityDeductible = coterieDeductible;
            // what is "propertyDamageLiabilityDeductible" Assuming GL Deductible.
            //"propertyDamageLiabilityDeductible": 500,
        }
        this.limits[12] = coterieDeductible;

        //we might not have payroll if just GL or BOP
        const totalPayRoll = this.get_total_payroll()
        if(totalPayRoll > 0){
            submissionJSON.annualPayroll = totalPayRoll;
        }
        if(appDoc.founded){
            try{
                var now = moment();
                submissionJSON.businessAgeInMonths = now.diff(appDoc.founded, 'months');
            }
            catch(err){
                log.error(`Coterie API: Appid: ${this.app.id} businessAgeInMonths error ${err} ` + __location);
            }
            //
        }


        //Claims
        let claimsArray = [];
        if(appDoc.claims && appDoc.claims.length > 0){
            appDoc.claims.forEach((claim) => {
                if(claim.policyType.toUpperCase() === this.policy.type.toUpperCase()){
                    const claimJson = {
                        "description": "Event: " + claim.eventDate,
                        "amount": claim.amountPaid
                    }
                    claimsArray.push(claimJson)
                }
            });
        }
        submissionJSON.previousLosses = claimsArray

        log.debug(`Coterie ${this.policy.type.toUpperCase()} Quote submission JSON \n ${JSON.stringify(submissionJSON)} \n ` + __location)

        const publicKey = this.app.agencyLocation.insurers[this.insurer.id].agency_id
        //call API
        let host = null;
        let path = '/v1/commercial/quotes/bindable';
        if (this.insurer.useSandbox) {
            host = 'https://api-sandbox.coterieinsurance.com';
            //path = '/v1/commercial/quotes/bindable';
        }
        else {
            host = 'https://api.coterieinsurance.com';
            //path = '/v1/commercial/quotes/bindable';
        }
        const urlFQN = host + path;
        const requestOptions = {
            headers: {
                Authorization: `token ${publicKey}`,
                "Content-Type": 'application/json'
            },
            timeout: 60000
        };
        //log.debug("Coterie requeste options " + JSON.stringify(requestOptions) + __location)
        this.log += `--------======= Sending to Coterie =======--------<br><br>`;
        this.log += `<b>Request started at ${moment().utc().toISOString()}</b><br><br>`;
        this.log += `URL: ${host}${path}<br><br>`;
        this.log += `<pre>${JSON.stringify(submissionJSON, null, 2)}</pre><br><br>`;
        this.log += `--------======= End =======--------<br><br>`;

        let apiResponse = null;
        let quoteResponse = null;
        //const error = null;
        try{
            apiResponse = await axios.post(urlFQN, JSON.stringify(submissionJSON), requestOptions);
            if(apiResponse && apiResponse.data){
                quoteResponse = apiResponse.data;
            }
        }
        catch(err){
            log.error(`Coterie API: Appid: ${this.app.id} API call error: ${err}  ` + __location)
            this.reasons.push(`Coterie API Error: ${err}`);
            this.log += `--------======= Coterie Request Error =======--------<br><br>`;
            this.log += err;
            this.log += `--------======= End =======--------<br><br>`;
        }
        if(quoteResponse){
            log.debug(`Coterie API: Appid: ${this.app.id} response \n ${JSON.stringify(quoteResponse)} \n ` + __location)


            this.log += `--------======= Response Appid: ${this.app.id}  =======--------<br><br>`;
            this.log += `<pre>${JSON.stringify(quoteResponse, null, 2)}</pre><br><br>`;
            this.log += `--------======= End =======--------<br><br>`;
            let isReferred = false;
            this.quoteResponseJSON = quoteResponse;
            if(quoteResponse.isSuccess){
                if(quoteResponse.quote){
                    const quote = quoteResponse.quote
                    this.amount = quote.premium;
                    this.request_id = quote.externalId;
                    this.quoteLink = quote.applicationUrl;
                    if(this.policy.type.toUpperCase() === 'BOP'){
                        this.deductible = coterieDeductible;
                    }
                    isReferred = quote.isEstimate;
                    if(quote.quotes && quote.quotes.length > 0){
                        const quoteDetail = quote.quotes[0];
                        this.number = quoteDetail.applicationId;
                    }
                    if(isReferred){
                        return this.return_result('referred_with_price');
                    }
                    else {
                        return this.return_result('quoted');
                    }
                }
                else {
                    log.error(`Coterie API: Appid: ${this.app.id} unknown successful response ${JSON.stringify(quoteResponse)}`)
                    return this.return_result('error');
                }
            }
            else if(quoteResponse.errors){
                quoteResponse.errors.forEach((error) => {
                    this.reasons.push(error);
                });
                return this.return_result('declined');
            }
            else {
                log.error(`Coterie API: Appid: ${this.app.id} unknown unsuccessful reason ${JSON.stringify(quoteResponse)}`)
                this.reasons.push("Decline: unknown reason")
                return this.return_result('declined');
            }
        }
        else {
            this.log += `--------======= Response Appid: ${this.app.id}  =======--------<br><br>`;
            try{
                if(apiResponse){
                    this.log += `<pre>Status Code ${apiResponse.status}</pre><br><br>`;
                    this.log += `<pre>Status Text ${apiResponse.statusText}</pre><br><br>`;
                    //this.log += `<pre>${JSON.stringify(apiResponse.data, null, 2)}</pre><br><br>`;
                }
            }
            catch(err){
                log.error(`Unable to parse error response from Coterie ${this.app.id} ${apiResponse} ` + __location)
            }
            return this.return_result('error');
        }

    }
}