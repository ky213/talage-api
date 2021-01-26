/* eslint-disable multiline-comment-style */
'use strict'
const InsurerBO = global.requireShared('./models/Insurer-BO.js');
const moment = require('moment');

//const util = require('util');
//const serverHelper = global.requireRootPath('server.js');

/**
 * @param {array} activityCodeStringArray - An array of all the activity codes in the applicaiton
 * @param {string} industryCodeString - The industry code of the application
 * @param {array} zipCodeStringArray - An array of all the zipcodes (stored as strings) in which the business operates
 * @param {array.<Object>} policyTypeArray - An array containing of all the policy types/effectiveDates. Ex: [{type:"WC",effectiveDate:"03-02-2021"}]
 * @param {array} insurerStringArray - An array containing the IDs of the relevant insurers for the application
 * @param {boolean} return_hidden - true to return hidden questions, false to only return visible questions
 *
 * @returns {array|false} An array of questions if successful, false otherwise
 *
 */
async function GetQuestions(activityCodeStringArray, industryCodeString, zipCodeStringArray, policyTypeArray, insurerStringArray, return_hidden = false) {

    log.debug(`GetQuestions: activityCodeStringArray:  ${activityCodeStringArray}, industryCodeString:  ${industryCodeString}, zipCodeStringArray:  ${zipCodeStringArray}, policyTypeArray:  ${JSON.stringify(policyTypeArray)}, insurerStringArray:  ${insurerStringArray}, return_hidden: ${return_hidden}` + __location)

    if (policyTypeArray.length && typeof policyTypeArray[0] === "string") {
        console.log("=============================================================================");
        console.log("=============================================================================");
        console.log("Being called with a string policy type!!");
        console.log("=============================================================================");
        console.log("=============================================================================");
        throw "Being called with a string policy type!!";
    }

    let error = false;
    let sql = '';

    /*
     * Validate Activity Codes
     */

    // Convert activity code strings to ints
    let activityCodeArray = activityCodeStringArray.map(activityCode => parseInt(activityCode, 10));

    // Filter out duplicate codes
    activityCodeArray = activityCodeArray.filter((code, index) => activityCodeArray.indexOf(code) === index);

    // Check that each activity code is valid
    if (activityCodeArray.length) {
        sql = `SELECT id FROM clw_talage_activity_codes WHERE id IN (${activityCodeArray.join(',')}) AND state = 1;`;
        const activity_code_result = await db.queryReadonly(sql).catch(function(err) {
            error = err.message;
        });
        if (activity_code_result && activity_code_result.length !== activityCodeArray.length) {
            log.warn('Bad Request: Invalid Activity Code(s)');
            error = 'One or more of the activity codes supplied is invalid';
        }
        if (error) {
            return false;
        }
    }

    /*
     * Validate Industry Code
     */

    // Prep industry code for validation
    const industry_code = industryCodeString ? parseInt(industryCodeString, 10) : 0;

    // Check if the industry code is valid
    if (industry_code) {
        sql = `SELECT id FROM clw_talage_industry_codes WHERE id = ${db.escape(industry_code)} AND state = 1 LIMIT 1;`;
        const industry_code_result = await db.queryReadonly(sql).catch(function(err) {
            error = err.message;
        });
        if (industry_code_result && industry_code_result.length !== 1) {
            log.warn('Bad Request: Invalid Industry Code');
            error = 'The industry code supplied is invalid';
        }
        if (error) {
            return false;
        }
    }

    /*
     * Validate Zip Codes
     */
    const zipCodeArray = zipCodeStringArray.map(zip => zip.replace(/[^0-9]/gi, ''))

    // Check that the zip code is valid
    const territories = [];
    if (!zipCodeArray || !zipCodeArray.length) {
        log.warn('Bad Request: Zip Codes');
        return false;
    }
    // zip code table does not support 9-digit zips.  zipcode array need to make sure any 9 digit zips
    // are cut down to 5.
    sql = `SELECT DISTINCT territory FROM clw_talage_zip_codes WHERE zip IN (${zipCodeArray.join(',')});`;
    const zip_result = await db.queryReadonly(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        return false;
    }
    if (zip_result && zip_result.length >= 1) {
        zip_result.forEach(function(result) {
            territories.push(result.territory);
        });
    }
    else {
        log.warn('Bad Request: Zip Code');
        return false;
    }


    /*
     * Validate Policy Types
     */

    const policy_types = [];


    // Question list effective date is done per policy type.
    // For a given policy type, check the question's effective/expiration dates.
    const uniquePolicyEffectiveDateList = [];
    const questionEffectiveDateWhereClauseList = [];
    policyTypeArray.forEach(function(policy_type) {
        // Build a list of policy types
        policy_types.push(policy_type.type.replace(/[^a-z]/gi, '').toUpperCase());
        const policyEffectiveDate = moment(policy_type.effectiveDate).format("YYYY-MM-DD HH:MM:SS");
        // Build the question query where clause for each policy type
        questionEffectiveDateWhereClauseList.push(`(iq.policy_type = '${policy_type.type}' AND '${policyEffectiveDate}' >= iq.effectiveDate AND '${policyEffectiveDate}' < iq.expirationDate)`);
        // Build a list of unique policy effective dates for the industry and activity code queries
        if (!uniquePolicyEffectiveDateList.includes(policyEffectiveDate)) {
            uniquePolicyEffectiveDateList.push(policyEffectiveDate);
        }
    });
    const questionEffectiveDateWhereClause = "(" + questionEffectiveDateWhereClauseList.join(" OR ") + ")";

    // Industry and activity code effective date is done using the unique policy effective date list.
    const industryCodeEffectiveDateWhereClauseList = [];
    const activityCodeEffectiveDateWhereClauseList = [];
    for (const policyEffectiveDate of uniquePolicyEffectiveDateList) {
        industryCodeEffectiveDateWhereClauseList.push(`('${policyEffectiveDate}' >= iic.effectiveDate AND '${policyEffectiveDate}' < iic.expirationDate)`);
        activityCodeEffectiveDateWhereClauseList.push(`('${policyEffectiveDate}' >= inc.effectiveDate AND '${policyEffectiveDate}' < inc.expirationDate)`);
    }
    const industryCodeEffectiveDateWhereClause = "(" + industryCodeEffectiveDateWhereClauseList.join(" OR ") + ")";
    const activityCodeEffectiveDateWhereClause = "(" + activityCodeEffectiveDateWhereClauseList.join(" OR") + ")";

    // Do not permit requests that include both BOP and GL
    if (policyTypeArray.includes('BOP') && policyTypeArray.includes('GL')) {
        log.warn('Bad Request: Both BOP and GL are not allowed, must be one or the other');
        return false;
    }

    // Get Policy Types from the database
    sql = 'SELECT abbr FROM clw_talage_policy_types;';
    const policy_types_result = await db.queryReadonly(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        return false;
    }

    // Prepare the response
    const supported_policy_types = [];
    policy_types_result.forEach(function(policy_type) {
        supported_policy_types.push(policy_type.abbr);
    });

    // Check that all policy types match
    policy_types.forEach(function(policy_type) {
        if (!supported_policy_types.includes(policy_type)) {
            log.warn('Bad Request: Invalid Policy Type');
            error = `Policy type '${policy_type}' is not supported.`;
        }
    });
    if (error) {
        return false;
    }


    /*
     * Validate Insurers
     */
    let insurerArray = insurerStringArray;
    try{
        insurerArray = insurerStringArray.map(insurer => parseInt(insurer, 10));
    }
    catch(err){
        log.info("error parsing insurerStringArray " + err + __location);
    }

    // Check for anything that was not successfully converted
    if(insurerArray.includes(NaN)){
        log.error('Bad Request: Invalid insurer provided in request. Expecting talage insurer ID. ' + __location);
        return false;
    }

    // Check that insurers were valid
    // TODO Do we need to do this.  it will stop the show/quoting
    // verse some extra questions
    // if (insurerArray.length) {
    //     const insurerBO = new InsurerBO();
    //     const queryInsurer = {
    //         "insurerId":insurerArray,
    //         active: true
    //     };

    //     const insurers_result = await insurerBO.getList(queryInsurer).catch(function(err) {
    //         error = err.message;
    //     });
    //     if (insurers_result && insurers_result.length !== insurerArray.length) {
    //         log.warn('Bad Request: Invalid Insurer(s)');
    //         error = 'One or more of the insurers supplied is invalid';
    //     }
    //     if (error) {
    //         return false;
    //     }
    // }

    // Build the select and where statements
    const select = `q.id, q.parent, q.parent_answer, q.sub_level, q.question AS \`text\`, q.hint, q.type AS type_id, qt.name AS type, q.hidden${return_hidden ? ', GROUP_CONCAT(DISTINCT CONCAT(iq.insurer, "-", iq.policy_type)) AS insurers' : ''}`;
    let where = `q.state = 1
        ${insurerArray.length ? `AND iq.insurer IN (${insurerArray.join(',')})` : ''}
    `;

    let questions = [];

    // ============================================================
    // Get universal questions
    sql = `
		SELECT ${select}
		FROM clw_talage_questions AS q
		LEFT JOIN clw_talage_question_types AS qt ON q.type = qt.id
		LEFT JOIN clw_talage_insurer_questions AS iq ON q.id = iq.question
		LEFT JOIN clw_talage_insurer_question_territories as iqt ON iqt.insurer_question = iq.id
        WHERE
            iq.policy_type IN ('${policy_types.join("','")}') 
            AND iq.universal = 1
            AND (iqt.territory IN (${territories.map(db.escape).join(',')}) OR iqt.territory IS NULL) 
            AND ${where} 
            AND ${questionEffectiveDateWhereClause}
            GROUP BY q.id;
    `;
    const universal_questions = await db.queryReadonly(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        return false;
    }
    questions = questions.concat(universal_questions);

    // From this point forward, only get non-universal questions
    where += ' AND iq.universal = 0';

    // ============================================================
    // Get industry-based questions
    // Notes:
    //      - pull in all insurer questions which are for the requested policy types (clw_talage_insurer_questions.policy_type IN policy_types)
    //      - group by clw_talage_insurer_questions.question (Talage question) to ensure we don't get duplicate questions
    sql = `
        SELECT ${select}
        FROM clw_talage_industry_codes AS ic
        INNER JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON industryCodeMap.talageIndustryCodeId = ic.id
        INNER JOIN clw_talage_insurer_industry_codes AS iic ON iic.id = industryCodeMap.insurerIndustryCodeId
        INNER JOIN clw_talage_industry_code_questions AS icq ON icq.insurerIndustryCodeId = iic.id
        INNER JOIN clw_talage_questions AS q ON q.id = icq.talageQuestionId
        INNER JOIN clw_talage_insurer_questions AS iq ON iq.question = q.id
        INNER JOIN clw_talage_question_types AS qt ON qt.id = q.type
        WHERE
            ic.id = ${db.escape(industry_code)}
            AND iq.policy_type IN ("${policy_types.join("\",\"")}")
            AND iic.territory IN (${territories.map(db.escape).join(',')})
            AND ${where}
            AND ${questionEffectiveDateWhereClause}
            AND ${industryCodeEffectiveDateWhereClause}
            GROUP BY iq.question;
    `;
    const industryCodeQuestions = await db.queryReadonly(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        return false;
    }
    questions = questions.concat(industryCodeQuestions);

    // ============================================================
    // Get activity-based questions
    if(activityCodeArray && activityCodeArray.length > 0){
        sql = `
            SELECT ${select}
            FROM clw_talage_questions AS q
            LEFT JOIN clw_talage_insurer_questions AS iq ON q.id = iq.question
            INNER JOIN clw_talage_insurer_ncci_code_questions AS ncq ON q.id = ncq.question AND ncq.ncci_code IN(
                SELECT nca.insurer_code FROM clw_talage_activity_code_associations AS nca
                LEFT JOIN clw_talage_insurer_ncci_codes AS inc ON nca.insurer_code = inc.id
                WHERE nca.code IN (${activityCodeArray.join(',')})
                AND ${activityCodeEffectiveDateWhereClause}
                AND inc.state = 1${territories && territories.length ? ` AND inc.territory IN (${territories.map(db.escape).join(',')})` : ``}
            )
            LEFT JOIN clw_talage_question_types AS qt ON q.type = qt.id
            WHERE
                iq.policy_type IN ('WC')
                AND ${where} 
                AND ${questionEffectiveDateWhereClause}                                               
                GROUP BY q.id;
        `;
        const activityCodeQuestions = await db.queryReadonly(sql).catch(function(err) {
            error = err.message;
        });
        if (error) {
            return false;
        }
        questions = questions.concat(activityCodeQuestions);
    }

    // Remove Duplicates
    if (questions) {
        questions = questions.filter((question, index, self) => index === self.findIndex((t) => t.id === question.id));
    }

    if (!questions || questions.length === 0) {
        log.info('No questions to return');
        return [];
    }

    // Check for missing questions
    // NOTE: This iterative approach is expensive. Candidate for refactoring. -SF
    let missing_questions = find_missing_questions(questions);
    while (missing_questions) {
        // Query to get all missing questions
        sql = `
			SELECT ${select}
			FROM clw_talage_questions AS q
			LEFT JOIN clw_talage_question_types AS qt ON q.type = qt.id
			LEFT JOIN clw_talage_insurer_questions AS iq ON q.id = iq.question
            WHERE
                q.id IN (${missing_questions.join(',')})
                AND ${questionEffectiveDateWhereClause}
			    GROUP BY q.id;
		`;
        let error2 = null;
        const added_questions = await db.queryReadonly(sql).catch(function(err) {
            // eslint-disable-line no-await-in-loop, no-loop-func
            error2 = err.message;
        });
        if (error2) {
            return false;
        }
        questions = questions.concat(added_questions);

        // Check for additional missing questions
        missing_questions = find_missing_questions(questions);
    }

    // Let's do some cleanup and get a list of question IDs
    for (let index = 0; index < questions.length; index++) {
        const question = questions[index];

        // If this question is hidden and we don't want hidden questions
        if (!return_hidden && question.hidden) {
            // Do a bit of extra processing to make sure we don't need it
            let unhidden_child = false;
            questions.forEach((q) => {
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
        }
        else {
            delete question.hidden;
        }
    }

    // Remove empty elements in the array
    if (questions) {
        questions = questions.filter((question) => question.id > 0);
    }

    // Get a list of the question IDs
    const question_ids = questions.map(function(question) {
        return question.id;
    });
    if (question_ids) {
        // Get the answers to the questions
        sql = `SELECT id, question, \`default\`, answer FROM clw_talage_question_answers WHERE question IN (${question_ids.filter(Boolean).join(',')}) AND state = 1;`;
        const answers = await db.queryReadonly(sql).catch(function(err) {
            error = err.message;
        });
        if (error) {
            return false;
        }

        // Combine the answers with their questions
        questions.forEach((question) => {
            if (question.type_id >= 1 && question.type_id <= 3) {
                question.possible_answers = {};
                answers.forEach((answer) => {
                    if (answer.question === question.id) {
                        // Create a local copy of the answer so we can remove properties
                        const answer_obj = Object.assign({}, answer);
                        delete answer_obj.question;

                        // Remove the default if it is not applicable
                        if (answer_obj.default === 1) {
                            answer_obj.default = true;
                        }
                        else {
                            delete answer_obj.default;
                        }

                        question.possible_answers[parseInt(answer_obj.id, 10)] = answer_obj;
                    }
                });

                // If there were no answers, do not return the element
                if (!Object.keys(question.possible_answers).length) {
                    delete question.possible_answers;
                }
            }
            delete question.type_id;
        });

        // Sort the questions
        questions.sort(function(a, b) {
            return a.id - b.id;
        });
    }
    // log.info(`Returning ${questions.length} Questions`);

    return questions;
}

/**
 * @param {array} activityCodeArray - An array of all the activity codes in the applicaiton
 * @param {string} industryCodeString - The industry code of the application
 * @param {array} zipCodeArray - An array of all the zipcodes (stored as strings) in which the business operates
 * @param {array.<Object>} policyTypeArray - An array containing of all the policy types applied for. Ex: [{type:"WC",effectiveDate:"03-02-2021"}]
 * @param {array} insurerStringArray - An array containing the IDs of the relevant insurers for the application
 * @param {boolean} return_hidden - true to return hidden questions, false to only return visible questions
 *
 * @returns {array|false} An array of questions structured the way the front end is expecting them, false otherwise
 *
 */
exports.GetQuestionsForFrontend = async function(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerStringArray, return_hidden = false){

    const questions = await GetQuestions(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerStringArray, return_hidden);

    if(!questions){
        return false;
    }
    for(const question in questions){
        if(Object.prototype.hasOwnProperty.call(questions, question)){
            if('possible_answers' in questions[question]){
                questions[question].answers = Object.values(questions[question].possible_answers);
                delete questions[question].possible_answers;
            }
        }
    }

    return questions;
}

/**
 * @param {array} activityCodeArray - An array of all the activity codes in the applicaiton
 * @param {string} industryCodeString - The industry code of the application
 * @param {array} zipCodeArray - An array of all the zipcodes (stored as strings) in which the business operates
 * @param {array.<Object>} policyTypeArray - An array containing of all the policy types applied for. Ex: [{type:"WC",effectiveDate:"03-02-2021"}]
 * @param {array} insurerArray - An array containing the IDs of the relevant insurers for the application
 * @param {boolean} return_hidden - true to return hidden questions, false to only return visible questions
 *
 * @returns {array|false} An array of questions structured the way the back end is expecting them, false otherwise
 *
 */
exports.GetQuestionsForBackend = async function(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, return_hidden = false){
    return GetQuestions(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, return_hidden);
}

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
    const question_ids = questions.map(function(question) {
        return question.id;
    });

    // Loop through each question and make sure it's parent is in our question_ids
    questions.forEach(function(question) {
        if (question.parent) {
            if (!question_ids.includes(question.parent)) {
                missing_questions.push(question.parent);
            }
        }
    });
    return missing_questions.length ? missing_questions : false;
}