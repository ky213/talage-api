'use strict';

const serverHelper = global.requireRootPath('server.js');

/**
 * Responds to get requests for the activity codes associated with an industry code
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

    let industryCodeId = null;
    try{
        industryCodeId = parseInt(req.query.talageIndustryCodeId, 10);
    }
    catch{
        return next(serverHelper.requestError('Bad Request: Invalid talageIndustryCodeId provided'));
    }

    if(!industryCodeId){
        return next(serverHelper.requestError('Bad Request: Invalid talageIndustryCodeId provided'));
    }

    const talageActivityCodeSql = `
        SELECT * 
        FROM clw_talage_activity_codes 
        WHERE id IN (
            SELECT activityCodeId
            FROM clw_talage_industry_code_associations
            WHERE industryCodeId = ${db.escape(industryCodeId)}
        )
        `;
    const activityCodes = await db.query(talageActivityCodeSql).catch(function(err){
        log.error(err.message);
        res.send(500, 'Error retrieving activity codes related to an industry code.');
        return next(serverHelper.internalError('Error retrieving activity codes related to an industry code.'));
    });

    // Return the response
    res.send(200, activityCodes);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Industry Code Activity Code list', `${basePath}/industry-code-activity-codes`, getIdustryCodeActivityCodes, 'administration', 'all');
};