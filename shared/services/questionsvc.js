/* eslint-disable array-element-newline */
/* eslint-disable object-curly-newline */
/* eslint-disable multiline-comment-style */
/* eslint-disable one-var */
const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const helper = global.requireShared('./helpers/helper.js');
const log = global.log;
const QuestionModel = require('mongoose').model('Question');
const utility = global.requireShared('./helpers/utility.js');


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

    log.info(`GetQuestions: activityCodeStringArray:  ${activityCodeStringArray}, industryCodeString:  ${industryCodeString}, zipCodeStringArray:  ${zipCodeStringArray}, policyTypeArray:  ${JSON.stringify(policyTypeArray)}, insurerStringArray:  ${insurerStringArray}, questionSubjectArea: ${questionSubjectArea}, return_hidden: ${return_hidden}, stateList:  ${JSON.stringify(stateList)}` + __location)

    /*
     * Validate Activity Codes
     */
    // Convert activity code strings to ints
    let activityCodeArray = activityCodeStringArray.map(activityCode => parseInt(activityCode, 10));

    // Filter out duplicate codes
    activityCodeArray = activityCodeArray.filter((code, index) => activityCodeArray.indexOf(code) === index);

    /*
     * Validate Industry Code
     */

    // Prep industry code for validation
    const industry_code = industryCodeString ? parseInt(industryCodeString, 10) : 0;

    let territories = [];
    if(stateList.length > 0){
        territories = stateList;
    }
    else {
        // get territories from zipcodes
        const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');
        const zipCodeBO = new ZipCodeBO();
        const zipCodeArray = zipCodeStringArray.map(zip => zip.replace(/[^0-9]/gi, ''))
        // Check that the zip code is valid
        if (zipCodeArray && zipCodeArray.length > 0) {
            const zipStateList = await zipCodeBO.getStatesForZipCodeList(zipCodeArray)
            zipStateList.forEach((zipState) => {
                territories.push(zipState)
            })
        }
        else {
            log.warn('Question Service: Bad Request: Zip Codes - no zip codes' + __location);
            //Do not kill process.  There are questions for "All States" See Univeral question processing.
            // no code base questions will come back
            // return false;
        }
    }


    /*
     * Validate Policy Types
     */

    const policyTypes = [];
    const mongoPolicyExpirationList = [];
    // Question list effective date is done per policy type.
    // For a given policy type, check the question's effective/expiration dates.
    const uniquePolicyEffectiveDateList = [];
    const questionEffectiveDateWhereClauseList = [];
    policyTypeArray.forEach(function(policyTypeJSON) {
        // Build a list of policy types
        policyTypes.push(policyTypeJSON.type.replace(/[^a-z]/gi, '').toUpperCase());
        const policyEffectiveDate = moment(policyTypeJSON.effectiveDate).format('YYYY-MM-DD HH:mm:ss');
        // Build a list of unique policy effective dates for the industry and activity code queries
        if (!uniquePolicyEffectiveDateList.includes(policyEffectiveDate)) {
            uniquePolicyEffectiveDateList.push(policyEffectiveDate);
        }
        questionEffectiveDateWhereClauseList.push(`(iq.policy_type = '${policyTypeJSON.type.toUpperCase()}' AND '${policyEffectiveDate}' >= iq.effectiveDate AND '${policyEffectiveDate}' < iq.expirationDate)`);

        const mongoPolicyEffectiveDateQuery = {
            policyTypeList: policyTypeJSON.type.toUpperCase(),
            effectiveDate: {$lte: policyEffectiveDate},
            expirationDate: {$gte: policyEffectiveDate}
        }
        mongoPolicyExpirationList.push(mongoPolicyEffectiveDateQuery);
    });


    // Industry and activity code effective date is done using the unique policy effective date list.
    const industryCodeEffectiveDateWhereClauseList = [];
    const activityCodeEffectiveDateWhereClauseList = [];
    for (const policyEffectiveDate of uniquePolicyEffectiveDateList) {
        industryCodeEffectiveDateWhereClauseList.push(`('${policyEffectiveDate}' >= iic.effectiveDate AND '${policyEffectiveDate}' < iic.expirationDate)`);
        activityCodeEffectiveDateWhereClauseList.push(`('${policyEffectiveDate}' >= inc.effectiveDate AND '${policyEffectiveDate}' < inc.expirationDate)`);
    }

    // Get Policy Types from the database - Is this necessary - bad policyType will just mean no questions.
    const supported_policy_types = [];
    const PolicyTypeBO = global.requireShared('./models/PolicyType-BO.js');
    const policyTypeBO = new PolicyTypeBO();
    const policyTypeList = await policyTypeBO.getList({wheelhouse_support: true}).catch(function(err) {
        // Check if this was
        log.error(`policyTypeBO error on getList ` + err + __location);
    });
    if (policyTypeList) {
        policyTypeList.forEach(function(policy_type) {
            supported_policy_types.push(policy_type.policyTypeCd);
        });
    }

    // Check that all policy types match
    policyTypes.forEach(function(policy_type) {
        if (!supported_policy_types.includes(policy_type)) {
            log.warn(`Bad Request: Invalid Policy Type ${policy_type}` + __location);
        }
    });


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


    // Build the select and where statements
    // const select = `q.id, q.parent, q.parent_answer, q.sub_level, q.question AS \`text\`, q.hint, q.type AS type_id, qt.name AS type, q.hidden${return_hidden ? ', GROUP_CONCAT(DISTINCT CONCAT(iq.insurer, "-", iq.policy_type)) AS insurers' : ''}`;
    // let where = `q.state = 1
    //     ${insurerArray.length ? `AND iq.insurer IN (${insurerArray.join(',')})` : ''}
    // `;
    const InsurerQuestionModel = require('mongoose').model('InsurerQuestion');
    let questions = [];
    log.debug("Getting universal questions " + __location);
    // ============================================================
    // Get universal questions
    // Mongo
    const policyEffectiveDate = uniquePolicyEffectiveDateList[0];

    // eslint-disable-next-line prefer-const
    let insurerQuestionQuery = {
        insurerId: {$in: insurerArray},
        universal: true,
        policyTypeList: {$in: policyTypes},
        questionSubjectArea: questionSubjectArea,
        active: true
    }

    // eslint-disable-next-line prefer-const
    let orParamList = [];
    mongoPolicyExpirationList.forEach((mongoPolicyEffectiveDateQuery) => {
        orParamList.push(mongoPolicyEffectiveDateQuery)
    });
    insurerQuestionQuery.$or = orParamList;
    log.debug(`insurerQuestionQuery Universal  ${"\n"} ${JSON.stringify(insurerQuestionQuery)} ${'\n'} ` + __location);
    let start = moment();
    try{

        const insurerQuestionList = await InsurerQuestionModel.find(insurerQuestionQuery).lean();
        //need territory filter
        //territoryList: {$in: territories},

        if(insurerQuestionList && insurerQuestionList.length > 0){
            // eslint-disable-next-line prefer-const
            let talageQuestionIdArray = [];
            //let noTerritoryHitCount = 0;
            for(const insurerQuestion of insurerQuestionList){
                if(insurerQuestion.talageQuestionId){
                    let add = false;
                    if(insurerQuestion.territoryList && insurerQuestion.territoryList.length > 0){
                        const territoryHit = insurerQuestion.territoryList.some((iqt) => territories.includes(iqt))
                        if(territoryHit){
                            add = true;
                        }
                    }
                    else {
                        add = true;
                        //noTerritoryHitCount++;
                    }
                    if(add && talageQuestionIdArray.indexOf(insurerQuestion.talageQuestionId) === -1){
                        talageQuestionIdArray.push(insurerQuestion.talageQuestionId)
                    }
                }
            }
            // log.debug("NO territoryList hit count " + noTerritoryHitCount + __location);
            log.debug("Number of Universal Insurer Questions  " + talageQuestionIdArray.length + __location);
            if(talageQuestionIdArray.length > 0) {
                log.debug(`talageQuestionIdArray.length ${talageQuestionIdArray.length} `)
                const universal_questions = await getTalageQuestionFromInsureQuestionList(talageQuestionIdArray, insurerQuestionList,return_hidden);
                log.debug(`Adding ${universal_questions.length} Mongo universal questions ` + __location)
                questions = questions.concat(universal_questions);
            }
            else {
                log.debug(`No universal questions ` + __location)
            }
        }
        else {
            log.debug(`No Insurer universal questions found ` + __location)
        }
        const endSqlSelect = moment();
        const diff = endSqlSelect.diff(start, 'milliseconds', true);
        log.info(`Mongo Universal Question process duration: ${diff} milliseconds`);
    }
    catch(err){
        log.error(`Error loading Universal Questions from Mongo ${err}` + __location)
    }

    // From this point forward, only get non-universal questions
    // where += ' AND iq.universal = 0';

    // ============================================================
    // // Get industry-based questions
    //log.debug("territories " + territories);
    log.debug(`Getting industry questions use Redis ${global.settings.USE_REDIS_QUESTION_CACHE}  ` + __location);
    // if(global.settings.USE_REDIS_QUESTION_CACHE === "YES"){
    // }
    const InsurerIndustryCodeModel = require('mongoose').model('InsurerIndustryCode');
    start = moment();
    // eslint-disable-next-line prefer-const
    let industryQuery = {
        insurerId: {$in: insurerArray},
        talageIndustryCodeIdList: industry_code,
        territoryList: {$in: territories},
        effectiveDate: {$lte: policyEffectiveDate},
        expirationDate: {$gte: policyEffectiveDate},
        active: true
    }
    // eslint-disable-next-line prefer-const
    orParamList = [];
    const policyTypeCheck = {policyTypeList: {$in: policyTypes}};
    const policyTypeLengthCheck = {policyTypeList: {$size: 0}}
    const policyTypeNullCheck = {policyTypeList: null}
    orParamList.push(policyTypeCheck)
    orParamList.push(policyTypeLengthCheck)
    orParamList.push(policyTypeNullCheck)
    industryQuery.$or = orParamList;
    try{
        //log.debug(`insurerIndustryCodeList query ${JSON.stringify(industryQuery)}`)
        const insurerIndustryCodeList = await InsurerIndustryCodeModel.find(industryQuery).lean();
        let insurerQuestionIdArray = [];
        // eslint-disable-next-line prefer-const
        let talageQuestionIdArray = [];
        if(insurerIndustryCodeList && insurerIndustryCodeList.length > 0){
            for(const insurerIndustryCode of insurerIndustryCodeList){
                if(insurerIndustryCode.insurerTerritoryQuestionList && insurerIndustryCode.insurerTerritoryQuestionList.length > 0){
                    let addStandardQuestions = false;
                    for(let i = 0; i < territories.length; i++){
                        //find if territory is in insurerIndustryCode.InsurerTerritoryQuestionList
                        //if so add question list - Dups are OK.
                        const tQFound = insurerIndustryCode.insurerTerritoryQuestionList.find((tQ) => tQ.territory === territories[i]);
                        if(tQFound && tQFound.insurerQuestionIdList && tQFound.insurerQuestionIdList.length > 0){
                            insurerQuestionIdArray = insurerQuestionIdArray.concat(tQFound.insurerQuestionIdList);
                        }
                        else{
                            //we want to add the insurerIndustryCode's standard question list.
                            addStandardQuestions = true;
                        }
                    }
                    //any territory that does not get a hit trigger adding standard questions
                    if(addStandardQuestions && insurerIndustryCode.insurerQuestionIdList && insurerIndustryCode.insurerQuestionIdList.length > 0){
                        insurerQuestionIdArray = insurerQuestionIdArray.concat(insurerIndustryCode.insurerQuestionIdList);
                    }
                }
                else if(insurerIndustryCode.insurerQuestionIdList && insurerIndustryCode.insurerQuestionIdList.length > 0){
                    insurerQuestionIdArray = insurerQuestionIdArray.concat(insurerIndustryCode.insurerQuestionIdList);
                }

            }//for insurerIndustryCodeList
        }
        //log.debug("insurerIndustryCodeList insurerQuestionIdArray " + insurerQuestionIdArray)
        let insurerQuestionList = null;
        if(insurerQuestionIdArray.length > 0){
            // eslint-disable-next-line prefer-const
            insurerQuestionQuery = {
                insurerId: {$in: insurerArray},
                insurerQuestionId: {$in: insurerQuestionIdArray},
                universal: false,
                questionSubjectArea: questionSubjectArea,
                active: true
            }
            // eslint-disable-next-line prefer-const
            const orParamList2 = [];
            const territoryAllCheck = {allTerritories: true};
            const territoryCheck = {territoryList: {$in: territories}};
            const territoryLengthCheck = {territoryList: {$size: 0}}
            const territoryNullCheck = {territoryList: null}
            orParamList2.push(territoryAllCheck)
            orParamList2.push(territoryCheck)
            orParamList2.push(territoryNullCheck)
            orParamList2.push(territoryLengthCheck)

            const orParamExprDate = []
            mongoPolicyExpirationList.forEach((mongoPolicyEffectiveDateQuery) => {
                orParamExprDate.push(mongoPolicyEffectiveDateQuery)
            });
            insurerQuestionQuery.$and = [{$or: orParamList2}, {$or:orParamExprDate}];

            //log.debug("insurerQuestionQuery: " + JSON.stringify(insurerQuestionQuery));
            insurerQuestionList = await InsurerQuestionModel.find(insurerQuestionQuery).lean();
            if(insurerQuestionList){
                for(const insurerQuestion of insurerQuestionList){
                    if(insurerQuestion.talageQuestionId && talageQuestionIdArray.indexOf(insurerQuestion.talageQuestionId) === -1){
                        talageQuestionIdArray.push(insurerQuestion.talageQuestionId)
                    }
                }
            }
        }
        // log.debug("talageQuestionIdArray " + talageQuestionIdArray)
        if(talageQuestionIdArray.length > 0) {
            const industry_questions = await getTalageQuestionFromInsureQuestionList(talageQuestionIdArray, insurerQuestionList,return_hidden);
            log.debug(`Adding ${industry_questions.length} Mongo industry questions ` + __location)
            questions = questions.concat(industry_questions);
            //log.debug("industry_questions " + JSON.stringify(industry_questions));
        }
        const endSqlSelect = moment();
        const diff = endSqlSelect.diff(start, 'milliseconds', true);
        log.info(`Mongo Industry Question process duration: ${diff} milliseconds`);
    }
    catch(err){
        log.error(`Error get Mongo Industry questions ${JSON.stringify(industryQuery)}  ${err}` + __location);
    }

    log.debug("Getting activity questions " + __location);
    // ============================================================
    // Get activity-based questions
    const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
    start = moment();
    const now = moment();
    // eslint-disable-next-line prefer-const
    let activityCodeQuery = {
        insurerId: {$in: insurerArray},
        talageActivityCodeIdList: {$in: activityCodeArray},
        territoryList: {$in: territories},
        effectiveDate: {$lte: now},
        expirationDate: {$gte: now},
        active: true
    }
    try{
        log.debug(`activityCodeQuery ${JSON.stringify(activityCodeQuery)}`);
        const insurerActivityCodeList = await InsurerActivityCodeModel.find(activityCodeQuery).lean();
        // eslint-disable-next-line prefer-const
        let insurerQuestionIdArray = [];
        // eslint-disable-next-line prefer-const
        let talageQuestionIdArray = [];
        if(insurerActivityCodeList && insurerActivityCodeList.length > 0){
            for(const insurerActivityCode of insurerActivityCodeList){
                if(insurerActivityCode.insurerTerritoryQuestionList && insurerActivityCode.insurerTerritoryQuestionList.length > 0){
                    let addStandardQuestions = false;
                    for(let i = 0; i < territories.length; i++){
                        //if so add question list - Dups are OK.
                        const tQFound = insurerActivityCode.insurerTerritoryQuestionList.find((tQ) => tQ.territory === territories[i]);
                        if(tQFound && tQFound.insurerQuestionIdList && tQFound.insurerQuestionIdList.length > 0){
                            //insurerQuestionIdArray = insurerQuestionIdArray.concat(tQFound.insurerQuestionIdList);
                            utility.addArrayToArray(insurerQuestionIdArray,tQFound.insurerQuestionIdList)
                        }
                        else {
                            addStandardQuestions = true;
                        }
                    }
                    //any territory that does not get a hit trigger adding standard questions
                    if(addStandardQuestions && insurerActivityCode.insurerQuestionIdList && insurerActivityCode.insurerQuestionIdList.length > 0){
                        //insurerQuestionIdArray = insurerQuestionIdArray.concat(insurerActivityCode.insurerQuestionIdList);
                        utility.addArrayToArray(insurerQuestionIdArray,insurerActivityCode.insurerQuestionIdList)
                    }
                }
                else if(insurerActivityCode.insurerQuestionIdList && insurerActivityCode.insurerQuestionIdList.length > 0){
                    //insurerQuestionIdArray = insurerQuestionIdArray.concat(insurerActivityCode.insurerQuestionIdList);
                    utility.addArrayToArray(insurerQuestionIdArray,insurerActivityCode.insurerQuestionIdList)
                }
            }
        }
        //log.debug("insurerQuestionIdArray " + insurerQuestionIdArray + __location)
        let insurerQuestionList = null;
        if(insurerQuestionIdArray.length > 0){
            // eslint-disable-next-line prefer-const
            insurerQuestionQuery = {
                insurerId: {$in: insurerArray},
                insurerQuestionId: {$in: insurerQuestionIdArray},
                universal: false,
                questionSubjectArea: questionSubjectArea,
                active: true
            }
            // eslint-disable-next-line prefer-const
            const orParamList2 = [];
            const territoryAllCheck = {allTerritories: true};
            const territoryCheck = {territoryList: {$in: territories}};
            const territoryLengthCheck = {territoryList: {$size: 0}}
            const territoryNullCheck = {territoryList: null}
            orParamList2.push(territoryAllCheck)
            orParamList2.push(territoryCheck)
            orParamList2.push(territoryNullCheck)
            orParamList2.push(territoryLengthCheck)
            const orParamExprDate = []
            mongoPolicyExpirationList.forEach((mongoPolicyEffectiveDateQuery) => {
                orParamExprDate.push(mongoPolicyEffectiveDateQuery)
            });
            insurerQuestionQuery.$and = [{$or: orParamList2}, {$or:orParamExprDate}];

            //log.debug("insurerQuestionQuery: " + JSON.stringify(insurerQuestionQuery));
            insurerQuestionList = await InsurerQuestionModel.find(insurerQuestionQuery).lean();
            if(insurerQuestionList){
                for(const insurerQuestion of insurerQuestionList){
                    if(insurerQuestion.talageQuestionId && talageQuestionIdArray.indexOf(insurerQuestion.talageQuestionId) === -1){
                        talageQuestionIdArray.push(insurerQuestion.talageQuestionId)
                    }
                }
            }
        }
        //log.debug("talageQuestionIdArray " + talageQuestionIdArray + __location)
        if(talageQuestionIdArray.length > 0) {
            const activityCode_questions = await getTalageQuestionFromInsureQuestionList(talageQuestionIdArray, insurerQuestionList,return_hidden);
            log.debug(`Adding ${activityCode_questions.length} Mongo activity code questions ` + __location)
            questions = questions.concat(activityCode_questions);
            //log.debug("activityCode_questions " + JSON.stringify(activityCode_questions));
        }
        const endSqlSelect = moment();
        const diff2 = endSqlSelect.diff(start, 'milliseconds', true);
        log.info(`Mongo Activity Code Question process duration: ${diff2} milliseconds`);
    }
    catch(err){
        log.error(`Error get Mongo Activity questions ${JSON.stringify(activityCodeQuery)}  ${err}` + __location);
    }

    log.debug("Getting missing questions " + __location);
    // Check for missing questions
    start = moment();
    let missing_questions = find_missing_questions(questions);
    while (missing_questions) {
        const added_questions = await getTalageQuestionFromInsureQuestionList(missing_questions, null,return_hidden);
        log.debug("Missing questions count " + added_questions.length + __location);
        questions = questions.concat(added_questions);
        // Check for additional missing questions
        missing_questions = find_missing_questions(questions);
    }
    const endSqlSelect = moment();
    const diff2 = endSqlSelect.diff(start, 'milliseconds', true);
    log.info(`Missing Question process duration: ${diff2} milliseconds`);

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

    try{
        questions.forEach((question) => {
            if (question.type_id >= 1 && question.type_id <= 3 && question.answers && question.answers.length > 0) {
                question.possible_answers = {};
                question.answers.forEach((answer) => {
                    const answer_obj = Object.assign({}, answer);
                    // Remove the default if it is not applicable
                    if (answer_obj.default === false) {
                        delete answer_obj.default;
                    }
                    //Backward compatible for MySql query
                    answer_obj.id = answer_obj.answerId;
                    answer_obj.question = question.talageQuestionId;

                    question.possible_answers[answer_obj.answerId] = answer_obj;

                });
                // If there were no answers, do not return the element
                if (!Object.keys(question.possible_answers).length) {
                    delete question.possible_answers;
                }
            }
            delete question.type_id;
        });
    }
    catch(err){
        log.error(`QuestionSvc Error Creating possible answers ${err}` + __location)
    }

    log.debug("question sort " + __location);
    // Sort the questions
    questions.sort(function(a, b) {
        return a.id - b.id;
    });
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
exports.GetQuestionsForFrontend = async function(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerStringArray, questionSubjectArea, return_hidden = true, stateList = []){

    const questions = await GetQuestions(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerStringArray, questionSubjectArea, return_hidden, stateList);

    if(!questions || questions === false){
        log.debug('GetQuestionsForFrontend no questions ')
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
exports.GetQuestionsForBackend = async function(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden = true, stateList = []){
    return GetQuestions(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden, stateList);
}


/**
 * Get talage Question list from  insureQuestionList
 *
 * @param {array} talageQuestionIdArray - An array of question IDs
 * @param {array} insurerQuestionList - An array of insureQuestion objects
 * @param {boolean} return_hidden - true = get hidden questions
 *
 * @returns {mixed} - An array of IDs if questions are missing, false if none are
 */
async function getTalageQuestionFromInsureQuestionList(talageQuestionIdArray, insurerQuestionList, return_hidden = false){
    if(!talageQuestionIdArray || talageQuestionIdArray.length === 0){
        return [];
    }
    const start = moment();
    let talageQuestions = [];
    let error = null;

    //get question from Mongo.
    // eslint-disable-next-line object-property-newline
    const query = {active: true, talageQuestionId: {$in: talageQuestionIdArray}};
    // eslint-disable-next-line object-property-newline
    const queryProjection = {"__v": 0, "_id": 0,acordQuestion: 0, active: 0,updatedAt:0, createdAt: 0};
    talageQuestions = await QuestionModel.find(query,queryProjection).lean().catch(function(err) {
        error = err.message;
        log.error(`Error get Talage Questions ${err} ` + __location);
    });
    if (error) {
        return [];
    }
    //backwards capable with mysql query
    talageQuestions.forEach(function(talageQuestion){
        talageQuestion.id = talageQuestion.talageQuestionId
        talageQuestion.type = talageQuestion.typeDesc
        talageQuestion.type_id = talageQuestion.typeId
        talageQuestion.answers.forEach((answer) => {
            if(answer._id){
                delete answer._id
            }
            if(answer.id){
                delete answer.id
            }
            if(!answer.default){
                answer.default = false;
            }
        })

    });

    const endSqlSelect = moment();
    const diff = endSqlSelect.diff(start, 'milliseconds', true);
    log.info(`Mongo Talage Question process duration: ${diff} milliseconds`);
    // should be removed once integration are refactored
    // to drive off insurer questions not talage quesetions.
    // this is only need to match TalageQuestion to insurer question.
    if(insurerQuestionList && talageQuestions && talageQuestions.length && return_hidden){
        // if(!insurerQuestionList){
        //     //TODO get insurerQuestionList from talageQuestions
        // }
        //Create new return question array with insuer-policytype info
        //loop  talageQuestions find insurerQuestionList matches.
        //add row for every match
        // eslint-disable-next-line prefer-const
        let talageQuestionPolicyTypeList = [];
        // eslint-disable-next-line prefer-const
        let insurerQuestionRefList = [];
        talageQuestions.forEach(function(talageQuestion){
            const iqForTalageQList = insurerQuestionList.filter(function(iq) {
                return iq.talageQuestionId === talageQuestion.id;
            });
            //change to store insurerQuestionId.  will allow for multiple insurerquestions to map to
            // one talage question.
            iqForTalageQList.forEach(function(iqForTalageQ){
                iqForTalageQ.policyTypeList.forEach((policyType) => {
                    talageQuestionPolicyTypeList.push(iqForTalageQ.insurerId + "-" + policyType)
                });
                insurerQuestionRefList.push(iqForTalageQ.insurerId + "-" + iqForTalageQ.insurerQuestionId)
            });
            talageQuestion.insurers = talageQuestionPolicyTypeList.join(',');
            talageQuestion.insurerQuestionRefList = insurerQuestionRefList;
        });
        return talageQuestions;
    }
    else{
        return talageQuestions;
    }

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
// async function CreateRedisIndustryCodeQuestionEntryInternal(industryCodeId){


//     const redisKey = "question-industry-" + industryCodeId.toString();
//     try{
//         //const ttlSeconds = 3600;
//         const redisResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(questionList))
//         if(redisResponse && redisResponse.saved){
//             log.debug(`Saved ${redisKey} to Redis ` + __location);
//         }
//     }
//     catch(err){
//         log.error(`Error save ${redisKey} to Redis JWT ` + err + __location);
//     }
//     return redisKey;


// }


// exports.UpdateRedisIndustryQuestionByQuestionId = async function(questionId){

// }


// exports.UpdateRedisIndustryQuestionByInsurer = async function(){

// }

// exports.UpdateRedisIndustryQuestions = async function(){
// }