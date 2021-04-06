/* eslint-disable require-jsdoc */
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const utility = global.requireShared('./helpers/utility.js');
const moment = require('moment');

async function GetActivityCodes(territory,industry_code){
    let addCode2Redis = false;
    let activityIdList = [];
    const redisKey = "activity-code-industrycode-" + territory + "-" + industry_code.toString();
    // if(global.settings.USE_REDIS_ACTIVITY_CODE_CACHE === "YES"){
    //     const start = moment();
    //     let redisCacheCodes = null;
    //     const resp = await global.redisSvc.getKeyValue(redisKey);
    //     if(resp.found){
    //         try{
    //             redisCacheCodes = JSON.parse(resp.value);
    //         }
    //         catch(err){
    //             log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
    //         }
    //         const endRedis = moment();
    //         var diff = endRedis.diff(start, 'milliseconds', true);
    //         log.info(`Redis Activity Code Cache request ${redisKey} duration: ${diff} milliseconds`);
    //         if(redisCacheCodes){
    //             return redisCacheCodes;
    //         }
    //     }
    //     else {
    //       addCode2Redis = true;
    //     }
    //     //TODO filters for insuers, effective date

    // }

    // eslint-disable-next-line prefer-const
    //generate from activityId list from mongo or mysal
    if(global.settings.USE_MONGO_QUESTIONS === "YES"){
        const start = moment();
        const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
        const activityCodeQuery = {
            territoryList: territory,
            active: true
        }
        let insurerActivityCodeList = null;
        try{
            insurerActivityCodeList = await InsurerActivityCodeModel.find(activityCodeQuery).lean()
        }
        catch(err){
            log.warn(`Appid: ${this.app.id} Error ActivityCodeSvc.GetActivityCodes for ${this.insurer.name}:${this.insurer.id} and ${this.app.applicationDocData.mailingState}` + __location);
        }
        
        const endMongoFind = moment();
        var diffFind = endMongoFind.diff(start, 'milliseconds', true);
        log.info(`Mongo Insurer Activity Code by Territory Find ${territory} count ${insurerActivityCodeList.length} duration: ${diffFind} milliseconds` + __location);
        
        if(insurerActivityCodeList){
            log.debug(`insurerActivityCodeList.length ${insurerActivityCodeList.length}`)
            insurerActivityCodeList.forEach((insurerActivityCode) => {
                if(insurerActivityCode.talageActivityCodeIdList && insurerActivityCode.talageActivityCodeIdList.length > 0){
                    utility.addArrayToArray(activityIdList,insurerActivityCode.talageActivityCodeIdList);
                }
            });
        }
        const endMongo = moment();
        var diff = endMongo.diff(start, 'milliseconds', true);
        log.info(`Mongo Insurer Activity Code by Territory processing ${territory} count ${insurerActivityCodeList.length} duration: ${diff} milliseconds` + __location);
    }
    else {
        const sql_insurer_territory_activity_codes = `
		SELECT distinct nca.code
		FROM clw_talage_activity_code_associations AS nca 
		JOIN clw_talage_insurer_ncci_codes AS inc ON nca.insurer_code = inc.id
		WHERE inc.territory = ${db.escape(territory)} AND inc.state = 1;
		`;
        const activityIdResults = await db.queryReadonly(sql_insurer_territory_activity_codes).catch(function(err) {
            log.error(err.message + __location);
        });
        if(activityIdResults){
            activityIdResults.forEach((resultJSON) => {
                activityIdList.push(resultJSON.code);
            });
        }
    }

    if(activityIdList.length > 0){
        const start = moment();
        const sql_all_activity_codes = `
            SELECT nc.id, nc.description,
            CASE
                WHEN ica.frequency > 30
                THEN 1
                ELSE 0
            END AS suggested,
            GROUP_CONCAT(DISTINCT acan.name) AS 'alternate_names'
            FROM #__activity_codes AS nc
            LEFT JOIN clw_talage_industry_code_associations AS ica ON nc.id = ica.activityCodeId AND ica.industryCodeId = ${db.escape(industry_code)}    
            LEFT JOIN #__activity_code_alt_names AS acan ON nc.id = acan.activity_code
            WHERE nc.id in (${activityIdList.join(",")}) AND nc.state = 1 GROUP BY nc.id ORDER BY nc.description;
            `;
        let error = false;
        const codes = await db.queryReadonly(sql_all_activity_codes).catch(function(err) {
            log.error(err.message + __location);
            error = err;
        });
        if (error) {
            throw error;
        }
        const endMongo = moment();
        var diff = endMongo.diff(start, 'milliseconds', true);
        log.info(`Mysql Activity Code request ${redisKey} duration: ${diff} milliseconds` + __location);

        if (codes && codes.length) {
            codes.forEach(function(code) {
                if (code.alternate_names) {
                    code.alternate_names = code.alternate_names.split(',');
                }
                else {
                    delete code.alternate_names;
                }
            });
            // log.info(`Returning ${codes.length} Activity Codes`);
            // if(addCode2Redis){
            //     try{
            //         //const ttlSeconds = 3600;
            //         const redisResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(codes))
            //         if(redisResponse && redisResponse.saved){
            //             log.debug(`Saved ${redisKey} to Redis ` + __location);
            //         }
            //     }
            //     catch(err){
            //         log.error(`Error save ${redisKey} to Redis cache ` + err + __location);
            //     }

            // }
            return codes;
        }
        else {
            return [];
        }
    }
    else {
        return [];
    }
}


