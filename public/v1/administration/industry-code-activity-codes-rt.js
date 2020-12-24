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
async function getIdustryCodeActivityCodes(req, res, next){
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

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Industry Code Activity Code list', `${basePath}/industry-code-activity-codes`, getIdustryCodeActivityCodes, 'administration', 'all');
};