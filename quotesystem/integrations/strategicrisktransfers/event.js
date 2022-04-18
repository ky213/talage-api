'use strict';

const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');

//http://internal-DevSimpleRater-1161216847.us-east-1.elb.amazonaws.com/api/SimpleRaterApi
//const DevHost = "internal-DevSimpleRater-1161216847.us-east-1.elb.amazonaws.com";
const StagingHost = "internal-DevSimpleRater-1161216847.us-east-1.elb.amazonaws.com";
const StagingBasePath = "/api/SimpleRaterApi/spreadsheet";
const ProductionHost = "internal-DevSimpleRater-1161216847.us-east-1.elb.amazonaws.com";
const ProductionBasePath = "/api/SimpleRaterApi/spreadsheet";


module.exports = class AcuityWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = false;
        this.requiresInsurerActivityCodes = false;
    }

    async _insurer_price(){
        const appDoc = this.applicationDocData
        const logPrefix = `Appid: ${this.app.id} Stratgic Risk Transfer Event Pricing `


        // const tomorrow = moment().add(1,'d').startOf('d');
        // if(this.policy.effective_date < tomorrow){
        //     this.reasons.push("Insurer: Does not allow effective dates before tomorrow. - Stopped before submission to insurer");
        //     const pricingResult = {
        //         gotPricing: false,
        //         outOfAppetite: true,
        //         pricingError: false
        //     }
        //     return pricingResult;
        // }


        let primaryContact = appDoc.contacts.find(c => c.primary);
        if(!primaryContact && appDoc.contacts.length > 0){
            primaryContact = appDoc.contacts[0]
        }
        else if (!primaryContact){
            primaryContact = {phone: ''};
        }
        //    let contactPhone = '';
        //     if(primaryContact){
        //         try{
        //             contactPhone = primaryContact?.phone?.toString()
        //             contactPhone = stringFunctions.santizeNumber(contactPhone, false);
        //         }
        //         catch(err){
        //             log.error(`Appid: ${this.app.id} Travelers WC: Unable to get contact phone. error: ${err} ` + __location);
        //         }
        //     }
        //     else {
        //         contactPhone = "510555555";
        //     }

        const policyJSON = appDoc.policies.filter(policy => policy === "EVENT");
        if(!policyJSON){
            log.error(`${logPrefix} Missing EVENT policy` + __location);
            return this.client_error(`Missing EVENT policy`);

        }

        let numberOfAttendeesString = "1";
        const numberofAttendees = policyJSON.eventInsurance?.numberofAttendees
        if(numberofAttendees){
            numberOfAttendeesString = numberofAttendees.toString();
        }

        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {
            "fileName" : "strategicrisktransfers/TokioMarineHCCRaceLiabilityInsuranceRater.xlsx",
            "setValues" : {"C4" : numberOfAttendeesString.toString()},
            "returnValues" : {"finalPremium" : "O4"}
        };

        // if(this.get_years_in_business() < 4){
        //     quoteRequestData.basisOfQuotation.threeYearsManagementExperienceInd = appDoc.yearsOfExp >= 3;
        // }


        // =========================================================================================================
        // Send the request
        let host = '';
        const basePath = '/api/SimpleRaterApi/spreadsheet';
        switch(global.settings.ENV){
            case "development":
                host = "internal-DevSimpleRater-1161216847.us-east-1.elb.amazonaws.com"
                break;
            case "awsdev":
                host = "internal-DevSimpleRater-1161216847.us-east-1.elb.amazonaws.com"
                break;
            case "staging":
                host = "internal-StageSimpleRater-1161216847.us-east-1.elb.amazonaws.com"
                break;
            case "demo":
                host = "internal-ProdSimpleRater-1161216847.us-east-1.elb.amazonaws.com"
                break;
            case "production":
                host = "internal-ProdSimpleRater-1161216847.us-east-1.elb.amazonaws.com"
                break;
            default:
                // dont send the email
                log.error(`Failed to generating application link, invalid environment. ${__location}`);
                return;
        }


        const internalCall = true;
        let response = null;
        try {
            response = await this.send_json_request(host, basePath,
                JSON.stringify(quoteRequestData),
                null,
                "POST",
                true,
                true,
                internalCall);
        }
        catch (error) {
            try {
                if(error.indexOf("ETIMEDOUT") > -1){
                    log.error(`${logPrefix}The Submission to Travelers timed out` + __location);
                }
                else if(typeof error.response === 'string') {
                    response = JSON.parse(error.response);
                    log.error(`${logPrefix}The Submission to Travelers Error ${response}` + __location);
                }
                else {
                    log.error(`${logPrefix}The Submission to Travelers Error ${JSON.stringify(error.response)}` + __location);
                }

                const pricingResult = {
                    gotPricing: false,
                    outOfAppetite: false,
                    pricingError: true
                }
                return pricingResult;
            }
            catch (error2) {
                log.error(`${logPrefix}The Request to insurer had an error of ${error}` + __location);
                const pricingResult = {
                    gotPricing: false,
                    outOfAppetite: false,
                    pricingError: true
                }
                return pricingResult;
            }
        }
        const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
        let pricingResult = {};
        let amount = 0;
        let apiResult = "";
        let piQuoteStatus = {};

        if(response.finalPremium){
            const premium = response.finalPremium;
            pricingResult = {
                gotPricing: true,
                price: premium,
                outOfAppetite: false,
                pricingError: false
            }
            amount = premium
            piQuoteStatus = quoteStatus.priceIndication;
            apiResult = "price_indication";

        }
        else {
            //Error
            pricingResult = {
                gotPricing: false,
                outOfAppetite: false,
                pricingError: true
            }
            apiResult = "pi_error";
            piQuoteStatus = quoteStatus.piError;
            this.reasons.push(`UnKnown failer of rater`);
            log.error(`${logPrefix} Failed call to Simple Rater` + __location)

        }
        //write quote record to db. if successful write a quote record.
        if(pricingResult.gotPricing || global.settings.ALWAYS_SAVE_PRICING_QUOTE === "YES"){
            await this.record_quote(amount, apiResult, piQuoteStatus)
        }
        //currently thinking PI error or out of market in AP Applications
        // will cause confusing and agents to stop working the application
        // appDoc will have the pricingResult info.

        return pricingResult;


    }


    /**
	 * Requests a quote from Acuity and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.applicationDocData
        const logPrefix = `Appid: ${this.app.id} StrategicRiskTransfer EVENT `


        // const tomorrow = moment().add(1,'d').startOf('d');
        // if(this.policy.effective_date < tomorrow){
        //     this.reasons.push("Insurer: Does not allow effective dates before tomorrow. - Stopped before submission to insurer");
        //     const pricingResult = {
        //         gotPricing: false,
        //         outOfAppetite: true,
        //         pricingError: false
        //     }
        //     return pricingResult;
        // }


        let primaryContact = appDoc.contacts.find(c => c.primary);
        if(!primaryContact && appDoc.contacts.length > 0){
            primaryContact = appDoc.contacts[0]
        }
        else if (!primaryContact){
            primaryContact = {phone: ''};
        }

        const policyJSON = appDoc.policies.filter(policy => policy === "EVENT");
        if(!policyJSON){
            log.error(`${logPrefix} Missing EVENT policy` + __location);
            return this.client_error(`Missing EVENT policy`);

        }

        let numberOfAttendeesString = "1";
        const numberofAttendees = policyJSON.eventInsurance?.numberofAttendees
        if(numberofAttendees){
            numberOfAttendeesString = numberofAttendees.toString();
        }

        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {
            "fileName" : "strategicrisktransfers/TokioMarineHCCRaceLiabilityInsuranceRater.xlsx",
            "setValues" : {"C4" : numberOfAttendeesString},
            "returnValues" : {"finalPremium" : "O4"}
        };

        // if(this.get_years_in_business() < 4){
        //     quoteRequestData.basisOfQuotation.threeYearsManagementExperienceInd = appDoc.yearsOfExp >= 3;
        // }


        // =========================================================================================================
        // Send the request
        const host = this.insurer.useSandbox ? StagingHost : ProductionHost;
        const basePath = this.insurer.useSandbox ? StagingBasePath : ProductionBasePath;
        const internalCall = true;
        let response = null;
        try {
            response = await this.send_json_request(host, basePath,
                JSON.stringify(quoteRequestData),
                null,
                "POST",
                true,
                true,
                internalCall)
        }
        catch (error) {
            try {
                if(error.indexOf("ETIMEDOUT") > -1){
                    return this.client_error(`The Submission to Simple Rater timed out`, __location, {error: error});
                }
                else {
                    response = JSON.parse(error.response);
                }
            }
            catch (error2) {
                return this.client_error(`The Request to insurer had an error of ${error}`, __location, {error: error});
            }
        }
        this.productDesc = "Race Liability";
        if(response.finalPremium){
            const premium = response.finalPremium
            return this.client_quoted(appDoc.applicationId, {}, premium)

            //TODO send email with App details to Insurer
        }
        else {
            //Error
            log.error(`${logPrefix} unknown error` + __location);
            return this.client_error(`unknown error`);

        }

        // // Unrecognized quote status
        // log.error(`${logPrefix} unknown error` + __location);
        // return this.client_error(`unknown error`);
    }
};