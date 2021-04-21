'use strict';

const serverHelper = require('../../../server.js');
const InsurerIndustryCodeBO = global.requireShared('./models/InsurerIndustryCode-BO.js');
const InsurerActivityCodeBO = global.requireShared('./models/InsurerActivityCode-BO.js');

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getIdustryCodeActivityCodesSql(req, res, next){
    if(!req.query || !req.query.industryCode){
        return next(serverHelper.requestError('Bad Request: No industryCode provided'));
    }

    // Define a query to get a list of insurer industry codes, given an industryCode
    const idustryCodeInsurerIndustryCodesSQL = `
        SELECT * 
        FROM clw_talage_activity_codes 
        WHERE id IN (
            SELECT activityCodeId
            FROM clw_talage_industry_code_associations 
            WHERE industryCodeId = ${db.escape(req.query.industryCode)}
        )
		`;

    // Get the agencies from the database
    const insurerIndustryCodes = await db.query(idustryCodeInsurerIndustryCodesSQL).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Return the response
    res.send(200, insurerIndustryCodes);
    return next();
}

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getIdustryCodeActivityCodes(req, res, next){
    if(!req.query || !req.query.talageIndustryCodeId){
        return next(serverHelper.requestError('Bad Request: No talageIndustryCodeId provided'));
    }

    // get the insurer industry codes to get what questions they are linked to
    const insurerIndustryCodeBO = new InsurerIndustryCodeBO();
    const insurerIndustryCodeQuery = {talageIndustryCodeIdList: req.query.talageIndustryCodeId};
    const insurerIndustryCodes = await insurerIndustryCodeBO.getList(insurerIndustryCodeQuery);

    let insurerQuestionIdList = [];
    if(insurerIndustryCodes){
        insurerIndustryCodes.forEach(insurerIndustryCode => {
            insurerQuestionIdList = insurerQuestionIdList.concat(insurerIndustryCode.insurerQuestionIdList);
        });
    }

    let activityCodes = [];
    // use the question link to jump to insurer activity codes
    if(insurerQuestionIdList.length > 0){
        const insurerActivityCodeBO = new InsurerActivityCodeBO();
        const insurerActivityCodeQuery = {insurerQuestionIdList: insurerQuestionIdList};
        const insurerActivityCodes = await insurerActivityCodeBO.getList(insurerActivityCodeQuery);

        let talageActivityCodeIdList = []
        if(insurerActivityCodes){
            insurerActivityCodes.forEach(insurerActivityCode => {
                talageActivityCodeIdList = talageActivityCodeIdList.concat(insurerActivityCode.talageActivityCodeIdList);
            });
        }

        // find the talage activity codes with the talage ids from the insurer activity code result
        const uniqueTalageActivityCodeIds = [...new Set(talageActivityCodeIdList)];

        const talageActivityCodeSql = `
            SELECT * 
            FROM clw_talage_activity_codes 
            WHERE id IN (${db.escape(uniqueTalageActivityCodeIds.join(","))})
            `;
        activityCodes = await db.query(talageActivityCodeSql).catch(function(err){
            log.error(err.message);
            res.send(500, 'Error retrieving activity codes related to an industry code.');
            return next(serverHelper.internalError('Error retrieving activity codes related to an industry code.'));
        });
    }

    // Return the response
    res.send(200, activityCodes);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Industry Code Activity Code list', `${basePath}/industry-code-activity-codes-sql`, getIdustryCodeActivityCodesSql, 'administration', 'all');
    server.addGetAuthAdmin('GET Industry Code Activity Code list', `${basePath}/industry-code-activity-codes`, getIdustryCodeActivityCodes, 'administration', 'all');
};