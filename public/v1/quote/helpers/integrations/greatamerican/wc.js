const builder = require('xmlbuilder');
const moment_timezone = require('moment-timezone');
const Integration = require('../Integration.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const superagent = require('superagent');
const _ = require('lodash');

const getToken = async () => {
    const uat = global.settings.GREAT_AMERICAN_UAT;
    const uatId = global.settings.GREAT_AMERICAN_UAT_ID;

    const headers = {
        httpHeader: [
            `Authorization: Basic ${Buffer.from(`${uatId}:${uat}`).toString('base64')}`,
            'Accept: application/json',
        ]
    };

    const apiCall = await superagent
        .post('https://uat01.api.gaig.com/oauth/accesstoken?grant_type=client_credentials')
        .set('Authorization', `Basic ${Buffer.from(`${uatId}:${uat}`).toString('base64')}`)
        .set('Accept', 'application/json');
    const out = JSON.parse(apiCall.res.text);
    if (!out.access_token) {
        throw new Error(out);
    }
    return out;
};


const getAppetite = async () => {
    const token = await getToken();

    const appetite = await superagent
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/appetite')
        .send({ product: { product: 'WC' } })
        .set('Authorization', `Bearer ${token.access_token}`)
        .set('Accept', 'application/json');

    const out = JSON.parse(appetite.res.text);
    if (_.get(out, 'product.data.classCodes'))
        return out.product.data.classCodes;
    else
        throw new Error(out);
}

/**
 * Starts a new question session with Great American.
 * 
 * @param {*} token 
 * @param {*} businessTypes An array of business types. Each entry should be in the format of:
 *    { id: ncciCode, value: 'GraphicDesign' }
 */
const getSession = async (token, businessTypes) => {
    const uat = global.settings.GREAT_AMERICAN_UAT;
    const uatId = global.settings.GREAT_AMERICAN_UAT_ID;

    const send = {
        riskSelection: {
            input: {
                line: "WC",
                date: '2021-01-04',
                contextData: {
                    businessTypes,
                    generalQuestionsOnly: false
                }
            },
            options: {
                questionnaireDetails: true
            }
        }
    };
    const apiCall = await superagent
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/eligibility')
        .send(send)
        .set('Authorization', `Bearer ${token.access_token}`)
        .set('Accept', 'application/json');
    return JSON.parse(apiCall.res.text);
};

const injectAnswers = async (token, fullQuestionSession, questionAnswers) => {
    const questionSession = _.cloneDeep(fullQuestionSession);
    const answerSession = _.get(questionSession, 'riskSelection.data.answerSession');
    const allGroups = _.get(answerSession, 'questionnaire.groups');

    // Set the 'answer' field of questions equal to the values specified in the
    // questionAnswers parameter.
    for (const group of allGroups) {
        for (const question of group.questions) {
            if (questionAnswers[question.questionId]) {
                let answer = questionAnswers[question.questionId]

                // If select box, then map the user-friendly value to the Great
                // American answerId value.
                if (question.answerType === 'SELECT') {
                    const gaOption = question.options.find(a => a.label === questionAnswers[question.questionId]);
                    if (!gaOption) {
                        throw new Error(`Cannot find value for option: ${questionAnswers[question.questionId]}`);
                    }
                    answer = gaOption.optionId;

                }
                // if (question.answerType === 'INTEGER') {
                //     answer = parseInt(questionAnswers[question.questionId], 10);
                // }
                question.answer = answer;
            }
        }
    }

    const newEligibilityParameters = _.cloneDeep(questionSession);
    delete newEligibilityParameters.riskSelection.data;
    newEligibilityParameters.riskSelection = {
        input: answerSession
    };

    const appetite = await superagent
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/eligibility')
        .send(newEligibilityParameters)
        .set('Authorization', `Bearer ${token.access_token}`)
        .set('Accept', 'application/json');
    return JSON.parse(appetite.res.text);
};


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
	 * Requests a quote from Liberty and returns. This request is not intended to be called directly.
	 *
	 * @returns {Promise.<object, Error>} A promise that returns an object containing quote information if resolved, or an Error if rejected
	 */
    async _insurer_quote() {
        //this.applicationDocData.activityCodes
        //this.insurer_wc_codes
        console.log('HITZ 1111', this.app.applicationDocData, this.industry_code.id);
        const codes = await Promise.all(Object.keys(this.insurer_wc_codes).map(
            code => this.get_insurer_code_for_activity_code(this.insurer.id, code.substr(0, 2), code.substr(2))
        ));
        // const codes = await Promise.all(this.app.applicationDocData.activityCodes.map(t => this.get_insurer_code_for_activity_code(this.insurer.id, t.ncciCode);

        const token = await getToken();
        const session = await getSession(token, codes.map(c => ({
            id: c.code,
            value: c.attributes.classIndustry
        })));

        const questions = {};
        for (const q of Object.values(this.questions)) {
            questions[this.question_identifiers[q.id]] = q.answer;
            // insurer = 26 and code = 4194 and territory = 
        }

        if (session.newBusiness.workflowControl !== 'CONTINUE') {
            throw new Error(`Great American returned a bad workflow control response: ${session.newBusiness.workflowControl}`);
        }

        const daAnswers = await injectAnswers(token, session, questions);
//generalEligibilityYearsOfExperience
        console.log('HITZ DECLINED', JSON.stringify(this, null, 2));
        console.log('HITZ 2', questions, session);
        return this.return_result('declined');
        // this.business.industry_code


    }
};