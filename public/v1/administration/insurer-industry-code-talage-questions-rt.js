'use strict';

const serverHelper = global.requireRootPath('server.js');

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getInsurerIndustryCodeQuestions(req, res, next){
    if(!req.query || !req.query.insurerIndustryCodeId){
        return next(serverHelper.requestError('Bad Request: No insurerIndustryCodeId provided'));
    }

    // Define a query to get a list of questions, given a insurerIndustryCodeId
    const qIndustryCodeSQL = `
            SELECT * FROM clw_talage_questions
            WHERE id IN (
                SELECT DISTINCT talageQuestionId 
                FROM clw_talage_industry_code_questions
                WHERE insurerIndustryCodeId = ${db.escape(req.query.insurerIndustryCodeId)}
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
    server.addGetAuthAdmin('GET Question Insurer Industry Codes list', `${basePath}/insurer-industry-code-talage-questions`, getInsurerIndustryCodeQuestions, 'administration', 'all');
};