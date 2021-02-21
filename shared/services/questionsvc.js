/* eslint-disable multiline-comment-style */
'use strict'
const moment = require('moment');
const helper = global.requireShared('./helpers/helper.js');

//const util = require('util');
//const serverHelper = global.requireRootPath('server.js');

/**
 * @param {array} activityCodeStringArray - An array of all the activity codes in the applicaiton
 * @param {string} industryCodeString - The industry code of the application
 * @param {array} zipCodeStringArray - An array of all the zipcodes (stored as strings) in which the business operates
 * @param {array.<Object>} policyTypeArray - An array containing of all the policy types/effectiveDates. Ex: [{type:"WC",effectiveDate:"03-02-2021"}]
 * @param {array} insurerStringArray - An array containing the IDs of the relevant insurers for the application
 * @param {string} questionSubjectArea - A string specifying the question subject area ("general", "location", "location.building", ...)
 * @param {boolean} return_hidden - true to return hidden questions, false to only return visible questions
 * @param {array} stateList - An array containing the US State Codes for the application
 *
 * @returns {array|false} An array of questions if successful, false otherwise
 *
 */
async function GetQuestions(activityCodeStringArray, industryCodeString, zipCodeStringArray, policyTypeArray, insurerStringArray, questionSubjectArea, return_hidden = false, stateList = []) {

    log.debug(`GetQuestions: activityCodeStringArray:  ${activityCodeStringArray}, industryCodeString:  ${industryCodeString}, zipCodeStringArray:  ${zipCodeStringArray}, policyTypeArray:  ${JSON.stringify(policyTypeArray)}, insurerStringArray:  ${insurerStringArray}, questionSubjectArea: ${questionSubjectArea}, return_hidden: ${return_hidden}, stateList:  ${JSON.stringify(stateList)}` + __location)

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
    let territories = [];
    if(stateList.length > 0){
        territories = stateList;
    }
    else {

        /*
        * Validate Zip Codes
        */
        const zipCodeArray = zipCodeStringArray.map(zip => zip.replace(/[^0-9]/gi, ''))

        // Check that the zip code is valid

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
    }


    /*
     * Validate Policy Types
     */

    const policyTypes = [];

    // Question list effective date is done per policy type.
    // For a given policy type, check the question's effective/expiration dates.
    const uniquePolicyEffectiveDateList = [];
    const questionEffectiveDateWhereClauseList = [];
    policyTypeArray.forEach(function(policyTypeJSON) {
        // Build a list of policy types
        policyTypes.push(policyTypeJSON.type.replace(/[^a-z]/gi, '').toUpperCase());
        const policyEffectiveDate = moment(policyTypeJSON.effectiveDate).format(db.dbTimeFormat());
        // Build a list of unique policy effective dates for the industry and activity code queries
        if (!uniquePolicyEffectiveDateList.includes(policyEffectiveDate)) {
            uniquePolicyEffectiveDateList.push(policyEffectiveDate);
        }
        questionEffectiveDateWhereClauseList.push(`(iq.policy_type = '${policyTypeJSON.type.toUpperCase()}' AND '${policyEffectiveDate}' >= iq.effectiveDate AND '${policyEffectiveDate}' < iq.expirationDate)`);
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
    policyTypes.forEach(function(policy_type) {
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
    log.debug("Getting universal questions " + __location);
    // ============================================================
    // Get universal questions
    sql = `
        SELECT ${select}
        FROM clw_talage_questions AS q
        LEFT JOIN clw_talage_question_types AS qt ON q.type = qt.id
        LEFT JOIN clw_talage_insurer_questions AS iq ON q.id = iq.question
        LEFT JOIN clw_talage_insurer_question_territories as iqt ON iqt.insurer_question = iq.id
        WHERE
            iq.universal = 1
            AND (iqt.territory IN (${territories.map(db.escape).join(',')}) OR iqt.territory IS NULL) 
            AND ${where} 
            AND ${questionEffectiveDateWhereClause}
            AND iq.questionSubjectArea = '${questionSubjectArea}'
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
    // // Get industry-based questions
    log.debug("territories " + territories);
    log.debug(`Getting industry questions use Redis ${global.settings.USE_REDIS_QUESTION_CACHE}  ` + __location);
    if(global.settings.USE_REDIS_QUESTION_CACHE === "YES"){
        const redisQuestions = await getRedisIndustryCodeQuestions(industry_code)
        log.debug(`Redis questions ${redisQuestions.length} returned ` + __location)
        if(redisQuestions.length > 0){
            // eslint-disable-next-line space-before-function-paren
            var filteredRedisQuestions = redisQuestions.filter(function(el) {
                let returnValue = false;
                try{
                    let insurerMatch = false;
                    if(el.insurerList){
                        const qInsurerList = el.insurerList.split(',')
                        for(let i = 0; i < qInsurerList.length; i++){
                            const insurerId = parseInt(qInsurerList[i], 10);
                            if(insurerArray.indexOf(insurerId) > -1){
                                insurerMatch = true;
                                break;
                            }
                        }
                    }
                    let policyTypeMatch = false;
                    if(el.policyTypeList){
                        const qPolicyTypeList = el.policyTypeList.split(',')
                        const matched = qPolicyTypeList.filter(qPolicyTypeCd => policyTypes.indexOf(qPolicyTypeCd) > -1);
                        if(matched && matched.length > 0){
                            policyTypeMatch = true;
                        }
                    }
                    let territoryMatch = false;
                    if(el.territoryList){
                        const qTerritoryList = el.territoryList.split(',')
                        const matched = qTerritoryList.filter(qterritory => territories.indexOf(qterritory) > -1);
                        if(matched && matched.length > 0){
                            territoryMatch = true;
                        }
                    }

                    //log.debug(`insurerMatch ${insurerMatch} territoryMatch ${territoryMatch} el.territory ${el.territory}     policyTypeMatch ${policyTypeMatch} el.universal ${el.universal} el.questionSubjectArea ${el.questionSubjectArea} ` + __location);
                    if(insurerMatch === true
                        && territoryMatch === true
                        && policyTypeMatch === true
                        && el.universal === 0
                        && el.questionSubjectArea === questionSubjectArea){
                        policyTypeArray.forEach(function(policyTypeJSON) {
                            const policyEffDateMoment = moment(policyTypeJSON.effectiveDate);
                            const insurerIndustryEffectiveDate = moment(el.insurerIndustryEffectiveDate);
                            const insurerIndustryExpirationDate = moment(el.insurerIndustryExpirationDate);
                            const insurerQuestionEffectiveDate = moment(el.insurerQuestionEffectiveDate);
                            const insurerQuestionExpirationDate = moment(el.insurerQuestionExpirationDate);
                            if(policyEffDateMoment >= insurerIndustryEffectiveDate
                                    && policyEffDateMoment < insurerIndustryExpirationDate
                                    && policyEffDateMoment >= insurerQuestionEffectiveDate
                                    && policyEffDateMoment < insurerQuestionExpirationDate){
                                returnValue = true;
                            }

                        });
                    }
                }
                catch(err){
                    log.error("Question filter error " + err + __location)
                }

                return returnValue;
            });
            log.debug(`Adding ${filteredRedisQuestions.length} redis industry questions ` + __location)
            questions = questions.concat(filteredRedisQuestions);
        }
        else {
            log.debug(`Adding ZERO redis industry questions - not found ` + __location)
        }
    }
    if(global.settings.USE_MONGO_QUESTIONS === "YES"){
        const InsurerIndustryCodeModel = require('mongoose').model('InsurerIndustryCode');
        const InsurerQuestionModel = require('mongoose').model('InsurerQuestion');
        const start = moment();
        const now = moment();
        // eslint-disable-next-line prefer-const
        let industryQuery = {
            insurerId: {$in: insurerArray},
            talageIndustryCodeIdList: industry_code,
            territoryList: {$in: territories},
            effectiveDate: {$lte: now},
            expirationDate: {$gte: now},
            active: true
        }
        // eslint-disable-next-line prefer-const
        let orParamList = [];
        const policyTypeCheck = {policyType: {$in: policyTypes}};
        const policyTypeNullCheck = {policyType: null}
        orParamList.push(policyTypeCheck)
        orParamList.push(policyTypeNullCheck)
        industryQuery.$or = orParamList;
        try{
            const insurerIndustryCodeList = await InsurerIndustryCodeModel.find(industryQuery)
            let insurerQuestionIdArray = [];
            // eslint-disable-next-line prefer-const
            let talageQuestionIdArray = [];
            if(insurerIndustryCodeList && (await insurerIndustryCodeList).length > 0){
                for(const insurerIndustryCode of insurerIndustryCodeList){
                    if(insurerIndustryCode.insurerQuestionIdList && insurerIndustryCode.insurerQuestionIdList.length > 0){
                        insurerQuestionIdArray = insurerQuestionIdArray.concat(insurerIndustryCode.insurerQuestionIdList);
                    }
                }
            }
            //log.debug("insurerQuestionIdArray " + insurerQuestionIdArray)
            if(insurerQuestionIdArray.length > 0){
                // eslint-disable-next-line prefer-const
                const insurerQuestionQuery = {
                    insurerId: {$in: insurerArray},
                    systemId: {$in: insurerQuestionIdArray},
                    universal: false,
                    policyType: {$in: policyTypes},
                    questionSubjectArea: questionSubjectArea,
                    territoryList: {$in: territories},
                    effectiveDate: {$lt: now},
                    expirationDate: {$gt: now},
                    active: true
                }
                // eslint-disable-next-line prefer-const
                orParamList = [];
                const territoryCheck = {territoryList: {$in: territories}};
                const territoryLengthCheck = {territoryList: {$size: 0}}
                const territoryNullCheck = {territoryList: null}
                orParamList.push(territoryCheck)
                orParamList.push(territoryNullCheck)
                orParamList.push(territoryLengthCheck)
                insurerQuestionQuery.$or = orParamList;

                //log.debug("insurerQuestionQuery: " + JSON.stringify(insurerQuestionQuery));
                const insurerQuestionList = await InsurerQuestionModel.find(insurerQuestionQuery)
                if(insurerQuestionList){
                    for(const insurerQuestion of insurerQuestionList){
                        if(insurerQuestion.talageQuestionId){
                            talageQuestionIdArray.push(insurerQuestion.talageQuestionId)
                        }
                    }
                }
            }
            //log.debug("talageQuestionIdArray " + talageQuestionIdArray)
            if(talageQuestionIdArray.length > 0) {
                sql = `
                    SELECT ${select}
                    FROM clw_talage_questions AS q
                    LEFT JOIN clw_talage_question_types AS qt ON q.type = qt.id
                    LEFT JOIN clw_talage_insurer_questions AS iq ON q.id = iq.question
                    WHERE
                        q.id IN (${talageQuestionIdArray.map(db.escape).join(',')}) 
                        AND ${where}
                        GROUP BY q.id;
                `;
                // log.debug("question sql " + sql)
                const industry_questions = await db.queryReadonly(sql).catch(function(err) {
                    error = err.message;
                });
                if (error) {
                    return false;
                }
                log.debug(`Adding ${industry_questions.length} Mongo industry questions ` + __location)
                questions = questions.concat(industry_questions);
                log.debug("industry_questions " + JSON.stringify(industry_questions));
            }
            const endSqlSelect = moment();
            const diff = endSqlSelect.diff(start, 'milliseconds', true);
            log.info(`Mongo Industry Question process duration: ${diff} milliseconds`);
        }
        catch(err){
            log.error(`Error get Mongo Industry questions ${JSON.stringify(industryQuery)}  ${err}` + __location);
        }

    }
    else {
        // Notes:
        //      - pull in all insurer questions which are for the requested policy types (clw_talage_insurer_questions.policy_type IN policy_types)
        //      - group by clw_talage_insurer_questions.question (Talage question) to ensure we don't get duplicate questions
        const start = moment();
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
                AND iic.territory IN (${territories.map(db.escape).join(',')})
                AND ${where}
                AND ${questionEffectiveDateWhereClause}
                AND ${industryCodeEffectiveDateWhereClause}
                AND iq.questionSubjectArea = '${questionSubjectArea}'
                GROUP BY iq.question;
        `;
        // log.debug("industry sql " + sql);
        const industryCodeQuestions = await db.queryReadonly(sql).catch(function(err) {
            error = err.message;
        });
        if (error) {
            return false;
        }
        const endSqlSelect = moment();
        var diff = endSqlSelect.diff(start, 'milliseconds', true);
        log.info(`Mysql Industry Question query duration: ${diff} milliseconds`);

        log.debug(`Adding ${industryCodeQuestions.length} mysql industry questions ` + __location)
        questions = questions.concat(industryCodeQuestions);
        log.debug("industryCodeQuestions " + JSON.stringify(industryCodeQuestions));
    }

    log.debug("Getting activity questions " + __location);
    // ============================================================
    // Get activity-based questions
    if (activityCodeArray && activityCodeArray.length > 0) {
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
                ${where} 
                AND ${questionEffectiveDateWhereClause}                                               
                AND iq.questionSubjectArea = '${questionSubjectArea}'
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

    log.debug("removing duplicate questions " + __location);
    // Remove Duplicates
    if (questions) {
        questions = questions.filter((question, index, self) => index === self.findIndex((t) => t.id === question.id));
    }
    if (!questions || questions.length === 0) {
        log.info('No questions to return' + __location);
        return [];
    }

    log.debug("Getting missing questions " + __location);
    // Check for missing questions
    let missing_questions = find_missing_questions(questions);
    while (missing_questions) {
        // Query to get all missing questions. This ensures that all parent questions are present regardless of effective date.
        sql = `
            SELECT ${select}
            FROM clw_talage_questions AS q
            INNER JOIN clw_talage_question_types AS qt ON q.type = qt.id
            INNER JOIN clw_talage_insurer_questions AS iq ON q.id = iq.question
            WHERE
                q.id IN (${missing_questions.join(',')})
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
        log.debug("Missing questions  count " + added_questions.length + __location);
        questions = questions.concat(added_questions);
        // Check for additional missing questions
        missing_questions = find_missing_questions(questions);
    }
    log.debug("Cleanup questions " + __location);
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

    log.debug("removing empty questions " + __location);
    // Remove empty elements in the array
    if (questions) {
        questions = questions.filter((question) => question.id > 0);
    }

    // Get a list of the question IDs
    const question_ids = questions.map(function(question) {
        return question.id;
    });
    log.debug("Getting answers questions " + __location);
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

        log.debug("question sort " + __location);
        // Sort the questions
        questions.sort(function(a, b) {
            return a.id - b.id;
        });
    }
    log.info(`Returning ${questions.length} Questions`);

    return questions;
}

/**
 * @param {array} activityCodeArray - An array of all the activity codes in the applicaiton
 * @param {string} industryCodeString - The industry code of the application
 * @param {array} zipCodeArray - An array of all the zipcodes (stored as strings) in which the business operates
 * @param {array.<Object>} policyTypeArray - An array containing of all the policy types applied for. Ex: [{type:"WC",effectiveDate:"03-02-2021"}]
 * @param {array} insurerStringArray - An array containing the IDs of the relevant insurers for the application
 * @param {string} questionSubjectArea - A string specifying the question subject area ("general", "location", "location.building", ...)
 * @param {boolean} return_hidden - true to return hidden questions, false to only return visible questions
 * @param {array} stateList - An array containing the US State Codes for the application
 *
 * @returns {array|false} An array of questions structured the way the front end is expecting them, false otherwise
 *
 */
exports.GetQuestionsForFrontend = async function(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerStringArray, questionSubjectArea, return_hidden = false, stateList = []){

    const questions = await GetQuestions(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerStringArray, questionSubjectArea, return_hidden, stateList);

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
 * @param {string} questionSubjectArea - A string specifying the question subject area ("general", "location", "location.building", ...)
 * @param {boolean} return_hidden - true to return hidden questions, false to only return visible questions
 * @param {array} stateList - An array containing the US State Codes for the application
 *
 * @returns {array|false} An array of questions structured the way the back end is expecting them, false otherwise
 *
 */
exports.GetQuestionsForBackend = async function(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden = false, stateList = []){
    return GetQuestions(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden, stateList);
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

// eslint-disable-next-line require-jsdoc
async function getRedisIndustryCodeQuestions(industryCodeId){

    let questionList = [];
    const redisKey = "question-industry-" + industryCodeId.toString();
    const start = moment();
    const resp = await global.redisSvc.getKeyValue(redisKey);
    if(resp.found){
        try{
            questionList = JSON.parse(resp.value);
        }
        catch(err){
            log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
        }
        const endRedis = moment();
        var diff = endRedis.diff(start, 'milliseconds', true);
        log.info(`Redis request ${redisKey} duration: ${diff} milliseconds`);
    }
    else {
        log.warn(`#{redisKey} not found refreshing cache` + __location)
        await CreateRedisIndustryCodeQuestionEntryInternal(industryCodeId);
        const resp2 = await global.redisSvc.getKeyValue(redisKey);
        if(resp2.found && resp2.value){
            try{
                questionList = JSON.parse(resp2.value);
            }
            catch(err){
                log.error(`Error Parsing question cache key ${redisKey} value: ${resp2.value} ${err} ` + __location);
            }

        }
    }
    //TODO filters for insuers, effective date

    return questionList;
}

exports.CreateRedisIndustryCodeQuestionEntry = async function(industryCodeId){
    // eslint-disable-next-line no-return-await
    return await CreateRedisIndustryCodeQuestionEntryInternal(industryCodeId)
}

// eslint-disable-next-line require-jsdoc
async function CreateRedisIndustryCodeQuestionEntryInternal(industryCodeId){

    const now = moment();
    const todayDateString = now.format(db.dbTimeFormat());
    // ============================================================
    // Get industry-based questions
    // Notes:
    //      questionId and id are same.  id is from backward compatibility.
    const select = `ic.id as 'industryCodeId', iq.questionSubjectArea,
         iic.effectiveDate as 'insurerIndustryEffectiveDate', iic.expirationDate as 'insurerIndustryExpirationDate',
         iq.effectiveDate as 'insurerQuestionEffectiveDate', iq.expirationDate as 'insurerQuestionExpirationDate',
         q.id  as 'questionId',q.id  as 'id', iq.universal, q.parent, q.parent_answer, q.sub_level, q.question AS 'text', q.hint, q.type AS type_id, qt.name AS type, q.hidden,
         GROUP_CONCAT(DISTINCT CONCAT(iq.insurer, "-", iq.policy_type)) AS insurers,
          GROUP_CONCAT(DISTINCT iq.insurer) AS insurerList,
          GROUP_CONCAT(DISTINCT iq.policy_type) AS policyTypeList,
          GROUP_CONCAT(DISTINCT iic.territory) AS territoryList`;

    const sql = `
        SELECT ${select}
        FROM clw_talage_industry_codes AS ic
        INNER JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON industryCodeMap.talageIndustryCodeId = ic.id
        INNER JOIN clw_talage_insurer_industry_codes AS iic ON iic.id = industryCodeMap.insurerIndustryCodeId
        INNER JOIN clw_talage_industry_code_questions AS icq ON icq.insurerIndustryCodeId = iic.id
        INNER JOIN clw_talage_questions AS q ON q.id = icq.talageQuestionId
        INNER JOIN clw_talage_insurer_questions AS iq ON iq.question = q.id
        INNER JOIN clw_talage_question_types AS qt ON qt.id = q.type
        WHERE
            ic.id = ${db.escape(industryCodeId)}
            AND q.state = 1
            AND (('${todayDateString}' >= iq.effectiveDate AND '${todayDateString}' < iq.expirationDate))
            AND (('${todayDateString}' >= iic.effectiveDate AND '${todayDateString}' < iic.expirationDate))
            GROUP BY iq.question;
    `;
    let error = null;
    const industryCodeQuestions = await db.queryReadonlyCluster(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        log.error(`Error getting industry code questions industryCodeId ${industryCodeId} for Redis ${error}` + __location)
        return false;
    }


    let questionList = [];
    questionList = questionList.concat(industryCodeQuestions);
    const redisKey = "question-industry-" + industryCodeId.toString();
    try{
        //const ttlSeconds = 3600;
        const redisResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(questionList))
        if(redisResponse && redisResponse.saved){
            log.debug(`Saved ${redisKey} to Redis ` + __location);
        }
    }
    catch(err){
        log.error(`Error save ${redisKey} to Redis JWT ` + err + __location);
    }
    return redisKey;


}

// eslint-disable-next-line require-jsdoc
async function CreateRedisIndustryCodeQuestionByArray(industryCodeList, listName){
    if(industryCodeList && industryCodeList.length > 0){
        for (let i = 0; i < industryCodeList.length; i++){
            const industryCodeId = industryCodeList[i].industryCodeId;
            try{
                await CreateRedisIndustryCodeQuestionEntryInternal(industryCodeId)
            }
            catch(err){
                log.error(`Error Setting industry code questions cache industryCodeId ${industryCodeId} for Redis ${err}` + __location)
            }
            log.info(`Indusry Code Redis cached for industryCode ${industryCodeId} updated ${i + 1} of ${industryCodeList.length} in ${listName}`);
        }
    }
    else {
        log.info(`No industry code List to update` + __location)
    }
}

// eslint-disable-next-line require-jsdoc
async function processIndustryCodeList(industryCodeList){
    if(industryCodeList && industryCodeList.length > 1 && global.settings.REDIS_QUESTION_CACHE_JOB_COUNT > 1){
        // eslint-disable-next-line prefer-const
        let subListSize = Math.floor(industryCodeList.length / global.settings.REDIS_QUESTION_CACHE_JOB_COUNT)
        if(industryCodeList.length % global.settings.REDIS_QUESTION_CACHE_JOB_COUNT > 0){
            subListSize += 1;
        }
        const subIndustryCodeLisArray = helper.splitArray(industryCodeList, subListSize);
        const createRedisIndustryCodeQuestionCmdList = [];
        for(let i = 0; i < subIndustryCodeLisArray.length; i++){
            log.debug(`Adding sublist ${i + 1} length: ${subIndustryCodeLisArray[i].length}` + __location)
            const listName = "list" + (i + 1);
            createRedisIndustryCodeQuestionCmdList.push(CreateRedisIndustryCodeQuestionByArray(subIndustryCodeLisArray[i], listName))
        }
        await Promise.all(createRedisIndustryCodeQuestionCmdList);
    }
    else {
        await CreateRedisIndustryCodeQuestionByArray(industryCodeList);
    }
    return industryCodeList.length;
}


exports.UpdateRedisIndustryQuestionByQuestionId = async function(questionId){
    const sql = `SELECT distinct ic.id as 'industryCodeId'
        FROM clw_talage_industry_codes AS ic
        INNER JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON industryCodeMap.talageIndustryCodeId = ic.id
        INNER JOIN clw_talage_insurer_industry_codes AS iic ON iic.id = industryCodeMap.insurerIndustryCodeId
        INNER JOIN clw_talage_industry_code_questions AS icq ON icq.insurerIndustryCodeId = iic.id
        where icq.talageQuestionId = ${db.escape(questionId)}
        order by ic.id`

    let error = null;
    const industryCodeList = await db.queryReadonlyCluster(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        log.error(`Error getting industry code  for questionId  ${questionId} for Redis ${error}` + __location)
        return false;
    }
    if(industryCodeList.length > 0){
        await processIndustryCodeList(industryCodeList)
    }
    else {
        log.info(`No industry code to update for QuestionId ${questionId} ` + __location)
    }
}


exports.UpdateRedisIndustryQuestionByInsurer = async function(insurerId){
    const sql = `SELECT distinct ic.id as 'industryCodeId'
        FROM clw_talage_industry_codes AS ic
        INNER JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON industryCodeMap.talageIndustryCodeId = ic.id
        INNER JOIN clw_talage_insurer_industry_codes AS iic ON iic.id = industryCodeMap.insurerIndustryCodeId
        where iic.insurer = ${db.escape(insurerId)}
        order by ic.id`

    let error = null;
    const industryCodeList = await db.queryReadonlyCluster(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        log.error(`Error getting industry code  for insurerId  ${insurerId} for Redis ${error}` + __location)
        return false;
    }
    if(industryCodeList.length > 0){
        await processIndustryCodeList(industryCodeList)
    }
    else {
        log.info(`No industry code to update for insurerId ${insurerId} ` + __location)
    }
}

exports.UpdateRedisIndustryQuestions = async function(industryCodeId){
    let sql = ` SELECT distinct ic.id as 'industryCodeId'
            FROM clw_talage_industry_codes AS ic
            INNER JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON industryCodeMap.talageIndustryCodeId = ic.id
            INNER JOIN clw_talage_insurer_industry_codes AS iic ON iic.id = industryCodeMap.insurerIndustryCodeId
            INNER JOIN clw_talage_industry_code_questions AS icq ON icq.insurerIndustryCodeId = iic.id
            where ic.state > 0 `;
    if(industryCodeId){
        sql += ` AND ic.id = ${db.escape(industryCodeId)}`
    }
    sql += ` order by ic.id`

    let error = null;
    const industryCodeList = await db.queryReadonlyCluster(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        log.error(`Error getting industry codes for Redis update ${error}` + __location)
        return false;
    }
    await processIndustryCodeList(industryCodeList)

    log.info("Redis Industry Code Question cached updated. processed " + industryCodeList.length + __location);


    return industryCodeList.length;


}