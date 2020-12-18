/* eslint-disable brace-style */
/* eslint indent: 0 */
/* eslint multiline-comment-style: 0 */

/**
 * Workers Compensation Policy Integration for Pie
 *
 * Note: Owner Officer information is currently being omitted because we don't have the ownership percentage or birthdate
 */

'use strict';

const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const axios = require('axios');
const moment = require('moment');


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

        // Determine which URL to use
        let host = '';
        if (this.insurer.useSandbox) {
            host = 'api.post-prod.pieinsurance.com';
        } else {
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
        // "clientId": "2esslhgcdg3olble0hc8g5jb1q",
        // "clientSecret": "14ae6f52aij7ebnaircrpvs3uc18p4vgpf3pg5mj8lgcdfsi5qql"

        let token_response = null;
        try {
            const headers = {auth: {
                username: '2esslhgcdg3olble0hc8g5jb1q',
                password: '14ae6f52aij7ebnaircrpvs3uc18p4vgpf3pg5mj8lgcdfsi5qql'
            }};
            //token_response = await this.send_request(host, '/oauth2/token', "", headers);
            token_response = await axios.post(`https://${host}/oauth2/token`, null, headers);
        } catch (err) {
            log.error(`Appid: ${this.app.id} Pie WC ERROR: Get token error ${err}` + __location)
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

        data.workersCompensation.currentlyCovered = !this.policy.coverage_lapse;
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
                state_object.experienceModification = {};
                state_object.experienceModification.factor = this.app.business.experience_modifier;
                if (this.app.business.bureau_number) {
                    state_object.experienceModification.riskId = this.app.business.bureau_number;
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
                            } else {
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

                // Waiver of Subrogation
                state_object.blanketWaiver = false;

                //

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

        // Claims
        if (this.policy.claims.length) {
            data.workersCompensation.lossHistory = [];

            for (const claim_index in this.policy.claims) {
                if (Object.prototype.hasOwnProperty.call(this.policy.claims, claim_index)) {
                    const claim = this.policy.claims[claim_index];
                    const loss_object = {};

                    loss_object.data = claim.date.format('YYYY-MM-DD');

                    // Append the loss to the loss history
                    data.workersCompensation.lossHistory.push(loss_object);
                }
            }
        }

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


        // eslint-disable-next-line prefer-const
        let questionsArray = [];

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
            log.debug('');
            log.debug(JSON.stringify(data, null, 4));
            log.debug('')
            log.debug('this.questions:',this.questions);
            res = await this.send_json_request(host, '/api/v1/Quotes', JSON.stringify(data), {Authorization: token});
        } catch (error) {
            log.error(`Appid: ${this.app.id} Pie WC Request: Error  ${error} ` + __location)
            return this.return_result('error');
        }

        // Pie only returns indications
        this.indication = true;

        // Attempt to get the quote number
        try {
            this.request_id = res.id;
        } catch (e) {
            log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find quote number.` + __location);
        }

        // Attempt to get the amount of the quote
        try {
            this.amount = parseInt(res.premiumDetails.totalEstimatedPremium, 10);
        } catch (error) {
            log.error(`Appid: ${this.app.id} Pie WC: Error getting amount ${error} ` + __location)
            return this.return_result('error');
        }

        // Attempt to grab the limits info
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
        } catch (e) {
            log.error(`Appid: ${this.app.id} Pie WC: Error getting limit ${e} ` + __location)
            return this.return_result('error');
        }

        // Grab the writing company
        try {
            this.writer = res.insuranceCompany;
        } catch (e) {
            log.warn(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Quote structure changed. Unable to find writing company.` + __location);
        }

        // Dirty? (Indicates a Valen outage)
        if (res.isDirty) {
            this.reasons.push('Valen is Down: Quote generated during a Valen outage are less likely to go unrevised by Underwriting.');
        }

        // Send the result of the request
        return this.return_result('quoted');
    }
};