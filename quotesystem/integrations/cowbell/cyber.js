/* eslint-disable no-unneeded-ternary */
const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');


// const cowbellStagingHost = "https://api.morecowbell.ai";
// const cowbellStagingBasePath = "/api";

// const cowbellProductionHost = "https://api.cowbellcyber.ai";
// const cowbellProductionBasePath = "/api";


module.exports = class cowbellCyber extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerIndustryCodes = false;
        this.requiresInsurerActivityCodes = false;
    }

    /**
     * Gets a child property from an object
     * @param  {object} object - the parent object
     * @param  {string} childPath - period-delimited child name ("Quote.Result.Status")
     * @returns {object} The child object or null if it could not be found
     */
    getChildProperty(object, childPath) {
        const childPathList = childPath.split('.');
        let child = object;
        for (const childName of childPathList) {
            if (!child.hasOwnProperty(childName)) {
                return null;
            }
            child = child[childName];
        }
        return child;
    }

    /**
	 * Requests a quote from Insurer and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const appDoc = this.app.applicationDocData


        const aggregateLimits = [50000,
            100000,
            250000,
            500000,
            750000,
            1000000,
            2000000,
            3000000,
            4000000,
            5000000];

        const businessIncomeCoverageLimits = [100000,
            150000,
            200000,
            250000,
            300000,
            350000,
            400000,
            450000,
            500000,
            550000,
            600000,
            650000,
            700000,
            750000,
            800000,
            850000,
            900000,
            950000,
            1000000];


        const applicationDocData = this.app.applicationDocData;


        //get Cyber policy from appDoc.
        const policy = applicationDocData.policies.find(p => p.policyType.toUpperCase() === "CYBER");
        if(!policy){
            log.error(`Cowbell AppId ${appDoc.applicationId} does not have a CYBER policy`, __location);
            return this.client_error(`NO Cyber policy for AppId ${appDoc.applicationId}`, __location);
        }
        const cyberPolicy = policy.cyber;
        if(!cyberPolicy){
            log.error(`Cowbell AppId ${appDoc.applicationId} does not have a CyberSchema attached to Policy`, __location);
            return this.client_error(`NO Cyber policy for AppId ${appDoc.applicationId}`, __location);
        }
        let policyaggregateLimit = cyberPolicy.aggregateLimit
        if(aggregateLimits.indexOf(policyaggregateLimit) === -1){
            //find best match
            for(let i = 0; i < aggregateLimits.length; i++){
                if(policyaggregateLimit < aggregateLimits[i]){
                    policyaggregateLimit = aggregateLimits[i]
                    break;
                }
            }
        }
        //waiting period check
        // eslint-disable-next-line array-element-newline
        const waitingPeriodList = [6,8,12,24]
        if(waitingPeriodList.indexOf(cyberPolicy.waitingPeriod) === -1){
            cyberPolicy.waitingPeriod = 6;
        }

        // same for businessIncomeCoverageLimits
        let businessIncomeCoverage = cyberPolicy.businessIncomeCoverage
        if(businessIncomeCoverageLimits.indexOf(businessIncomeCoverage) === -1){
            //find best match
            for(let i = 0; i < businessIncomeCoverageLimits.length; i++){
                if(businessIncomeCoverage < businessIncomeCoverageLimits[i]){
                    businessIncomeCoverage = businessIncomeCoverageLimits[i]
                    break;
                }
            }
        }
        // =========================================================================================================
        // Validation

        // Ensure we have a supported legal entity.
        const legalEntityMap = {
            'Association': 'Private',
            'Corporation': 'Public',
            'Limited Liability Company': 'Private',
            'Limited Partnership': 'Partnership',
            'Partnership': 'Partnership',
            'Sole Proprietorship': 'Non-Corporates',
            'Other': 'OT',
            "Corporation (C-Corp)": "Public",
            "Corporation (S-Corp)": 'Private',
            "Non Profit Corporation": "Non-Profit",
            "Limited Liability Company (Member Managed)": "Private",
            "Limited Liability Company (Manager Managed)": "Private"
        };
        if (!legalEntityMap.hasOwnProperty(appDoc.entityType)) {
            log.error(`The business entity type '${appDoc.entityType}' is not supported by this insurer.`, __location);
            //return this.client_error(`The business entity type '${appDoc.entityType}' is not supported by this insurer.`, __location);
        }
        //If Corporation,  check if Corporation (C-Corp)
        let naicsNumber = 0;
        if (this.industry_code.naics) {
            try{
                naicsNumber = parseInt(this.industry_code.naics, 10);
            }
            catch(err){
                log.error(`Cowbell Cyber could not convert an NAICS code ${this.industry_code.naics} for '${appDoc.industryCode}' into number.`, __location);
            }
        }
        else {
            log.error(`Cowbell Cyber requires an NAICS code '${appDoc.industryCode}' does not have one.`, __location);
        }

        let primaryContact = applicationDocData.contacts.find(c => c.primary);
        if(!primaryContact){
            primaryContact = {};
        }
        // fall back to outside phone IFF we cannot find primary contact phone
        const constactPhone = primaryContact.phone ? constactPhone : applicationDocData.phone.toString();
        const formattedContactPhone = `+1-${constactPhone.substring(0, 3)}-${constactPhone.substring(constactPhone.length - 7)}`;

        const primaryLocation = applicationDocData.locations.find(l => l.primary)

        //Main Domai - 1st in list.
        let mainDomain = "";
        if(cyberPolicy.domains.length > 0){
            const domainList = cyberPolicy.domains.split(',');
            if(domainList.length > 0){
                mainDomain = domainList[0];
            }
        }
        //claims
        let claimHistory = 0 //no claims
        if(appDoc.claims.length > 0){
            const cyberClaimsList = appDoc.claims.filter(c => c.policyType === "CYBER");
            if(cyberClaimsList && cyberClaimsList.length > 0){
                // any claim within five years is rejection per Cowbell.
                // Cyber enum based on within years.
                // if any cyber claims just set it to 1 - Recommended by Cowbell
                if(cyberClaimsList.length > 0){
                    claimHistory = 1;
                }
            }
        }

        // Create the quote request
        const quoteRequestData = {

            //"accountDescription": "string",
            //"accountId": "string",
            //"accountName": "string",
            "agencyId": this.app.agencyLocation.insurers[this.insurer.id].agency_id,
            "agencyName": this.app.agencyLocation.agency,
            "agentEmail": this.app.agencyLocation.agencyEmail,
            "agentFirstName": this.app.agencyLocation.first_name,
            "agentLastName": this.app.agencyLocation.last_name,
            "agentPhone":this.app.agencyLocation.agencyPhone,
            "businessIncomeCoverage": businessIncomeCoverage,
            "address1": primaryLocation.address,
            "address2": primaryLocation.address2,
            "city": primaryLocation.city,
            "state": primaryLocation.states,
            "zipCode": primaryLocation.zipcode.slice(0,5),
            "phoneNumber": primaryContact.phone,
            "claimHistory": claimHistory,
            //"daAgencyId": "string",
            "dbaOrTradestyle": appDoc.dba,
            "deductible": policy.deductible,
            "domainName": mainDomain,
            "domains": cyberPolicy.domains,
            //"dunsNumber": "string",
            "effectiveDate": policy.effectiveDate.format('YYYY-MM-DD').toISOString(),
            "entityType": "Independent",
            //Questions....
            "isAuthenticatingFundTransferRequests": true,
            "isFranchise": false,
            "isPreventingUnauthorizedWireTransfers": true,
            "isSecurityOfficer": true,
            "isSecurityTraining": true,
            "isVerifyingBankAccounts": true,
            "useCloudStorage": true,
            "useEncryption": true,
            // end questions
            "limit": policyaggregateLimit,
            "naicsCode": naicsNumber,
            "natureOfBusiness": this.industry_code.description,
            "noOfEmployeesAll": this.get_total_employees(),
            "ownershipType": "Public",
            "policyContactEmail": primaryContact.email,
            "policyContactFirstName": primaryContact.firstName,
            "policyContactLastName": primaryContact.lastName,
            "policyContactPhone": formattedContactPhone,
            "hardwareReplCostEndorsement": cyberPolicy.hardwareReplCostEndorsement ? true : false,
            "hardwareReplCostSubLimit": cyberPolicy.hardwareReplCostEndorsement ? cyberPolicy.hardwareReplCostLimit : null,
            "computerFraudEndorsement": cyberPolicy.computerFraudEndorsement ? true : false,
            "postBreachRemediationEndorsement": cyberPolicy.postBreachRemediationEndorsement ? true : false,
            "postBreachRemediationSubLimit": cyberPolicy.postBreachRemediationEndorsement ? cyberPolicy.postBreachRemediationLimit : null,
            "ransomPaymentEndorsement": cyberPolicy.ransomPaymentEndorsement ? true : false,
            "ransomPaymentLimit": cyberPolicy.ransomPaymentEndorsement ? cyberPolicy.ransomPaymentLimit : null,
            "retroactivePeriod": cyberPolicy.yearsOfPriorActs ? cyberPolicy.yearsOfPriorActs : 1,
            "waitingPeriod": cyberPolicy.waitingPeriod ? cyberPolicy.waitingPeriod : 6,
            "revenue": appDoc.grossSalesAmt,
            "socialEngEndorsement": cyberPolicy.socialEngEndorsement ? true : false,
            "socialEngLimit": cyberPolicy.socialEngEndorsement ? cyberPolicy.socialEngLimit : null,
            "socialEngDeductible": cyberPolicy.socialEngEndorsement ? cyberPolicy.socialEngDeductible : null,
            "telecomsFraudEndorsement":  cyberPolicy.telecomsFraudEndorsement ? true : false,
            "telecomsFraudSubLimit": cyberPolicy.telecomsFraudEndorsement ? cyberPolicy.telecomsFraudEndorsementLimit : null,
            "url": appDoc.website,
            "yearEstablished": appDoc.founded.year()
            // "additionalInsureds": [
            //     {
            //         "address1": "string",
            //         "address2": "string",
            //         "businessName": "string",
            //         "city": "string",
            //         "id": "string",
            //         "naicsCode": "string",
            //         "naicsDescription": "string",
            //         "state": "string",
            //         "zipCode": "string"
            //     }
            // ]

        };

        // TODO Question overrides
        //   "isAuthenticatingFundTransferRequests": true,
        //     "isFranchise": false,
        //     "isPreventingUnauthorizedWireTransfers": true,
        //     "isSecurityOfficer": true,
        //     "isSecurityTraining": true,
        //     "isVerifyingBankAccounts": true,
        //     "useCloudStorage": true,
        //     "useEncryption": true,

        //TODO Additional Insurered

        log.debug(`Cowbel submission \n ${JSON.stringify(quoteRequestData)} \n` + __location);
        return this.client_error(`Did not send`);
        // if (claimObjects) {
        //     quoteRequestData.losses = claimObjects;
        // }

        // =========================================================================================================
        //request to get token
        //  {"Authorization": 'Basic ' + Buffer.from(this.username + ":" + this.password).toString('base64')},
        // Send the request - use Oauth2 for with token.
        // const host = this.insurer.useSandbox ? cowbellStagingHost : cowbellProductionHost;
        // const basePath = this.insurer.useSandbox ? cowbellStagingBasePath : cowbellProductionBasePath;
        // let response = null;
        // try {
        //     response = await this.send_json_request(host, basePath + "/quote",
        //         JSON.stringify(quoteRequestData),
        //         {"Authorization": 'Basic ' + Buffer.from(this.username + ":" + this.password).toString('base64')},
        //         "POST");
        // }
        // catch (error) {
        //     try {
        //         response = JSON.parse(error.response);
        //     }
        //     catch (error2) {
        //         return this.client_error(`The insurer returned an error code of ${error.httpStatusCode}`, __location, {error: error});
        //     }
        // }

        // // console.log("response", JSON.stringify(response, null, 4));

        // // Check for internal errors where the request format is incorrect
        // if (response.hasOwnProperty("statusCode") && response.statusCode === 400) {
        //     return this.client_error(`The insurer returned an internal error status code of ${response.statusCode}`, __location, {debugMessages: JSON.stringify(response.debugMessages)});
        // }

        // // =========================================================================================================
        // // Process the quote information response


        // // Unrecognized quote status
        // return this.client_error(`Received an unknown quote status of `);
    }
};