const jsrender = require('jsrender');
const fs = require('fs');
const moment = require('moment');

const template = jsrender.templates('./wc.xmlt');

const applicationData = JSON.parse(fs.readFileSync('./test-application.json'));
applicationData.get_years_in_business = function() {
	return 5;
};
applicationData.policy.effective_date = moment().add(1, 'days');
applicationData.policy.expiration_date = moment().add(1, 'years');
applicationData.validQuestions = [];
applicationData.determine_question_answer = function(question, required) {
	if (question.type !== 'Yes/No') {
		return null;
	}
	return question.answer;
};
const required_questions = [
	979
];
for(const question_id in applicationData.questions){
	if(Object.prototype.hasOwnProperty.call(applicationData.questions, question_id)){
		const question = applicationData.questions[question_id];

		question.get_answer_as_boolean = function() {
			return question.answer === 'Yes' || question.answer === 'YES';
		};

		// Don't process questions without a code (not for this insurer)
		const questionCode = applicationData.question_identifiers[question.id];
		if(!questionCode){
			continue;
		}

		// For Yes/No questions, if they are not required and the user answered 'No', simply don't send them
		if(!required_questions.includes(question.id) && question.type === 'Yes/No' && !question.hidden && !question.required && !question.get_answer_as_boolean()){
			continue;
		}

		// Get the answer
		let answer = '';
		try{
			answer = applicationData.determine_question_answer(question, required_questions.includes(question.id));
		}catch(error){
			console.log("BAD QUESTION 1");
			return;
		}

		// This question was not answered
		if(!answer){
			continue;
		}

		// Ensure the question is only yes/no
		if(question.type !== 'Yes/No'){
			console.log("BAD QUESTION 2");
			return;
		}
		
		// Save this as an answered question
		applicationData.validQuestions.push({
			entry: question,
			code: questionCode	
		});
	}
}

// Render the template and remove empty lines (remnants of control blocks)
const applicationText = template.render(applicationData).replace(/\n\s*\n/g,'\n');

console.log(applicationText);
// console.log(JSON.stringify(applicationData,null,4));