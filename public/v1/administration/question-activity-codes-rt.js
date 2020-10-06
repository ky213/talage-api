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
async function getQuestionActivityCodes(req, res, next){
    if(!req.query || !req.query.question){
        return next(serverHelper.requestError('Bad Request: No question provided'));
    }

    // Define a query to get a list of activity codes, given a question
    const qActivityCodeSQL = `
            SELECT DISTINCT
            clw_talage_activity_codes.id,
            clw_talage_activity_codes.description
            FROM clw_talage_activity_codes
            INNER JOIN (
                SELECT 
                clw_talage_activity_code_associations.insurer_code,
                clw_talage_activity_code_associations.code
                FROM clw_talage_activity_code_associations
                INNER JOIN (
                    SELECT 
                    clw_talage_insurer_ncci_codes.id, 
                    clw_talage_insurer_ncci_codes.insurer
                    from clw_talage_insurer_ncci_codes
                    INNER JOIN (
                        SELECT DISTINCT
                        ncci_code 
                        FROM clw_talage_insurer_ncci_code_questions 
                        WHERE question = ${db.escape(req.query.question)}
                    ) b
                    ON clw_talage_insurer_ncci_codes.id = b.ncci_code
                ) c
                ON c.id = clw_talage_activity_code_associations.insurer_code
            ) d
            ON d.code = clw_talage_activity_codes.id
            WHERE state = 1
            ORDER BY clw_talage_activity_codes.id ASC
		`;

    // Get the agencies from the database
    const qActivityCodes = await db.query(qActivityCodeSQL).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Return the response
    res.send(200, qActivityCodes);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Question Activity Codes list', `${basePath}/question-activity-codes`, getQuestionActivityCodes, 'administration', 'all');
};