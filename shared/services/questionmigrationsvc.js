/* eslint-disable array-element-newline */
/* eslint-disable prefer-const */
/* eslint-disable require-jsdoc */


function stringArraytoArray(dbString){
    if(typeof dbString === 'object'){
        return dbString;
    }
    else if(dbString && typeof dbString === 'string'){
        return dbString.split(',')
    }
    else if(dbString){
        log.debug(`dbstring type ${typeof dbString}`)
        log.debug(`dbstring  ${dbString}`)
        return [];
    }
    else {
        return [];
    }
}


async function importInsurerQuestions(insurerId) {

    const InsurerQuestionModel = require('mongoose').model('InsurerQuestion');
    //load message model and get message list.
    let sql = `select iq.id as 'systemId',
        iq.question as talageQuestionId,
        iq.insurer as insurerId,
        iq.policy_type as 'policyType',
        iq.universal,
        iq.text,
        iq.identifier,
        iq.attributes,
        iq.created as 'createdAt',
        iq.modified as 'updatedAt',
        iq.questionSubjectArea,
        iq.effectiveDate,
        iq.expirationDate,
        GROUP_CONCAT(DISTINCT t.territory) AS territoryList
        from clw_talage_insurer_questions AS iq
        left join clw_talage_insurer_question_territories t on iq.id = t.insurer_question
       `;
    if(insurerId > 0){
        sql += ` where insurer = ${insurerId} 
         `;
    }

    sql += ` 
        group by iq.id;`

    const result = await db.query(sql).catch(function(err) {
        // Check if this was
        log.error(`importInsurerQuestions error getting mysql Questions ${err}` + __location);
        return false;
    });
    log.info("importInsurerQuestions: Got MySql insurerQuestions - result.length - " + result.length);
    const updateAbleProps = ['talageQuestionId','policyType','allTerritories','questionSubjectArea','effectiveDate','expirationDate', 'universal', 'attributes','identifier']
    let updatedDocCount = 0;
    let newDocCount = 0;
    for(let i = 0; i < result.length; i++){
        try {
            result[i].territoryList = stringArraytoArray(result[i].territoryList);
            if(result[i].attributes){
                result[i].attributes = JSON.parse(result[i].attributes)
            }
            if(!result[i].territoryList || result[i].territoryList.length === 0){
                result[i].allTerritories = true;
            }
            const insurerQuestion = new InsurerQuestionModel(result[i]);
            //check if question is already in mongo. update/insert
            const query = {systemId: result[i].systemId}
            const existingDoc = await InsurerQuestionModel.findOne(query);
            if(existingDoc){
                log.debug(`Existing InsurerQuestion ${existingDoc.systemId} - ${existingDoc.insurerQuestionId}`)
                //update file
                let updateHit = false;
                if(result[i].territoryList && result[i].territoryList.length > 0){
                    updateHit = true;
                    existingDoc.territoryList = result[i].territoryList
                }
                //loop updateable array
                updateAbleProps.forEach((updateAbleProp) => {
                    if(insurerQuestion[updateAbleProp] && insurerQuestion[updateAbleProp] !== existingDoc[updateAbleProp]){
                        existingDoc[updateAbleProp] = insurerQuestion[updateAbleProp];
                        if (updateAbleProp === "policyType") {
                            existingDoc.policyTypeList = [insurerQuestion.policyType]
                        }
                        updateHit = true;
                    }
                });
                if(updateHit){
                    await existingDoc.save().catch(function(err) {
                        log.error('Mongo insurerQuestions Save err ' + err + __location);
                        return false;
                    });
                    updatedDocCount++;
                }
            }
            else {
                log.debug(`New Question SystemId ${result[i].systemId}`)
                await insurerQuestion.save().catch(function(err) {
                    log.error('Mongo insurerQuestions Save err ' + err + __location);
                    return false;
                });
                newDocCount++;
            }

            if((i + 1) % 100 === 0){
                log.debug(`importInsurerQuestions processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("importInsurerQuestions Updating insurerQuestions List error " + err + __location);
            return false
        }
    }
    log.debug(`Update Questions: ${updatedDocCount}`);
    log.debug(`New Questions: ${newDocCount}`);
    return true;

}

const groupQuestionArray = key => array => array.reduce((objectsByKeyValue, obj) => {
    const value = obj[key];
    objectsByKeyValue[value] = (objectsByKeyValue[value] || []).concat(obj.insurerQuestionId);
    return objectsByKeyValue;
}, {});


async function insurerCodeTerritoryQuestions(insurerIndustryCodeIdList, iqMongoList){
    //const InsurerQuestionModel = require('mongoose').model('InsurerQuestion');
    if(insurerIndustryCodeIdList){
        const sql = `SELECT distinct iic.territory, iq.id as insurerQuestionId
            FROM clw_talage_insurer_industry_codes AS iic
            inner JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON  iic.id = industryCodeMap.insurerIndustryCodeId
            inner JOIN clw_talage_industry_codes AS ic ON industryCodeMap.talageIndustryCodeId = ic.id
            inner JOIN clw_talage_industry_code_questions  AS icq ON icq.insurerIndustryCodeId = iic.id 
            inner JOIN clw_talage_insurer_questions AS iq ON iq.question = icq.talageQuestionId
            where iic.id in (${insurerIndustryCodeIdList})
            order by iic.territory ;`;

        // eslint-disable-next-line prefer-const
        let result = await db.query(sql).catch(function(error) {
            // Check if this was
            log.error("error " + error);
            return false;
        });
        if(result && result.length > 0){
            const groupByTerritory = groupQuestionArray('territory')
            const groupedQuestionList = groupByTerritory(result);
            var territoryQuestionArray = [];
            // eslint-disable-next-line guard-for-in
            for (const tqObjectGrouped in groupedQuestionList) {
                const iqsystemIdList = groupedQuestionList[tqObjectGrouped];
                // get insurerQuestionId
                if(iqsystemIdList && iqsystemIdList.length > 0){
                    let insurerQuestionIdList = [];
                    for (let j = 0; j < iqsystemIdList.length; j++) {
                        const iqId = iqsystemIdList[j];
                        const iQFound = iqMongoList.find((iq) => iq.systemId === iqId);
                        if(iQFound){
                            insurerQuestionIdList.push(iQFound.insurerQuestionId)
                        }
                    }
                    if(insurerQuestionIdList.length){
                        const territoryQuestionJSON = {
                            territory: tqObjectGrouped,
                            insurerQuestionIdList: insurerQuestionIdList
                        }
                        territoryQuestionArray.push(territoryQuestionJSON);
                    }
                }
            }
            //log.debug("groupedQuestions " + JSON.stringify(territoryQuestionArray))
            // if(territoryQuestionArray.length === 0){
            //     log.debug("no questions " + sql)
            // }
            return territoryQuestionArray
        }
        else {
            //log.debug("no questions  returned " + sql)
            return null;
        }

    }
    else {
        // log.debug("empty insurerIndustryCodeIdList")
        return null
    }
}


async function importInsurerIndustryCodes(insurerId) {

    const InsurerIndustryCodeModel = require('mongoose').model('InsurerIndustryCode');
    const InsurerQuestionModel = require('mongoose').model('InsurerQuestion');
    const iqMongoList = await InsurerQuestionModel.find({}).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });


    let sql = `SELECT  
         iic.code,
		 iic.type,
		 iic.insurer as 'insurerId',
		 iic.description,
		 iic.attributes,
		 iic.policyType as 'policyType',
         iic.effectiveDate, 
         iic.expirationDate ,
         GROUP_CONCAT(DISTINCT iic.id) AS oldSystemIdList,
         GROUP_CONCAT(DISTINCT iic.territory) AS territoryList,
         GROUP_CONCAT(DISTINCT ic.id) AS talageIndustryCodeIdList
        FROM clw_talage_insurer_industry_codes AS iic
        Left JOIN industry_code_to_insurer_industry_code AS industryCodeMap ON  iic.id = industryCodeMap.insurerIndustryCodeId
        left JOIN clw_talage_industry_codes AS ic ON industryCodeMap.talageIndustryCodeId = ic.id
        `;

    if(insurerId > 0){
        sql += ` where iic.insurer = ${insurerId} 
        `;
    }

    sql += ` GROUP BY iic.insurer, iic.code,iic.policyType, iic.attributes;`;
    //where industryCodeMap.talageIndustryCodeId

    // eslint-disable-next-line prefer-const
    let result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });
    log.debug("Got MySql insurerIndustryCode - result.length - " + result.length);
    const updateAbleProps = ['attributes','effectiveDate','expirationDate','territoryList','talageIndustryCodeIdList','insurerQuestionIdList','insurerTerritoryQuestionList'];
    let updatedDocCount = 0;
    let newDocCount = 0;
    for(let i = 0; i < result.length; i++){
        try {
            //Liberty mutual "gl" policyType fix.
            if(result[i].policyType === "gl"){
                result[i].policyType = "GL";
            }
            result[i].territoryList = stringArraytoArray(result[i].territoryList);
            result[i].talageIndustryCodeIdList = stringArraytoArray(result[i].talageIndustryCodeIdList);
            if(result[i].attributes){
                result[i].attributes = JSON.parse(result[i].attributes)
            }

            try{
                //get territory array for insurer
                if(result[i].oldSystemIdList){
                    const insurerCodeTerritoryQuestionArray = await insurerCodeTerritoryQuestions(result[i].oldSystemIdList,iqMongoList);
                    if(insurerCodeTerritoryQuestionArray && insurerCodeTerritoryQuestionArray.length > 0){
                        result[i].insurerTerritoryQuestionList = insurerCodeTerritoryQuestionArray
                    }
                }
                else {
                    log.debug(`NO insurerIndustryCodeIdList for insurer: ${result[i].insurerId}`)
                }
            }
            catch(err){
                log.error("Question group error " + err)
                return false
            }
            result[i].oldSystemIdList = stringArraytoArray(result[i].oldSystemIdList);
            let insurerIndustryCode = new InsurerIndustryCodeModel(result[i]);
            //TODO Determine if existing doc
            // by insurerId, policyType,type, code,
            const query = {
                insurerId: insurerIndustryCode.insurerId,
                policyTypeList: [insurerIndustryCode.policyType],
                policyType: insurerIndustryCode.policyType,
                code: insurerIndustryCode.code,
                oldSystemIdList: insurerIndustryCode.oldSystemIdList
            }
            const existingDoc = await InsurerIndustryCodeModel.findOne(query);
            if(existingDoc){
                //update file
                let updateHit = false;
                //loop updateable array
                updateAbleProps.forEach((updateAbleProp) => {
                    if(insurerIndustryCode[updateAbleProp] && insurerIndustryCode[updateAbleProp] !== existingDoc[updateAbleProp]){
                        existingDoc[updateAbleProp] = insurerIndustryCode[updateAbleProp]
                        updateHit = true;
                    }
                });
                if(updateHit){
                    await existingDoc.save().catch(function(err) {
                        log.error('Mongo insurerIndustryCode Save err ' + err + __location);
                        return false;
                    });
                    updatedDocCount++;
                }
            }
            else {
                await insurerIndustryCode.save().catch(function(err) {
                    log.error('Mongo insurerIndustryCode Save err ' + err + __location);
                    return false;
                });
                newDocCount++;
            }
            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating insurerIndustryCode List error " + err + __location);
            return false;
        }
    }
    log.debug("ImportInsurerIndustryCodes Done!");
    log.debug(`Updated IndustryCodes: ${updatedDocCount}`);
    log.debug(`New IndustryCodes: ${newDocCount}`);
    return true;

}


async function insurerActivityCodeTerritoryQuestions(insurerActivityCodeIdList, territory, iqMongoList){
    if(insurerActivityCodeIdList && insurerActivityCodeIdList.length > 0){
        const sql = `SELECT distinct iq.id as insurerQuestionId
                    FROM clw_talage_insurer_ncci_code_questions AS ncq
                    INNER JOIN clw_talage_insurer_questions AS iq ON ncq.question = iq.question
                    WHERE ncq.ncci_code in (${insurerActivityCodeIdList}) ;`;

        let result = await db.query(sql).catch(function(error) {
            // Check if this was
            log.error("error " + error);
            return false;
        });
        if(result && result.length > 0){
            let territoryQuestionArray = [];
            for(let i = 0; i < result.length; i++){
                if(result[i].insurerQuestionId){
                    const iqId = result[i].insurerQuestionId;
                    const iQFound = iqMongoList.find((iq) => iq.systemId === iqId);
                    if(iQFound){
                        territoryQuestionArray.push(iQFound.insurerQuestionId)
                    }
                }
            }
            if(territoryQuestionArray.length > 0){
                const territoryQuestionJSON = {
                    territory: territory,
                    insurerQuestionIdList: territoryQuestionArray
                };
                return territoryQuestionJSON
            }
            else {
                return null;
            }

        }
        // else {
        //     log.debug("no questions  returned " + sql)
        //     return null;
        // }

    }
    else {
        log.debug("empty insurerActivityCodeIdList")
        return null
    }
}


async function importActivityCodes(insurerId) {

    const InsurerQuestionModel = require('mongoose').model('InsurerQuestion');
    const iqMongoList = await InsurerQuestionModel.find({}).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });

    const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
    //load message model and get message list.
    let sql = `SELECT  inc.insurer as 'insurerId',inc.code,inc.sub,inc.description
                    ,inc.attributes ,inc.effectiveDate ,inc.expirationDate 
                    ,GROUP_CONCAT(DISTINCT territory) AS territoryList
                    ,GROUP_CONCAT(DISTINCT nca.code) AS talageActivityCodeIdList
                    ,GROUP_CONCAT(DISTINCT inc.id) AS oldSystemIdList
                FROM clw_talage_insurer_ncci_codes inc
	                left join clw_talage_activity_code_associations AS nca ON nca.insurer_code = inc.id 
                `;

    if(insurerId > 0){
        sql += ` where inc.insurer = ${insurerId} 
        `;
    }
    sql += `  GROUP BY  inc.insurer, inc.code,inc.sub ,inc.description,inc.attributes ,inc.effectiveDate , inc.expirationDate
                ORDER BY inc.insurer, inc.code, inc.sub, inc.description;`;


    let result = await db.query(sql).catch(function(error) {
        // Check if this was
        log.error("error " + error);
        return false;
    });
    log.debug("Got MySql insurerActviityCode - result.length - " + result.length);
    const updateAbleProps = ['attributes','effectiveDate','expirationDate','territoryList','talageActivityCodeIdList','insurerQuestionIdList','insurerTerritoryQuestionList'];
    let updatedDocCount = 0;
    let newDocCount = 0;
    for(let i = 0; i < result.length; i++){
        try {
            result[i].territoryList = stringArraytoArray(result[i].territoryList);
            result[i].talageActivityCodeIdList = stringArraytoArray(result[i].talageActivityCodeIdList);
            if(result[i].attributes){
                result[i].attributes = JSON.parse(result[i].attributes)
            }
            //get territory array for insurer
            try{
                if(result[i].territoryList && result[i].territoryList.length > 0 && result[i].oldSystemIdList){
                    let insurerTerritoryQuestionList = [];
                    //for on territoryList
                    for(let j = 0; j < result[i].territoryList.length; j++){
                        const insurerCodeTerritoryQuestionJSON = await insurerActivityCodeTerritoryQuestions(result[i].oldSystemIdList, result[i].territoryList[j], iqMongoList);
                        if(insurerCodeTerritoryQuestionJSON){
                            insurerTerritoryQuestionList.push(insurerCodeTerritoryQuestionJSON);
                        }
                    }
                    if(insurerTerritoryQuestionList.length > 0){
                        result[i].insurerTerritoryQuestionList = insurerTerritoryQuestionList
                        //log.debug("adding  insurerTerritoryQuestionList")
                    }
                }
            }
            catch(err){
                log.error("Question group error " + err)
                return false
            }

            result[i].oldSystemIdList = stringArraytoArray(result[i].oldSystemIdList);
            let insurerActivityCode = new InsurerActivityCodeModel(result[i]);
            //TODO Determine if existing doc
            // by insurerId,  code, sub
            const query = {
                insurerId: insurerActivityCode.insurerId,
                code: insurerActivityCode.code,
                sub: insurerActivityCode.sub,
                oldSystemIdList: insurerActivityCode.oldSystemIdList
            }
            const existingDoc = await InsurerActivityCodeModel.findOne(query);
            if(existingDoc){
                //update file
                let updateHit = false;
                //loop updateable array
                updateAbleProps.forEach((updateAbleProp) => {
                    if(insurerActivityCode[updateAbleProp] && insurerActivityCode[updateAbleProp] !== existingDoc[updateAbleProp]){
                        existingDoc[updateAbleProp] = insurerActivityCode[updateAbleProp]
                        updateHit = true;
                    }
                });
                if(updateHit){
                    await existingDoc.save().catch(function(err) {
                        log.error('Mongo insurerActivityCode Save err ' + err + __location);
                        return false;
                    });
                    updatedDocCount++
                }
            }
            else {
                await insurerActivityCode.save().catch(function(err) {
                    log.error('Mongo insurerActivityCode Save err ' + err + __location);
                    return false;
                });
                newDocCount++;
            }

            // if(insurerActivityCode.insurerTerritoryQuestionList.length > 0){
            //     log.debug("has territoryquestions " + insurerActivityCode.insurerActivityCodeId)
            // }
            if((i + 1) % 100 === 0){
                log.debug(`processed ${i + 1} of ${result.length} `)
            }
        }
        catch(err){
            log.error("Updating insurerActivityCode List error " + err + __location);
            return false;
        }
    }
    log.debug("InsurerActivityCodes Import Done!");
    log.debug(`Updated InsurerActivityCodes: ${updatedDocCount}`);
    log.debug(`New InsurerActivtiyCodes: ${newDocCount}`);
    return true;

}


module.exports = {
    importInsurerQuestions: importInsurerQuestions,
    importInsurerIndustryCodes: importInsurerIndustryCodes,
    importActivityCodes: importActivityCodes
};