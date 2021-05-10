/* eslint-disable object-curly-newline */
/* eslint-disable no-trailing-spaces */
/* eslint-disable no-console */

/**
 * Worker's Compensation Integration for Markel
 */

'use strict';

const Integration = require('../Integration.js');
const moment = require('moment');
global.requireShared('./helpers/tracker.js');

// NOTE: Many of these missing titles will be added 
const ownerTitleMatrix = {
    // Administrator: "com.markel.title.Administrator"
    // Board Member: "OfcrBO"
    // Executor: "com.markel.title.Executor"
    // General Partner: "GenPtnr"
    // Limited Partner: "LtdPtnr"
    // Manager: "GenMgr"
    // "Member": "Member",
    // Non-Paid Officer (CA Only): "com.markel.title.NonPaidOfficer_CAonly"
    // Non-subject Officer (NY only): "com.markel.title.NSO_NYonly"
    // NY Non-Subject Executive Officer (President): "com.markel.title.NSEO.President_NYonly"
    // NY Non-Subject Executive Officer (Secretary): "com.markel.title.NSEO.Secretary_NYonly"
    // NY Non-Subject Executive Officer (Treasurer): "com.markel.title.NSEO.Treasurer_NYonly"
    // NY Non-Subject Executive Officer (Vice President): "com.markel.title.NSEO.VicePresident_NYonly"
    // Officer: "CorpOff"
    "Other": "Ot",
    // Owner: "Own"
    // Partner: "Ptnr"
    "President": "Pres",
    "Chief Executive Officer": "Pres",
    // Partner: "Ptnr"
    "Secretary": "Sec",
    // Sole Proprietor: "SolePrp"
    "Treasurer": "Treas",
    // Trustee: "Trustee"
    "Vice President": "VP",
    // BELOW ARE OWNER TITLES WE SUPPORT BUT MARKEL DOESN'T - SET TO "Ot" (OTHER)
    "Chief Financial Officer": "Ot",
    "Chief Operating Officer": "Ot",
    "Director": "Ot",
    "Executive Vice President": "Ot",
    "Executive Secy-VP": "Ot",
    "Executive Secretary": "Ot",
    "Secy-Treas": "Ot",
    "Pres-VP-Secy-Treas": "Ot",
    "Pres-VP-Secy": "Ot",
    "Pres-VP": "Ot",
    "Pres-Treas": "Ot",
    "Pres-Secy-Treas": "Ot",
    "Pres-Secy": "Ot",
    "VP-Treas": "Ot",
    "VP-Secy-Treas": "Ot",
    "VP-Secy": "Ot"
}

