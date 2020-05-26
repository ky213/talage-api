'use strict';

const validator = global.requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');
const auth = require('./helpers/auth.js');

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
	let error = false;

	// Check for data
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.info('Bad Request: No data received');
		return next(serverHelper.requestError('Bad Request: No data received'));
	}

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'applications', 'view').catch(function (e) {
		error = e;
	});
	if (error) {
		return next(error);
	}

	// Make sure basic elements are present
	if (!req.query.application_id) {
		log.info('Bad Request: Missing Application ID');
		return next(serverHelper.requestError('Bad Request: You must supply an application ID'));
	}

	// Validate the application ID
	if (!await validator.is_valid_id(req.query.application_id)) {
		log.info('Bad Request: Invalid application id');
		return next(serverHelper.requestError('Invalid application id'));
	}

	const sql = `SELECT qa.answer, aq.text_answer, tq.id, tq.type, tq.parent, tq.parent_answer, tq.sub_level, tq.question
						FROM \`#__application_questions\` AS aq
						LEFT JOIN \`#__questions\` AS tq ON aq.question = tq.id
						LEFT JOIN \`#__question_answers\` AS qa ON aq.answer = qa.id
						WHERE aq.application = ${req.query.application_id}
						ORDER BY tq.parent`;

	const rawQuestionData = await db.query(sql).catch(function (err) {
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});


	// The object which will hold all the questions in the correct nesting
	const dependencyList = {};
	// The object to hold child ID: childId
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

			let childId = listOfParents.pop();

			//If parent of childId does not exist
			if (!dependencyList.hasOwnProperty(childId)) {
				log.error(`Child ${childId} Does Not Exist: question.parent=${question.parent} question.id=${question.id} listOfParents=${listOfParents}`);
				return;
			}

			let child = dependencyList[childId];
			//Build objects for parents with children questions for dependencyList
			do {
				if (!child) {
					log.error(`Child ${childId} Does Not Exist: question.parent=${question.parent} question.id=${question.id} listOfParents=${listOfParents}`);
					return;
				}
				childId = listOfParents.pop();
				//If childId is undefined, listofParents is empty, build child object
				if (childId) {
					child = child.children[childId];
				}
				else {
					childId = question.id;
					child.children[childId] = { 'question': question.question, 'answer': question.answer, 'children': {} };
				}
			} while (childId !== question.id)

		}
	});

	res.send(200, { 'questions': dependencyList });
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get questions', `${basePath}/questions`, GetQuestions);
};