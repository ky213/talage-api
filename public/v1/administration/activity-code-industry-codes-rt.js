'use strict';

const serverHelper = require('../../../server.js');

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
    if(!req.query || !req.query.activityCode){
        return next(serverHelper.requestError('Bad Request: No activityCode provided'));
    }

    // Define a query to get a list of industry_codes, given an activityCode
    const activityCodeIndustryCodesSQL = `
        SELECT id, description FROM clw_talage_industry_codes
        INNER JOIN (
            SELECT 
            clw_talage_industry_code_associations.industryCodeId
            FROM clw_talage_industry_code_associations
            INNER JOIN (
                SELECT DISTINCT id
                FROM clw_talage_activity_codes 
                WHERE id = ${db.escape(req.query.activityCode)}
            ) ac ON ac.id = clw_talage_industry_code_associations.activityCodeId
        ) ica ON ica.industryCodeId = clw_talage_industry_codes.id
		`;

    // Get the agencies from the database
    const questions = await db.query(activityCodeIndustryCodesSQL).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Return the response
    res.send(200, questions);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Activity Code Industry Code list', `${basePath}/activity-code-industry-codes`, getActivityCodeIndustryCodes, 'administration', 'all');
};