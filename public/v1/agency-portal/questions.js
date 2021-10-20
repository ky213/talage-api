/* eslint-disable no-loop-func */
'use strict';


const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuestionBO = global.requireShared('models/Question-BO.js');
const log = global.log;

/**
 * A function to get the answer from a question
 * @param {object} appQuestion - The answer from a question in the form of a string
 * @return {string} - The answer
 */
function getAnswer(appQuestion) {
    //TODO check for answer list and get descriptions
    if(appQuestion){
        let answerValue = appQuestion.answerValue;
        if(appQuestion.answerList && appQuestion.answerList.length > 0){
            answerValue = "";
            for(let i = 0; i < appQuestion.answerList.length; i++){
                if(i > 0){
                    answerValue += ", ";
                }
                answerValue += appQuestion.answerList[i];
            }
        }
        return answerValue;
    }
    else {
        return "";
    }
}

/**
 * Recursive function for digging through children to find a parent
 *
 * @param {Array<Object>} questions - array of questions (children of a previous parent)
 * @param {Number} parentId - The parent ID of the question being looked for
 *
 * @returns {Object} - The parent question
 */
function _findQuestion(questions, parentId) {
    if (questions[parentId]) {
        return questions[parentId];
    }
    else {
        for (const question of Object.values(questions)) {
            const foundQuestion = _findQuestion(question.children);

            if (foundQuestion) {
                return foundQuestion;
            }
        }
    }

    return;
}

/**
 * A function to determine whether the answer is an empty checkbox answer or not. Empty checkbox answers are just a series of verticle brackets (i.e. |||)
 *
 * @param {String} answer - A question answer
 *
 * @returns {Boolean} - Whether or not the answer is an empty checkbox answer or not
 */
function isBlankCheckboxAnswer(answer) {
    if (answer.length === 0) {
        return false;
    }

    if (typeof answer !== "string") {
        return false;
    }

    for (const character of answer.trim()) {
        if (character !== "|") {
            return false;
        }
    }

    return true;
}

/**
 * Responds to get requests for the Questions endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getQuestions(req, res, next) {
    let error = false;
    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: No data received');
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Make sure basic elements are present
    if (!req.query.application_id) {
        log.info('Bad Request: Missing Application ID');
        return next(serverHelper.requestError('Bad Request: You must supply an application ID'));
    }

    // // Validate the application ID
    // if (!await validator.is_valid_id(req.query.application_id)) {
    //     log.info('Bad Request: Invalid application id');
    //     return next(serverHelper.requestError('Invalid application id'));
    // }
    const appId = req.query.application_id;

    let passedAgencyCheck = false;
    let applicationJSON = null;
    try{
        const applicationBO = new ApplicationBO();
        const applicationDBDoc = await applicationBO.getById(appId);
        if(applicationDBDoc){
            if(req.authentication.isAgencyNetworkUser && applicationDBDoc.agencyNetworkId === req.authentication.agencyNetworkId){
                passedAgencyCheck = true;
            }
            else {
                const agents = await auth.getAgents(req).catch(function(e) {
                    error = e;
                });
                if (error) {
                    log.error('Error get application getAgents ' + error + __location);
                    return next(error);
                }
                if(agents.includes(applicationDBDoc.agencyId)){
                    passedAgencyCheck = true;
                }
            }
        }
        if(applicationDBDoc){
            applicationJSON = JSON.parse(JSON.stringify(applicationDBDoc))
        }
    }
    catch(err){
        log.error(`Error Getting application do appId ${appId} ` + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(applicationJSON && applicationJSON.applicationId && passedAgencyCheck === false){
        log.info(`Forbidden: User is not authorized for this application ${appId}` + __location);
        //Return not found so do not expose that the application exists
        return next(serverHelper.notFoundError('Application Not Found'));
    }

    if (applicationJSON.questions && applicationJSON.questions.length > 0) {
        // copy app questions
        const appQuestions = JSON.parse(JSON.stringify(applicationJSON.questions));
        const questions = {};
        const questionBO = new QuestionBO();

        let prevQuestionCount = appQuestions.length;
        let executionCount = 0;
        // NOTE Question Text must be from Application in case questions have been edited.
        while (appQuestions.length > 0) {
            // if we've done one full round of question processing...
            if (executionCount === prevQuestionCount) {
                // if the count of appQuestions didn't change, we're just spinning in the while loop, exit out
                if (appQuestions.length === prevQuestionCount) {
                    log.warn(`Application ${appId} ${appQuestions.length} remaining child questions could not be properly processed. These questions are likely unanswered children questions. Skipping... ` + __location);
                    break;
                }

                // else update prev question count and reset execution counter
                prevQuestionCount = appQuestions.length;
                executionCount = 0;
            }

            const question = appQuestions.splice(0, 1)[0];

            // Grab question data from DB
            let dbQuestion = null;
            try {
                dbQuestion = await questionBO.getById(question.questionId)
            }
            catch (e) {
                log.warn(`Application ${appId} - An error occurred trying to grab question ${question.questionId}: ${e}. It might no longer be in the database.` + __location);

                // question no longer in the db, add it as parent
                questions[question.questionId] = {
                    answer: getAnswer(question),
                    answerId: question.answerId,
                    children: {},
                    question: question.questionText,
                    questionId: question.questionId
                };

                executionCount++;
                continue;
            }

            if(!dbQuestion){
                log.warn(`Application ${appId} - Could not find question ${question.questionId} in the database.` + __location);

                // question no longer in the db, add it as parent
                questions[question.questionId] = {
                    answer: getAnswer(question),
                    answerId: question.answerId,
                    children: {},
                    question: question.questionText,
                    questionId: question.questionId
                };

                executionCount++;
                continue;
            }

            // if question is not a child, just add it
            if (!dbQuestion.parent) {
                questions[question.questionId] = {
                    answer: getAnswer(question),
                    answerId: question.answerId,
                    children: {},
                    question: question.questionText,
                    questionId: question.questionId
                };
            }
            else {
                // else it's a child (potentially both), find its parent
                const parent = _findQuestion(questions, dbQuestion.parent);

                // if the parent wasn't found...
                if (!parent) {
                    // add it back in to be processed later
                    appQuestions.push(question);
                    executionCount++;
                    continue;
                }

                // if the child question was answered, or its a text question that was answered and it's not checkbox question that was unanswered
                const questionAnswer = getAnswer(question);
                if (dbQuestion.parent_answer === parent.answerId ||
                    !question.answerId && questionAnswer && questionAnswer.trim().length > 0 && !isBlankCheckboxAnswer(questionAnswer)) {
                    // add the child question to the parent's children map
                    parent.children[question.questionId] = {
                        answer: getAnswer(question),
                        answerId: question.answerId,
                        children: {},
                        question: question.questionText,
                        questionId: question.questionId
                    };
                }
            }

            executionCount++;
        }

        res.send(200, {"questions": questions});
    }
    else {
        // no questions to return, pass empty object
        res.send(200, {"questions": {}});
    }


    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get questions', `${basePath}/questions`, getQuestions, 'applications', 'view');
};