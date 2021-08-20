/* eslint-disable no-unneeded-ternary */
const Integration = require('../Integration.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
global.requireShared('./helpers/tracker.js');
const {convertToDollarFormat} = global.requireShared('./helpers/stringFunctions.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const axios = require('axios');

const utility = global.requireShared('./helpers/utility.js');
const moment = require('moment');

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

        // const businessIncomeCoverageLimits = [100000,
        //     150000,
        //     200000,
        //     250000,
        //     300000,
        //     350000,
        //     400000,
        //     450000,
        //     500000,
        //     550000,
        //     600000,
        //     650000,
        //     700000,
        //     750000,
        //     800000,
        //     850000,
        //     900000,
        //     950000,
        //     1000000];


        //get Cyber policy from appDoc.
        const policy = appDoc.policies.find(p => p.policyType.toUpperCase() === "CYBER");
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
        const businessIncomeCoverage = cyberPolicy.businessIncomeCoverage
        // if(businessIncomeCoverageLimits.indexOf(businessIncomeCoverage) === -1){
        //     //find best match
        //     for(let i = 0; i < businessIncomeCoverageLimits.length; i++){
        //         if(businessIncomeCoverage < businessIncomeCoverageLimits[i]){
        //             businessIncomeCoverage = businessIncomeCoverageLimits[i]
        //             break;
        //         }
        //     }
        // }
        // =========================================================================================================
        // Validation

        // Ensure we have a supported legal entity.
        const legalEntityMap = {
            'Association': 'Private',
            'Corporation': 'Private',
            'Limited Liability Company': 'Private',
            'Limited Partnership': 'Partnership',
            'Partnership': 'Partnership',
            'Sole Proprietorship': 'Non-Corporates',
            "Corporation (C-Corp)": "Private",
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

        let primaryContact = appDoc.contacts.find(c => c.primary);
        if(!primaryContact){
            primaryContact = {};
        }
        // fall back to outside phone IFF we cannot find primary contact phone
        const contactPhone = primaryContact.phone ? primaryContact.phone : appDoc.phone.toString();

        const primaryLocation = appDoc.locations.find(l => l.primary)

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
                // any claim will cause a rejection
                if(cyberClaimsList.length > 0){
                    claimHistory = 1;
                }
            }
        }
        //this.policy.effective_date.format('YYYY-MM-DD')
        let Surname = this.app.agencyLocation.last_name
        let GivenName = this.app.agencyLocation.first_name
        let agencyEmail = this.app.agencyLocation.agencyEmail
        let agencyName = this.app.agencyLocation.agency;
        let agencyPhone = this.app.agencyLocation.agencyPhone

        // If talageWholeSale
        if(this.app.agencyLocation.insurers[this.insurer.id].talageWholesale){
            Surname = this.app.agencyLocation.quotingAgencyLocationDB.lastName;
            GivenName = this.app.agencyLocation.quotingAgencyLocationDB.firstName;
            const agencyBO = new AgencyBO();
            const agencyInfo = await agencyBO.getById(this.app.agencyLocation.quotingAgencyLocationDB.agencyId);
            agencyName = agencyInfo.name;
            agencyEmail = this.app.agencyLocation.quotingAgencyLocationDB.email
            agencyPhone = this.app.agencyLocation.quotingAgencyLocationDB.phone
        }

        // Create the quote request
        const quoteRequestData = {

            //"accountDescription": "string",
            //"accountId":
            "accountName": appDoc.businessName,
            "agencyId": this.app.agencyLocation.insurers[this.insurer.id].agency_id,
            "agencyName": agencyName,
            "agentEmail": agencyEmail,
            "agentFirstName": GivenName,
            "agentLastName": Surname,
            "agentPhone":stringFunctions.santizeNumber(agencyPhone),
            "businessIncomeCoverage": businessIncomeCoverage,
            "address1": primaryLocation.address,
            "address2": primaryLocation.address2,
            "city": primaryLocation.city,
            "state": primaryLocation.state,
            "zipCode": primaryLocation.zipcode.slice(0,5),
            "phoneNumber": stringFunctions.santizeNumber(primaryContact.phone),
            "companyType": legalEntityMap[appDoc.entityType],
            "ownershipType": legalEntityMap[appDoc.entityType],
            "claimHistory": claimHistory,
            //"daAgencyId": "string",
            "dbaOrTradestyle": appDoc.dba,
            "deductible": policy.deductible,
            "domainName": mainDomain,
            "domains": cyberPolicy.domains,
            //"dunsNumber": "string",
            "effectiveDate": moment(policy.effectiveDate).toISOString(),
            "entityType": "Independent",
            //Questions....
            // "questionTraining":  true,
            // "questionLeadership": true,
            // "questionEncryption": true,
            // "questionCloud": true,
            // "isAuthenticatingFundTransferRequests": true,
            // "isFranchise": false,
            // "isPreventingUnauthorizedWireTransfers": true,
            // "isSecurityOfficer": true,
            // "isSecurityTraining": true,
            // "isVerifyingBankAccounts": true,
            // "useCloudStorage": true,
            // "useEncryption": true,
            // end questions
            "limit": policyaggregateLimit,
            "aggregateLimit": policyaggregateLimit,
            "naicsCode": naicsNumber,
            "natureOfBusiness": this.industry_code.description,
            "noOfEmployeesAll": this.get_total_employees(),
            "numberOfEmployees": this.get_total_employees(),
            "policyContactEmail": primaryContact.email,
            "policyContactFirstName": primaryContact.firstName,
            "policyContactLastName": primaryContact.lastName,
            "policyContactPhone": stringFunctions.santizeNumber(contactPhone),
            "hardwareReplCostEndorsement": cyberPolicy.hardwareReplCostEndorsement ? true : false,
            "hardwareReplCostSubLimit": cyberPolicy.hardwareReplCostEndorsement ? cyberPolicy.hardwareReplCostLimit : null,
            "computerFraudEndorsement": cyberPolicy.computerFraudEndorsement ? true : false,
            "postBreachRemediationEndorsement": cyberPolicy.postBreachRemediationEndorsement ? true : false,
            "postBreachRemediationSubLimit": cyberPolicy.postBreachRemediationEndorsement ? cyberPolicy.postBreachRemediationLimit : null,
            "ransomPaymentEndorsement": cyberPolicy.ransomPaymentEndorsement ? true : false,
            "ransomPaymentLimit": cyberPolicy.ransomPaymentEndorsement ? cyberPolicy.ransomPaymentLimit : null,
            "retroactivePeriod": cyberPolicy.yearsOfPriorActs ? cyberPolicy.yearsOfPriorActs : 1,
            "retroactiveYear": cyberPolicy.yearsOfPriorActs ? cyberPolicy.yearsOfPriorActs : 1,
            "waitingPeriod": cyberPolicy.waitingPeriod ? cyberPolicy.waitingPeriod : 6,
            "revenue": appDoc.grossSalesAmt,
            "socialEngEndorsement": cyberPolicy.socialEngEndorsement ? true : false,
            "socialEngLimit": cyberPolicy.socialEngEndorsement ? cyberPolicy.socialEngLimit : null,
            "socialEngDeductible": cyberPolicy.socialEngEndorsement ? cyberPolicy.socialEngDeductible : null,
            "telecomsFraudEndorsement":  cyberPolicy.telecomsFraudEndorsement ? true : false,
            "telecomsFraudSubLimit": cyberPolicy.telecomsFraudEndorsement ? cyberPolicy.telecomsFraudEndorsementLimit : null,
            "url": appDoc.website,
            "yearEstablished": moment(appDoc.founded).year(),
            "yearsInBusiness": this.get_years_in_business()
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
        //Question Processing.
        for(const insurerQuestion of this.insurerQuestionList){
            if(Object.prototype.hasOwnProperty.call(this.questions, insurerQuestion.talageQuestionId)){
                if(insurerQuestion.identifier){
                    const question = this.questions[insurerQuestion.talageQuestionId];
                    if(!question){
                        continue;
                    }
                    quoteRequestData[insurerQuestion.identifier] = question.get_answer_as_boolean()
                }
            }
        }


        //"companyType": "Private" override....

        log.debug(`Cowbell submission \n ${JSON.stringify(quoteRequestData)} \n` + __location);

        // =========================================================================================================
        // request to get token
        const clientId = this.username
        const clientSecret = this.password;
        const authBody = {
            "clientId": clientId,
            "secret": clientSecret
        }
        // Send the request - use Oauth2 for with token.
        const host = this.insurer.useSandbox ? cowbellStagingHost : cowbellProductionHost;
        const basePath = this.insurer.useSandbox ? cowbellStagingBasePath : cowbellProductionBasePath;
        let responseAuth = null;
        let authToken = null;
        const authUrl = `${host}${basePath}/auth/v1/api/token`;
        try {
            const options = {headers: {Accept: 'application/json'}};

            //let responseAuth = null;
            try{
                const apiCall = await axios.post(authUrl, authBody, options);
                responseAuth = apiCall.data;
            }
            catch(err){
                //console.log(err);
                this.log += `----auth ${authUrl} -----\n`
                this.log += `<pre>${JSON.stringify(authBody, null, 2)}</pre>`;
                log.error(`Error getting token from Cowbell ${err} @ ${__location}`)
                this.log += "\nError Response: \n ";
                this.log += err;
                this.log += `<pre>Response ${JSON.stringify(err.response.data)}</pre><br><br>`;
                this.log += "\n";
                return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode} response: ${responseAuth}`, __location, {error: err});
            }

            if(responseAuth && responseAuth.accessToken){
                authToken = responseAuth.accessToken;
            }

            // responseAuth = await this.send_json_request(host, basePath + "/auth/v1/api/token",
            //     JSON.stringify(authBody),
            //     null,
            //     "POST");
            // if(responseAuth && responseAuth.accessToken){
            //     authToken = responseAuth.accessToken;
            // }

        }
        catch (error) {
            try {
                responseAuth = JSON.stringify(error.response);
                return this.client_error(`The Cowbell returned an error code of ${error.httpStatusCode} response: ${responseAuth}`, __location, {error: error});
            }
            catch (error2) {
                return this.client_error(`The Cowbell returned an error code of ${error.httpStatusCode}`, __location, {error: error});
            }
        }
        if(authToken){
            let response = null;

            const options = {headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${authToken}`
            }};
            try {

                const quoteUrl = `${host}${basePath}/quote/v1`;

                this.log += `----quote url ${quoteUrl} -----\n`
                this.log += `<pre>${JSON.stringify(quoteRequestData, null, 2)}</pre>`;
                const apiCall = await axios.post(quoteUrl, quoteRequestData, options);
                response = JSON.parse(JSON.stringify(apiCall.data));

                this.log += `----Response -----\n`
                this.log += `<pre>${JSON.stringify(response, null, 2)}</pre>`;
            }
            catch (err) {
                try {
                    response = err.response.data;
                    return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode} response: ${response}`, __location, {error: err});
                }
                catch (error2) {
                    return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode}`, __location, {error: err});
                }
            }
            let cowbellQuoteId = null
            if(response && response.id){
                this.number = response.id
                cowbellQuoteId = response.id
                let quotePremium = null
                const quoteLimits = {};
                quoteLimits[11] = policyaggregateLimit;
                quoteLimits[12] = this.deductible;

                const quoteCoverages = [];
                let coverageSort = 0;
                quoteCoverages.push({
                    description: `Aggregate`,
                    value: convertToDollarFormat(policyaggregateLimit, true),
                    sort: coverageSort++,
                    category: "Liability Coverages"
                });
                if(policy.deductible){
                    quoteCoverages.push({
                        description: `Deductible`,
                        value: convertToDollarFormat(policy.deductible, true),
                        sort: coverageSort++,
                        category: "Liability Coverages"
                    });
                }

                // Give Cowbell 5 seconds to run there process.
                await utility.Sleep(5000);

                let accountId = null;
                try{
                    const quoteUrl = `${host}${basePath}/quote/v1/${cowbellQuoteId}`;
                    //5 tries with 5 seconds waits
                    const NUMBER_OF_TRIES = 24;
                    for(let i = 0; i < NUMBER_OF_TRIES; i++){
                        this.log += `----quote url ${quoteUrl} ----- try count: ${i + 1}\n`
                        this.log += `GET Request`;
                        const apiCall = await axios.get(quoteUrl, options);
                        const responseQD = apiCall.data;

                        this.log += `----Response -----\n`
                        this.log += `<pre>${JSON.stringify(apiCall.data, null, 2)}</pre>`;
                        this.quoteResponseJSON = responseQD;
                        this.quoteResponseJSON.quoteId = cowbellQuoteId;
                        if(responseQD.totalPremium){
                            this.number = responseQD.quoteNumber;
                            quotePremium = responseQD.totalPremium;
                            this.quoteLink = responseQD.agencyDeepLinkURL
                            this.purchaseLink = responseQD.policyHolderDeepLinkURL

                            //check we got more then just "https://" for links
                            if(this.quoteLink === "https://"){
                                log.error(`Cowbell AppId ${appDoc.applicationId} did not return a FQN for agencyDeepLinkURL` + __location)
                                this.quoteLink = ''
                            }

                            if(this.purchaseLink === "https://"){
                                log.error(`Cowbell AppId ${appDoc.applicationId} did not return a FQN for policyHolderDeepLinkURL` + __location)
                                this.purchaseLink = ''
                            }

                            accountId = responseQD.accountId
                            this.isBindable = true
                            break;
                        }
                        if(i < NUMBER_OF_TRIES - 1){
                            await utility.Sleep(5000);
                        }
                    }

                }
                catch(err){
                    try {
                        response = err.response.data;
                        return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode} response: ${response} ${err}`, __location, {error: err});
                    }
                    catch (error2) {
                        return this.client_error(`The Cowbell returned an error code of ${err.httpStatusCode}`, __location, {error: err});
                    }
                }
                if(this.number && quotePremium){
                    // Get proposal doc...
                    //await utility.Sleep(2000);
                    const createdTS = moment(this.quoteResponseJSON.created).unix();
                    const quoteDocUrl = `${host}${basePath}/docs/v1/quote/${accountId}/proposal/${cowbellQuoteId}?createdDate=${createdTS}`;
                    //5 tries with 5 seconds waits
                    const NUMBER_OF_TRIES = 12;
                    for(let i = 0; i < NUMBER_OF_TRIES; i++){
                        try{
                            this.log += `----Get quote proposal url ${quoteDocUrl} ----- try count: ${i + 1}\n`
                            this.log += `GET Request`;
                            const apiCall = await axios.get(quoteDocUrl, options);
                            const responseQD = apiCall.data;

                            this.log += `----Response -----\n`
                            this.log += `<pre>${JSON.stringify(apiCall.data, null, 2)}</pre>`;
                            if(responseQD){
                                log.debug(`qoute doc response ${JSON.stringify(responseQD)}`)
                                const quoteProposalUrl = responseQD;
                                //call to get the doc.
                                try{
                                    const config = {
                                        "Content-Type": 'application/pdf',
                                        responseType: 'arraybuffer'
                                    };
                                    this.log += `----Get quote proposal doc url ${quoteProposalUrl} ----- \n`
                                    this.log += `GET Request`;
                                    const quoteDocResponse = await axios.get(quoteProposalUrl, config);
                                    const buff = Buffer.from(quoteDocResponse.data);
                                    this.quote_letter.data = buff.toString('base64');
                                }
                                catch(err){
                                    log.error(`Appid: ${this.app.id} Cowbell Cyber: Error getting quote proposal ${err} ` + __location)
                                }
                                break;
                            }
                        }
                        catch(err){
                            log.info(`Cowbell Qoute Proposal request error ${err}` + __location)
                        }
                        if(i < NUMBER_OF_TRIES - 1){
                            await utility.Sleep(5000);
                        }

                    }
                    return this.client_quoted(this.number, quoteLimits, quotePremium, null,null, quoteCoverages);
                }
                else {

                    return this.client_error(`The Cowbell did not return totalPremium `, __location);
                }
            }
            else if(response && response.message) {
                return this.client_declined(response.message);
                //return this.client_error(`The Cowbell returned unexpected response ${JSON.stringify(response)}`, __location);
            }
            else {
                return this.client_error(`The Cowbell returned unexpected response ${JSON.stringify(response)}`, __location);
            }


        }
        else {
            return this.client_error(`Cowbell request failure - no authToken is response `, __location);
        }

    }
};