// eslint-disable-next-line require-jsdoc
// async function CreateRedisActivityCoceIndustryCodeCacheByArray(industryCodeList, listName){
//     //get territory list
//     const territoryBO = new TerritoryBO();
//     //abbr
//     const territoryBOList = await territoryBO.getList(req.query).catch(function(err) {
//         error = err;
//     })
//     if (error) {
//         return next(error);
//     }

//     if(industryCodeList && industryCodeList.length > 0){
//         for (let i = 0; i < industryCodeList.length; i++){
//             const industryCodeId = industryCodeList[i].industryCodeId;
//             for(let j=0; j < territoryBOList.length; j++){
//                 try{
//                     await GetActivityCodes(industryCodeId)
//                 }
//                 catch(err){
//                     log.error(`Error Setting industry code questions cache industryCodeId ${industryCodeId} for Redis ${err}` + __location)
//                 }
            

//             }
//             log.info(`Actvity Code Cache By Indusry Code Redis update for industryCodeId: ${industryCodeId} updated ${i + 1} of ${industryCodeList.length} in ${listName}`);
            
//         }
//     }
//     else {
//         log.info(`No industry code List to update` + __location)
//     }
// }


// // eslint-disable-next-line require-jsdoc
// async function processIndustryCodeList(industryCodeList){
//     if(industryCodeList && industryCodeList.length > 1 && global.settings.REDIS_QUESTION_CACHE_JOB_COUNT > 1){
//         // eslint-disable-next-line prefer-const
//         let subListSize = Math.floor(industryCodeList.length / global.settings.REDIS_QUESTION_CACHE_JOB_COUNT)
//         if(industryCodeList.length % global.settings.REDIS_QUESTION_CACHE_JOB_COUNT > 0){
//             subListSize += 1;
//         }
//         const subIndustryCodeLisArray = helper.splitArray(industryCodeList, subListSize);
//         const createRedisIndustryCodeQuestionCmdList = [];
//         for(let i = 0; i < subIndustryCodeLisArray.length; i++){
//             log.debug(`Adding sublist ${i + 1} length: ${subIndustryCodeLisArray[i].length}` + __location)
//             const listName = "list" + (i + 1);
//             createRedisIndustryCodeQuestionCmdList.push(CreateRedisActivityCoceIndustryCodeCacheByArray(subIndustryCodeLisArray[i], listName))
//         }
//         await Promise.all(createRedisIndustryCodeQuestionCmdList);
//     }
//     else {
//         await CreateRedisActivityCoceIndustryCodeCacheByArray(industryCodeList);
//     }
//     return industryCodeList.length;
// }




// async function UpdateRedisActivityCodeByIndustryCache(industryCodeId){
//     let sql = ` SELECT distinct ic.id as 'industryCodeId'
//             FROM clw_talage_industry_codes AS ic
//             where ic.state > 0 `;
//     if(industryCodeId){
//         sql += ` AND ic.id = ${db.escape(industryCodeId)}`
//     }
//     sql += ` order by ic.id`

//     let error = null;
//     const industryCodeList = await db.queryReadonlyCluster(sql).catch(function(err) {
//         error = err.message;
//     });
//     if (error) {
//         log.error(`Error getting industry codes for Redis update ${error}` + __location)
//         return false;
//     }
//     await processIndustryCodeList(industryCodeList)

//     log.info("Redis Industry Code Question cached updated. processed " + industryCodeList.length + __location);
//     return industryCodeList.length;

// }

module.exports = {GetActivityCodes: GetActivityCodes}