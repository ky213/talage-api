/* eslint-disable array-element-newline */
/* eslint-disable object-curly-newline */
/* eslint-disable multiline-comment-style */
/* eslint-disable one-var */
const moment = require('moment');
// eslint-disable-next-line no-unused-vars
const helper = global.requireShared('./helpers/helper.js');
const log = global.log;
const QuestionModel = global.mongoose.Question;
const utility = global.requireShared('./helpers/utility.js');


/**
 * @param {array} activityCodeStringArray - An array of all the activity codes in the applicaiton
 * @param {string} industryCodeStringArray - An Array of industry codes of the application
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
async function GetQuestions(activityCodeStringArray, industryCodeStringArray, zipCodeStringArray, policyTypeArray, insurerStringArray, questionSubjectArea = "general", return_hidden = false, stateList = []) {

    log.info(`GetQuestions: activityCodeStringArray:  ${activityCodeStringArray}, industryCodeStringArray:  ${industryCodeStringArray}, zipCodeStringArray:  ${zipCodeStringArray}, policyTypeArray:  ${JSON.stringify(policyTypeArray)}, insurerStringArray:  ${insurerStringArray}, questionSubjectArea: ${questionSubjectArea}, return_hidden: ${return_hidden}, stateList:  ${JSON.stringify(stateList)}` + __location)

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

    const industryCodeIdList = [];
    for(const industryCodeString of industryCodeStringArray){
        //const industry_code = industryCodeString ? parseInt(industryCodeString, 10) : 0;
        const industrycodeId = industryCodeString ? parseInt(industryCodeString, 10) : 0;
        industryCodeIdList.push(industrycodeId)
    }

    let territories = [];
    if(stateList.length > 0){
        territories = stateList;
    }
    else if(zipCodeStringArray.length > 0) {
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
    else {
        log.info('Question Service: no zip codes or state info' + __location);
    }


    /*
     * Validate Policy Types
     */

    const policyTypes = [];
    const mongoPolicyExpirationList = [];

    const policyExpirationList = [];
    // Question list effective date is done per policy type.
    // For a given policy type, check the question's effective/expiration dates.
    const uniquePolicyEffectiveDateList = [];
    // const questionEffectiveDateWhereClauseList = [];
    policyTypeArray.forEach(function(policyTypeJSON) {
        // Build a list of policy types
        policyTypes.push(policyTypeJSON.type.replace(/[^a-z]/gi, '').toUpperCase());
        const policyEffectiveDate = moment(policyTypeJSON.effectiveDate).format('YYYY-MM-DD HH:mm:ss');
        // Build a list of unique policy effective dates for the industry and activity code queries
        if (!uniquePolicyEffectiveDateList.includes(policyEffectiveDate)) {
            uniquePolicyEffectiveDateList.push(policyEffectiveDate);
        }
        // questionEffectiveDateWhereClauseList.push(`(iq.policy_type = '${policyTypeJSON.type.toUpperCase()}' AND '${policyEffectiveDate}' >= iq.effectiveDate AND '${policyEffectiveDate}' < iq.expirationDate)`);

        const mongoPolicyEffectiveDateQuery = {
            policyTypeList: policyTypeJSON.type.toUpperCase(),
            effectiveDate: {$lte: policyEffectiveDate},
            expirationDate: {$gte: policyEffectiveDate}
        }
        mongoPolicyExpirationList.push(mongoPolicyEffectiveDateQuery);

        //for IC and AC queries
        const policyEffectiveDateItem = {
            policyTypeList: policyTypeJSON.type.toUpperCase(),
            effectiveDate: policyEffectiveDate,
            expirationDate: policyEffectiveDate
        }

        policyExpirationList.push(policyEffectiveDateItem);
    });


    // Get Policy Types from the database - Is this necessary - bad policyType will just mean no questions.
    const supported_policy_types = [];
    const PolicyTypeBO = global.requireShared('./models/PolicyType-BO.js');
    const policyTypeBO = new PolicyTypeBO();
    const policyTypeListDB = await policyTypeBO.getList({wheelhouse_support: true}).catch(function(err) {
        // Check if this was
        log.error(`policyTypeBO error on getList ` + err + __location);
    });
    if (policyTypeListDB) {
        policyTypeListDB.forEach(function(policy_type) {
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
    const InsurerQuestionModel = global.mongoose.InsurerQuestion;
    let questions = [];
    log.debug("Getting universal questions " + __location);
    // ============================================================
    // Get universal questions
    // Mongo


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
    if(orParamList.length > 0){
        insurerQuestionQuery.$or = orParamList;
    }
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
                    if(insurerQuestion.territoryList && insurerQuestion.territoryList.length > 0 && territories.length > 0){
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
    let policyEffectiveDate = uniquePolicyEffectiveDateList[0];
    //get first non-WC effective date, otherwise use the only one we have.
    const glPolicyDates = policyExpirationList.find((policyEffective) => policyEffective.policyTypeList !== "WC");
    if(glPolicyDates){
        policyEffectiveDate = glPolicyDates.effectiveDate
    }

    const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;
    start = moment();
    for(const industryCodeId of industryCodeIdList){
        if(industryCodeId > 0){
            // eslint-disable-next-line prefer-const
            let industryQuery = {
                insurerId: {$in: insurerArray},
                talageIndustryCodeIdList: industryCodeId,
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
                    log.debug(`Adding ${industry_questions.length} Mongo industry questions for ${industryCodeId}` + __location)
                    questions = questions.concat(industry_questions);
                    //log.debug("industry_questions " + JSON.stringify(industry_questions));
                }
            }
            catch(err){
                log.error(`Error get Mongo Industry questions ${JSON.stringify(industryQuery)}  ${err}` + __location);
            }
        }
    }
    let endSqlSelect = moment();
    const diff = endSqlSelect.diff(start, 'milliseconds', true);
    log.info(`Mongo Industry Question process duration: ${diff} milliseconds`);

    log.debug("Getting activity questions " + __location);
    // ============================================================

    //get WC effective date, no WC use 1st one we have.
    policyEffectiveDate = uniquePolicyEffectiveDateList[0];
    const wcPolicyDates = policyExpirationList.find((policyEffective) => policyEffective.policyTypeList === "WC");
    if(wcPolicyDates){
        policyEffectiveDate = wcPolicyDates.effectiveDate
    }

    // Get activity-based questions
    const InsurerActivityCodeModel = global.mongoose.InsurerActivityCode;
    start = moment();
    // eslint-disable-next-line prefer-const
    let activityCodeQuery = {
        insurerId: {$in: insurerArray},
        talageActivityCodeIdList: {$in: activityCodeArray},
        territoryList: {$in: territories},
        effectiveDate: {$lte: policyEffectiveDate},
        expirationDate: {$gte: policyEffectiveDate},
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
        endSqlSelect = moment();
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
        // If Added questions is empty then the break out of loop, will return empty if parent questions are inactive
        if(added_questions.length === 0){
            log.debug(`Added questions is returning empty array: ${added_questions.length} for questions ${JSON.stringify(missing_questions)}` + __location);
            break;
        }
        log.debug("Missing questions count " + added_questions.length + __location);
        questions = questions.concat(added_questions);
        // Check for additional missing questions
        missing_questions = find_missing_questions(questions);
    }
    endSqlSelect = moment();
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
        return a.categorySortNumber - b.categorySortNumber || a.sortRanking - b.sortRanking || a.talageQuestionId - b.talageQuestionId
    });
    log.info(`Returning ${questions.length} Questions`);

    return questions;
}

