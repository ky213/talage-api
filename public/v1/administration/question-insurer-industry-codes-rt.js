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
async function getQuestionInsurerIndustryCodes(req, res, next){
    if(!req.query || !req.query.talageQuestionId){
        return next(serverHelper.requestError('Bad Request: No talageQuestionId provided'));
    }

    // Define a query to get a list of activity codes, given a talageQuestionId
    // TODO: id might be used instead of code
    const qIndustryCodeSQL = `
            SELECT * FROM clw_talage_insurer_industry_codes
            WHERE id IN (
                SELECT DISTINCT insurerIndustryCodeId 
                FROM clw_talage_industry_code_questions 
                WHERE talageQuestionId = ${db.escape(req.query.talageQuestionId)}
            )
		`;

    // Get the agencies from the database
    const qIndustryCodes = await db.query(qIndustryCodeSQL).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Return the response
    res.send(200, qIndustryCodes);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Question Insurer Industry Codes list', `${basePath}/question-insurer-industry-codes`, getQuestionInsurerIndustryCodes, 'administration', 'all');
};