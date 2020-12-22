/* eslint-disable no-console */

/**
 * Worker's Compensation Integration for Markel
 */

'use strict';

const Integration = require('../Integration.js');
const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

module.exports = class MarkelWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    /**
     * Requests a quote from Markel and returns. This request is not intended to be called directly.
     *
     * @returns {result} The result of return_result()
     */

    async _insurer_quote() {

        const special_activity_codes = {
            AK: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            AL: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            AR: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            CA: [
                '8868',
                '8875',
                '9014',
                '9015',
                '9016',
                '9031',
                '9048',
                '9053',
                '9059',
                '9061',
                '9063',
                '9180'
            ],
            CO: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9053',
                '9059',
                '9061',
                '9063',
                '9180',
                '9186'
            ],
            CT: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            DE: [
                '0891',
                '0968',
                '0978',
                '8861',
                '8864',
                '8869',
                '9015',
                '9016',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            FL: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            GA: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            HI: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9013',
                '9014',
                '9015',
                '9016',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            IA: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            IL: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            IN: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            KS: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            KY: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            LA: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            MA: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9063'
            ],
            MD: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            MI: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            MN: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            MO: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            MS: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            NC: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            NE: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            NH: [
                '8842',
                '8864',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            NJ: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            NM: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9180',
                '9186'
            ],
            NV: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9016',
                '9048',
                '9059',
                '9061',
                '9063',
                '9110',
                '9180',
                '9186'
            ],
            OK: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9063'
            ],
            PA: [
                '0884',
                '0891',
                '0965',
                '0971',
                '0978',
                '0986'
            ],
            RI: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9063'
            ],
            SC: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9063'
            ],
            SD: [
                '8842',
                '8864',
                '8868',
                '9014',
                '9015',
                '9063'
            ],
            TN: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9063'
            ],
            TX: [
                '8868',
                '9014',
                '9015',
                '9063'
            ],
            UT: [
                '8842',
                '8864',
                '8868',
                '9014',
                '9015',
                '9063'
            ],
            VA: [
                '8842',
                '8861',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9063'
            ],
            VT: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9063'
            ],
            WI: [
                '8842',
                '8864',
                '8868',
                '8869',
                '9014',
                '9015',
                '9063'
            ],
            WV: [
                '8842',
                '8864',
                '8869',
                '9014',
                '9015',
                '9063'
            ]
        };

        let host = '';
        let path = '';
        let key = '';

        //Determine API
        if (this.insurer.useSandbox) {
            host = 'api-sandbox.markelcorp.com';
            path = '/smallCommercial/v1/wc'
            key = {'apikey': `${this.password}`};
        }
        else {
            host = 'api.markelcorp.com';
            path = '/smallCommercial/v1/wc';
            key = {'apikey': `${this.password}`};
        }

        // These are the statuses returned by the insurer and how they map to our Talage statuses
        this.possible_api_responses.Declined = 'declined';
        this.possible_api_responses.Incomplete = 'error';
        this.possible_api_responses.Submitted = 'referred';
        this.possible_api_responses.Quoted = 'quoted';

        // These are the limits supported by Markel * 1000
        const carrierLimits = ['100000/500000/100000',
            '500000/500000/500000',
            '1000000/1000000/1000000',
            '1500000/1500000/1500000',
            '2000000/2000000/2000000'];
        let yearsInsured = moment().diff(this.app.business.founded, 'years');

        const mapCarrierLimits = {
            '100000/500000/100000': '100/500/100',
            '500000/500000/500000': '500/500/500',
            '1000000/1000000/1000000': '1000/1000/1000',
            '1500000/1500000/1500000': '1500/1500/1500',
            '2000000/2000000/2000000': '2000/2000/2000'
        }

        // Check for excessive losses in DE, HI, MI, PA and VT
        const excessive_loss_states = [
            'DE',
            'HI',
            'MI',
            'PA',
            'VT'
        ];

        if (yearsInsured > 10) {
            yearsInsured = 10;
        }
        else if (yearsInsured === 0) {
            yearsInsured = 1
        }

        // Prepare limits
        const markelLimits = mapCarrierLimits[this.app.policies[0].limits];
        const limits = this.getBestLimits(carrierLimits);

        if (!limits) {
            log.warn(`Appid: ${this.app.id} Markel WC autodeclined: no limits  ${this.insurer.name} does not support the requested liability limits ` + __location);
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} does not support the requested liability limits`);
            return this.return_result('autodeclined');
        }

        // Check the number of claims
        if (excessive_loss_states.includes(this.app.business.primary_territory)) {
            if (this.policy.claims.length > 2) {
                log.info(`Appid: ${this.app.id} autodeclined: ${this.insurer.name} Too many claims ` + __location);
                this.reasons.push(`Too many past claims`);
                return this.return_result('autodeclined');
            }
        }

        // Check for excessive losses in South Dakota
        if (this.app.business.primary_territory === 'SD') {
            if (this.policy.claims.length > 4) {
                log.info(`Appid: ${this.app.id} autodeclined: ${this.insurer.name} Too many claims ` + __location);
                this.reasons.push(`Too many past claims`);
                return this.return_result('autodeclined');
            }
        }

        // Markel has us define our own Request ID
        this.request_id = this.generate_uuid();

        const primaryAddress = this.app.business.locations[0];

        // Define how legal entities are mapped for Markel
        const entityMatrix = {
            Association: 'AS',
            Corporation: 'CP',
            'Limited Liability Company': 'LLC',
            'Limited Partnership': 'LP',
            Partnership: 'PT',
            'Sole Proprietorship': 'IN'
        };
        const entityType = entityMatrix[this.app.business.entity_type];
        // Get the claims organized by year

        if (!(this.app.business.entity_type in entityMatrix)) {
            log.error(`Markel (application ${this.app.id}): Invalid Entity Type ${__location}`);
            // return this.return_result('autodeclined');
        }

        const claims_by_year = this.claims_to_policy_years();
        let losses = 'No';

        for (let i = 1; i <= 3; i++) {
            if (claims_by_year[i].count > 0) {
                losses = 'Yes'
            }
        }

        let classificationCd = '';
        let ownerPayroll = '';

        // Add class code information
        this.app.business.locations.forEach((location) => {
            location.activity_codes.forEach((activity_code) => {
                classificationCd = this.insurer_wc_codes[location.territory + activity_code.id];
                ownerPayroll = activity_code.payroll;
            });
        });

        // /* ---=== Begin Questions ===--- */

        const specialQuestions = ['CGL05',
            'GENRL22',
            'WORK16',
            'com.markel.uw.questions.Question1524',
            'com.markel.uw.questions.Question1781'];
        const unique_territories = [];
        const questionObj = {};
        this.app.business.locations.forEach(function(location) {
            if (unique_territories.includes(location.territory)) {
                unique_territories.push(location.territory);
            }
        });
        for (const question_id in this.questions) {
            if (Object.prototype.hasOwnProperty.call(this.questions, question_id)) {
                const question = this.questions[question_id];
                const QuestionCd = this.question_identifiers[question.id];

                // If there is no question code, this question is for another insurer, just move on
                if (!QuestionCd) {
                    continue;
                }

                // Get the answer
                let answer = '';
                try {
                    answer = this.determine_question_answer(question);
                }
                catch (error) {
                    log.error(`Appid: ${this.app.id} Markel WC: Unable to determine answer for question ${question.id}. error: ${error} ` + __location);
                    this.reasons.push(`Unable to determine answer for question ${question.id}`);
                    return this.return_result('error');
                }

                // This question was not answered
                if (!answer && !this.universal_questions.includes(question_id)) {
                    continue;
                }

                // Special rules for Question 1045
                if (question_id === 1045) {
                    // Replace any percentages that are present
                    if (typeof answer === 'string') {
                        answer = answer.replace('%', '');
                    }

                    // Make sure the answer is numeric
                    if (/^\d+$/.test(answer)) {
                        const answerInt = parseInt(answer, 10);

                        if (answerInt < 15) {
                            answer = 'Less than 15';
                        }
                        else if (answerInt < 25) {
                            answer = 'Greater than 15 but less than 25';
                        }
                        else {
                            answer = 'Greater than 25';
                        }
                    }
                    else {
                        log.error(`Appid: ${this.app.id} Markel WC: User provided an invalid percentage for the subcontractors question (not numeric) ` + __location);
                        this.reasons.push('User provided an invalid percentage for the subcontractors question (not numeric)');
                        return this.return_result('error');
                    }
                }

                let questionAnswer = '';

                //Special Questions and defaults
                if (QuestionCd === 'com.markel.uw.questions.submission.EMod') {
                    questionAnswer = 'NA'
                }

                if (QuestionCd === 'com.markel.uw.questions.submission.ExposureOutsideState') {
                    questionAnswer = 'NA'
                }
                if (QuestionCd === 'com.markel.uw.questions.submission.YearsWithWC') {
                    if (question.type === 'Yes/No') {
                        questionAnswer = 'NA'
                    }
                    if (question.type === 'Num') {
                        questionAnswer = this.get_years_in_business()
                    }
                }

                if (specialQuestions.includes(QuestionCd)) {
                    questionAnswer = 'N0'
                }
                if (QuestionCd === 'com.markel.uw.questions.Question1590') {
                    questionAnswer = this.policy.coverage_lapse ? 'YES' : 'NO'
                }
                if (QuestionCd === 'com.markel.uw.questions.Question29') {
                    questionAnswer = this.policy.claims.length ? 'YES' : 'NO';
                }

                if (question.type === 'Yes/No') {
                    questionAnswer = question.get_answer_as_boolean() ? 'YES' : 'NO';
                }
                else {
                    questionAnswer = 'NA';

                    // Check if the answer is a number
                    if (/^\d+$/.test(answer)) {
                        questionAnswer = answer;
                    }
                    else {
                        questionAnswer = answer;
                    }
                }

                // Multi-State?
                if (unique_territories.length > 1) {

                    if (QuestionCd === 'com.markel.uw.questions.Question30') {
                        questionAnswer = 'YES'
                    }
                    if (QuestionCd === 'com.markel.uw.questions.Question1551') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Explanation') {
                            questionAnswer = unique_territories.join(',');
                        }
                    }

                }
                else if (QuestionCd === 'com.markel.uw.questions.Question30') {
                    questionAnswer = 'NO'
                }

                if (QuestionCd === 'com.markel.uw.questions.Question870') {
                    questionAnswer = this.app.business.website ? 'YES' : 'NO'
                }

                if (this.app.business.website) {

                    if (QuestionCd === 'com.markel.uw.questions.Question1041') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Explanation') {
                            questionAnswer = this.app.business.website;
                        }
                    }

                }

                // /* ---=== Begin State Specific Questions ===--- */

                // Certified Safety Committee Notification?
                const safety_committee_states = [
                    'AZ',
                    'DE',
                    'KY',
                    'NJ',
                    'PA',
                    'UT',
                    'WI'
                ];

                if (safety_committee_states.includes(this.app.business.primary_territory)) {
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.CertSafetyCommNotification') {
                        questionAnswer = 'NO'
                    }

                }

                // NumberOfClaims within last 3 years
                const number_of_claims_states = [
                    'DE',
                    'HI',
                    'MI',
                    'PA',
                    'SD',
                    'VT'
                ];

                if (number_of_claims_states.includes(this.app.business.primary_territory) !== -1) {
                    let total_claims = 0;
                    for (const year in claims_by_year) {
                        if (year <= 3) {
                            total_claims += claims_by_year[year].count;
                        }
                    }

                    if (QuestionCd === `com.markel.uw.questions.stateSpecific.${this.app.business.primary_territory.toLowerCase()}.NumberOfClaims`) {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Num') {
                            questionAnswer = total_claims
                        }
                    }

                }

                // Alabama
                if (this.app.business.primary_territory === 'AL') {

                    // How many claims were within the last year?
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.al.NumberOfClaimsLastYear') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Num') {
                            questionAnswer = Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0
                        }
                    }

                    // How many claims were within the last 2 years?
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.al.NumberOfClaimsLast2Years') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Num') {
                            questionAnswer = (Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0) + (Object.prototype.hasOwnProperty.call(claims_by_year, 2) ? claims_by_year[2].count : 0)
                        }
                    }
                }

                // Colorado
                if (this.app.business.primary_territory === 'CO') {

                    // How many loss time claims were within the last year?
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.co.NumberOfLossTimeClaimsLastYr') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Num') {
                            questionAnswer = Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].missedWork : 0
                        }
                    }

                    // How many medical claims of $250 or more were within the last?
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.co.NumberOfMedClaimsLastYr') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Num') {
                            questionAnswer = Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0
                        }
                    }

                    // Certified Risk Management Program
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.co.CRMPFlag') {
                        questionAnswer = 'N0'

                    }
                }

                // Delaware
                if (this.app.business.primary_territory === 'DE') {
                    if (this.app.business.bureau_number === 0) {

                        // Do you know the DCRB file number?
                        if (QuestionCd === 'com.markel.uw.questions.Question1206') {
                            questionAnswer = 'N0'
                        }
                    }
                    else {

                        // Do you know the DCRB file number?
                        if (QuestionCd === 'com.markel.uw.questions.Question1206') {
                            questionAnswer = 'YES'
                        }

                        // Please enter the DCRB file number
                        if (QuestionCd === 'com.markel.uw.questions.Question1207') {
                            if (question.type === 'Yes/No') {
                                questionAnswer = 'NA'
                            }
                            if (question.type === 'Explanation') {
                                questionAnswer = this.app.business.bureau_number
                            }
                        }

                    }
                }

                // Hawaii
                if (this.app.business.primary_territory === 'HI') {

                    // Default to NO
                    if (QuestionCd === 'com.markel.uw.questions.Question1783') {
                        questionAnswer = 'N0'
                    }

                    // You can contact the DOL for assistance in obtaining or verifying a DOL number by calling 808-586-8914
                    if (QuestionCd === 'com.markel.uw.questions.Question1784') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Explanation') {
                            questionAnswer = 'OK'
                        }
                    }

                }

                // Kentucky
                if (this.app.business.primary_territory === 'KY') {

                    // Does the applicant wish to select a deductible?
                    if (QuestionCd === 'com.markel.uw.questions.Question1638') {
                        questionAnswer = 'N0'
                    }

                }

                // Pennsylvania
                if (this.app.business.primary_territory === 'PA') {
                    if (this.app.business.bureau_number) {

                        // Do you know the PCRB file number?
                        if (QuestionCd === 'com.markel.uw.questions.Question1204') {
                            questionAnswer = 'YES'
                        }

                        // Please enter the PCRB file number
                        if (QuestionCd === 'com.markel.uw.questions.Question1205') {
                            if (question.type === 'Yes/No') {
                                questionAnswer = 'NA'
                            }
                            if (question.type === 'Explanation') {
                                questionAnswer = this.app.bureau_number;
                            }
                        }

                    }
                    else if (QuestionCd === 'com.markel.uw.questions.Question1204') {
                        // Do you know the PCRB file number?
                        questionAnswer = 'NO';
                    }
                }

                // Rhode Island
                if (this.app.business.primary_territory === 'RI') {

                    // Consecutive years with no losses (between 0 and 6 inclusive)
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.ri.ClaimFreeYearNumber') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Num') {
                            questionAnswer = this.get_years_since_claim();
                        }
                    }

                }

                // Texas
                if (this.app.business.primary_territory === 'TX') {

                    // How many claims were within the last year?
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.tx.NumberOfClaimsLastYear') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Num') {
                            questionAnswer = Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0;
                        }
                    }

                    // How many claims were within the last 2 years?
                    if (QuestionCd === 'com.markel.uw.questions.stateSpecific.tx.NumberOfClaimsLast2Years') {
                        if (question.type === 'Yes/No') {
                            questionAnswer = 'NA'
                        }
                        if (question.type === 'Num') {
                            questionAnswer = (Object.prototype.hasOwnProperty.call(claims_by_year, 1) ? claims_by_year[1].count : 0) + (Object.prototype.hasOwnProperty.call(claims_by_year, 2) ? claims_by_year[2].count : 0);
                        }
                    }

                    // Any lapse in coverage?
                    if (QuestionCd === 'com.markel.uw.questions.Question1594') {
                        questionAnswer = this.policy.coverage_lapse ? 'YES' : 'NO';
                    }

                }

                // /* ---=== End State Specific Questions ===--- */

                // ---=== Special Markel Question ===---
                //  Markel asks one question that we do not support because it is unnecessary.
                //  Below, we add in support for that question so Markel still receives an
                //  answer as it desires.

                if (Object.prototype.hasOwnProperty.call(special_activity_codes, this.app.business.primary_territory)) {
                    let match = false;
                    const codes = special_activity_codes[this.app.business.primary_territory];
                    this.app.business.locations.forEach(function(location) {
                        location.activity_codes.forEach(function(activity_code) {
                            let short_code = activity_code.id;
                            while (short_code > 9999) {
                                short_code = Math.floor(short_code / 10);
                            }

                            if (codes.includes(short_code)) {
                                match = true;
                            }
                        });
                    });

                    if (match) {

                        // Add the additional question
                        if (QuestionCd === 'com.markel.uw.questions.Question1203') {
                            questionAnswer = 'NO'
                        }

                    }
                }
                //Add Question to the question object for the API
                questionObj[QuestionCd] = questionAnswer;
            }
        }

        // Populate the location list
        const locationList = [];
        this.app.business.locations.forEach(location => {
            // Get total payroll for this location
            let locationPayroll = 0;
            location.activity_codes.forEach((activityCode) => {
                locationPayroll += activityCode.payroll;
            });
            locationList.push({
                "Location Address1":location.address,
                "Location Zip": location.zip,
                "Location City": location.city,
                "Location State": location.state_abbr,
                "Payroll Section": [
                    {
                        Payroll: locationPayroll,
                        "Full Time Employees": location.full_time_employees,
                        "Part Time Employees": location.part_time_employees,
                        "Class Code": classificationCd,
                        "Class Code Description": this.app.business.industry_code_description
                    }
                ]
            })
        });

        // Populate the owner / officer information section
        let ownerOfficerInformationSection = null;
        if (this.app.business.owners && this.app.business.owners.length > 0) {
            ownerOfficerInformationSection = [
                {
                    "Owner First Name": this.app.business.owners[0].fname,
                    "Owner Last Name": this.app.business.owners[0].lname,
                    "Owner Title": this.app.business.owners[0].officerTitle,
                    "Owner Ownership": this.app.business.owners[0].ownership,
                    "Owner Class": 8001,
                    "Owner Payroll": ownerPayroll,
                    "Owner Include": 'Yes'
                }
            ];
        }
        else {
            ownerOfficerInformationSection = [
                {"Owner Include": 'No'}
            ];
        }

        const jsonRequest = {submissions: [
            {
                RqUID: this.generate_uuid(),
                programCode: "wc",
                effectiveDate: this.policy.effective_date.format('YYYY-MM-DD'),
                agencyInformation: {
                    agencyId: this.app.agencyLocation.insurers[this.insurer.id].agency_id,
                    licensingAgentUsername: this.app.agencyLocation.insurers[this.insurer.id].agent_id
                },
                insured: {
                    address1: this.app.business.mailing_address,
                    city: this.app.business.mailing_city,
                    documentDeliveryPreference: "EM",
                    name: this.app.business.name,
                    dba: this.app.business.dba,
                    website: this.app.business.website,
                    fein: this.app.business.locations[0].identification_number,
                    postalCode: this.app.business.mailing_zipcode,
                    state: this.app.business.mailing_territory
                },
                application: {
                    'Location Information': {Location: locationList},
                    "Policy Info": {
                        "Employer Liability Limit": markelLimits,
                        "Years Insured": yearsInsured,
                        "Exp Mod NCCI": {"Exp Mod NCCI Factor": this.app.business.experience_modifier},
                        "Losses": losses
                    },
                    "Additional Information": {
                        "Entity Type": entityType,
                        "Assigned Risk Pool Prior Period": "No",
                        "Primary Contact Name": this.app.business.contacts[0].first_name,
                        "Primary Contact Last Name": this.app.business.contacts[0].last_name,
                        "Phone Number": this.app.business.contacts[0].phone,
                        "Email": this.app.business.contacts[0].email,
                        "Outside Exposure": "None",
                        "Owner Officer Information Section": ownerOfficerInformationSection
                    },
                    "Underwriter Questions": {
                        "UWQuestions": questionObj,
                        "Description of Operations": this.app.business.industry_code_description
                    },
                    "signaturePreference": "Electronic"
                }
            }
        ]}

        // let unansweredQ = null;
        let declinedReasons = null;
        let response = null;
        try {
            response = await this.send_json_request(host, path, JSON.stringify(jsonRequest), key, 'POST', false);
        }
        catch (error) {
            log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: ${error} ${__location}`);
            this.reasons.push(error);
            return this.return_result('error');
        }

        const rquIdKey = Object.keys(response)[0]

        try {
            if (response && response[rquIdKey].underwritingDecisionCode === 'SUBMITTED') {

                if(response[rquIdKey].premium){
                    this.amount = response[rquIdKey].premium.totalPremium;
                }

                // Get the quote limits
                if (response[rquIdKey].application["Policy Info"]) {

                    const limitsString = response[rquIdKey].application["Policy Info"]["Employer Liability Limit"].replace(/,/g, '');
                    const limitsArray = limitsString.split('/');
                    const quotelimits = {
                        '1': limitsArray[0],
                        '2': limitsArray[1],
                        '3': limitsArray[2]
                    }
                    return await this.client_referred(null, quotelimits, response[rquIdKey].premium.totalPremium,null,null);
                }
                else {
                    log.error('Markel Quote structure changed. Unable to find limits. ' + __location);
                    this.reasons.push('Quote structure changed. Unable to find limits.');
                }
                // Return with the quote
                return this.return_result('referred_with_price');
            }
        }
        catch (error) {
            log.error(`Appid: ${this.app.id} Markel WC: Error getting amount ${error}` + __location);
            return this.return_result('error');
        }

        //Check reasons for DECLINED
        if (response[rquIdKey].errors) {
            //Unanswered Questions - This is never referenced? - SF
            // if (response[rquIdKey]) {
            //     unansweredQ = response[rquIdKey].errors[0].UnansweredQuestions;
            // }
            //Declined Reasons
            if (response[rquIdKey].errors[1]) {
                declinedReasons = response[rquIdKey].errors[1].DeclineReasons;
            }
            else if (response[rquIdKey].errors[0] && typeof response[rquIdKey].errors[0] === 'string') {
                this.reasons.push(`Markel  Error ${response[rquIdKey].errors[0]}`);
            }
            else {
                for(const errorNode of response[rquIdKey].errors){
                    this.reasons.push(`Markel  Error ${JSON.stringify(errorNode)}`);
                }
                return this.return_result('error');
            }
        }

        if (response[rquIdKey].underwritingDecisionCode === 'DECLINED') {
            this.reasons.push(declinedReasons);
            return this.return_result('declined');
        }
        this.reasons.push(`Markel Error unknown for ${this.app.business.industry_code_description} in ${primaryAddress.territory}`);
        return this.return_result('error');

    }
};