const entityTypeMatrix = {
    "Association": "AS",
    // Not applicable in GA, IL, KY
    "C Corporation": "CCORP",
    // Not applicable in AK, AL, AR, CA, CO, CT, DE, FL, GA, HI, IA, IL, IN, KS, KY, LA, MD, MI, MN, MO, MS, NC, NE, NH, NJ, NM, NV, OK, RI, SC, SD, TN, TX, UT, VA, VT, WI, WV
    "Common Ownership": "CO",
    // Not applicable in DC, ID, KY, MI, MT, ND, OH, OR, WA, WI, WY
    "Corporation": "CP",
    // Applicable in all states.
    "Estate": "ES",
    // Not applicable in GA, IL, NH
    "Governmental Entity": "GE",
    // Not applicable in GA, IL, KY, LA, UT
    "Joint Venture": "JV",
    // Not applicable in DC, GA, ID, IL, ND, NY, OH, OR, WA, WY
    "Limited Liability Company": "LLC",
    // Applicable in all states.
    "Limited Partnership": "LP",
    // Not applicable in AL, AR, CO, CT, DE, FL, GA, HI, IA, IL, IN, KS, KY, LA, MA MD, MI, MN, MO, MS, NC, NE, NH, NJ, NM, NV, OK, PA, RI, SC, SD, TN, TX, UT, VA, VT, WV
    "Individual": "IN",
    // Not applicable in NY.
    "Nonprofit": "NP",
    // Not applicable in MI, NY, WI
    "Other": "OT",
    // Not applicable in GA, IL, KY, MI, VA
    "Professional Corporation": "PROF",
    // Applicable only in CA.
    "Partnership": "PT",
    // Applicable in all states.
    "Public Employer": "PUBLIC",
    // Not applicable in AZ, DC, GA, ID, IL, KY, MA, ME, MT, ND, OH, OR, UT, WA, WI, WY
    "Sole Proprietor": "SOLEPRP",
    // Applicable in all states.
    "S Corporation": "SS", // Markel's name: Subchapter S Corporation
    // Not applicable in AK, AL, AR, CO, CT, DE, FL, GA, IA, IL, IN, KS, KY, LA, MD, MI, MN, MO, MS, NC, NE, NH, NM, NV, OK, RI, SC, SD, TN, TX, UT, VA, VT, WI, WV
    "Trust": "TR",
    // Not applicable in GA, IL
    "Cooperative Corporation": "com.markel.coop",
    // Applicable only in CA.
    "Executor": "com.markel.exec",
    // Not applicable in AZ, DC, GA, ID, IL, KY, MT, NC, ND, OH, OR, WA, WI, WY
    "Limited Liability Partnership": "com.markel.llp",
    // Not applicable in AL, AR, CO, CT, DE, FL, HI, IA, IN, KS, KY, MD, MN, MO, MS, NC, NE, NH, NM, NV, OK, RI, SC, SD, TN, TX, VA, VT, WV
    "Religious Organization": "com.markel.religious",
    // Not applicable in DC, GA, ID, IL, KY, MT, ND, OH, OR, WA, WY
    "Trustee": "com.markel.trustee",
    // Not applicable in AZ, CA, DC, GA, ID, IL, KY, MI, MT, ND, OH, OR, WA, WI, WY
    "Registered Limited Liability Partnership": "com.markel.RLLP",
    // Applicable only in NY
    "Professional Service Liability Company": "com.markel.PSLC",
    // Applicable only in NY
    "Nonprofit Corporation": "com.markel.NPC",
    // Applicable only in NY
    "Unincorporated Nonprofit Association": "com.markel.UNPA"
    // Applicable only in NY
};

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
        const applicationDocData = this.app.applicationDocData;

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

        const appDoc = this.app.applicationDocData

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
        //This may result in no limit being found. needs defaults
        //Plus need to use best match.   Note: limits variable not used submission.
        let markelLimits = mapCarrierLimits[this.app.policies[0].limits];
        const limits = this.getBestLimits(carrierLimits);
        if (limits) {
            const markelBestLimits = limits.join("/");
            const markelLimitsSubmission = mapCarrierLimits[markelBestLimits];
            if(markelLimitsSubmission){
                markelLimits = markelLimitsSubmission;
            }
            else {
                markelLimits = '100/500/100';
            }
        }
        else {
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

        const primaryAddress = this.app.business.locations[0];

        let entityType = null;
        if (applicationDocData.entityType === "Corporation") {
            switch(applicationDocData.corporationType) {
                case "C":
                    entityType = "CCORP";
                    break;
                case "S":
                    entityType = "SS";
                    break;
                case "N":
                    entityType = "NP";
                    break;
                default:
                    entityType = "CP";
                    break;
            }
        } 
        else {
            entityType = entityTypeMatrix[applicationDocData.entityType];
        }

        // Get the claims organized by year
        const claims_by_year = this.claims_to_policy_years();
        let losses = 'No';

        for (let i = 1; i <= 3; i++) {
            if (claims_by_year[i].count > 0) {
                losses = 'Yes'
            }
        }

        /* ---=== Begin Questions ===--- */

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
                    //this.reasons.push(`Unable to determine answer for question ${question.id}`);
                    //return this.return_result('error');
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

        let totalOwnerPayroll = 0;
        let ownerClassCode = null;
        let highestPayroll = 0;

        // Populate the location list
        const locationList = [];
        // for each location, push a location object into the locationList
        applicationDocData.locations.forEach(location => {
            const locationObj = {
                "Location Address1":location.address,
                "Location Zip": location.zipcode,
                "Location City": location.city,
                "Location State": location.state,
                "Payroll Section": []
            };

            // for each activity, push a Payroll Section object into the Payroll Section list
            location.activityPayrollList.forEach(activity => {
                const fullTimeEmployees = activity.employeeTypeList.find(type => type.employeeType === "Full Time");
                const partTimeEmployees = activity.employeeTypeList.find(type => type.employeeType === "Part Time");
                const owners = activity.employeeTypeList.find(type => type.employeeType === "Owners");
                // we count owners as full time employees, so add them if they exist
                let ftCount = fullTimeEmployees ? fullTimeEmployees.employeeTypeCount : 0;
                ftCount += owners ? owners.employeeTypeCount : 0;
                const ptCount = partTimeEmployees ? partTimeEmployees.employeeTypeCount : 0;

                const classCode = this.insurer_wc_codes[`${applicationDocData.mailingState}${activity.activityCodeId}`];

                // TODO: The logic below will be changed once we get further clarification from Markel. Likely, we will not send owners if they are included
                //       in the payroll to force a non-bindable quote, since we do not track owner information the way the expect
                // if we find an owner, map it for later when setting owner information
                // NOTE: We have a gap in how we store owner information, and cannot link owner payroll/activity to actual owner records
                //      For this integration, we will pick the class code associated with the highest payroll, 
                //      and divide the payroll by the number of owners, for each owner
                const owner = activity.employeeTypeList.find(type => type.employeeType === "Owners");
                if (owner) {
                    const payroll = parseInt(owner.employeeTypePayroll, 10);
                    totalOwnerPayroll += payroll;

                    if (payroll > highestPayroll) {
                        ownerClassCode = classCode;
                        highestPayroll = payroll;
                    }
                }

                locationObj["Payroll Section"].push({
                    Payroll: activity.payroll,
                    "Full Time Employees": ftCount,
                    "Part Time Employees": ptCount,
                    "Class Code": classCode ? classCode : ``,
                    "Class Code Description": this.industry_code.description
                });
            });

            locationList.push(locationObj);
        });

        // if we weren't able to set a class code (they didn't enter owner payroll info), but we have owners, set as first activity
        if (!ownerClassCode && applicationDocData.owners.length > 0) {
            const firstActivity = Object.values(this.insurer_wc_codes)[0];
            ownerClassCode = firstActivity ? firstActivity : ``;
        }

        // Populate the owner / officer information section
        const ownerOfficerInformationSection = [];
        const totalOwners = applicationDocData.owners.length;
        applicationDocData.owners.forEach(owner => {
            ownerOfficerInformationSection.push({
                "Owner First Name": owner.fname,
                "Owner Last Name": owner.lname,
                "Owner Title": ownerTitleMatrix[owner.officerTitle],
                "Owner Ownership": owner.ownership,
                "Owner Class": ownerClassCode ? ownerClassCode : ``,
                "Owner Payroll": Math.round(totalOwnerPayroll / totalOwners),
                "Owner Include": owner.include ? 'Yes' : 'No'
            });
        });
        
        if(!markelLimits){
            log.error(`Appid: ${this.app.id}: Markel WC missing markelLimits. ` + __location)
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
                    fein: appDoc.ein,
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
        ]};

        // let unansweredQ = null;
        // let declinedReasons = null;
        let response = null;
        try {
            response = await this.send_json_request(host, path, JSON.stringify(jsonRequest), key, 'POST', false);
        }
        catch (error) {
            log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: ${error} ${__location}`);
            this.reasons.push(error);
            return this.return_result('error');
        }

        const rquIdKey = Object.keys(response)[0];

        try {
            if (response && (response[rquIdKey].underwritingDecisionCode === 'SUBMITTED' || response[rquIdKey].underwritingDecisionCode === 'QUOTED')) {

                if(response[rquIdKey].premium){
                    this.amount = response[rquIdKey].premium.totalPremium;
                }

                try {
                    this.request_id = response[rquIdKey].applicationID;
                    this.number = this.request_id;
                }
                catch (e) {
                    log.error(`Appid: ${this.app.id} ${this.insurer.name} ${this.policy.type} Integration Error: Unable to find quote number.` + __location);
                }
                // null is a valid response. isBindable defaults to false.  null equals false.
                if(response[rquIdKey].isBindAvailable){
                    this.isBindable = response[rquIdKey].isBindAvailable;
                }
                // Get the quote limits
                if (response[rquIdKey].application["Policy Info"]) {

                    const limitsString = response[rquIdKey].application["Policy Info"]["Employer Liability Limit"].replace(/,/g, '');
                    const limitsArray = limitsString.split('/');
                    this.limits = {
                        '1': parseInt(limitsArray[0],10) * 1000,
                        '2': parseInt(limitsArray[1],10) * 1000,
                        '3': parseInt(limitsArray[2],10) * 1000
                    }
                }
                else {
                    log.error('Markel Quote structure changed. Unable to find limits. ' + __location);
                    this.reasons.push('Quote structure changed. Unable to find limits.');
                }
                // Return with the quote
                if(response[rquIdKey].underwritingDecisionCode === 'SUBMITTED') {
                    return this.return_result('referred_with_price');
                }
                else {
                    return this.return_result('quoted');
                }
            }
        }
        catch (error) {
            log.error(`Appid: ${this.app.id} Markel WC: Error getting amount ${error}` + __location);
            return this.return_result('error');
        }

        //Check reasons for DECLINED
        if (response[rquIdKey].underwritingDecisionCode === 'DECLINED') {
            if(response[rquIdKey].errors && response[rquIdKey].errors.length > 0){
                response[rquIdKey].errors.forEach((error) => {
                    if(error.DeclineReasons && error.DeclineReasons.length > 0){
                        error.DeclineReasons.forEach((declineReason) => {
                            this.reasons.push(declineReason);
                        });
                    }
                });
            }
            return this.return_result('declined');
        }
        else if (response[rquIdKey].errors) {
            response[rquIdKey].errors.forEach((error) => {
                if(typeof error === 'string'){
                    this.reasons.push(`Markel Error ${error}`);
                }
                else {
                    this.reasons.push(`Markel Error ${JSON.stringify(error)}`);
                }

            });
        }
        else {
            this.reasons.push(`Markel Error unknown for ${this.app.business.industry_code_description} in ${primaryAddress.territory}`);
        }

        return this.return_result('error');

    }
};