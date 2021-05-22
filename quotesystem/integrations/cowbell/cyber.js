const Integration = require('../Integration.js');
global.requireShared('./helpers/tracker.js');


const cowbellStagingHost = "https://api.morecowbell.ai";
const cowbellStagingBasePath = "/api";

const cowbellProductionHost = "https://api.cowbellcyber.ai";
const cowbellProductionBasePath = "/api";


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
            log.error(`Cowbell AppId ${appDoc.applicationId} does not have a CYBER pollicy`, __location);
            return this.client_error(`NO Cyber policy for AppId ${appDoc.applicationId}`, __location);
        }
        const cyberPolicy = policy.cyber;
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
        // same for businessIncomeCoverageLimits
        // Find best limits
        // let carrierLimitOptions = defaultLimits;
        // if (stateLimits.hasOwnProperty(this.app.business.locations[0].state_abbr)) {
        //     carrierLimitOptions = stateLimits[this.app.business.locations[0].state_abbr];
        // }
        // const carrierLimits = this.getBestLimits(carrierLimitOptions);
        // if (carrierLimits) {
        //     applicationLimits = carrierLimits.join("/");
        // }

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

        // let zipCodeNumber = 0;
        // try{
        //     zipCodeNumber = parseInt(appDoc.mailingZipcode.slice(0,5),10);
        // }
        // catch(err){

        // }
        //TODO refactor for using location 
        const primaryState =  appDoc.mailingState;
        // =========================================================================================================
        // Create the quote request
        const quoteRequestData = {

            "accountDescription": "string",
            //"accountId": "string",
            "accountName": "string",
            "address1": "string",
            "address2": "string",
            "agencyId": "string",
            "agencyName": "string",
            "agentEmail": "string",
            "agentFirstName": "string",
            "agentLastName": "string",
            "agentPhone": "string",
            "businessIncomeCoverage": 0,
            "city": "string",
            "claimHistory": 0,
            "computerFraudEndorsement": true,
            "daAgencyId": "string",
            "dbaOrTradestyle": "string",
            "deductible": 1000,
            "domainName": "string",
            "domains": "string",
            "dunsNumber": "string",
            "effectiveDate": "2019-08-24T14:15:22Z",
            "entityType": "Independent",
            "hardwareReplCostEndorsement": true,
            "isAuthenticatingFundTransferRequests": true,
            "isFranchise": true,
            "isPreventingUnauthorizedWireTransfers": true,
            "isSecurityOfficer": true,
            "isSecurityTraining": true,
            "isVerifyingBankAccounts": true,
            "limit": policyaggregateLimit,
            "naicsCode": naicsNumber,
            "natureOfBusiness": this.industry_code.description,
            "noOfEmployeesAll": 0,
            "ownershipType": "Public",
            "phoneNumber": "string",
            "policyContactEmail": primaryContact.email,
            "policyContactFirstName": primaryContact.firstName,
            "policyContactLastName": primaryContact.lastName,
            "policyContactPhone": formattedContactPhone,
            "postBreachRemediationEndorsement": true,
            "postBreachRemediationSubLimit": 50000,
            "ransomPaymentEndorsement": true,
            "ransomPaymentLimit": 250000,
            "retroactivePeriod": 1,
            "revenue": appDoc.grossSalesAmt,
            "socialEngDeductible": 10000,
            "socialEngEndorsement": true,
            "socialEngLimit": 50000,
            "state": primaryState,
            "telecomsFraudEndorsement": true,
            "telecomsFraudSubLimit": 50000,
            "url": appDoc.website,
            "useCloudStorage": true,
            "useEncryption": true,
            "waitingPeriod": 6,
            "yearEstablished": appDoc.founded.year(),
            "zipCode": appDoc.mailingZipcode.slice(0,5)
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

        // if (claimObjects) {
        //     quoteRequestData.losses = claimObjects;
        // }

        // =========================================================================================================
        //request to get token
        //  {"Authorization": 'Basic ' + Buffer.from(this.username + ":" + this.password).toString('base64')},
        
        
        // Send the request - use Oauth2 for with token.
        const host = this.insurer.useSandbox ? cowbellStagingHost : cowbellProductionHost;
        const basePath = this.insurer.useSandbox ? cowbellStagingBasePath : cowbellProductionBasePath;
        let response = null;
        try {
            response = await this.send_json_request(host, basePath + "/quote",
                JSON.stringify(quoteRequestData),
                {"Authorization": 'Basic ' + Buffer.from(this.username + ":" + this.password).toString('base64')},
                "POST");
        }
        catch (error) {
            try {
                response = JSON.parse(error.response);
            }
            catch (error2) {
                return this.client_error(`The insurer returned an error code of ${error.httpStatusCode}`, __location, {error: error});
            }
        }

        // console.log("response", JSON.stringify(response, null, 4));

        // Check for internal errors where the request format is incorrect
        if (response.hasOwnProperty("statusCode") && response.statusCode === 400) {
            return this.client_error(`The insurer returned an internal error status code of ${response.statusCode}`, __location, {debugMessages: JSON.stringify(response.debugMessages)});
        }

        // =========================================================================================================
        // Process the quote information response

      
        // Unrecognized quote status
        return this.client_error(`Received an unknown quote status of '${quoteStatus}`);
    }
};