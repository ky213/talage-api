'use strict';

const validator = requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');

/**
 * A function to get the answer from a question
 * @param {object} question - The answer from a question in the form of a string
 * @return {string} - The answer
 */
function getAnswer(question) {
	if (Object.prototype.hasOwnProperty.call(question, 'answer') && question.answer !== null) {
		return question.answer;
	} else if (Object.prototype.hasOwnProperty.call(question, 'text_answer') && question.text_answer !== null) {
		return question.text_answer;
	}
	return '';

}

/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetQuestions(req, res, next) {
	// Check for data
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.info('Bad Request: No data received');
		return next(serverHelper.RequestError('Bad Request: No data received'));
	}

	// Make sure basic elements are present
	if (!req.query.application_id) {
		log.info('Bad Request: Missing Application ID');
		return next(serverHelper.RequestError('Bad Request: You must supply an application ID'));
	}

	// Validate the application ID
	if (!await validator.is_valid_id(req.query.application_id)) {
		log.info('Bad Request: Invalid application id');
		return next(serverHelper.RequestError('Invalid application id'));
	}

	const sql = `SELECT qa.answer, aq.text_answer, tq.id, tq.type, tq.parent, tq.parent_answer, tq.sub_level, tq.question
						FROM \`#__application_questions\` AS aq
						LEFT JOIN \`#__questions\` AS tq ON aq.question = tq.id
						LEFT JOIN \`#__question_answers\` AS qa ON aq.answer = qa.id
						WHERE aq.application = ${req.query.application_id}
						ORDER BY tq.parent`;

	const rawQuestionData = await db.query(sql).catch(function (err) {
		log.error(err.message);
		return next(serverHelper.InternalServerError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});


	// The object which will hold all the questions in the correct nesting
	const dependencyList = {};
	// The object to hold child ID: parentID
	const childToParent = {};

	// Go through the data and build place the child questions under their parents
	rawQuestionData.forEach((question) => {

		// If this question is a parent then add its info
		if (question.parent === null) {
			dependencyList[question.id] = {
				'answer': getAnswer(question),
				'children': {},
				'question': question.question
			};
			// If this question is a child add to the children array
		} else {

			// Store the relationship between this question and its parent
			childToParent[question.id] = question.parent;

			// The array of the IDs of all the parents for this question
			const listOfParents = [question.parent];

			// Add all the parent IDs all the way to the top level
			while (childToParent[listOfParents.slice(-1)[0]]) {
				listOfParents.push(childToParent[listOfParents.slice(-1)[0]]);
			}

			// Build a string that will put this question in the proper nesting
			let str = `dependencyList['${listOfParents.pop()}']`;
			for (let i = 0; i < listOfParents.length; i++) {
				str += `.children['${listOfParents.pop()}']`;
			}

			str += `.children['${question.id}'] = { question: ${db.escape(question.question)}, answer: ${db.escape(getAnswer(question))}, children: {}};`;

			/*
			 * Evaluate the string as a command
			 * If there is messed up data and the eval doesn't work, then catch the error and move on
			 */
			try {
				// eslint-disable-next-line  no-eval
				eval(str);
			} catch (e) {
				log.error(e.message);
			}
		}
	});

	res.send(200, { 'questions': dependencyList });
	return next();
}

exports.RegisterEndpoint = (server, basePath) => {
	server.AddGetAuth('Get questions', basePath + '/questions', GetQuestions);
};