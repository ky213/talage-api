/* eslint-disable valid-jsdoc */
/* eslint-disable object-curly-newline */
const axios = require('axios');
const _ = require('lodash');
const log = global.log;

const getApiUrl = (integration) => {
    if (integration.insurer.useSandbox) {
        return 'https://uat01.api.gaig.com';
    }
    return 'https://uat01.api.gaig.com';
}

const getToken = async (integration, username, password) => {

    const options = {
        headers: {
            Authorization: `Basic ${Buffer.from(`${integration.username}:${integration.password}`).toString('base64')}`,
            Accept: 'application/json'
        }
    };

    let out = null;
    try{
        const apiCall = await axios.post(`${getApiUrl(integration)}/oauth/accesstoken?grant_type=client_credentials`, null, options);
        out = apiCall.data;
    }
    catch(err){
        //console.log(err);
        log.error(`Error getting token from Great American ${err} @ ${__location}`)
    }

    if (!out.access_token) {
        log.error(`NO access token returned: ${JSON.stringify(out, null, 2)} @ ${__location}`);
        throw new Error(`NO access token returned: ${JSON.stringify(out, null, 2)}`);
    }
    return out;
};

const getNcciFromClassCode = async (code, territory) => {

    const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
    const activityCodeQuery = {
        insurerId: 26,
        talageActivityCodeIdList: code,
        territoryList: territory,
        active: true
    }

    const insurerActivityCode = await InsurerActivityCodeModel.findOne(activityCodeQuery)
    if(insurerActivityCode){
        return insurerActivityCode.code
    }
    else{
        log.error(`Code could not be found: ${code} / ${territory} @ ${__location}`);
        throw new Error(`Code could not be found: ${code} / ${territory}`);
    }

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
const getPricing = async (token, integration, sessionId) => {
    const appData = integration.app.applicationDocData;

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

    // Retrieve the primary contact.
    let primaryContact;
    let allPrimaryContacts = appData.contacts.filter(t => t.primary);
    if (allPrimaryContacts.length > 0) {
        primaryContact = allPrimaryContacts[0];
    } else {
        primaryContact = appData.contacts[0];
    }

    //correct activitycodeId vs ncciCode.
    appData.locations.forEach((location) => {
        location.activityPayrollList.forEach((payroll) => {
            if(!payroll.activtyCodeId){
                payroll.activtyCodeId = payroll.ncciCode;
            }
        });
    });


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
            insuredEmail: primaryContact.email,
            contactPhone: primaryContact.phone,
            contactName: `${primaryContact.firstName} ${primaryContact.lastName}`,
            currentPolicyExpiration: '',
            policyEffectiveDate: integration.policy.effective_date.format('YYYY-MM-DD'),
            policyExpirationDate: integration.policy.expiration_date.format('YYYY-MM-DD'),
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
                    classCode: await getNcciFromClassCode(code.activtyCodeId, location.state),
                    payroll: code.payroll,
                    numberOfEmployees: _.sum(code.employeeTypeList.map(t => t.employeeTypeCount))
                })))
            })))
        }
    };
    let apiCall = null;
    try{
        integration.log += `----pricing ${getApiUrl(integration)}/shop/api/newBusiness/pricing -----\n`
        integration.log += `<pre>${JSON.stringify(send, null, 2)}</pre>`;
        apiCall = await axios.post(`${getApiUrl(integration)}/shop/api/newBusiness/pricing`, send, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/json',
            }
        });
    }
    catch(err){
        //because we like knowing where things went wrong.
        log.error(`AppId: ${integration.appId} get getPricing error ${err} ` + __location);
        integration.log += "\nError Response: \n ";
        integration.log += err;
        integration.log += "\n";
    }
    if(apiCall){
        integration.log += `----Response -----\n`
        integration.log += `<pre>${JSON.stringify(apiCall.data, null, 2)}</pre>`;
        return apiCall.data;
    }
    else {
        return null;
    }
}

