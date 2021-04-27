/* eslint-disable dot-notation */
//const builder = require('xmlbuilder');
const moment = require('moment');
//const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//const superagent = require('superagent');
const _ = require('lodash');
const GreatAmericanApi = require('./api');

module.exports = class GreatAmericanWC extends Integration {

    /**
     * Initializes this integration.
     *
     * @returns {void}
     */
    _insurer_init() {
        this.requiresInsurerActivityClassCodes = true;
    }

    logApiCall(title, params, out) {
        this.log += `--------======= Sending ${title} =======--------<br><br>`;
        this.log += `Request:\n <pre>${JSON.stringify(params, null, 2)}</pre><br><br>\n`;
        this.log += `Response:\n <pre>${JSON.stringify(out, null, 2)}</pre><br><br>`;
        this.log += `--------======= End =======--------<br><br>`;
    }

    /**
     * Requests a quote from Great America and returns. This request is not
     * intended to be called directly.
     *
     * @returns {Promise.<object, Error>} A promise that returns an object
     *   containing quote information if resolved, or an Error if rejected
     */
    async _insurer_quote() {
        const codes = await Promise.all(Object.keys(this.insurer_wc_codes).map(code => this.get_insurer_code_for_activity_code(this.insurer.id, code.substr(0, 2), code.substr(2))));
        let error = null
        const token = await GreatAmericanApi.getToken(this).catch((err) => {
            error = err;
            log.error(`Appid: ${this.app.id} Great American WC: error ${err} ` + __location);
        });
        if(error){
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} WC Request Error: ${error}`);
            return this.return_result('error');
        }

        let sessionCodes = codes.map(c => ({
            id: c.code,
            value: c.attributes.classIndustry
        }));
        // GA only wants the first activity code passed to their API endpoint.
        sessionCodes = [sessionCodes[0]];
        const session = await GreatAmericanApi.getSession(this, token, sessionCodes)
        if(!session){
            this.log += `Great American getSession failed: `;
            this.reasons.push(`Great American getSession failed`);
            return this.return_result('error');
        }

        const questions = {};
        for (const q of Object.values(this.questions)) {
            // Does a question have alternative identifiers? If so, also mark
            // this as an answer for those alternatives.
            const attrs = this.question_details[q.id].attributes;

            if (attrs && attrs.alternativeQuestionIds) {
                for (const id of attrs.alternativeQuestionIds) {
                    questions[id] = q.answer;
                }
            }

            questions[this.question_identifiers[q.id]] = q.answer;
        }

        if (session.newBusiness.workflowControl !== 'CONTINUE') {
            this.log += `Great American returned a bad workflow control response: ${session.newBusiness.workflowControl} @ ${__location}`;
            return this.return_result('declined');
        }

        const questionnaireInit = session.riskSelection.data.answerSession.questionnaire;
        let need_generalEligibility3OrMore = false;
        let need_generalEligibility3OrMoreRestManu = false;
        questionnaireInit.groups.forEach((groups) => {
            groups.questions.forEach((question) => {
                if(question.questionId === 'generalEligibility3OrMore'){
                    need_generalEligibility3OrMore = true;
                }
                if(question.questionId === 'generalEligibility3OrMoreRestManu'){
                    need_generalEligibility3OrMoreRestManu = true;
                }


            });
        });
        //Questions from appDoc Data.
        if(this.app.applicationDocData.founded){
            const yearsWhole = moment().diff(this.app.applicationDocData.founded, 'years',false);
            const years = moment().diff(this.app.applicationDocData.founded, 'years',true);
            questions['generalEligibilityYearsOfExperience'] = yearsWhole.toString();


            if(years < 0.16){
                //New Business/No Experience < 2 months
                questions['scheduleRatingBusinessExperience'] = 'New Business/No Experience';
            }
            else if(years < 1){
                //New Business/No Experience
                questions['scheduleRatingBusinessExperience'] = 'Less Than 1 Year';
            }
            else if(years >= 1 && years <= 3){
                questions['scheduleRatingBusinessExperience'] = '1 to 3 Years';
            }
            else {
                questions['scheduleRatingBusinessExperience'] = '3 Years or More';
            }

            //Determine if generalEligibility3OrMore or generalEligibility3OrMoreRestManu should be included.
            if(need_generalEligibility3OrMore){
                questions['generalEligibility3OrMore'] = years >= 3 ? "Yes" : "No"
            }

            if(need_generalEligibility3OrMoreRestManu){
                questions['generalEligibility3OrMoreRestManu'] = years >= 3 ? "Yes" : "No"
            }

            //log.debug(`application GreatAmerican Questions ${JSON.stringify(this.questions)}`)
        }
        else {
            questions['generalEligibilityYearsOfExperience'] = '5';
        }
        if(this.app.applicationDocData.yearsOfExp){
            questions['generalEligibilityYearsOfExperience'] = this.app.applicationDocData.yearsOfExp;
        }

        //Employee Info
        questions['generalEligibilityTotalFullTime'] = this.get_total_full_time_employees();
        questions['generalEligibilityTotalPartTime'] = this.get_total_part_time_employees();
        questions['generalEligibilityTotalEmployees'] = this.get_total_employees();

        //Claims
        questions['claimsLossesMoreThan50K'] = "No, I have not had a single loss more than $50,000";
        questions['claimsLosses4years'] = "Less than 2 losses";
        this.app.applicationDocData.claims.forEach((claim) => {
            let years = 5;
            if(claim.eventDate){
                try{
                    years = moment().diff(claim.eventDate, 'years',false);
                }
                catch(err){
                    log.error(`Appid: ${this.app.id} Great American WC: claim date error ${err} ` + __location);
                }
            }
            let claimCount = 0;
            if(claim.policyType === "WC" && years < 5){
                claimCount++;
                let totalAmount = 0;
                if(claim.amountPaid){
                    totalAmount = claim.amountPaid
                }
                if(claim.amountReserved){
                    totalAmount += claim.amountReserved
                }
                if(totalAmount > 50000){
                    questions['claimsLossesMoreThan50K'] = "Yes, I’ve had a single loss more than $50,000";
                }
            }
            if(claimCount < 2){
                questions['claimsLosses4years'] = "Less than 2 losses";
            }
            else if(claimCount >= 2 && claimCount < 5){
                questions['claimsLosses4years'] = "2 to 4 losses";
            }
            else{
                //no insurance for you!
                questions['claimsLosses4years'] = "5 or more losses";
            }
        });
        //PolicyQuestions
        this.app.applicationDocData.policies.forEach((policy) => {
            if(policy.policyType === "WC"){
                //Q: Prior Insurance?
                questions['scheduleRatingPriorInsurance'] = policy.coverageLapse ? "No" : "Yes";
            }
        });

        let curAnswers = await GreatAmericanApi.injectAnswers(this, token, session, questions);
        this.logApiCall('injectAnswers', [session, questions], curAnswers);
        if(!curAnswers){
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} WC Request injectAnswers Error: No reponse`);
            return this.return_result('error');
        }
        let questionnaire = curAnswers.riskSelection.data.answerSession.questionnaire;


        // Often times follow-up questions are offered by the Great American
        // API after the first request for questions. So keep injecting the
        // follow-up questions until all of the questions are answered.
        while (questionnaire.questionsAsked !== questionnaire.questionsAnswered) {
            this.log += `There are some follow up questions (${questionnaire.questionsAsked} questions asked but only ${questionnaire.questionsAnswered} questions answered)  @ ${__location}`;
            const oldQuestionsAnswered = questionnaire.questionsAnswered;

            curAnswers = await GreatAmericanApi.injectAnswers(this, token, curAnswers, questions);
            this.logApiCall('injectAnswers', [curAnswers, questions], curAnswers);
            questionnaire = curAnswers.riskSelection.data.answerSession.questionnaire;

            // Prevent infinite loops with this check. Every call to
            // injectAnswers should answer more questions. If we aren't getting
            // anywhere with these calls, then decline the quote.
            if (questionnaire.questionsAnswered === oldQuestionsAnswered) {
                this.log += `ERROR: No progress is being made in answering more questions. Current session: ${JSON.stringify(questionnaire, null, 2)} @ ${__location}`
                return this.return_result('declined');
            }
        }

        const quote = await GreatAmericanApi.getPricing(token, this, curAnswers.newBusiness.id).catch((err) => {
            error = err;
            log.error(`Appid: ${this.app.id} Great American WC: error ${err} ` + __location);
        });
        // logging should be at the raw request level.   not here. outbound logged before call.
        // response after call.[curAnswers.newBusiness.id] is not the payload......
        //this.logApiCall('getPricing', [curAnswers.newBusiness.id], quote);
        if(error){
            this.reasons.push(`Appid: ${this.app.id} ${this.insurer.name} WC Request Error: ${error}`);
            return this.return_result('error');
        }

        if (_.get(quote, 'rating.data.policy.id')) {
            this.amount = parseFloat(_.get(quote, 'rating.data.TotalResult'));
            this.writer = _.get(quote, 'rating.data.policy.company.name');
            this.number = _.get(quote, 'rating.data.policy.id');

            if (quote.newBusiness.status === 'REFERRAL' &&
                _.get(quote, 'rating.data.policy.company.name') !== 'Great American Insurance Company') {
                return this.return_result('referred');
            }
            this.log += 'Finished quoted!';
            return this.return_result('quoted');
        }
        else {
            this.log += 'Finished declined';
            return this.return_result('declined');
        }
    }
};