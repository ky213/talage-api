const builder = require('xmlbuilder');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const superagent = require('superagent');
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
        this.log += `Location: ${__location}<br><br>`;
        this.log += `Params: ${JSON.stringify(params, null, 2)}<br><br>`;
        this.log += `<pre>${JSON.stringify(out, null, 2)}</pre><br><br>`;
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
        const codes = await Promise.all(Object.keys(this.insurer_wc_codes).map(
            code => this.get_insurer_code_for_activity_code(this.insurer.id, code.substr(0, 2), code.substr(2))
        ));

        const token = await GreatAmericanApi.getToken(this);

        let sessionCodes = codes.map(c => ({
            id: c.code,
            value: c.attributes.classIndustry
        }));
        // GA only wants the first activity code passed to their API endpoint.
        sessionCodes = [sessionCodes[0]];
        const session = await GreatAmericanApi.getSession(this, token, sessionCodes);
        this.logApiCall('getSession', [sessionCodes], session);

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

        // XXX: Temporarily hard-coding this question. Need to remove later.
        questions['generalEligibilityYearsOfExperience'] = '5';
        
        let curAnswers = await GreatAmericanApi.injectAnswers(this, token, session, questions);
        this.logApiCall('injectAnswers', [session, questions], curAnswers);
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
        const quote = await GreatAmericanApi.getPricing(token, this, curAnswers.newBusiness.id);
        this.logApiCall('getPricing', [curAnswers.newBusiness.id], quote);

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
        } else {
            this.log += 'Finished declined';
            return this.return_result('declined');
        }
    }
};