/* eslint-disable prefer-const */
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const moment = require('moment');
const axios = require('axios');
const log = global.log;
//const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');


module.exports = class crumForesterBop extends Integration {

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

        log.debug('CrumForester GL Quote starting ' + __location)
        const appDoc = this.app.applicationDocData;

        // product array
        let policyTypeArray = [];
        policyTypeArray.push(this.policy.type.toUpperCase())


        //get primary contact
        let primaryContact = {}
        appDoc.contacts.forEach((appContact) => {
            if(appContact.primary){
                primaryContact = appContact;
            }
        });
        //look up crumForester industry Code from InsurerIndustryCode Doc attributes.
        let crumForesterClassCode = '';
        let crumForesterMajorCat = '';
        let crumForesterSubCat = '';
        if(this.insurerIndustryCode && this.insurerIndustryCode.attributes){
            crumForesterClassCode = this.insurerIndustryCode.attributes.ClassCode;
            crumForesterMajorCat = this.insurerIndustryCode.attributes.MajorCategory;
            crumForesterSubCat = this.insurerIndustryCode.attributes.SubCategory;

        }
        log.debug('this.policy.limits ' + this.policy.limits + __location)
        const requestedLimits = this.getSplitLimits(this.policy.limits);
        log.debug('requestedLimits ' + requestedLimits + __location)
        this.limits[4] = parseInt(requestedLimits[0],10);
        this.limits[8] = parseInt(requestedLimits[3],10);
        this.limits[9] = parseInt(requestedLimits[4],10);

        //leave out policyEnddate per crumForester - Defaults to yearly.
        // let submissionJSONw = {
        //     "metadata": appDoc.applicationId,
        //     "applicationTypes": policyTypeArray,
        //     "grossAnnualSales": appDoc.grossSalesAmt,
        //     "glLimit": requestedLimits[0],
        //     "glAggregateLimit": requestedLimits[3],
        //     "glAggregatePcoLimit": requestedLimits[4],
        //     "policyStartDate": this.policy.effective_date.toISOString(),
        //     //"policyEndDate": this.policy.expiration_date.toISOString(),

        //     "businessName": appDoc.businessName

        // }
        let producerArray = this.app.agencyLocation.insurers[this.insurer.id].agency_id.split("|");
        const producerName = producerArray[0];
        const producerCode = producerArray[1];

        let userArray = this.app.agencyLocation.insurers[this.insurer.id].agent_id.split("|");
        const userName = userArray[0];
        const userPwd = userArray[1];

        //get primary contact
        let submissionJSON = {
            "method": "AddNewBOPQuote",
            "quoteDetails": {"policyService": {
                "policyHeader": {
                    "serviceName": "BOPAddOrUpdatePolicy",
                    "agencyReferenceID": appDoc.applicationId,
                    "quoteNumber": appDoc.applicationId,
                    "policyNumber": appDoc.applicationId,
                    "userCredentials": {"userName": userName}
                },
                "data": {
                    "producerInfo": {
                        "name": producerName,
                        "code": producerCode,
                        "producerContactName":`${this.app.agencyLocation.first_name} ${this.app.agencyLocation.last_name}`,
                        "producerEmail":this.app.agencyLocation.agencyEmail
                    },
                    "account": {
                        "applicantBusinessType": appDoc.entityType,
                        "insuredInformation": [
                            {
                                "numberOfInsured": "1",
                                "businessName": appDoc.businessName,
                                "address1": appDoc.mailingAddress,
                                "address2": appDoc.mailingAddress2,
                                "city": appDoc.mailingCity,
                                "state": appDoc.mailingState,
                                "zipCode": appDoc.mailingZipcode,
                                "county": "",
                                "primaryPhone": appDoc.phone,
                                "applicantWebsiteUrl": appDoc.website
                            }
                        ],
                        "contactInformation": [
                            {
                                "contactName": `${primaryContact.firstName} ${primaryContact.lastName}`,
                                "contactTitle": "",
                                "contactPhone": primaryContact.phone.toString(),
                                "contactEmail": primaryContact.email
                            }
                        ],
                        "natureOfBusiness": {
                            "businessDateStarted": moment(appDoc.founded).format("YYYY-MM-DD"),
                            "descriptionOfPrimaryOperation": this.industry_code.description
                        },
                        "premises": [],
                        "otherBusinessVenture": "none"
                    },
                    "policy": {
                        "effectiveDate": this.policy.effective_date.format("YYYY-MM-DD"),
                        "expirationDate": this.policy.expiration_date.format("YYYY-MM-DD"),
                        "liablityCoverages": {
                            "liablityOccurence": requestedLimits[0].toString(),
                            "liablityAggregate": requestedLimits[3].toString(),
                            "liablityBldgLimit": "50000",
                            "medicalLimit": "300000",
                            "liablityPersonalPropertyLimit": "50000"
                        },
                        "policyID": "",
                        "quoteID": "",
                        "product": "BOP",
                        "productName": "194",
                        "term": "12",
                        "quoteNumber": "",
                        "policyNumber": "",
                        "status": "",
                        "transactionDate": moment().format("YYYY-MM-DD"),
                        "policyType": "New",
                        "writingCompany": "07",
                        "totalInsuredValuePerPolicy": "",
                        "isUWAppetiteEligible": "",
                        "triaPremium": "",
                        "termPremium": "",
                        "priorPremium": "",
                        "newPremium": ""
                    }
                },
                "acceptabilityQuestions": [],
                "isEligible": "Yes",
                "responseMessages": []
            }}
        }

        log.debug('CF Submission JSON start: ' + JSON.stringify(submissionJSON))
        //locations
        //quoteDetails.data.account.premises

        let liablityBldgLimit = 0;
        let liablityPersonalPropertyLimit = 0;
        try{
            appDoc.locations.forEach((location, index) => {
                const locationNumber = index + 1;
                let totalLocLevel = location.full_time_employees;
                let partLocLevel = location.part_time_employees;
                let total = 0;
                let part = 0;
                location.activityPayrollList.forEach((activtyCodePayroll) => {
                    activtyCodePayroll.employeeTypeList.forEach((employeeType) => {
                        if(employeeType.employeeType === "Full Time"){
                            total += employeeType.employeeTypeCount;
                        }
                        else if(employeeType.employeeType === "Part Time"){
                            part += employeeType.employeeTypeCount;
                        }
                    });

                });
                totalLocLevel = total > 0 ? total : totalLocLevel;
                partLocLevel = part > 0 ? part : partLocLevel;

                let buildingLimit = 0;
                if(location.buildingLimit){
                    buildingLimit = location.buildingLimit;
                }
                else if(this.policy.bopCoverage){
                    buildingLimit = this.policy.bopCoverage;
                }
                let bppLimit = 0
                if(location.businessPersonalPropertyLimit){
                    bppLimit = location.businessPersonalPropertyLimit
                }
                else if(this.policy.bopCoverage){
                    bppLimit = this.policy.bopCoverage;
                }
                //County look up.
                //const CountyString = '';
                let permisesJSON = {
                    "locationNumber": locationNumber.toString(),
                    "street": location.address,
                    "city": location.city,
                    "state": location.state,
                    "county": location.county,
                    "zipCode": location.zipcode,
                    "premisesFullTimeEmployee": totalLocLevel.toString(),
                    "premisesPartTimeEmployee": partLocLevel.toString(),
                    "occupancy": {
                        "majorClass": crumForesterMajorCat,
                        "subClass": crumForesterSubCat,
                        "classCode": crumForesterClassCode
                    },
                    "isBuildingOwned": location.own ? "Yes" : "No",
                    "squareFootage": location.square_footage.toString(),
                    "annualSales": appDoc.grossSalesAmt.toString(),
                    "buildingLimit": buildingLimit.toString(),
                    "businessPropertyPersonallimit": bppLimit.toString(),
                    "eligible": "1",
                    "propertyDeductible": this.policy.deductible.toString(),
                    "damageToPremisesRentedToYou": "50000"
                };
                submissionJSON.quoteDetails.policyService.data.account.premises.push(permisesJSON);
                if(buildingLimit){
                    liablityBldgLimit += buildingLimit;
                }

                if(bppLimit){
                    liablityPersonalPropertyLimit += bppLimit;
                }

            });
        }
        catch(err){
            log.error(`CrumForester API: Appid: ${this.app.id} location processing error: ${err}  ` + __location)
        }
        submissionJSON.quoteDetails.policyService.data.policy.liablityCoverages.liablityBldgLimit = liablityBldgLimit.toString();
        submissionJSON.quoteDetails.policyService.data.policy.liablityCoverages.liablityPersonalPropertyLimit = liablityPersonalPropertyLimit.toString();

        const questionsArray = [];
        for(const question_id in this.questions){
            if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                const question = this.questions[question_id];
                const cfQuestionId = this.question_identifiers[question.id];
                const questionAnswer = this.determine_question_answer(question, question.required);
                if (questionAnswer) {
                    questionsArray.push({
                        "questionId": cfQuestionId,
                        "questionResponse": questionAnswer
                    })
                }
            }
        }

        //Claims
        //let claimsArray = [];
        let bopClaimCount = 0;
        let glClaimCount = 0;
        if(appDoc.claims && appDoc.claims.length > 0){
            appDoc.claims.forEach((claim) => {
                if(claim.policyType.toUpperCase() === "BOP"){
                    bopClaimCount++;
                }
                if(claim.policyType.toUpperCase() === "GL"){
                    glClaimCount++;
                }
            });
        }
        questionsArray.push({
            "questionId": "11A",
            "questionResponse": bopClaimCount.toString()
        })

        questionsArray.push({
            "questionId": "11B",
            "questionResponse": glClaimCount.toString()
        })

        submissionJSON.quoteDetails.policyService.acceptabilityQuestions = questionsArray;

        log.debug(`CrumForester ${this.policy.type.toUpperCase()} Quote submission JSON \n ${JSON.stringify(submissionJSON)} \n ` + __location)

        //Auth.....
        // const AuthFQN = 'https://cognito-idp.us-east-1.amazonaws.com';


        const publicKey = this.app.agencyLocation.insurers[this.insurer.id].agency_id
        //call API
        let host = null;
        let path = '/dpapi/v1/quote';
        if (this.insurer.useSandbox) {
            host = 'https://api.uat.cfdigitalpartners.com';
        }
        else {
            host = 'https:/api.cfdigitalpartners.com';
            //path =` '/v1/commercial/quotes/bindable';
        }
        const urlFQN = host + path;

        //log.debug("CrumForester requeste options " + JSON.stringify(requestOptions) + __location)
        this.log += `--------======= Sending to CrumForester =======--------<br><br>`;
        this.log += `<b>Request started at ${moment().utc().toISOString()}</b><br><br>`;
        this.log += `URL: ${host}${path}<br><br>`;
        this.log += `<pre>${JSON.stringify(submissionJSON, null, 2)}</pre><br><br>`;
        this.log += `--------======= End =======--------<br><br>`;

        return this.return_result('error');

        const requestOptions = {
            headers: {
                Authorization: `token ${publicKey}`,
                "Content-Type": 'application/json'
            },
            timeout: 60000
        };

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
            log.error(`CrumForester API: Appid: ${this.app.id} API call error: ${err}  ` + __location)
            this.reasons.push(`CrumForester API Error: ${err}`);
            this.log += `--------======= CrumForester Request Error =======--------<br><br>`;
            this.log += err;
            this.log += `--------======= End =======--------<br><br>`;
        }
        if(quoteResponse){
            log.debug(`CrumForester API: Appid: ${this.app.id} response \n ${JSON.stringify(quoteResponse)} \n ` + __location)


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
                    log.error(`CrumForester API: Appid: ${this.app.id} unknown successful response ${JSON.stringify(quoteResponse)}`)
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
                log.error(`CrumForester API: Appid: ${this.app.id} unknown unsuccessful reason ${JSON.stringify(quoteResponse)}`)
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
                log.error(`Unable to parse error response from CrumForester ${this.app.id} ${apiResponse} ` + __location)
            }
            return this.return_result('error');
        }

    }
}