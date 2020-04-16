'use strict';

const util = require('util');

/**
 * Parses through the questions we have recieved to see if any are missing based on those referenced as the 'parent' of an existing question
 *
 * @param {array} questions - An array of objects, each containing question data
 *
 * @returns {mixed} - An array of IDs if questions are missing, false if none are
 */
function find_missing_questions(questions) {
	const missing_questions = [];

	// Get a list of question IDs for easier reference
	const question_ids = questions.map(function (question) {
		return question.id;
	});

	// Loop through each question and make sure it's parent is in our question_ids
	questions.forEach(function (question) {
		if (question.parent) {
			if (!question_ids.includes(question.parent)) {
				missing_questions.push(question.parent);
			}
		}
	});
	return missing_questions.length ? missing_questions : false;
}

/**
 * Returns all questions related to given params
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetQuestions(req, res, next) {

	/* ---=== Check Request Requirements ===--- */

	// Check for data
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.warn('Bad Request: Required data missing. Please see documentation.');
		return next(ServerBadRequestError('Required data missing. Please see documentation.'));
	}

	log.verbose(util.inspect(req.query));

	// Make sure basic elements are present
	if (!req.query.policy_types) {
		log.warn('Bad Request: Missing Policy Types');
		return next(ServerBadRequestError('You must supply one or more policy types'));
	}

	// Make sure the proper codes were supplied
	if (req.query.policy_types.includes('BOP') || req.query.policy_types.includes('GL')) {
		if (!req.query.industry_code) {
			log.warn('Bad Request: Missing Industry Code');
			return next(ServerBadRequestError('You must supply an industry code'));
		}
	}
	if (req.query.policy_types.includes('WC')) {
		if (!req.query.activity_codes) {
			log.warn('Bad Request: Missing Activity Codes');
			return next(ServerBadRequestError('You must supply one or more activity codes'));
		}
	}

	// Make sure a zip code was provided
	if (!Object.prototype.hasOwnProperty.call(req.query, 'zips') || !req.query.zips) {
		log.warn('Bad Request: Missing Zip Codes');
		return next(ServerBadRequestError('You must supply at least one zip code'));
	}

	// Check if we should return hidden questions also
	let return_hidden = false;
	if (req.query.hidden && req.query.hidden === 'true') {
		log.info('Returning hidden questions as well');
		return_hidden = true;
	}

	/* ---=== Validate Input ===--- */

	const activity_codes = [];
	const insurers = [];
	const policy_types = [];
	const zips = req.query.zips.split(',').map(function (zip) {
		return zip ? zip.replace(/[^0-9]/gi, '') : 0;
	});
	const industry_code = req.query.industry_code ? parseInt(req.query.industry_code, 10) : 0;

	// Do not permit requests that include both BOP and GL
	if (req.query.policy_types.includes('BOP') && req.query.policy_types.includes('GL')) {
		log.warn('Bad Request: Both BOP and GL are not allowed, must be one or the other');
		return next(ServerBadRequestError('Both BOP and GL are not allowed, please choose one or the other'));
	}

	// Sanitize and de-duplicate
	if (req.query.policy_types.includes('WC')) {
		if (req.query.activity_codes) {
			req.query.activity_codes.split(',').forEach(function (activity_code) {
				const int_code = parseInt(activity_code, 10);
				if (!activity_codes.includes(int_code)) {
					activity_codes.push(int_code);
				}
			});
		}
	}

	if (req.query.insurers) {
		let invalid_insurer = false;
		await req.query.insurers.split(',').forEach(function (insurer) {
			const insurer_id = parseInt(insurer, 10);
			if (isNaN(insurer_id)) {
				log.warn('Bad Request: Invalid insurer');
				invalid_insurer = true;
			}
			insurers.push(insurer_id);
		});
		if (invalid_insurer) {
			return next(ServerBadRequestError('Bad Request: Invalid Insurer'));
		}
	}

	req.query.policy_types.split(',').forEach(function (policy_type) {
		policy_types.push(policy_type.replace(/[^a-z]/gi, '').toUpperCase());
	});

	/* ---=== Validate Input ===--- */

	let error = false;
	let sql = '';

	// Check that each activity code is valid
	if (activity_codes.length) {
		sql = `SELECT id FROM #__activity_codes WHERE id IN (${activity_codes.join(',')}) AND state = 1;`;
		const activity_code_result = await db.query(sql).catch(function (err) {
			error = err.message;
		});
		if (activity_code_result && activity_code_result.length !== activity_codes.length) {
			log.warn('Bad Request: Invalid Activity Code(s)');
			error = 'One or more of the activity codes supplied is invalid';
		}
		if (error) {
			return next(ServerBadRequestError(error));
		}
	}

	// Check if the industry code is valid
	if (industry_code) {
		sql = `SELECT id FROM #__industry_codes WHERE id = ${db.escape(industry_code)} AND state = 1 LIMIT 1;`;
		const industry_code_result = await db.query(sql).catch(function (err) {
			error = err.message;
		});
		if (industry_code_result && industry_code_result.length !== 1) {
			log.warn('Bad Request: Invalid Industry Code');
			error = 'The industry code supplied is invalid';
		}
		if (error) {
			return next(ServerBadRequestError(error));
		}
	}

	// Check that insurers were valid
	if (insurers.length) {
		sql = `SELECT id FROM #__insurers WHERE id IN (${insurers.join(',')}) AND state = 1;`;
		const insurers_result = await db.query(sql).catch(function (err) {
			error = err.message;
		});
		if (insurers_result && insurers_result.length !== insurers.length) {
			log.warn('Bad Request: Invalid Insurer(s)');
			error = 'One or more of the insurers supplied is invalid';
		}
		if (error) {
			return next(ServerBadRequestError(error));
		}
	}

	// Get Policy Types from the database
	sql = 'SELECT abbr FROM #__policy_types;';
	const policy_types_result = await db.query(sql).catch(function (err) {
		error = err.message;
	});
	if (error) {
		return next(ServerBadRequestError(error));
	}

	// Prepare the response
	const supported_policy_types = [];
	policy_types_result.forEach(function (policy_type) {
		supported_policy_types.push(policy_type.abbr);
	});

	// Check that all policy types match
	policy_types.forEach(function (policy_type) {
		if (!supported_policy_types.includes(policy_type)) {
			log.warn('Bad Request: Invalid Policy Type');
			error = `Policy type '${policy_type}' is not supported.`;
		}
	});
	if (error) {
		return next(ServerBadRequestError(error));
	}

	// Check that the zip code is valid
	const territories = [];
	if (!zips || !zips.length) {
		log.warn('Bad Request: Zip Codes');
		return next(ServerBadRequestError('You must supply at least one zip code'));
	}

	sql = `SELECT DISTINCT territory FROM #__zip_codes WHERE zip IN (${zips.join(',')});`;
	const zip_result = await db.query(sql).catch(function (err) {
		error = err.message;
	});
	if (error) {
		return next(ServerBadRequestError(error));
	}
	if (zip_result && zip_result.length >= 1) {
		zip_result.forEach(function (result) {
			territories.push(result.territory);
		});
	} else {
		log.warn('Bad Request: Zip Code');
		return next(ServerBadRequestError('The zip code(s) supplied is/are invalid'));
	}

	/* ---=== Get The Applicable Questions ===--- */


	// The following is a temporary hack while questions are in transition

	// Build the select and where statements
	const select = `q.id, q.parent, q.parent_answer, q.sub_level, q.question AS \`text\`, q.hint, q.type AS type_id, qt.name AS type, q.hidden${return_hidden ? ', GROUP_CONCAT(DISTINCT CONCAT(iq.insurer, "-", iq.policy_type)) AS insurers' : ''}`;
	let where = `q.state = 1${insurers.length ? ` AND iq.insurer IN (${insurers.join(',')})` : ''}`;

	let questions = [];

	// GET All UNIVERSAL Questions
	sql = `
				SELECT ${select}
				FROM #__questions AS q
				LEFT JOIN #__question_types AS qt ON q.type = qt.id
				LEFT JOIN #__insurer_questions AS iq ON q.id = iq.question
				LEFT JOIN #__insurer_question_territories as iqt ON iqt.insurer_question = iq.id
				WHERE iq.policy_type IN ('${policy_types.join('\',\'')}') AND iq.universal = 1 AND (iqt.territory IN (${territories.map(db.escape).join(',')}) OR iqt.territory IS NULL) AND ${where} GROUP BY q.id;
		`;
	const universal_questions = await db.query(sql).catch(function (err) {
		error = err.message;
	});
	if (error) {
		return next(ServerBadRequestError(error));
	}

	// Add these questions to the array
	questions = questions.concat(universal_questions);

	// From this point forward, only get non-universal questions
	where += ' AND iq.universal = 0';

	// GET BOP and GL Questions
	if (policy_types.includes('BOP') || policy_types.includes('GL')) {
		// Get the ISO questions
		sql = `
				SELECT ${select}
				FROM #__industry_code_questions AS icq
				LEFT JOIN #__questions AS q ON (q.id = icq.question)
				LEFT JOIN #__question_types AS qt ON q.type = qt.id
				LEFT JOIN #__insurer_questions AS iq ON q.id = iq.question
				WHERE icq.insurer_industry_code = (SELECT code FROM #__industry_codes_iso WHERE id = (SELECT iso FROM #__industry_codes WHERE id = ${db.escape(industry_code)}) LIMIT 1)
				AND ${where} GROUP BY q.id;
			`;
		const iso_questions = await db.query(sql).catch(function (err) {
			error = err.message;
		});
		if (error) {
			return next(ServerBadRequestError(error));
		}

		// Add these questions to the array
		questions = questions.concat(iso_questions);

		// Get the CGL questions
		sql = `
				SELECT ${select}
				FROM #__industry_code_questions AS icq
				LEFT JOIN #__questions AS q ON (q.id = icq.question)
				LEFT JOIN #__question_types AS qt ON q.type = qt.id
				LEFT JOIN #__insurer_questions AS iq ON q.id = iq.question
				LEFT JOIN #__insurer_industry_codes AS iic ON icq.insurer_industry_code = iic.id
				LEFT JOIN #__industry_codes AS ic ON ic.cgl = iic.code AND iic.type = 'c'
				WHERE ic.id = ${db.escape(industry_code)} AND ${where} GROUP BY q.id;
			`;
		const cgl_questions = await db.query(sql).catch(function (err) {
			error = err.message;
		});
		if (error) {
			return next(ServerBadRequestError(error));
		}

		// Add these questions to the array
		questions = questions.concat(cgl_questions);
	}

	// GET WC Questions
	if (policy_types.includes('WC')) {
		sql = `
				SELECT ${select}
				FROM #__questions AS q
				LEFT JOIN #__insurer_questions AS iq ON q.id = iq.question
				INNER JOIN #__insurer_ncci_code_questions AS ncq ON q.id = ncq.question AND ncq.ncci_code IN(
					SELECT nca.insurer_code FROM #__activity_code_associations AS nca
					LEFT JOIN #__insurer_ncci_codes AS inc ON nca.insurer_code = inc.id
					WHERE nca.code IN (${activity_codes.join(',')})
					AND inc.state = 1${territories && territories.length ? ` AND inc.territory IN (${territories.map(db.escape).join(',')})` : ``}
				)
				LEFT JOIN #__question_types AS qt ON q.type = qt.id
				WHERE iq.policy_type IN ('WC') AND ${where} GROUP BY q.id;
			`;
		const wc_questions = await db.query(sql).catch(function (err) {
			error = err.message;
		});
		if (error) {
			return next(ServerBadRequestError(error));
		}

		// Add these questions to the array
		questions = questions.concat(wc_questions);
	}

	// Remove Duplicates
	if (questions) {
		questions = questions.filter((question, index, self) => index === self.findIndex((t) => t.id === question.id));
	}

	if (!questions || questions.length === 0) {
		log.info('No questions to return');
		res.send(200, []);
		return next();
	}

	// Check for missing questions
	let missing_questions = find_missing_questions(questions);
	while (missing_questions) {
		// Query to get all missing questions
		sql = `
				SELECT ${select}
				FROM #__questions AS q
				LEFT JOIN #__question_types AS qt ON q.type = qt.id
				LEFT JOIN #__insurer_questions AS iq ON q.id = iq.question
				WHERE q.id IN (${missing_questions.join(',')})
				GROUP BY q.id;
			`;
		const added_questions = await db.query(sql).catch(function (err) { // eslint-disable-line no-await-in-loop, no-loop-func
			error = err.message;
		});
		if (error) {
			return next(ServerBadRequestError(error));
		}
		questions = questions.concat(added_questions);

		// Check for additional missing questions
		missing_questions = find_missing_questions(questions);
	}

	// Let's do some cleanup and get a list of question IDs
	await questions.forEach(async function (question, index) {
		// If this question is hidden and we don't want hidden questions
		if (!return_hidden && question.hidden) {
			// Do a bit of extra processing to make sure we don't need it
			let unhidden_child = false;
			await questions.forEach(function (q) {
				if (question.id === q.parent && !q.hidden) {
					unhidden_child = true;
				}
			});
			if (!unhidden_child) {
				delete questions[index];
			}
		}

		// If there is no hint, don't return one
		if (!question.hint) {
			delete question.hint;
		}

		// If the question doesn't have a parent, don't return one
		if (!question.parent) {
			delete question.parent;
			delete question.parent_answer;
		}

		// If there is no sub_level, don't return one
		if (!question.sub_level) {
			delete question.sub_level;
		}

		// Groom the hidden field
		if (question.hidden) {
			question.hidden = true;
		} else {
			delete question.hidden;
		}
	});

	// Remove empty elements in the array
	if (questions) {
		questions = questions.filter((question) => question.id > 0);
	}

	// Get a list of the question IDs
	const question_ids = questions.map(function (question) {
		return question.id;
	});
	if (question_ids) {
		// Get the answers to the questions
		sql = `SELECT id, question, \`default\`, answer FROM #__question_answers WHERE question IN (${question_ids.filter(Boolean).join(',')}) AND state = 1;`;
		const answers = await db.query(sql).catch(function (err) {
			error = err.message;
		});
		if (error) {
			return next(ServerBadRequestError(error));
		}

		// Combine the answers with their questions
		questions.forEach(function (question) {
			if (question.type_id >= 1 && question.type_id <= 3) {
				question.answers = [];
				answers.forEach(function (answer) {
					if (answer.question === question.id) {
						// Create a local copy of the answer so we can remove properties
						const answer_obj = Object.assign({}, answer);
						delete answer_obj.question;

						// Remove the default if it is not applicable
						if (answer_obj.default === 1) {
							answer_obj.default = true;
						} else {
							delete answer_obj.default;
						}

						question.answers.push(answer_obj);
					}
				});

				// If there were no answers, do not return the element
				if (!question.answers.length) {
					delete question.answers;
				}
			}
			delete question.type_id;
		});

		// Sort the questions
		questions.sort(function (a, b) {
			return a.id - b.id;
		});
	}

	log.info(`Returning ${questions.length} Questions`);
	res.send(200, questions);

	return next();
}


/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (basePath) => {
	ServerAddGet('Get Questions', basePath + '/list', GetQuestions);
	ServerAddGet('Get Questions (deprecated)', basePath + '/v1', GetQuestions);
};