/**
 * @param {array} activityCodeArray - An array of all the activity codes in the applicaiton
 * @param {string} industryCodeStringArray - An array of industry codes of the application
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
// exports.GetQuestionsForAppBO = async function(activityCodeArray, industryCodeStringArray, zipCodeArray, policyTypeArray, insurerStringArray, questionSubjectArea = "general", return_hidden = true, stateList = []){

//     const questionPullStart = moment();
//     const questions = await GetQuestions(activityCodeArray, industryCodeStringArray, zipCodeArray, policyTypeArray, insurerStringArray, questionSubjectArea, return_hidden, stateList);

//     if(!questions || questions === false){
//         log.debug('GetQuestionsForAppBO no questions ')
//         return false;
//     }
//     for(const question in questions){
//         if(Object.prototype.hasOwnProperty.call(questions, question)){
//             if('possible_answers' in questions[question]){
//                 questions[question].answers = Object.values(questions[question].possible_answers);
//                 delete questions[question].possible_answers;
//             }
//         }
//     }


//     const endQuestionPull = moment();
//     const diff = endQuestionPull.diff(questionPullStart, 'milliseconds', true);
//     log.info(`GetQuestionsForAppBO Question pull: ${questions.length} in ${diff} milliseconds`);

//     return questions;
// }

/**
 * @param {array} activityCodeArray - An array of all the activity codes in the applicaiton
 * @param {string} industryCodeStringArray - An array of industry codes of the application
 * @param {array} zipCodeArray - An array of all the zipcodes (stored as strings) in which the business operates
 * @param {array.<Object>} policyTypeJsonList - An array containing of all the policy types applied for. Ex: [{type:"WC",effectiveDate:"03-02-2021", insurerIdList: [1,3]}]
 * @param {string} questionSubjectArea - A string specifying the question subject area ("general", "location", "location.building", ...)
 * @param {boolean} return_hidden - true to return hidden questions, false to only return visible questions
 * @param {array} stateList - An array containing the US State Codes for the application
 *
 * @returns {array|false} An array of questions structured the way the front end is expecting them, false otherwise
 *
 */
