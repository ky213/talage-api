/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//const utility = global.requireShared('./helpers/utility.js');
const moment = require('moment');
var FastJsonParse = require('fast-json-parse')

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
                const parsedJSON = new FastJsonParse(resp.value)
                if(parsedJSON.err){
                    throw parsedJSON.err
                }
                redisCacheCodes = parsedJSON.value;
            }
            catch(err){
                log.error(`Error Parsing question cache key ${redisKey} value: ${resp.value} ${err} ` + __location);
            }
            const endRedis = moment();
            var diffRedis = endRedis.diff(start, 'milliseconds', true);
            let activityCodeCount = 0;
            if(redisCacheCodes){
                activityCodeCount = redisCacheCodes.length
            }
            log.info(`REDIS IndustryCode Activity Code Cache request ${redisKey} count: ${activityCodeCount}  duration: ${diffRedis} milliseconds`);
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

    const start = moment();
    const IndustryCodeModel = global.mongoose.IndustryCode;
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
    log.info(`Mongo IndustryCode Activity Code List processing ${territory} IndustryCode ${industryCodeId} count ${icActivityCodeList.length} duration: ${diff} milliseconds` + __location);

    //start = moment();
    const InsurerActivityCodeModel = global.mongoose.InsurerActivityCode;
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
    log.info(`Mongo Insurer Activity Code by Territory processing ${territory} IndustryCode ${industryCodeId} count ${activityIdList.length} duration: ${diff} milliseconds` + __location);

    if(activityIdList.length > 0){
        //start = moment();
        const ActivityCodeModel = global.mongoose.ActivityCode;
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
        log.info(`Mongo Get Activity Code by request ${redisKey} duration: ${diff} milliseconds got ${codes.length} codes` + __location);

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
                    const ttlSeconds = 86400;
                    const redisResponse = await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(codes),ttlSeconds)
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
async function updateActivityCodeCacheByIndustryCode(industryCodeId, territoryList = []){
    log.info(`Update IndustryCode Redis cache for ${industryCodeId}` + __location)
    //get territory list
    if(territoryList.length === 0){
        let error = null;
        const TerritoryBO = global.requireShared('./models/Territory-BO.js');
        const territoryBO = new TerritoryBO();
        territoryList = await territoryBO.getAbbrNameList().catch(function(err) {
            log.error("updateActivityCodeCacheByIndustryCode: territory get getAbbrNameList " + err + __location);
            error = err;
        });
        if(error){
            return;
        }
    }
    const forceCacheUpdate = true;
    for(const territory of territoryList){
        await GetActivityCodes(territory.abbr,industryCodeId, forceCacheUpdate)
    }


}

async function updateActivityCodeCacheByActivityCode(activityCodeId){
    log.info(`Update ActivityCode Redis cache for ${activityCodeId}` + __location)
    const IndustryCodeModel = global.mongoose.IndustryCode;
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


async function removeActivityCodeCacheByActivityCode(activityCodeId){
    log.info(`Removing ActivityCode Redis cache for ${activityCodeId}` + __location)
    const IndustryCodeModel = global.mongoose.IndustryCode;
    let IndustryCodeList = null;
    try{
        const icQuery = {
            activityCodeIdList: activityCodeId,
            active: true
        }
        IndustryCodeList = await IndustryCodeModel.find(icQuery).lean();
    }
    catch(err){
        log.warn(`removeActivityCodeCacheByActivityCode: ${activityCodeId} Error ${err} ` + __location);
    }
    if(IndustryCodeList){
        const TerritoryBO = global.requireShared('./models/Territory-BO.js');
        const territoryBO = new TerritoryBO();
        const territoryList = await territoryBO.getAbbrNameList().catch(function(err) {
            log.error("updateActivityCodeCacheByIndustryCode: territory get getAbbrNameList " + err + __location);
        });
        if(territoryList){
            for(const ic of IndustryCodeList){
                for(const territory of territoryList){
                    const redisKey = "activity-code-industrycode-" + territory.abbr + "-" + ic.industryCodeId.toString();
                    await global.redisSvc.deleteKey(redisKey);
                }
            }
        }
    }
    else {
        log.debug(`No industry codes for ${activityCodeId}` + __location)
    }


}


async function updateActivityCodeCacheByActivityCodeTerritoryList(activityCodeList, territoryList){
    log.info(`Removing ActivityCode Redis cache for ${activityCodeList} & ${territoryList} ` + __location)
    if(!activityCodeList && activityCodeList.length === 0){
        return;
    }
    if(!territoryList && territoryList.length === 0){
        return;
    }
    const IndustryCodeModel = global.mongoose.IndustryCode;
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
    //const forceCacheUpdate = true;
    if(IndustryCodeList){
        for(const ic of IndustryCodeList){
            for (const abbr of territoryList){
                //await GetActivityCodes(abbr,ic.industryCodeId, forceCacheUpdate)
                const redisKey = "activity-code-industrycode-" + abbr + "-" + ic.industryCodeId.toString();
                await global.redisSvc.deleteKey(redisKey);
            }
        }
    }
    else {
        log.debug(`No industry codes for ${activityCodeList}` + __location)
    }


}

async function getActivityCodesByNCCICode(ncciCode, territory) {
    log.info(`Finding activity code for NCCI code : ${ncciCode} ${__location}`);

    try {
        const {
            ActivityCode, InsurerActivityCode
        } = global.mongoose;

        const insurerActivityCodes = await InsurerActivityCode.aggregate([
            {$match: {
                insurerId: 9, // NCCI insurer (fake)
                active: true,
                talageActivityCodeIdList: {$ne:null},
                territoryList: territory,
                code: {$regex: `^${ncciCode}`}
            }},
            {$unwind: "$talageActivityCodeIdList"},
            {$addFields: {talageActivityCodeId: "$talageActivityCodeIdList"}},
            {$project: {talageActivityCodeIdList: 0}}
        ]);

        const codeList = [];
        const alreadyProcessedCodeIDs = new Set();

        for (const insurerActivityCode of insurerActivityCodes) {
            if (alreadyProcessedCodeIDs.has(insurerActivityCode.talageActivityCodeId)) {
                continue;
            }

            alreadyProcessedCodeIDs.add(insurerActivityCode.talageActivityCodeId);

            const code = await ActivityCode.findOne({
                activityCodeId: insurerActivityCode.talageActivityCodeId,
                active: true
            },
            {
                __v: 0,
                _id: 0,
                id: 0,
                talageStandard: 0,
                codeGroupList: 0,
                active: 0,
                talageActivityCodeUuid: 0,
                updatedAt: 0,
                createdAt: 0
            }).lean();

            if (code) {
                code.id = code.activityCodeId;
                code.ncciCode = insurerActivityCode.code;
                code.ncciSubCode = insurerActivityCode.sub;
                codeList.push(code);
            }
        }

        return codeList;
    }
    catch (error) {
        log.warn(`findActivityCodesByNCCICode: ${ncciCode} Error ${error} ` + __location);
    }
}

module.exports = {
    GetActivityCodes: GetActivityCodes,
    getActivityCodesByNCCICode: getActivityCodesByNCCICode,
    updateActivityCodeCacheByIndustryCode: updateActivityCodeCacheByIndustryCode,
    updateActivityCodeCacheByActivityCode: updateActivityCodeCacheByActivityCode,
    updateActivityCodeCacheByActivityCodeTerritoryList: updateActivityCodeCacheByActivityCodeTerritoryList,
    removeActivityCodeCacheByActivityCode: removeActivityCodeCacheByActivityCode
}
