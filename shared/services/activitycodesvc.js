/* eslint-disable require-jsdoc */
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const utility = global.requireShared('./helpers/utility.js');

async function GetActivityCodes(territory,industry_code){
    // eslint-disable-next-line prefer-const
    let activityIdList = [];
    //generate from activityId list from mongo or mysal
    if(global.settings.USE_MONGO_QUESTIONS === "YES"){
        const InsurerActivityCodeModel = require('mongoose').model('InsurerActivityCode');
        const activityCodeQuery = {
            territoryList: territory,
            active: true
        }
        let insurerActivityCodeList = null;
        try{
            insurerActivityCodeList = await InsurerActivityCodeModel.find(activityCodeQuery)
        }
        catch(err){
            log.warn(`Appid: ${this.app.id} Error ActivityCodeSvc.GetActivityCodes for ${this.insurer.name}:${this.insurer.id} and ${this.app.applicationDocData.mailingState}` + __location);
        }
        if(insurerActivityCodeList){
            log.debug(`insurerActivityCodeList.length ${insurerActivityCodeList.length}`)
            insurerActivityCodeList.forEach((insurerActivityCode) => {
                if(insurerActivityCode.talageActivityCodeIdList && insurerActivityCode.talageActivityCodeIdList.length > 0){
                    utility.addArrayToArray(activityIdList,insurerActivityCode.talageActivityCodeIdList);
                }
            });
        }
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

module.exports = {GetActivityCodes: GetActivityCodes}