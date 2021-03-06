/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable dot-notation */
/* eslint-disable array-element-newline */
'use strict';
//const moment = require('moment');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const jsonFunctions = global.requireShared('./helpers/jsonFunctions.js');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

//const makeInt = true;

exports.process = async function(requestJSON) {

    // move to business and contact info
    // to businessInfo
    //Clean inputs
    // Should be in request
    const makeInt = true;
    requestJSON.solepro = stringFunctions.parseBool(requestJSON.solepro, false);
    requestJSON.solepro = requestJSON.solepro === true ? 1 : 0;
    requestJSON.wholesale = stringFunctions.parseBool(requestJSON.wholesale, false);
    requestJSON.wholesale = requestJSON.wholesale === true ? 1 : 0

    requestJSON.questions = {};

    if(requestJSON.agencyLocation){
        requestJSON.agency_location = stringFunctions.santizeNumber(requestJSON.agencyLocation, makeInt);
    }
    let question_answersJSON = null;
    if(requestJSON.question_answers){
        question_answersJSON = jsonFunctions.jsonParse(requestJSON.question_answers)
    }

    let question_defaultsJSON = null;
    if(requestJSON.question_defaults){
        question_defaultsJSON = jsonFunctions.jsonParse(requestJSON.question_defaults)
    }

    if(question_answersJSON && question_defaultsJSON){
        let questionList = [];
        for (const prop in question_defaultsJSON) {
            if(!question_answersJSON[prop]){
                question_answersJSON[prop] = question_defaultsJSON[prop];
            }
        }

        for (const questionId in question_answersJSON) {
            const questionJSON = getQuestionJSON(questionId, question_answersJSON[questionId]);
            questionList.push(questionJSON);
        }
        requestJSON.questions = questionList;

        // Email decision in Model.

    }
    else {
        log.error("QuestionParser: question set was missing questions. id " + requestJSON.id)
    }

    delete requestJSON.question_answers;
    delete requestJSON.question_defaults
    //delete requestJSON.agency_location

    //log.debug("Owners Question requestJSON: " + JSON.stringify(requestJSON));
    return true;
}

/**
 * Get question JSON for a given question ID and answer
 *
 * @param  {Number} questionId - The question ID
 * @param  {Object} questionAnswer - The question answer
 * @returns {Object} question JSON {id, answer, type}
 */
function getQuestionJSON(questionId, questionAnswer) {
    const question = {"id" :questionId};
    question.answer = questionAnswer;
    if(Array.isArray(question.answer)){
        question.type = "array";
    }
    else if(typeof question.answer === "string"){
        question.type = "text";
    }
    else {
        question.type = "numeric";
    }
    return question;
}

// Export getQuestionJSON so other parsers have access to it to handle their object-based questions (location, owner, etc...)
exports.getQuestionJSON = getQuestionJSON;