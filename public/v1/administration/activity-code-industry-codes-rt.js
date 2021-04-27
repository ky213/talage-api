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
async function getActivityCodeIndustryCodes(req, res, next){
    if(!req.query || !req.query.talageActivityCodeId){
        return next(serverHelper.requestError('Bad Request: No talageActivityCodeId provided'));
    }

    // get the insurer activity codes to get what questions they are linked to
    const insurerActivityCodeBO = new InsurerActivityCodeBO();
    const insurerActivityCodeQuery = {talageActivityCodeIdList: req.query.talageActivityCodeId};
    const insurerActivityCodes = await insurerActivityCodeBO.getList(insurerActivityCodeQuery);

    let insurerQuestionIdList = [];
    if(insurerActivityCodes){
        insurerActivityCodes.forEach(insurerActivityCode => {
            insurerQuestionIdList = insurerQuestionIdList.concat(insurerActivityCode.insurerQuestionIdList);
        });
    }

    let industryCodes = [];
    // use the question link to jump to insurer industry codes
    if(insurerQuestionIdList.length > 0){
        const insurerIndustryCodeBO = new InsurerIndustryCodeBO();
        const insurerIndustryCodeQuery = {insurerQuestionIdList: insurerQuestionIdList};
        const insurerIndustryCodes = await insurerIndustryCodeBO.getList(insurerIndustryCodeQuery);

        let talageIndustryCodeIdList = []
        if(insurerIndustryCodes){
            insurerIndustryCodes.forEach(insurerIndustryCode => {
                talageIndustryCodeIdList = talageIndustryCodeIdList.concat(insurerIndustryCode.talageIndustryCodeIdList);
            });
        }

        // find the talage industry codes with the talage ids from the insurer industry code result
        const uniqueTalageIndustryCodeIds = [...new Set(talageIndustryCodeIdList)];

        const talageIndustryCodeSql = `
            SELECT * 
            FROM clw_talage_industry_codes 
            WHERE id IN (${db.escape(uniqueTalageIndustryCodeIds.join(","))})
            `;
        industryCodes = await db.query(talageIndustryCodeSql).catch(function(err){
            log.error(err.message);
            res.send(500, 'Error retrieving industry codes related to an industry code.');
            return next(serverHelper.internalError('Error retrieving industry codes related to an industry code.'));
        });
    }

    // Return the response
    res.send(200, industryCodes);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Activity Code Industry Code list', `${basePath}/activity-code-industry-codes`, getActivityCodeIndustryCodes, 'administration', 'all');
};