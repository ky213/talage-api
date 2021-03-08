const axios = require('axios');
const _ = require('lodash');

const getToken = async () => {
    const uat = global.settings.GREAT_AMERICAN_UAT;
    const uatId = global.settings.GREAT_AMERICAN_UAT_ID;

    const options = {
        headers: {
            Authorization: `Basic ${Buffer.from(`${uatId}:${uat}`).toString('base64')}`,
            Accept: 'application/json',
        }
    };

    const apiCall = await axios.post('https://uat01.api.gaig.com/oauth/accesstoken?grant_type=client_credentials', null, options);
    const out = apiCall.data;
    if (!out.access_token) {
        throw new Error(out);
    }
    return out;
};

const getAppetite = async () => {
    const token = await getToken();
    const options = {
        headers: {
            Authorization: `Bearer ${token.access_token}`,
            Accept: 'application/json',
        }
    };

    const postData = { product: { product: 'WC' } }

    const appetite = await axios.post(
        'https://uat01.api.gaig.com/shop/api/newBusiness/appetite',
        postData,
        options);

    const out = appetite.data;
    if (_.get(out, 'product.data.classCodes'))
        return out.product.data.classCodes;
    else
        throw new Error(out);
}

const getNcciFromClassCode = async (code, territory) => {
    const talageCode = await db.query(`
        SELECT
            inc.code
        FROM clw_talage_activity_codes AS ac
        LEFT JOIN clw_talage_activity_code_associations AS aca ON ac.id = aca.code
        LEFT JOIN clw_talage_insurer_ncci_codes AS inc ON aca.insurer_code = inc.id
        WHERE
            inc.insurer = 26 AND inc.territory = '${territory}' AND ac.id = ${code}`);
    if (talageCode.length <= 0) {
        throw new Error(`Code could not be found: ${code} / ${territory}`);
    }
    return talageCode[0].code;
}

/**
 * If you answered all of the questions from Great American in a question
 * session, then you can use this function to ask for a quote. If the policy is
 * rejected by Great American, then the object returned will have a failed
 * status.
 * 
 * @param {*} token 
 * @param {*} app 
 * @param {*} sessionId 
 */
const getPricing = async (token, app, sessionId) => {
    const appData = app.applicationDocData;

    // Map our entity types to the entity types of Great America.
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
            locations: await Promise.all(appData.locations.map(async (location) => ({
                id: location.locationId,
                streetAddress: location.address,
                addressLine2: location.address2,
                city: location.city,
                state: location.state,
                zip: location.zipcode,
                classCodes: await Promise.all(location.activityPayrollList.map(async (code) => ({
                    classCode: await getNcciFromClassCode(code.ncciCode, location.state),
                    payroll: code.payroll,
                    numberOfEmployees: _.sum(code.employeeTypeList.map(t => t.employeeTypeCount))
                })))
            })))
        }
    };
    const apiCall = await axios
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/pricing', send, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/json',
            }
        });
    return apiCall.data;
}

const getQuote = async (token, sessionId) => {
    const send = {
        newBusiness: {
            id: sessionId
        }
    };
    const apiCall = await axios
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/submit', send, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/json',
            }
        });
    return apiCall.data;
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
    const apiCall = await axios
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/eligibility', send, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/json',
            }
        });
    return apiCall.data;
};

/**
 * This function will update the current question session with GreatAmerica
 * with the answers to the questions that you provided. Then return the new
 * question result (which will tell you if there are more follow-up questions).
 * @param {*} token 
 * @param {*} fullQuestionSession 
 * @param {*} questionAnswers An object (key-value pair) where the key is the
 *   question ID and the value is the answer to the question.
 */
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
            question.answer = answer;
        }
    }

    const newEligibilityParameters = _.cloneDeep(questionSession);
    delete newEligibilityParameters.riskSelection.data;
    newEligibilityParameters.riskSelection = {
        input: answerSession
    };

    const appetite = await axios
        .post('https://uat01.api.gaig.com/shop/api/newBusiness/eligibility', newEligibilityParameters, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/json',
            }
        });
    return appetite.data;
};

module.exports = {
    getSession,
    getQuote,
    getPricing,
    getAppetite,
    getToken,
    injectAnswers
}