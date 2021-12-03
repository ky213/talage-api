/* eslint-disable require-jsdoc */
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
//const utility = global.requireShared('./helpers/utility.js');
const moment = require('moment');


//, codeGroupList = []
async function GetIndustryCodeCategories(agencyId, codeGroupList){
    const IndustryCodeCategoryModel = require('mongoose').model('IndustryCodeCategory');
    const queryProjection = {
        "__v": 0,
        "_id": 0,
        "id": 0,
        "talageStandard": 0,
        "codeGroupList":0,
        active: 0,
        talageIndustryCodeCategoryUuid: 0,
        updatedAt: 0,
        createdAt: 0
    };
    const queryOptions = {sort: {name: 1}};

    let IndustryCodeCatList = null;
    try{
        if(agencyId){
            //lookup Agency's codeGroupList

        }
        const icQuery = {active: true}
        if(codeGroupList && codeGroupList.length > 0){
            icQuery.codeGroupList = {$in: codeGroupList};
        }
        else{
            icQuery.talageStandard = true;
        }
        log.debug('icQuery ' + JSON.stringify(icQuery) + __location)
        IndustryCodeCatList = await IndustryCodeCategoryModel.find(icQuery,queryProjection, queryOptions).lean();
    }
    catch(err){
        log.error(`GetIndustryCodeCategories Error ${err} ` + __location);
    }
    if(IndustryCodeCatList){
        IndustryCodeCatList.forEach((icc) => {
            icc.id = icc.industryCodeCategoryId
        })

        return IndustryCodeCatList;
    }
    else {
        return [];
    }
}


//, codeGroupList = []
//agencyId = null, codeGroupList = []
async function GetIndustryCodes(){
    //  const addCode2Redis = false;
    // const redisKey = "industrycodelist";
    const catList = await GetIndustryCodeCategories();
    //log.debug(`catList ${JSON.stringify(catList)}` + __location)
    const start = moment();
    const IndustryCodeModel = require('mongoose').model('IndustryCode');
    let IndustryCodeList = [];
    try{
        const icQuery = {
            active: true,
            talageStandard: true
        }
        const queryProjection = {
            "__v": 0,
            "_id": 0,
            "id": 0,
            "talageStandard": 0,
            "codeGroupList":0,
            active: 0,
            talageIndustryCodeUuid: 0,
            activityCodeIdList: 0,
            primaryActivityCodeId: 0,
            updatedAt: 0,
            createdAt: 0
        };
        const queryOptions = {sort: {description: 1}};

        IndustryCodeList = await IndustryCodeModel.find(icQuery, queryProjection, queryOptions).lean();

    }
    catch(err){
        log.warn(`IndustryCodeSvc.GetIndustryCodes  ${err}` + __location);
    }

    const endMongo = moment();
    const diff = endMongo.diff(start, 'milliseconds', true);
    log.info(`Mongo IndustryCode  List processing  count ${IndustryCodeList.length} duration: ${diff} milliseconds` + __location);

    if(IndustryCodeList.length > 0) {
        IndustryCodeList.forEach(function(ic) {
            ic.id = ic.industryCodeId;
            ic.isFeatured = ic.featured;
            ic.featured = ic.featured ? 1 : 0;
            if(ic.industryCodeCategoryId > 0) {

                const iccDoc = catList.find((icc) => icc.industryCodeCategoryId === ic.industryCodeCategoryId);
                if(iccDoc){
                    ic.category = iccDoc.name;
                }
                // else {
                //     log.debug(`ic.industryCodeCategoryId no hit ${ic.industryCodeCategoryId} ` + __location)
                // }
            }
            if (ic.alternateNames && ic.alternateNames.length > 0) {
                ic.alternate_names = ic.alternateNames;
            }
        });
        return IndustryCodeList;
    }
    else {
        return [];
    }
}

