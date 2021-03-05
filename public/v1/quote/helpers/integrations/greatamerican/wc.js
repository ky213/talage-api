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

	/**
	 * Requests a quote from Great America and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        const codes = await Promise.all(Object.keys(this.insurer_wc_codes).map(
            code => this.get_insurer_code_for_activity_code(this.insurer.id, code.substr(0, 2), code.substr(2))
        ));

        const token = await GreatAmericanApi.getToken();
        const session = await GreatAmericanApi.getSession(token, codes.map(c => ({
            id: c.code,
            value: c.attributes.classIndustry
        })));

        const questions = {};
        for (const q of Object.values(this.questions)) {
            questions[this.question_identifiers[q.id]] = q.answer;
        }

        if (session.newBusiness.workflowControl !== 'CONTINUE') {
            throw new Error(`Great American returned a bad workflow control response: ${session.newBusiness.workflowControl}`);
        }

        // XXX: Temporarily hard-coding this question. Need to remove later.
        questions['generalEligibilityYearsOfExperience'] = '5';
        
        let curAnswers = await GreatAmericanApi.injectAnswers(token, session, questions);
        let questionnaire = curAnswers.riskSelection.data.answerSession.questionnaire;

        // Often times follow-up questions are offered by the Great American
        // API after the first request for questions. So keep injecting the
        // follow-up questions until all of the questions are answered.
        while (questionnaire.questionsAsked !== questionnaire.questionsAnswered) {
            console.log(`There are some follow up questions (${questionnaire.questionsAsked} questions asked but only ${questionnaire.questionsAnswered} questions answered)`);
            let oldQuestionsAnswered = questionnaire.questionsAnswered;

            curAnswers = await GreatAmericanApi.injectAnswers(token, curAnswers, questions);
            questionnaire = curAnswers.riskSelection.data.answerSession.questionnaire;

            // Prevent infinite loops with this check. Every call to
            // injectAnswers should answer more questions. If we aren't getting
            // anywhere with these calls, then throw an exception.
            if (questionnaire.questionsAnswered === oldQuestionsAnswered) {
                throw new Error('Feels like some Great American questions are not imported. It is asking additional questions unexpectedly');
            }
        }
        const quote = await GreatAmericanApi.getPricing(token, this.app, curAnswers.newBusiness.id);

        if (_.get(quote, 'rating.data.policy.id')) {
            this.amount = parseFloat(_.get(quote, 'rating.data.TotalResult'));
            this.writer = _.get(quote, 'rating.data.policy.company.name');
            this.number = _.get(quote, 'rating.data.policy.id');

            if (quote.newBusiness.status === 'REFERRAL' &&
                _.get(quote, 'rating.data.policy.company.name') !== 'Great American Insurance Company') {
                return this.return_result('referred');
            }
            return this.return_result('quoted');
        } else {
            return this.return_result('declined');
        }
    }
};