exports.GetQuestionsForAppBO2 = async function(activityCodeArray, industryCodeStringArray, zipCodeArray, policyTypeJsonList, questionSubjectArea = "general", return_hidden = true, stateList = []){

    const questionPullStart = moment();
    const questions = [];
    for(const policyTypeJSON of policyTypeJsonList){

        const policyTypeArray = [];
        policyTypeArray.push(policyTypeJSON)
        const questionsPT = await GetQuestions(activityCodeArray, industryCodeStringArray, zipCodeArray, policyTypeArray, policyTypeJSON.insurerIdList, questionSubjectArea, return_hidden, stateList);

        if(questionsPT?.length > 0){
            if(questions.length === 0){
                questions.push(...questionsPT);
            }
            else {
                for(const newQuestion of questionsPT){
                    const existingQ = questions.find((q) => q?.talageQuestionId === newQuestion.talageQuestionId);
                    if(!existingQ){
                        questions.push(newQuestion)
                    }
                }
            }
        }
        log.debug(`GetQuestionsForAppBO2 after ${policyTypeJSON.type} question count ${questions.length}` + __location)
    }
    if(questions?.length > 0){
        for(const question of questions){
            if('possible_answers' in question){
                question.answers = Object.values(question.possible_answers);
                delete question.possible_answers;
            }
        }
    }


    const endQuestionPull = moment();
    const diff = endQuestionPull.diff(questionPullStart, 'milliseconds', true);
    log.info(`GetQuestionsForAppBO Question pull: ${questions.length} in ${diff} milliseconds`);

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
exports.GetQuestionsForFrontend = async function(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerStringArray, questionSubjectArea = "general", return_hidden = true, stateList = []){
    const industryCodeStringArray = [industryCodeString]
    const questions = await GetQuestions(activityCodeArray, industryCodeStringArray, zipCodeArray, policyTypeArray, insurerStringArray, questionSubjectArea, return_hidden, stateList);

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
 * @param {string} industryCodeStringArray - The industry code of the application
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
exports.GetQuestionsForBackend = async function(activityCodeArray, industryCodeStringArray, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden = true, stateList = []){
    return GetQuestions(activityCodeArray, industryCodeStringArray, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden, stateList);
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
    const queryProjection = {"__v": 0, "_id": 0,talageQuestionUuid: 0, acordQuestion: 0, active: 0,updatedAt:0, createdAt: 0};
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
        if(!talageQuestion.categoryName){
            talageQuestion.categoryName = "uncategorized";
        }
        if(!talageQuestion.categorySortNumber){
            talageQuestion.categorySortNumber = 99;
        }
        if(!talageQuestion.sortRanking){
            talageQuestion.sortRanking = 99;
        }
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
                log.warn(`QuestionSvc.find_missing_questions Potential Bad Insurer Question Mapping questionId ${question.id} missing Parent Id ${question.parent}. Check Parent question mapping to insurer. ` + __location);
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
