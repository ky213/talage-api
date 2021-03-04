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

const getNcciFromClassCode = async (code, territory) => {
    const talageCode = await db.query(`SELECT * FROM clw_talage_activity_codes WHERE insurer = 26 and code = ${code}`);
    const association = await db.query(`SELECT * FROM clw_talage_activity_code_associations WHERE `);
    const ncciCodes = await db.query(`SELECT * FROM clw_talage_insurer_ncci_codes WHERE territory = '${territory}' AND code = `)
}

const getPricing = async (token, app, sessionId) => {
    const appData = app.applicationDocData;

    let entityType;
    switch (appData.entityType) {
        case 'Association':
            entityType = 'UNIN';
            break;

        case 'Corporation':
            entityType = 'CCORP';
            break;

        case 'Limited Liability Company':
            entityType = 'LLC';
            break;

        case 'Limited Partnership':
            entityType = 'LP';
            break;

        case 'Partnership':
            entityType = 'PART';
            break;

        case 'Sole Proprietorship':
            entityType = 'SP';
            break;

        case 'Other':
        default:
            entityType = '--';
            break;
    }

    const send = {
        newBusiness: {
            id: sessionId
        },
        submission: {
            insuredName: appData.businessName,
            legalEntity: entityType,
            fein: appData.ein,
            insuredStreetAddress: appData.mailingAddress,
            insuredAddressLine2: appData.mailingAddress2,
            insuredCity: appData.mailingCity,
            insuredStateCode: appData.mailingState,
            insuredZipCode: appData.mailingZipcode,
            insuredCountryCode: 'US',
            insuredEmail: appData.contacts[0].email,
            contactPhone: appData.contacts[0].phone,
            contactName: `${appData.contacts[0].firstName} ${appData.contacts[0].lastName}`,
            currentPolicyExpiration: '',
            policyEffectiveDate: app.policies[0].effective_date.format('YYYY-MM-DD'),
            policyExpirationDate: app.policies[0].expiration_date.format('YYYY-MM-DD'),
            includeBlanketWaiver: true,
            producerCode: 648783,
            locations: appData.locations.map(location => ({
                id: location.locationId,
                streetAddress: location.address,
                addressLine2: location.address2,
                city: location.city,
                state: location.state,
                zip: location.zipcode,
                classCodes: location.activityPayrollList.map(code => ({
                    classCode: '8001',
                    payroll: code.payroll,
                    numberOfEmployees: _.sum(code.employeeTypeList.map(t => t.employeeTypeCount))
                }))
            }))
        }
    };
    // let code = await getNcciFromClassCode(4194);
    const apiCall = await superagent
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/pricing')
        .send(send)
        .set('Authorization', `Bearer ${token.access_token}`)
        .set('Accept', 'application/json');
    return JSON.parse(apiCall.res.text);
}

// pricing -> agent move to insured
// -> /submit
//      -> bind
//      -> generate policy #
const getQuote = async (token, sessionId) => {
    const send = {
        newBusiness: {
            id: sessionId
        }
    };
    const apiCall = await superagent
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/submit')
        .send(send)
        .set('Authorization', `Bearer ${token.access_token}`)
        .set('Accept', 'application/json');
    return JSON.parse(apiCall.res.text);
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
            if (!questionAnswers[question.questionId]) {
                questionAnswers[question.questionId] = 1;
               continue;
            }
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

module.exports = {
    getSession,
    getQuote,
    getPricing,
    getNcciFromClassCode,
    getAppetite,
    getToken,
    injectAnswers
}