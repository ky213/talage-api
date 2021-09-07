/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Worker's Compensation Integration for Employers
 *
 * This integration file has answers to the following questions hard-coded in:
 * - I attest that the Insured (my client) has complied with the applicable workers' compensation laws of the states shown in Item 3.A of the policy information page, and I will maintain and make available upon request all required documentation in the Agency file.
 */

'use strict';

const Integration = require('../Integration.js');
const moment_timezone = require('moment-timezone');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

module.exports = class EmployersWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    /**
     * Formats phone number string from applicationDocData into the format desired by Employers
     *
     * @param {*} phone - Phone number of the form found in applicationDocData
     * @returns {string} - Phone number in the form: "###-###-####"
     */
    formatPhoneForEmployers(phone) {
        const phoneDigits = phone.trim().replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
            throw new Error(`Incorrect number of digits in phone number: ${phone}`);
        }
        const newPhone = [];
        newPhone.push(phoneDigits.slice(0,3));
        newPhone.push(phoneDigits.slice(3,6));
        newPhone.push(phoneDigits.slice(6,10));
        return newPhone.join('-');
    }

    formatZipCodeForEmployers(zipcode) {
        const zipDigits = zipcode.trim().replace(/\D/g, '');
        if (zipDigits.length !== 5 && zipDigits.length !== 9) {
            throw new Error(`Incorrect number of digits in zip code: ${zipcode}`);
        }
        if (zipDigits.length === 5) {
            return zipDigits;
        }
        else {
            const newZip = [];
            newZip.push(zipDigits.slice(0,5));
            newZip.push(zipDigits.slice(5));
            return newZip.join('-');
        }

    }

	/**
	 * Requests a quote from Employers and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    _insurer_quote() {
        const appDoc = this.app.applicationDocData;
        // These are the statuses returned by the insurer and how they map to our Talage statuses
        this.possible_api_responses.DECLINED = 'declined';
        this.possible_api_responses.IN_PROGRESS = 'referred';
        this.possible_api_responses.PENDING_REFERRAL = 'referred_with_price';
        this.possible_api_responses.QUOTED = 'quoted';
        this.possible_api_responses.REFERRED = 'referred';

        // These are the limits supported by Employers
        const carrierLimits = ['100000/500000/100000',
            '500000/500000/500000',
            '1000000/1000000/1000000',
            '2000000/2000000/2000000'];

        // Define how legal entities are mapped for Employers
        const entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LL',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };

        // Define how owner titles are mapped for Employers
        // Owner title codes from https://eigservices.atlassian.net/wiki/spaces/DUG/pages/1070663103/WorkCompIndividuals+Endorsement+Codes
        const ownerTitleMatrix = {
            'Chief Executive Officer': 'CE',
            'Chief Financial Officer': 'CF',
            'Chief Operating Officer': 'CO',
            'Director': 'DI',
            'Vice President': 'VP',
            'Executive Vice President': 'EV',
            'Executive Secy-VP': 'EY',
            'Executive Secretary': 'ES',
            'Treasurer': 'TR',
            'Secy-Treas': 'ST',
            'Secretary': 'SE',
            'President': 'PR',
            'Pres-VP-Secy-Treas': 'PA',
            'Pres-VP-Secy': 'PC',
            'Pres-VP': 'PV',
            'Pres-Treas': 'PE',
            'Pres-Secy-Treas': 'PS',
            'Pres-Secy': 'PY',
            'VP-Treas': 'VT',
            'VP-Secy-Treas': 'VY',
            'VP-Secy': 'VS'
        };

        // Define a list of required questions
        const required_questions = [979];

        // Build the Promise
        return new Promise(async(fulfill) => {

            // Log a warning message if there is no location state that matches the business primary state, as Employers will decline
            if (!appDoc.locations.find(location => location.state === appDoc.primaryState)) {
                log.warn(`Appid: ${this.app.id} No location matches primary state ${appDoc.primaryState}. This will likely result in an autodecline from Employers.`);
            }

            const requestJSON = {
            // Employers has us define our own Request ID
                "id": this.generate_uuid(),
                "effectiveDate": this.policy.effective_date.format('YYYY-MM-DD'),
                "expirationDate": this.policy.expiration_date.format('YYYY-MM-DD'),
                "primaryRiskState": appDoc.primaryState,
              //  "healthInsGroupId": "",
                "yearsInBusiness": this.get_years_in_business()
            };
            if(requestJSON.yearsInBusiness < 3){
                requestJSON.yearsInIndustry = appDoc.yearsOfExp
            }

            const primaryContact = appDoc.contacts.find(contact => contact.primary === true);
            const additionalContacts = appDoc.contacts.filter(contact => JSON.stringify(contact) !== JSON.stringify(primaryContact));

            try {
                requestJSON.applicantContact = {
                    "name": `${primaryContact.firstName} ${primaryContact.lastName}`,
                    "phoneNumber": this.formatPhoneForEmployers(primaryContact.phone),
                    "email": primaryContact.email,
                    "address": {
                        "streetAddress1": appDoc.mailingAddress,
                        "streetAddress2": appDoc.mailingAddress2,
                        "city": appDoc.mailingCity,
                        "state": appDoc.mailingState,
                        "zipCode": this.formatZipCodeForEmployers(appDoc.mailingZipcode)
                    },
                    "additionalContacts": additionalContacts.map(contact => ({
                            "name": `${contact.firstName} ${contact.lastName}`,
                            "phoneNumber": this.formatPhoneForEmployers(contact.phone),
                            "email": contact.email,
                            "address": {
                            "streetAddress1": "",
                            "streetAddress2": "",
                            "city": "",
                            "state": "",
                            "zipCode": ""
                            },
                            "roles": [
                            ]
                        }))
                };
            }
            catch (err) {
                log.error(`Employers WC: Appid: ${this.app.id} Problem creating quote request: ${err} ` + __location);
                this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} Problem creating quote request: ${err}`);
                fulfill(this.return_result('autodeclined'));
                return;
            }

            requestJSON.billingContact = {
                "name": `${primaryContact.firstName} ${primaryContact.lastName}`,
                "phoneNumber": this.formatPhoneForEmployers(primaryContact.phone),
                "email": primaryContact.email,
                "address": {
                    "streetAddress1": appDoc.mailingAddress,
                    "streetAddress2": appDoc.mailingAddress2,
                    "city": appDoc.mailingCity,
                    "state": appDoc.mailingState,
                    "zipCode": this.formatZipCodeForEmployers(appDoc.mailingZipcode)
                }
            };

            requestJSON.proposalContact = {
                "name": `${primaryContact.firstName} ${primaryContact.lastName}`,
                "phoneNumber": this.formatPhoneForEmployers(primaryContact.phone),
                "email": primaryContact.email,
                "address": {
                    "streetAddress1": appDoc.mailingAddress,
                    "streetAddress2": appDoc.mailingAddress2,
                    "city": appDoc.mailingCity,
                    "state": appDoc.mailingState,
                    "zipCode": this.formatZipCodeForEmployers(appDoc.mailingZipcode)
                }
            };
            //We use the Agency Code (Entered in AP) only send the agencyCode so not to trigger secondary employer search
            requestJSON.agency = {"agencyCode": this.app.agencyLocation.insurers[this.insurer.id].agencyId};

              //Just use the customerNumber for the agent, so not to trigger Employers secondary look up.
            requestJSON.agent = {"customerNumber": this.app.agencyLocation.insurers[this.insurer.id].agencyId + "-" + this.app.agencyLocation.insurers[this.insurer.id].agentId};

            const association = this.app.agencyLocation.business.association;
            const associationMembershipId = this.app.agencyLocation.business.association_id;
            if (association && association !== "None" && associationMembershipId) {
                requestJSON.association = {
                    "associationCode": this.app.agencyLocation.business.association,
                    "membershipId": this.app.agencyLocation.business.association_id
                }
            }

            // Ensure this entity type is in the entity matrix above
            if (!(appDoc.entityType in entityMatrix)) {
                log.error(`Appid: ${this.app.id} autodeclined: no limits  ${this.insurer.name} does not support the selected entity type ${this.entity_code} ` + __location)
                this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} does not support the selected entity type`);
                // What happens if we need it.  We want the insurer to decline vs killing it ourselves.
                fulfill(this.return_result('autodeclined'));
                return;
            }

            const locations = [];
            //If there is only one location make sure it is marked as primary.  Old apps used in renewal may not have it marked.
            if(appDoc.locations?.length === 1 && appDoc.locations[0].primary !== true){
                appDoc.locations[0].primary = true;
            }
            appDoc.locations.forEach(location => {
                const locationJSON = {
                    "primary": location.primary,
                    "businessName": appDoc.businessName.substring(0,60).replace('&', ''),
                    "taxPayerId": appDoc.ein,
                    "unemploymentId": location.unemploymentId ? location.unemploymentId : 0,
                    "numberOfEmployees": location.full_time_employees + location.part_time_employees,
                    "shift1EmployeesCount": location.full_time_employees + location.part_time_employees,
                    "shift2EmployeesCount": 0,
                    "shift3EmployeesCount": 0,
                    "address": {
                        "streetAddress1": location.address.length > 300 ? location.address.substring(0,299) : location.address,
                        "streetAddress2": location.address2,
                        "city": location.city,
                        "state": location.state,
                        "zipCode": this.formatZipCodeForEmployers(location.zipcode)
                    },
                    "owners": appDoc.owners.map(owner => {
                        const ownerObj = {
                        "firstName": owner.fname,
                        "lastName": owner.lname,
                        "isIncluded": owner.include,
                        "ownershipPercent": owner.ownership,
                        "ownershipSalary": owner.payroll
                        };
                        const ownerTitle = ownerTitleMatrix[owner.officerTitle];
                        ownerObj.ownerTitle = {"code": ownerTitle ? ownerTitle : ""}
                        return ownerObj;
                        }),
                    "rateClasses": location.activityPayrollList.map(activityCode => ({
                        "classCode": this.insurer_wc_codes[location.state + activityCode.activityCodeId],
                        "payrollAmount": activityCode.payroll
                        }))
                    };

                    locations.push(locationJSON);
            })

            requestJSON.namedInsureds = [
                {
                  "name": appDoc.businessName.substring(0,60).replace('&', ''),
                  "fein": appDoc.ein,
                  "legalEntity": {"code": entityMatrix[appDoc.entityType]},
                  "locations": locations
                }
            ];

            // Prepare limits
            const bestLimits = this.getBestLimits(carrierLimits);
            if (!bestLimits) {
                log.warn(`Appid: ${this.app.id} autodeclined: no best limits  ${this.insurer.name} does not support the requested liability limits ` + __location);
                this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} does not support the requested liability limits`);
                fulfill(this.return_result('autodeclined'));
                return;
            }

            requestJSON.wcelCoverageLimits = {
                "claimLimit": bestLimits[0],
                "employeeLimit": bestLimits[2],
                "policyLimit": bestLimits[1]
            };

            // Prepare claims by year
            let claimsByYear = null;
            if (this.policy.claims.length > 0) {
                // Get the claims organized by year
                claimsByYear = this.claims_to_policy_years();
            }
            requestJSON.priorLosses = [];
            if (claimsByYear) {
                for (let i = 1; i <= 4; i++){ // Employers wants at most 4 years of prior losses
                    const claimYear = claimsByYear[i];
                    if (claimYear) {
                        requestJSON.priorLosses.push({
                            "effectiveDate": claimYear.effective_date.format("YYYY-MM-DD"),
                            "numberOfClaims": claimYear.count,
                            "numberOfLostTimeClaims": 0,
                            "amountPaidAndReserved": claimYear.amountPaid + claimYear.amountReserved
                        })
                    }
                }
            }

            requestJSON.disclaimers = [];

            // Prepare questions

            const validQuestions = [];
            //This needs to flip to be loop on talagequestions not insurer questions.
            // currently Logic does not allow multiple insurer questions to be mapped to one talage question.
            for (const question_id in this.questions) {
                if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                    const question = this.questions[question_id];

                    // Don't process questions without a code (not for this insurer)
                    const questionCode = this.question_identifiers[question.id];
                    if (!questionCode) {
                        continue;
                    }

                    // For Yes/No questions, if they are not required and the user answered 'No', simply don't send them
                    if (!required_questions.includes(question.id) && question.type !== 'Yes/No' && !question.hidden && !question.required && !question.get_answer_as_boolean()) {
                        continue;
                    }

                    // Do not add disclaimer question to questions. Put it in the disclaimers property instead
                    if (questionCode === 'OOEA') {
                        requestJSON.disclaimers.push({
                                "disclaimerCode": questionCode,
                                "stateCode": appDoc.primaryState,
                                "affirmed": this.determine_question_answer(question, true) === "Yes"
                            });
                        continue;
                    }

                    // Get the answer
                    let answer = '';
                    try {
                        answer = this.determine_question_answer(question, required_questions.includes(question.id));
                    }
                    catch (error) {
                        log.error(`Appid: ${this.app.id} Employers WC: Unable to determine answer for question ${question.id} error: ${error} ` + __location)
                        this.reasons.push(`Unable to determine answer for question ${question.id}`);
                       // fulfill(this.return_result('error'));
                       // return;
                    }

                    // This question was not answered
                    if (!answer) {
                        continue;
                    }
                    let goodQuestion = true
                    // Ensure the question is only yes/no at this point
                    if (question.type !== 'Yes/No') {
                        goodQuestion = false
                        //More information in the log talageQuestionId and insurerquesiton id.
                        log.error(`Appid: ${this.app.id}Employers WC: Unknown question type supported. Employers only has Yes/No. ` + __location)
                        //this.reasons.push('Unknown question type supported. Employers only has Yes/No.');
                        // Do not stop quoting over a single question.  Make insurer decline or referr it.
                        // Do not add question to the submission either.
                        // Mapping is bad. just log it so mapping team can fix it.
                        // fulfill(this.return_result('error'));
                        // return;
                    }
                    if(goodQuestion){
                        // Save this as an answered question
                        validQuestions.push({
                            code: questionCode,
                            entry: question
                        });
                    }
                }
            }
            //Why this unstead of building array in the question loop
            requestJSON.questions = validQuestions.map(question => ({
                "questionCode": question.code,
                "value": question.entry.get_answer_as_boolean() ? 'YES' : 'NO'
            }))

            //call API
            let host = null;
            if (this.insurer.useSandbox) {
                host = 'api-qa.employers.com';
            }
            else {
                host = 'api.employers.com';
            }
            const path = '/DigitalAgencyServices/quote';

            const additionalHeaders = {
                    appKey: this.username,
                    appToken: this.password
                };

            this.log += `--------======= Sending to Employers =======--------<br><br>`;
            this.log += `<b>Request started at ${moment_timezone().utc().toISOString()}</b><br><br>`;
            this.log += `URL: ${host}${path}<br><br>`;
            this.log += `<pre>${JSON.stringify(requestJSON, null, 2)}</pre><br><br>`;
            this.log += `--------======= End =======--------<br><br>`;

            let quoteResponse = null;
            log.info(`Appid: ${this.app.id} Sending application to ${host}${path}. Remember to connect to the VPN. This can take up to 30 seconds.`);
            try {
                quoteResponse = await this.send_json_request(host, path, JSON.stringify(requestJSON), additionalHeaders, 'POST', true, true);
            }
            catch (err) {
                log.error(`Employers API: Appid: ${this.app.id} API call error: ${err}  ` + __location);
                this.reasons.push(`Employers API Error: ${err}`);
                this.log += `--------======= Employers Request Error =======--------<br><br>`;
                this.log += err;
                this.log += `--------======= End =======--------<br><br>`;

            }

            if (!quoteResponse || !quoteResponse.success) {
                this.reasons.push(`Insurer returned status: ${quoteResponse.status}`);
                if (quoteResponse.errors) {
                    // quoteResponse.errors array also contains info and warnings. Get the actual errors which can make a quote fail
                    const failingQuoteErrors = quoteResponse.errors.filter(error => {
                        const failingQuoteErrorCodes = ['required',
                                                        'invalid',
                                                        'error'];
                        const errorCode = error.code.split('.')[1];
                        return failingQuoteErrorCodes.includes(errorCode);
                    });
                    failingQuoteErrors.forEach(error => {
                        let errorMessage = "";
                        if (error.message) {
                            errorMessage += error.message;
                        }
                        if (error.fieldValue) {
                            errorMessage += ` : ${error.fieldValue}`;
                        }
                        this.reasons.push(errorMessage);
                    });
                }
                fulfill(this.return_result('declined'));
            }

            // Attempt to get the policy number
            if (quoteResponse.policyNumber) {
                this.number = quoteResponse.policyNumber;
            }
            else {
                log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find policy number.` + __location);
            }

            // Attempt to get the amount of the quote
            const premium = quoteResponse.totalPremium;
            if (premium){
                if (typeof premium === 'number') {
                    this.amount = quoteResponse.totalPremium;
                }
                else {
                    log.error(`Appid: ${this.app.id} Employers WC: Quote premium value in quote reponse is not of type 'number' but instead ${typeof premium}`)
                }
            }

            if (quoteResponse.wcelCoverageLimits) {
                this.limits[1] = quoteResponse.wcelCoverageLimits.claimLimit;
                this.limits[2] = quoteResponse.wcelCoverageLimits.policyLimit;
                this.limits[3] = quoteResponse.wcelCoverageLimits.employeeLimit;
            } // If no limits, this is handled in return_result()

            const status = quoteResponse.status;
            try {
                this.writer = quoteResponse.writingCompany;
            }
            catch (err) {
                if (status === 'QUOTED' || status === 'PENDING_REFER') {
                    log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find writing company.` + __location);
                }
            }

            try {
                const quoteLetter = quoteResponse.attachments.find(attachment => attachment.attachmentType === "QuoteLetter");
                if (quoteLetter) {
                    this.quote_letter = {
                        content_type: quoteLetter.contentType,
                        data: quoteLetter.contentBody,
                        file_name: quoteLetter.contentDisposition.match(/"(.*)"/)[1],
                        length: quoteLetter.contentLength
                    }
                }
            }
            catch (err) {
                if (status === 'QUOTED') {
                    log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Changed how it returns the quote letter.` + __location);
                }
            }

            // Grab the reasons
            try {
                quoteResponse.errors.forEach(error => `${error.code} - ${error.message}`)
            }
            catch (err) {
                if (status === 'IN_PROGRESS') {
                    log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to grab reasons.` + __location);
                }
            }

            if (status === `QUOTED`) {
                this.isBindable = true
            }

            fulfill(this.return_result(status));
        });
    }
};