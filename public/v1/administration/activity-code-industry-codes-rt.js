'use strict';

const serverHelper = require('../../../server.js');

/**
 * Responds to get requests for the industry codes associated with an activity code
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

    let activityCodeId = null;
    try{
        activityCodeId = parseInt(req.query.talageActivityCodeId, 10);
    }
    catch{
        return next(serverHelper.requestError('Bad Request: Invalid talageActivityCodeId provided'));
    }

    if(!activityCodeId){
        return next(serverHelper.requestError('Bad Request: Invalid talageActivityCodeId provided'));
    }

    const talageIndustryCodeSql = `
        SELECT * 
        FROM clw_talage_industry_codes 
        WHERE id IN (
            SELECT industryCodeId
            FROM clw_talage_industry_code_associations
            WHERE activityCodeId = ${db.escape(activityCodeId)}
        )
        `;
    const industryCodes = await db.query(talageIndustryCodeSql).catch(function(err){
        log.error(err.message);
        res.send(500, 'Error retrieving industry codes related to an activity code.');
        return next(serverHelper.internalError('Error retrieving industry codes related to an activity code.'));
    });

    // Return the response
    res.send(200, industryCodes);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Activity Code Industry Code list', `${basePath}/activity-code-industry-codes`, getActivityCodeIndustryCodes, 'administration', 'all');
};