const getQuote = async (integration, token, sessionId) => {
    const send = {
        newBusiness: {
            id: sessionId
        }
    };

    let apiCall = null;
    try{
        integration.log += `----submit ${getApiUrl(integration)}/shop/api/newBusiness/submit -----\n`
        integration.log += `<pre>${JSON.stringify(send, null, 2)}</pre>`;
        apiCall = await axios.post(`${getApiUrl(integration)}/shop/api/newBusiness/submit`, send, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/json',
            }
        });
    }
    catch(err){
        //because we like knowing where things went wrong.
        log.error(`AppId: ${integration.appId} get session error ${err} ` + __location);
        integration.log += "\nError Response: \n ";
        integration.log += err;
        integration.log += "\n";
    }
    if(apiCall){
        integration.log += `----Response -----\n`
        integration.log += `<pre>${JSON.stringify(apiCall.data, null, 2)}</pre>`;
        return apiCall.data;
    }
    else {
        return null;
    }
}

/**
 * Starts a new question session with Great American.
 *
 * @param {*} integration integration object
 * @param {*} token  auth token
 * @param {*} businessTypes An array of business types. Each entry should be in the format of:
 *    { id: ncciCode, value: 'GraphicDesign' } 
 */
const getSession = async (integration, token, businessTypes) => {
    // const uat = global.settings.GREAT_AMERICAN_UAT;
    // const uatId = global.settings.GREAT_AMERICAN_UAT_ID;

    const send = {
        riskSelection: {
            input: {
                line: "WC",
                date: '2021-01-04',
                contextData: {
                    businessTypes: businessTypes,
                    generalQuestionsOnly: false
                }
            },
            options: {
                questionnaireDetails: true
            }
        }
    };
    let apiCall = null;
    integration.log += `----getSession ${getApiUrl(integration)}/shop/api/newBusiness/eligibility -----\n`
    integration.log += `<pre>${JSON.stringify(send, null, 2)}</pre>`;
    try{
        apiCall = await axios.post(`${getApiUrl(integration)}/shop/api/newBusiness/eligibility`, send, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/json'
            }
        });
    }
    catch(err){
        //because we like knowing where things went wrong.
        log.error(`AppId: ${integration.app.applicationDocData.applicationId} get session error ${err} ` + __location);
        integration.log += "\nError Response: \n ";
        integration.log += err;
        integration.log += "\n";
    }
    if(apiCall){
        integration.log += `----Response -----\n`
        integration.log += `<pre>${JSON.stringify(apiCall.data, null, 2)}</pre>`;
        return apiCall.data;
    }
    else {
        return null;
    }
};


/**
 * This function will update the current question session with GreatAmerica
 * with the answers to the questions that you provided. Then return the new
 * question result (which will tell you if there are more follow-up questions).
 * @param {*} integration  
 * @param {*} token 
 * @param {*} fullQuestionSession 
 * @param {*} questionAnswers An object (key-value pair) where the key is the
 *   question ID and the value is the answer to the question.
 */
const injectAnswers = async (integration, token, fullQuestionSession, questionAnswers) => {
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
                    log.error(`Cannot find value for question ${question.questionId} option: ${questionAnswers[question.questionId]} in group.question ${JSON.stringify(question)} @ ${__location}`);
                    // let insurer reject it for missing question
                    throw new Error(`Cannot find value for question ${question.questionId}  option: ${questionAnswers[question.questionId]}`);
                    //continue;
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
    let appetite = null;
    try{
        appetite = await axios.post(`${getApiUrl(integration)}/shop/api/newBusiness/eligibility`, newEligibilityParameters, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/json'
            }
        });
    }
    catch(err){
        //because we like knowing where things went wrong.
        log.error(`AppId: ${integration.appId} get session error ${err} ` + __location);
    }
    if(appetite){
        return appetite.data;
    }
    else {
        return null;
    }
};

module.exports = {
    getSession,
    getQuote,
    getPricing,
    getToken,
    injectAnswers
}