async function GetBopIndustryCodes(industryCodeId, insurerArray){

    industryCodeId = parseInt(industryCodeId,10);
    if(!industryCodeId){
        log.info(`industrycodesvc.GetBopIndustryCodes bad industryCodeId ` + __location)
        return [];
    }
    const start = moment();
    const IndustryCodeModel = require('mongoose').model('IndustryCode');
    let IndustryCodeList = [];
    let runQuery = true;
    const icQuery = {
        active: true,
        codeGroupList: "BOP",
        parentIndustryCodeId: industryCodeId
    }
    try{
        if(insurerArray?.length > 0){
            log.debug(`industrycodesvc.GetBopIndustryCodes filtering on insurers`)
            const InsurerIndustryCodeModel = require('mongoose').model('InsurerIndustryCode');
            let insurerIndustryCodeList = null;
            try{
                const pipeLine = [
                    {$match: {
                        insurerId: {$in: insurerArray},
                        policyTypeList: "BOP",
                        active: true
                    }},
                    {"$unwind": "$talageIndustryCodeIdList"} ,
                    {$group:{
                        _id : null,
                        uniqueTalageIndustryCodes : {$addToSet : "$talageIndustryCodeIdList"}
                    }}
                ]
                //log.debug(`Mongo IndustryCode BOP List InsurerIndustryCodeModel pipeline \n ${JSON.stringify(pipeLine)} ` + __location)
                insurerIndustryCodeList = await InsurerIndustryCodeModel.aggregate(pipeLine)
                //log.debug(`Mongo IndustryCode BOP List InsurerIndustryCodeModel pipeline result \n ${JSON.stringify(insurerIndustryCodeList)} ` + __location)
                if(insurerIndustryCodeList[0] && insurerIndustryCodeList[0].uniqueTalageIndustryCodes && insurerIndustryCodeList[0].uniqueTalageIndustryCodes.length > 0){
                    const industryIdList = insurerIndustryCodeList[0].uniqueTalageIndustryCodes;
                    if(industryIdList?.length > 0){
                        //log.debug(`GetBopIndustryCodes industryIdList ${industryIdList}` + __location)
                        icQuery.industryCodeId = {$in: industryIdList}
                    }
                    else {
                        runQuery = false;
                    }
                }
                else {
                    runQuery = false;
                }
            }
            catch(err){
                log.warn(`industryCodeId: ${industryCodeId} Error IndustryCodeSvc.GetIndustryCodes ` + __location);
            }
        }

        if(runQuery){
            const queryProjection = {
                "__v": 0,
                "_id": 0,
                "id": 0,
                "talageStandard": 0,
                "codeGroupList":0,
                active: 0,
                talageIndustryCodeUuid: 0,
                activityCodeIdList: 0,
                primaryActivityCodeId: 0,
                updatedAt: 0,
                createdAt: 0
            };
            const queryOptions = {sort: {description: 1}};

            IndustryCodeList = await IndustryCodeModel.find(icQuery, queryProjection, queryOptions).lean();
        }

    }
    catch(err){
        log.warn(`IndustryCodeSvc.GetIndustryCodes  ${err}` + __location);
    }

    const endMongo = moment();
    const diff = endMongo.diff(start, 'milliseconds', true);
    log.info(`Mongo IndustryCode BOP List processing  count ${IndustryCodeList.length} duration: ${diff} milliseconds runQuery` + __location);

    if(IndustryCodeList.length > 0) {
        IndustryCodeList.forEach(function(ic) {
            ic.id = ic.industryCodeId;
            ic.isFeatured = ic.featured;
            ic.featured = ic.featured ? 1 : 0;
            if (ic.alternateNames && ic.alternateNames.length > 0) {
                ic.alternate_names = ic.alternateNames;
            }
        });
        return IndustryCodeList;
    }
    else {
        return [];
    }


}
module.exports = {
    GetIndustryCodes: GetIndustryCodes,
    GetIndustryCodeCategories: GetIndustryCodeCategories,
    GetBopIndustryCodes: GetBopIndustryCodes
    //UpdateRedisActivityCodeByIndustryCache: UpdateRedisActivityCodeByIndustryCache
}