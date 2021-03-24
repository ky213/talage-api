/* eslint multiline-comment-style: 0 */

/**
 * Workers Compensation Policy Integration for Pie
 *
 * Note: Owner Officer information is currently being omitted because we don't have the ownership percentage or birthdate
 */

const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const axios = require('axios');
const moment = require('moment');
const fs = require('fs');




module.exports = class PieWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    /**
	 * Requests a quote from Pie and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        // These are the statuses returned by the insurer and how they map to our Talage statuses
        /*
		This.possible_api_responses.Accept = 'quoted';
		this.possible_api_responses.Refer = 'referred';
		this.possible_api_responses.Reject = 'declined';
		*/
        const appDoc = this.app.applicationDocData;
        // These are the limits supported by Pie
        const carrierLimits = ['100000/500000/100000',
            '500000/500000/500000',
            '1000000/1000000/1000000'];

        // An association list tying the Talage entity list (left) to the codes used by this insurer (right)
        const entityMatrix = {
            Association: 'AssociationLaborUnionReligiousOrganization',
            Corporation: 'Corporation',
            'Joint Venture': 'JointVenture',
            'Limited Liability Company': 'LimitedLiabilityCompany',
            'Limited Liability Partnership': 'LimitedLiabilityPartnership',
            'Limited Partnership': 'LimitedPartnership',
            Other: 'Other',
            Partnership: 'Partnership',
            'Sole Proprietorship': 'Individual',
            'Trust - For Profit': 'TrustOrEstate',
            'Trust - Non-Profit': 'TrustOrEstate'
        };

        // Map the lapse reason question answer to the JSON enum value
        const lapseInCoverageReasonMap = {
            "Non-Payment": "NonPayment",
            "Audit Non-compliance": "AuditNonCompliance",
            "No Employees": "NoEmployees",
            "New Business": "NewBusiness",
            "Other": "Other"
        };

        // Determine which URL to use
        let host = '';
        if (this.insurer.useSandbox) {
            host = 'api.post-prod.pieinsurance.com';
        }
        else {
            host = 'api.pieinsurance.com';
        }

        // Prepare limits
        const limits = this.getBestLimits(carrierLimits);
        if (!limits) {
            log.warn(`Appid: ${this.app.id} autodeclined: no limits  ${this.insurer.name} does not support the requested liability limits ` + __location)
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // If the user want's owners included, Pie cannot write it
        if (this.app.business.owners_included) {
            log.info(`Appid: ${this.app.id} autodeclined: Pie does not support owners being included in a WC policy at this time. ` + __location)
            this.reasons.push(`Pie does not support owners being included in a WC policy at this time.`);
            return this.return_result('autodeclined');
        }

        let token_response = null;
        try {
            const headers = {auth: {
                username: this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                password: this.app.agencyLocation.insurers[this.insurer.id].agent_id
            }};
            //token_response = await this.send_request(host, '/oauth2/token', "", headers);
            token_response = await axios.post(`https://${host}/oauth2/token`, null, headers);
        }
        catch (err) {
            log.error(`Appid: ${this.app.id} Pie WC ERROR: Get token error ${err}` + __location)
            return this.return_result('error');
        }

        if(!token_response.data){
            log.error(`Appid: ${this.app.id} Pie WC ERROR: Get token error no response data` + __location)
            return this.return_result('error');
        }

        const token = `${token_response.data.token_type} ${token_response.data.id_token}`;

        // Get all territories present in this appilcation
        const territories = this.app.business.getTerritories();

        // Build the JSON Request
        const data = {};
        data.effectiveDate = this.policy.effective_date.format('YYYY-MM-DD');
        data.expirationDate = this.policy.expiration_date.format('YYYY-MM-DD');

        // Begin the 'workersCompensation' data object
        data.workersCompensation = {};

        // Custom coverage and lapse reason questions
        const coverageQuestions = {
            PieCustomWCCurrentCoverage: "Yes",
            PieCustomWCCurrentCoverageReason: "",
            PieCustomWCCurrentCoverageReasonOther: null,
            PieCustomWCContinuousCoverage: "Yes",
            PieCustomWCContinuousCoverage1Year: "No",
            PieCustomWCContinuousCoverage2Year: "No",
            PieCustomWCContinuousCoverage3Year: "No",
            PieCustomWCPaymentLapse: "No",
            PieCustomWCPaymentLapse1Year: "No",
            PieCustomWCPaymentLapse1YearReason: "",
            PieCustomWCPaymentLapse1YearReasonOther: null,
            PieCustomWCPaymentLapse2Year: "No",
            PieCustomWCPaymentLapse2YearReason: "",
            PieCustomWCPaymentLapse2YearReasonOther: null,
            PieCustomWCPaymentLapse3Year: "No",
            PieCustomWCPaymentLapse3YearReason: "",
            PieCustomWCPaymentLapse3YearReasonOther: null
        };
        const coverageQuestionsIdentifierList = Object.keys(coverageQuestions);
        const coverageQuestionsTalageIdList = [];
        for (const talageQuestionId in this.questions) {
            if (this.question_identifiers.hasOwnProperty(talageQuestionId) && this.questions.hasOwnProperty(talageQuestionId)) {
                const questionInsuranceIdentifier = this.question_identifiers[talageQuestionId];
                if (coverageQuestionsIdentifierList.includes(questionInsuranceIdentifier)) {
                    const questionAnswer = this.determine_question_answer(this.questions[talageQuestionId]);
                    if (questionAnswer) {
                        coverageQuestions[questionInsuranceIdentifier] = questionAnswer;
                    }
                    coverageQuestionsTalageIdList.push(talageQuestionId);
                }
            }
        }
        // Remove the coverage questions from the questions list. We can't do it above because we can't remove parent questions before child question
        // visibility is checked. After this point, only carrier-sent
        for (const coverageQuestionsTalageId of coverageQuestionsTalageIdList) {
            delete this.questions[coverageQuestionsTalageId];
        }

        // Determine business age in months
        let businessAgeInMonths = 0;
        if (this.app.applicationDocData.founded) {
            try {
                const foundingDate = new moment(this.app.applicationDocData.founded);
                const now = new moment();
                businessAgeInMonths = now.diff(foundingDate, 'months', true);
            }
            catch (err) {
                log.error(`Appid: ${this.app.id} Pie WC ERROR: Calculating Age ${err}` + __location)
            }
        }

        const isNewCompany = businessAgeInMonths < 2;
        // Determine if they are currently covered.
        data.workersCompensation.currentlyCovered = coverageQuestions.PieCustomWCCurrentCoverage === 'Yes';
        if (data.workersCompensation.currentlyCovered === false) {
            // Determine if this is a new company.
            // [ NonPayment, AuditNonCompliance, NoEmployees, Other, NewBusiness ]
            if (isNewCompany) {
                // If it is a new company, set it to "NewBusiness" regardless of what they chose
                data.workersCompensation.notCurrentlyCoveredReason = "NewBusiness";
            }
            else if (lapseInCoverageReasonMap.hasOwnProperty(coverageQuestions.PieCustomWCCurrentCoverageReason)) {
                // If they chose a reason and it exists, use it. null description is valid.
                data.workersCompensation.notCurrentlyCoveredReason = lapseInCoverageReasonMap[coverageQuestions.PieCustomWCCurrentCoverageReason];
                data.workersCompensation.notCurrentlyCoveredDescription = coverageQuestions.PieCustomWCCurrentCoverageReasonOther;
            }
            else {
                // Fall back to "Other" if no valid response.
                data.workersCompensation.notCurrentlyCoveredReason = "Other";
            }
        }

        // Begin the 'legalEntities' data object
        data.workersCompensation.legalEntities = [];

        // We only ever want one legal entity, so let's start building that
        data.workersCompensation.legalEntities[0] = {};

        data.workersCompensation.legalEntities[0].businessType = entityMatrix[this.app.business.entity_type];
        data.workersCompensation.legalEntities[0].states = [];
        // Create an object for each state
        for (const territory_index in territories) {
            if (Object.prototype.hasOwnProperty.call(territories, territory_index)) {
                const territory = territories[territory_index];
                const state_object = {};
                let unemployment_number = false;

                state_object.code = territory;

                // Experience Modifier
                const experienceModification = {};
                // Check if experience modifier exists and is a number
                if (this.app.applicationDocData.experienceModifier && typeof this.app.applicationDocData.experienceModifier === 'number') {
                    experienceModification.factor = this.app.applicationDocData.experienceModifier;
                }
                if (this.app.business.bureau_number) {
                    experienceModification.riskId = this.app.business.bureau_number;
                }
                // Check if experienceModification has at least one property
                if (Object.keys(experienceModification).length) {
                    state_object.experienceModification = experienceModification;
                }

                // All of the locations in this state
                let mailing_address_found = false;
                state_object.locations = [];
                for (const loc_index in this.app.business.locations) {
                    if (Object.prototype.hasOwnProperty.call(this.app.business.locations, loc_index)) {
                        const loc = this.app.business.locations[loc_index];
                        if (loc.territory === territory) {
                            const location_object = {};

                            // Check if there was an unemployment number, and if there was, save it for later
                            if (loc.unemployment_number) {
                                unemployment_number = loc.unemployment_number;
                            }

                            // Address
                            location_object.address = {};
                            location_object.address.state = loc.territory;
                            location_object.address.country = 'US';
                            location_object.address.line1 = loc.address;
                            if (loc.address2) {
                                location_object.address.line2 = loc.address2;
                            }
                            location_object.address.city = loc.city;
                            location_object.address.zip = loc.zip;

                            // Exposures
                            location_object.exposure = [];
                            for (const activity_code_index in loc.activity_codes) {
                                if (Object.prototype.hasOwnProperty.call(loc.activity_codes, activity_code_index)) {
                                    const activity_code = loc.activity_codes[activity_code_index];
                                    const exposure_object = {};
                                    exposure_object.payroll = activity_code.payroll;
                                    exposure_object.class = this.insurer_wc_codes[loc.territory + activity_code.id];

                                    // Append this exposure to the location
                                    location_object.exposure.push(exposure_object);
                                }
                            }

                            // Officers
                            location_object.officers = [];
                            for (const ownerJson of appDoc.owners) {
                                const officer = {};
                                officer.name = ownerJson.fname + " " + ownerJson.lname;
                                officer.ownershipPercentage = ownerJson.ownership / 100;
                                const officeBirthDate = moment(ownerJson.birthdate)
                                officer.birthDate = officeBirthDate.format("YYYY-MM-DD")
                                // Append this officer to the location
                                location_object.officers.push(officer);
                            }

                            location_object.fullTimeEmployeeCount = loc.full_time_employees;
                            location_object.partTimeEmployeeCount = loc.part_time_employees;
                            if (loc.address === this.app.business.mailing_address) {
                                location_object.mailingAddress = true;
                                mailing_address_found = true;
                            }
                            else {
                                location_object.mailingAddress = false;
                            }

                            // Append the location object to the locations array
                            state_object.locations.push(location_object);
                        }
                    }
                }

                // Hande the mailing address if different from the locations above
                if (!mailing_address_found) {
                    const address = {
                        city: this.app.business.mailing_city,
                        country: 'US',
                        line1: this.app.business.mailing_address,
                        state: this.app.business.mailing_territory,
                        zip: this.app.business.mailing_zip
                    };

                    if (this.app.business.mailing_address2) {
                        address.line2 = this.app.business.mailing_address2;
                    }

                    state_object.locations.push({
                        address: address,
                        mailingAddress: true
                    });
                }

                // Unemployment Number
                if (unemployment_number) {
                    state_object.uian = unemployment_number;
                }

                // Find Workers Comp policy
                const workersCompPolicy = this.app.applicationDocData.policies.find(({policyType}) => policyType === 'WC');
                // Check if blanket waiver exists in the workers comp policy
                if (workersCompPolicy && Object.prototype.hasOwnProperty.call(workersCompPolicy, 'blanketWaiver')) {
                    state_object.blanketWaiver = workersCompPolicy.blanketWaiver;
                }

                // Append the state into the states array
                data.workersCompensation.legalEntities[0].states.push(state_object);

            }
        }

        data.workersCompensation.legalEntities[0].name = this.app.business.name;
        if (this.app.business.dba) {
            data.workersCompensation.legalEntities[0].doingBusinessAs = [this.app.business.dba];
        }
        data.workersCompensation.legalEntities[0].taxId = this.app.business.locations[0].identification_number;

        // Limits
        data.workersCompensation.employersLiability = {};
        data.workersCompensation.employersLiability.eachAccident = limits[0];
        data.workersCompensation.employersLiability.eachEmployee = limits[2];
        data.workersCompensation.employersLiability.eachPolicy = limits[1];

        // Territories
        data.workersCompensation.otherStates = territories;

        // Contacts
        data.contacts = [];
        for (const contact_index in this.app.business.contacts) {
            if (Object.prototype.hasOwnProperty.call(this.app.business.contacts, contact_index)) {
                const contact = this.app.business.contacts[contact_index];
                const contact_object = {};
                const phone = contact.phone.toString();

                contact_object.type = 'Client';
                contact_object.firstName = contact.first_name;
                contact_object.lastName = contact.last_name;
                contact_object.phone = `${phone.substring(0, 3)}-${phone.substring(3, 6)}-${phone.substring(phone.length - 4)}`;
                contact_object.email = contact.email;

                // Append the contact to the contacts array
                data.contacts.push(contact_object);
            }
        }

        const questionsArray = [];
        for(const question_id in this.questions){
            if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                const question = this.questions[question_id];
                const pieQuestionId = this.question_identifiers[question.id];
                const questionAnswer = this.determine_question_answer(question, question.required);
                if (questionAnswer) {
                    questionsArray.push({
                        "id": pieQuestionId,
                        "answer": questionAnswer
                    })
                }
            }
        }

        data.eligibilityAnswers = questionsArray;

        data.namedInsured = this.app.business.name;
        data.description = this.get_operation_description();
        data.customerKey = this.app.id;
        data.partnerAgentIsAdmin = false;
        data.partnerAgentFirstName = 'Adam';
        data.partnerAgentLastName = 'Kiefer';
        data.partnerAgentEmail = 'customersuccess@talageins.com';

        // Prior carriers
        if (isNewCompany === false) {
            data.workersCompensation.priorCarriers = [];
            const claims = this.claims_to_policy_years();
            for (let i = 1; i < 4; i++) {
                // Check if they had coverage and were in business XX monthsago. If so, populate a prior coverage entry, including any claim information
                const hadCoverage = coverageQuestions.PieCustomWCContinuousCoverage === 'Yes' || coverageQuestions[`PieCustomWCContinuousCoverage${i}Year`] === 'Yes';
                if (hadCoverage && businessAgeInMonths > 12 * (i - 1)) {
                    const hadLapse = coverageQuestions[`PieCustomWCPaymentLapse${i}Year`] === 'Yes';

                    const priorCarrier = {
                        name: "Unknown", // Placeholder: this isn't currently captured anywhere, but Pie said it was ok -SF
                        effectiveDate: claims[i].effective_date.format("YYYY-MM-DD"),
                        expirationDate: claims[i].expiration_date.format("YYYY-MM-DD"),
                        nonZeroClaimCount: claims[i].nonzeroPaidCount,
                        zeroClaimCount: claims[i].zeroPaidCount,
                        amountPaid: claims[i].amountPaid,
                        amountReserved: claims[i].amountReserved,
                        lapseInPeriod: hadLapse
                        // Optional property
                        // amountIncurred:
                    };
                    if (hadLapse) {
                        priorCarrier.lapseReason = lapseInCoverageReasonMap[coverageQuestions[`PieCustomWCPaymentLapse${i}YearReason`]];
                        priorCarrier.lapseReasonDescription = coverageQuestions[`PieCustomWCPaymentLapse${i}YearReasonOther`];
                    }
                    data.workersCompensation.priorCarriers.push(priorCarrier);
                }
            }
        }

        // eslint-disable-next-line prefer-const
        let address = {};

        address.country = 'US';
        address.line1 = appDoc.mailingAddress;
        if (appDoc.mailingAddress2) {
            address.line2 = appDoc.mailingAddress2;
        }
        address.city = appDoc.mailingCity;
        address.state = appDoc.mailingState;
        address.zip = appDoc.mailingZipcode;

        data.mailingAddress = address;

        // Send JSON to the insurer
        let res = null;

        try {
            res = await this.send_json_request(host, '/api/v1/Quotes', JSON.stringify(data), {Authorization: token});
        }
        catch (error) {
            if(error.httpStatusCode === 400 && error.response){
                log.error(`Appid: ${this.app.id} Pie WC BAD Request: Error  ${error} ` + __location)
                try{
                    res = JSON.parse(error.response);
                }
                catch(e){
                    log.error(`Appid: ${this.app.id} Pie error parsing error response: Error  ${error} ` + __location)
                }
            }
            else {
                log.error(`Appid: ${this.app.id} Pie WC Request: Error  ${error} ` + __location)
                return this.return_result('error');
            }
        }

        //check for return not error
        if(res.bindStatus){
            if(res.bindStatus === "Quotable" || res.bindStatus === "Refer"){
                //Check for Declines

                // Pie only returns indications
                // this.indication = true;

                // Attempt to get the quote number
                if(res.id){
                    this.request_id = res.id;
                    this.number = res.id;
                }
                else {
                    log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find quote number.` + __location);
                }

                // Attempt to get the amount of the quote
                if (res.premiumDetails.totalEstimatedPremium){
                    try {
                        this.amount = parseInt(res.premiumDetails.totalEstimatedPremium, 10);
                        // Per Pie we should add totalTaxesAndAssessments to the amount we show.
                        if(res.premiumDetails.totalTaxesAndAssessments){
                            this.amount += parseInt(res.premiumDetails.totalTaxesAndAssessments, 10);
                        }
                    }
                    catch (error) {
                        log.error(`Appid: ${this.app.id} Pie WC: Error getting amount ${error} ` + __location)
                        //return this.return_result('error');
                    }
                }
                else if (res.bindStatus === "Quotable") {
                    log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find Premium from Quote.` + __location);
                }


                // Attempt to grab the limits info
                if(res.employersLiabilityLimits){
                    try {
                        for (const limit_name in res.employersLiabilityLimits) {
                            if (Object.prototype.hasOwnProperty.call(res.employersLiabilityLimits, limit_name)) {
                                const limit = res.employersLiabilityLimits[limit_name];

                                switch (limit_name) {
                                    case 'eachAccident':
                                        this.limits[1] = limit;
                                        break;
                                    case 'eachEmployee':
                                        this.limits[2] = limit;
                                        break;
                                    case 'eachPolicy':
                                        this.limits[3] = limit;
                                        break;
                                    default:
                                        log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Unexpected limit found in response` + __location);
                                        return this.return_result('error');
                                }
                            }
                        }
                    }
                    catch (e) {
                        log.error(`Appid: ${this.app.id} Pie WC: Error getting limit ${e} ` + __location)
                        return this.return_result('error');
                    }
                }
                else if (res.bindStatus === "Quotable") {
                    log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find limits from Quote.` + __location);
                }

                // Grab the writing company
                if(res.insuranceCompany){
                    this.writer = res.insuranceCompany;
                }
                else {
                    log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find writing company.` + __location);
                }


                // Dirty? (Indicates a Valen outage)
                if (res.isDirty) {
                    this.reasons.push('Valen is Down: Quote generated during a Valen outage are less likely to go unrevised by Underwriting.');
                }
                // Send the result of the request
                if(res.bindStatus === "Quotable"){

                    const config = {
                        "Content-Type": 'application/pdf',
                        headers: {Authorization: `${token}`},
                        responseType: 'arraybuffer'
                    };
                    try{
                        const quoteDocResponse = await axios.get(`https://${host}/api/v1/QuotePDF/${this.number}`, config);
                        const buff = Buffer.from(quoteDocResponse.data);
                        this.quote_letter.data = buff.toString('base64');
                    }
                    catch(err){
                        log.error(`Appid: ${this.app.id} Pie WC: Error getting quote doc ${err} ` + __location)
                    }


                    return this.return_result('quoted');
                }
                else {
                    //loop referReasons
                    this.processReason(res.referReasons)
                    return this.return_result('referred');
                }
            }
            else if(res.bindStatus === "Decline"){
                //loop declineReasons
                this.processReason(res.declineReasons)

                return this.return_result('declined');
            }
            else {
                this.reasons.push("unknown or missing bindStatus from Pie");
                return this.return_result('declined');
            }
        }
        else if (res.errors){
            if(res.title){
                this.reasons.push(res.title);
            }
            //loop res.errors
            // eslint-disable-next-line guard-for-in
            for(const errorReason in res.errors){
                this.reasons.push("PIE: " + errorReason);
                this.processReason(res.errors[errorReason])
            }
            this.processReason(res.errors)

            return this.return_result('declined');
        }
        else {
            this.reasons.push("unknown response from Pie");
            return this.return_result('declined');
        }
    }

    async getQuoteLetter(pieQuoteId, host, token){
        //this.quote_letter.data;
        const config = {headers: {Authorization: `Bearer ${token}`}};
        try{
            const quoteDocResponse = await axios.get(`https://${host}/oauth2/token`, config);
            this.quote_letter.data = quoteDocResponse;
        }
        catch(err){
            log.error(`Appid: ${this.app.id} Pie WC: Error getting quote doc ${err} ` + __location)
        }


    }


    processReason(reasonArray){
        log.debug("IN Processing PIE reason: " + reasonArray + __location)
        if(reasonArray && Array.isArray(reasonArray)){
            for(let i = 0; i < reasonArray.length; i++){
                const reason = reasonArray[i]
                log.debug("Adding PIE reason: " + reason + __location)
                this.reasons.push("PIE: " + reason);
            }
        }
    }
};