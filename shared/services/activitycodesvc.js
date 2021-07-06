/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//const utility = global.requireShared('./helpers/utility.js');
const moment = require('moment');


//Reference by InsurerActivityCode-BO, do not reference InsurerActivityCode-BO outside of fuction.


//, codeGroupList = []
async function GetActivityCodes(territory,industryCodeId, forceCacheUpdate = false){
    let addCode2Redis = false;
    let activityIdList = [];
    const redisKey = "activity-code-industrycode-" + territory + "-" + industryCodeId.toString();
    if(global.settings.USE_REDIS_ACTIVITY_CODE_CACHE === "YES" && forceCacheUpdate === false){
        const start = moment();
        let redisCacheCodes = null;
        const resp = await global.redisSvc.getKeyValue(redisKey);
        if(resp.found){
            try{
                redisCacheCodes = JSON.parse(resp.value);
            }
            catch(err){
                log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
            }
            const endRedis = moment();
            var diffRedis = endRedis.diff(start, 'milliseconds', true);
            log.info(`Redis Activity Code Cache request ${redisKey} duration: ${diffRedis} milliseconds`);
            if(redisCacheCodes){
                return redisCacheCodes;
            }
        }
        else {
            addCode2Redis = true;
        }
        //TODO filters for insuers, effective date

    }
    if(forceCacheUpdate && global.settings.USE_REDIS_ACTIVITY_CODE_CACHE === "YES"){
        addCode2Redis = true;
    }

    // eslint-disable-next-line prefer-const
    //generate from activityId list from mongo or mysal
    //get IndustryCode's activity code 1st.   smaller set
    // can be used to filter InsurerActivityCode

    let start = moment();
    const IndustryCodeModel = require('mongoose').model('IndustryCode');
    let icActivityCodeList = [];
    try{
        const icQuery = {
            industryCodeId: industryCodeId,
            active: true
        }
        const IndustryCodeDoc = await IndustryCodeModel.findOne(icQuery).lean();
        icActivityCodeList = IndustryCodeDoc.activityCodeIdList;
    }
    catch(err){
        log.warn(`industryCodeId: ${industryCodeId} Error ActivityCodeSvc.GetActivityCodes ` + __location);
    }

    let endMongo = moment();
    let diff = endMongo.diff(start, 'milliseconds', true);
    log.info(`Mongo IndustryCode Activity Code List processing ${territory} count ${icActivityCodeList.length} duration: ${diff} milliseconds` + __location);

    start = moment();
    const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
    let insurerActivityCodeList = null;
    try{
        const pipeLine = [
            {$match: {
                territoryList: territory,
                active: true
            }},
            {"$unwind": "$talageActivityCodeIdList"} ,
            {$group:{
                _id : null,
                uniqueTalageActivityCodes : {$addToSet : "$talageActivityCodeIdList"}
            }}
        ]
        insurerActivityCodeList = await InsurerActivityCodeModel.aggregate(pipeLine)
        if(insurerActivityCodeList[0] && insurerActivityCodeList[0].uniqueTalageActivityCodes && insurerActivityCodeList[0].uniqueTalageActivityCodes.length > 0){
            activityIdList = insurerActivityCodeList[0].uniqueTalageActivityCodes;
        }

    }
    catch(err){
        log.warn(`industryCodeId: ${industryCodeId} Error ActivityCodeSvc.GetActivityCodes ` + __location);
    }

    endMongo = moment();
    diff = endMongo.diff(start, 'milliseconds', true);
    log.info(`Mongo Insurer Activity Code by Territory processing ${territory} count ${activityIdList.length} duration: ${diff} milliseconds` + __location);

    if(activityIdList.length > 0){
        start = moment();
        const ActivityCodeModel = require('mongoose').model('ActivityCode');
        let codes = null;
        try{
            const icQuery = {
                activityCodeId: {$in: activityIdList},
                active: true
            }
            const queryProjection = {
                "__v": 0,
                "_id": 0,
                "id": 0,
                "talageStandard": 0,
                "codeGroupList":0,
                active: 0,
                talageActivityCodeUuid: 0,
                updatedAt: 0,
                createdAt: 0
            };
            codes = await ActivityCodeModel.find(icQuery,queryProjection).lean();
        }
        catch(err){
            log.warn(`industryCodeId: ${industryCodeId} Error ActivityCodeSvc.GetActivityCodes ` + __location);
        }

        endMongo = moment();
        diff = endMongo.diff(start, 'milliseconds', true);
        log.info(`Mongo Activity Code request ${redisKey} duration: ${diff} milliseconds got ${codes.length} codes` + __location);

        if (codes && codes.length > 0) {
            codes.forEach(function(code) {
                code.id = code.activityCodeId;
                if (code.alternateNames) {
                    code.alternate_names = code.alternateNames;
                }
                if(icActivityCodeList && icActivityCodeList.length > 0){
                    code.suggested = icActivityCodeList.indexOf(code.activityCodeId) > -1 ? 1 : 0
                }
                else {
                    code.suggested = 0;
                }
            });
            log.info(`Returning ${codes.length} Activity Codes` + __location);
            if(addCode2Redis){
                try{
                    //const ttlSeconds = 3600;
                    const redisResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(codes))
                    if(redisResponse && redisResponse.saved){
                        log.debug(`Saved ${redisKey} to Redis ` + __location);
                    }
                }
                catch(err){
                    log.error(`Error save ${redisKey} to Redis cache ` + err + __location);
                }

            }
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
async function updateActivityCodeCacheByIndustryCode(industryCodeId){
    log.info(`Update IndustryCode Redis cache for ${industryCodeId}` + __location)
    //get territory list
    let error = null;
    const TerritoryBO = global.requireShared('./models/Territory-BO.js');
    const territoryBO = new TerritoryBO();
    const allTerritories = await territoryBO.getAbbrNameList().catch(function(err) {
        log.error("updateActivityCodeCacheByIndustryCode: territory get getAbbrNameList " + err + __location);
        error = err;
    });
    if(error){
        return;
    }
    const forceCacheUpdate = true;
    for(const territory of allTerritories){
        await GetActivityCodes(territory.abbr,industryCodeId, forceCacheUpdate)
    }


}

async function updateActivityCodeCacheByActivityCode(activityCodeId){
    log.info(`Update ActivityCode Redis cache for ${activityCodeId}` + __location)
    const IndustryCodeModel = require('mongoose').model('IndustryCode');
    let IndustryCodeList = null;
    try{
        const icQuery = {
            activityCodeIdList: activityCodeId,
            active: true
        }
        IndustryCodeList = await IndustryCodeModel.find(icQuery).lean();
    }
    catch(err){
        log.warn(`updateActivityCodeCacheByActivityCode: ${activityCodeId} Error ${err} ` + __location);
    }
    if(IndustryCodeList){
        for(const ic of IndustryCodeList){
            await updateActivityCodeCacheByIndustryCode(ic.industryCodeId);
        }
    }
    else {
        log.debug(`No industry codes for ${activityCodeId}` + __location)
    }


}

async function updateActivityCodeCacheByActivityCodeTerritoryList(activityCodeList, territoryList){
    log.info(`Update ActivityCode Redis cache for ${activityCodeList} & ${territoryList} ` + __location)
    if(!activityCodeList && activityCodeList.length === 0){
        return;
    }
    if(!territoryList && territoryList.length === 0){
        return;
    }
    const IndustryCodeModel = require('mongoose').model('IndustryCode');
    let IndustryCodeList = null;
    try{
        const icQuery = {
            activityCodeIdList: {$in: activityCodeList},
            active: true
        }
        IndustryCodeList = await IndustryCodeModel.find(icQuery).lean();
    }
    catch(err){
        log.warn(`updateActivityCodeCacheByActivityCode: ${activityCodeList} Error ${err} ` + __location);
    }
    const forceCacheUpdate = true;
    if(IndustryCodeList){
        for(const ic of IndustryCodeList){
            for (const abbr of territoryList){
                await GetActivityCodes(abbr,ic.industryCodeId, forceCacheUpdate)
            }
        }
    }
    else {
        log.debug(`No industry codes for ${activityCodeList}` + __location)
    }


}


module.exports = {
    GetActivityCodes: GetActivityCodes,
    updateActivityCodeCacheByIndustryCode: updateActivityCodeCacheByIndustryCode,
    updateActivityCodeCacheByActivityCode: updateActivityCodeCacheByActivityCode,
    updateActivityCodeCacheByActivityCodeTerritoryList: updateActivityCodeCacheByActivityCodeTerritoryList
}