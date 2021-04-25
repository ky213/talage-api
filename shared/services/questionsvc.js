/* eslint-disable multiline-comment-style */
/* eslint-disable one-var */
const moment = require('moment');
const helper = global.requireShared('./helpers/helper.js');
const log = global.log;


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
            log.warn('GetQuestions - Invalid Activity Code(s)' + __location);
            //error = 'One or more of the activity codes supplied is invalid';
        }
        //Might be old Activity codes from copied application.
        // no need to stop.  Activity Code question logic will get no hits.
        // that is OK.
        // if (error) {
        //     return false;
        // }
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
            //return false;
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
        const policyEffectiveDate = moment(policyTypeJSON.effectiveDate).format(db.dbTimeFormat());
        // Build a list of unique policy effective dates for the industry and activity code queries
        if (!uniquePolicyEffectiveDateList.includes(policyEffectiveDate)) {
            uniquePolicyEffectiveDateList.push(policyEffectiveDate);
        }
        questionEffectiveDateWhereClauseList.push(`(iq.policy_type = '${policyTypeJSON.type.toUpperCase()}' AND '${policyEffectiveDate}' >= iq.effectiveDate AND '${policyEffectiveDate}' < iq.expirationDate)`);

        const mongoPolicyEffectiveDateQuery = {
            policyType: policyTypeJSON.type.toUpperCase(),
            effectiveDate: {$lte: policyEffectiveDate},
            expirationDate: {$gte: policyEffectiveDate}
        }
        mongoPolicyExpirationList.push(mongoPolicyEffectiveDateQuery);

        //For Acuity BOP testing
        if(policyTypeJSON.type.toUpperCase() === 'BOP'){
            // eslint-disable-next-line prefer-const
            let pe2 = JSON.parse(JSON.stringify(mongoPolicyEffectiveDateQuery))
            pe2.policyType = "GL";
            mongoPolicyExpirationList.push(pe2);

        }


    });
    

    // Industry and activity code effective date is done using the unique policy effective date list.
    const industryCodeEffectiveDateWhereClauseList = [];
    const activityCodeEffectiveDateWhereClauseList = [];
    for (const policyEffectiveDate of uniquePolicyEffectiveDateList) {
        industryCodeEffectiveDateWhereClauseList.push(`('${policyEffectiveDate}' >= iic.effectiveDate AND '${policyEffectiveDate}' < iic.expirationDate)`);
        activityCodeEffectiveDateWhereClauseList.push(`('${policyEffectiveDate}' >= inc.effectiveDate AND '${policyEffectiveDate}' < inc.expirationDate)`);
    }

    //work around to not remap GL questions for BOP.  Question system should not care
    // // Do not permit requests that include both BOP and GL
    // if (policyTypeArray.includes('BOP') && policyTypeArray.includes('GL')) {
    //     log.warn('Bad Request: Both BOP and GL are not allowed, must be one or the other');
    //     //return false; //work around to not remap GL questions for BOP.  Question system should not crea
    // }

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
        policyType: {$in: policyTypes},
        questionSubjectArea: questionSubjectArea,
        active: true
    }

    // eslint-disable-next-line prefer-const
    let orParamList = [];
    mongoPolicyExpirationList.forEach((mongoPolicyEffectiveDateQuery) => {
        orParamList.push(mongoPolicyEffectiveDateQuery)
    });
    insurerQuestionQuery.$or = orParamList;

    log.debug(`insurerQuestionQuery  ${"\n"} ${JSON.stringify(insurerQuestionQuery)} ${'\n'} ` + __location);
    try{

        const insurerQuestionList = await InsurerQuestionModel.find(insurerQuestionQuery)
        //need territory filter
        //territoryList: {$in: territories},

        if(insurerQuestionList){
            // eslint-disable-next-line prefer-const
            let talageQuestionIdArray = [];
            let noTerritoryHitCount = 0;
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
                        noTerritoryHitCount++;
                    }
                    if(add && talageQuestionIdArray.indexOf(insurerQuestion.talageQuestionId) === -1){
                        talageQuestionIdArray.push(insurerQuestion.talageQuestionId)
                    }
                }
            }
            log.debug("NO territoryList hit count " + noTerritoryHitCount + __location);
            log.debug("Number of Universal Talage Questions " + talageQuestionIdArray.length + __location);
            if(talageQuestionIdArray.length > 0) {
                log.debug(`talageQuestionIdArray.length ${talageQuestionIdArray.length} `)
                const universal_questions = await getTalageQuestionFromInsureQuestionList(talageQuestionIdArray, insurerQuestionList,return_hidden);
                log.debug(`Adding ${universal_questions.length} Mongo universal questions ` + __location)
                questions = questions.concat(universal_questions);
            }
            else {
                log.debug(`No universal questions for `)
            }
        }
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
    const InsurerIndustryCodeModel = require('mongoose').model('InsurerIndustryCode');
    let start = moment();
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
        //log.debug("insurerQuestionIdArray " + insurerQuestionIdArray)
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
            const territoryCheck = {territoryList: {$in: territories}};
            const territoryLengthCheck = {territoryList: {$size: 0}}
            const territoryNullCheck = {territoryList: null}
            orParamList2.push(territoryCheck)
            orParamList2.push(territoryNullCheck)
            orParamList2.push(territoryLengthCheck)

            const orParamExprDate = []
            mongoPolicyExpirationList.forEach((mongoPolicyEffectiveDateQuery) => {
                orParamExprDate.push(mongoPolicyEffectiveDateQuery)
            });
            insurerQuestionQuery.$and = [{$or: orParamList2}, {$or:orParamExprDate}];

            //log.debug("insurerQuestionQuery: " + JSON.stringify(insurerQuestionQuery));
            insurerQuestionList = await InsurerQuestionModel.find(insurerQuestionQuery)
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
        const insurerActivityCodeList = await InsurerActivityCodeModel.find(activityCodeQuery)
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
                            insurerQuestionIdArray = insurerQuestionIdArray.concat(tQFound.insurerQuestionIdList);
                        }
                        else {
                            addStandardQuestions = true;
                        }
                    }
                    //any territory that does not get a hit trigger adding standard questions
                    if(addStandardQuestions && insurerActivityCode.insurerQuestionIdList && insurerActivityCode.insurerQuestionIdList.length > 0){
                        insurerQuestionIdArray = insurerQuestionIdArray.concat(insurerActivityCode.insurerQuestionIdList);
                    }
                }
                else if(insurerActivityCode.insurerQuestionIdList && insurerActivityCode.insurerQuestionIdList.length > 0){
                    insurerQuestionIdArray = insurerQuestionIdArray.concat(insurerActivityCode.insurerQuestionIdList);
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
                //policyType: {$in: policyTypes},
                questionSubjectArea: questionSubjectArea,
                // effectiveDate: {$lt: now},
                //expirationDate: {$gt: now},
                active: true
            }
            // eslint-disable-next-line prefer-const
            const orParamList2 = [];
            const territoryCheck = {territoryList: {$in: territories}};
            const territoryLengthCheck = {territoryList: {$size: 0}}
            const territoryNullCheck = {territoryList: null}
            orParamList2.push(territoryCheck)
            orParamList2.push(territoryNullCheck)
            orParamList2.push(territoryLengthCheck)
            const orParamExprDate = []
            mongoPolicyExpirationList.forEach((mongoPolicyEffectiveDateQuery) => {
                orParamExprDate.push(mongoPolicyEffectiveDateQuery)
            });
            insurerQuestionQuery.$and = [{$or: orParamList2}, {$or:orParamExprDate}];

            //log.debug("insurerQuestionQuery: " + JSON.stringify(insurerQuestionQuery));
            insurerQuestionList = await InsurerQuestionModel.find(insurerQuestionQuery)
            if(insurerQuestionList){
                for(const insurerQuestion of insurerQuestionList){
                    if(insurerQuestion.talageQuestionId){
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

    // Get a list of the question IDs
    const question_ids = questions.map(function(question) {
        return question.id;
    });
    log.debug("Getting answers questions " + __location);
    if (question_ids && question_ids.length > 0) {
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
exports.GetQuestionsForBackend = async function(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden = false, stateList = []){
    return GetQuestions(activityCodeArray, industryCodeString, zipCodeArray, policyTypeArray, insurerArray, questionSubjectArea, return_hidden, stateList);
}


/**
 * Get talage Question list from  insureQuestionList
 *
 * @param {array} talageQuestionIdArray - An array of question IDs
 * @param {array} insurerQuestionList - An array of insureQuestion objects
 * @param {boolean} return_hidden - true = getting Insurer-PolicyType
 *
 * @returns {mixed} - An array of IDs if questions are missing, false if none are
 */
async function getTalageQuestionFromInsureQuestionList(talageQuestionIdArray, insurerQuestionList, return_hidden = false){
    if(!talageQuestionIdArray || talageQuestionIdArray.length === 0){
        return [];
    }
    //refactor for Mongo...
    const select = `q.id, q.parent, q.parent_answer, q.sub_level, q.question AS \`text\`, q.hint, q.type AS type_id, qt.name AS type, q.hidden`;
    let error = null;
    const sql = `
            SELECT ${select}
            FROM clw_talage_questions AS q
            LEFT JOIN clw_talage_question_types AS qt ON q.type = qt.id
            WHERE
                q.id IN (${talageQuestionIdArray.map(db.escape).join(',')}) 
                AND q.state = 1
                GROUP BY q.id;
        `;
    // log.debug("question sql " + sql)
    const talageQuestions = await db.queryReadonly(sql).catch(function(err) {
        error = err.message;
    });
    if (error) {
        return [];
    }
    if(insurerQuestionList && talageQuestions && talageQuestions.length && return_hidden){
        if(!insurerQuestionList){
            //TODO get insurerQuestionList from talageQuestions
        }
        //Create new return question array with insuer-policytype info
        //loop  talageQuestions find insurerQuestionList matches.
        //add row for every match
        // eslint-disable-next-line prefer-const
        let talageQuestionPolicyTypeList = [];
        talageQuestions.forEach(function(talageQuestion){
            const iqForTalageQList = insurerQuestionList.filter(function(iq) {
                return iq.question === talageQuestion.id;
            });

            iqForTalageQList.forEach(function(iqForTalageQ){
                talageQuestionPolicyTypeList.push(iqForTalageQ.insurerId + "-" + iqForTalageQ.policyType)
            });
            talageQuestion.insurers = talageQuestionPolicyTypeList.join(',');
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