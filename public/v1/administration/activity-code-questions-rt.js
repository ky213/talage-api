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
async function getActivityCodeQuestions(req, res, next){
    if(!req.query || !req.query.activityCode){
        return next(serverHelper.requestError('Bad Request: No activityCode provided'));
    }

    // Define a query to get a list of questions, given an activityCode
    const activityCodeQuestionsSQL = `
            SELECT DISTINCT
            clw_talage_questions.id,
            clw_talage_questions.question,
            clw_talage_questions.state
            FROM clw_talage_questions
            INNER JOIN (
                SELECT 
                clw_talage_insurer_ncci_code_questions.id,
                clw_talage_insurer_ncci_code_questions.question
                FROM clw_talage_insurer_ncci_code_questions
                INNER JOIN (
                    SELECT 
                    clw_talage_activity_code_associations.code, 
                    clw_talage_activity_code_associations.insurer_code
                    FROM clw_talage_activity_code_associations
                    INNER JOIN (
                        SELECT DISTINCT
                        * 
                        FROM clw_talage_activity_codes 
                        WHERE id = ${db.escape(req.query.activityCode)}
                    ) ac
                    ON ac.id = clw_talage_activity_code_associations.code
                ) ac_aca
                ON ac_aca.insurer_code = clw_talage_insurer_ncci_code_questions.ncci_code
            ) ac_aca_inc_incq
            ON ac_aca_inc_incq.question = clw_talage_questions.id
            WHERE state > 0
            ORDER BY clw_talage_questions.id ASC
		`;

    // Get the agencies from the database
    const questions = await db.query(activityCodeQuestionsSQL).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Return the response
    res.send(200, questions);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Activity Code Questions list', `${basePath}/activity-code-questions`, getActivityCodeQuestions, 'administration', 'all');
};