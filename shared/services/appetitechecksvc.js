/* eslint-disable array-element-newline */
/* eslint-disable object-curly-newline */
/* eslint-disable multiline-comment-style */
/* eslint-disable one-var */

const moment = require('moment');

/**
* @param {string} policyTypeCd - policyTypeCd "WC", "GL, "BOP"....
* @param {momentObj} policyEffectiveDate - effectiveDate momentObj
* @param {array} activityCodeIdList - An array of all the activity codes in the applicaiton
* @param {array} industryCodeIdList - An Array of industry codes of the application
* @param {array} insurerIdList - An array containing the IDs of the relevant insurers for the application
* @param {array} stateList - An array containing the US State Codes for the application
*
* @returns {string} return Appetite Check status ("Need more information", "Unable to determine", "In Appetite", "Out of Appetite")
*
*/
async function checkAppetite(policyTypeCd, policyEffectiveDate, activityCodeIdList = [], industryCodeIdList = [], insurerIdList = [], stateList = []) {
    log.info(`checkAppetite: policyTypeCd:  ${policyTypeCd}, policyEffectiveDate:  ${policyEffectiveDate}, activityCodeIdList:  ${JSON.stringify(activityCodeIdList)}, industryCodeIdList:  ${JSON.stringify(industryCodeIdList)}, insurerIdList:  ${JSON.stringify(insurerIdList)}, stateList:  ${JSON.stringify(stateList)}` + __location)
    if(!policyTypeCd || typeof policyTypeCd !== 'string' || policyTypeCd.length > 5 || policyTypeCd.length < 2){
        return "Need more information";
    }

    if(!policyEffectiveDate){
        policyEffectiveDate = moment();
    }
    if(!insurerIdList || insurerIdList.length === 0){
        return "Need more information";
    }

    if(!stateList || stateList.length === 0){
        return "Need more information";
    }

    if(policyTypeCd === "WC"){
        //swap travlers(2) over to ncci (9)
        if(insurerIdList.includes(2)){
            if(!insurerIdList.includes(3)){
                insurerIdList.push(3);
            }
            if(!insurerIdList.includes(14)){
                insurerIdList.push(14);
            }
            if(!insurerIdList.includes(19)){
                insurerIdList.push(19);
            }
            insurerIdList.push(9);
        }
        log.debug(`insurerIdList ${insurerIdList}` + __location)

        if(!activityCodeIdList || activityCodeIdList.length === 0){
            return "Need more information";
        }
        let result = "Out of Appetite";
        for(const activityCodeId of activityCodeIdList){
            for(const state of stateList){
                const activityCodeQuery = {
                    insurerId: {$in: insurerIdList},
                    talageActivityCodeIdList: activityCodeId,
                    territoryList: state,
                    effectiveDate: {$lte: policyEffectiveDate},
                    expirationDate: {$gte: policyEffectiveDate},
                    active: true
                }

                const InsurerActivityCodeModel = global.mongoose.InsurerActivityCode;
                const insurerActivityCodeList = await InsurerActivityCodeModel.find(activityCodeQuery).lean();
                if(insurerActivityCodeList.length > 0){
                    result = "In Appetite";
                }
                else {
                    result = "Out of Appetite";
                    return result
                }
            }
        }
        return result
        //determine if any WC insurer involved also need industry codes checks.
    }
    else if(policyTypeCd === "BOP"){
        //all other policy type are industryCode based.
        if(!industryCodeIdList || industryCodeIdList.length === 0){
            return "Need more information";
        }
        //BOP if any code hits it consider in appetite
        let result = "Out of Appetite";
        for(const state of stateList){
            const industryQuery = {
                policyTypeList: "BOP",
                insurerId: {$in: insurerIdList},
                talageIndustryCodeIdList: {$in: industryCodeIdList},
                territoryList: state,
                effectiveDate: {$lte: policyEffectiveDate},
                expirationDate: {$gte: policyEffectiveDate},
                active: true
            }

            log.debug(`checkAppetite IC BOP query ${JSON.stringify(industryQuery)}` + __location)
            const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;
            const insurerIndustryCodeList = await InsurerIndustryCodeModel.find(industryQuery).lean();
            if(insurerIndustryCodeList.length > 0){
                result = "In Appetite";
            }
            else {
                return "Out of Appetite";
            }
        }
        return result
    }
    else {
        //all other policy type are industryCode based.
        if(!industryCodeIdList || industryCodeIdList.length === 0){
            return "Need more information";
        }
        const cowbellInsurerId = 30
        if(insurerIdList.includes(cowbellInsurerId)){
            // future see if Cowbell API has appetite check.
            return "Unable to determine";
        }

        let result = "Out of Appetite";
        for(const industryCodeId of industryCodeIdList){
            for(const state of stateList){
                const industryQuery = {
                    insurerId: {$in: insurerIdList},
                    talageIndustryCodeIdList: industryCodeId,
                    territoryList: state,
                    effectiveDate: {$lte: policyEffectiveDate},
                    expirationDate: {$gte: policyEffectiveDate},
                    active: true
                }
                // eslint-disable-next-line prefer-const
                const orParamList = [];
                const policyTypeCheck = {policyTypeList: policyTypeCd};
                const policyTypeLengthCheck = {policyTypeList: {$size: 0}}
                const policyTypeNullCheck = {policyTypeList: null}
                orParamList.push(policyTypeCheck)
                orParamList.push(policyTypeLengthCheck)
                orParamList.push(policyTypeNullCheck)
                industryQuery.$or = orParamList;
                log.debug(`checkAppetite IC query ${JSON.stringify(industryQuery)}` + __location)
                const InsurerIndustryCodeModel = global.mongoose.InsurerIndustryCode;
                const insurerIndustryCodeList = await InsurerIndustryCodeModel.find(industryQuery).lean();
                if(insurerIndustryCodeList.length > 0){
                    result = "In Appetite";
                }
                else {
                    return "Out of Appetite";
                }
            }
        }
        return result
    }

}

module.exports = {
    checkAppetite: checkAppetite
}