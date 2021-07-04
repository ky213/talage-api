'use strict';

const serverHelper = global.requireRootPath('server.js');
const questionSvc = global.requireShared('./services/questionsvc.js');
const moment = require('moment');

/**
 * Returns all questions related to given params
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getQuestions(req, res, next){

    /* ---=== Check Request Requirements ===--- */

    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.warn('Bad Request: Required data missing. Please see documentation.');
        return next(serverHelper.requestError('Required data missing. Please see documentation.'));
    }

    //log.verbose(util.inspect(req.query));

    // Make sure basic elements are present
    if (!req.query.policy_types) {
        log.warn('Bad Request: Missing Policy Types');
        return next(serverHelper.requestError('You must supply one or more policy types'));
    }

    // Make sure the proper codes were supplied
    if (req.query.policy_types.includes('BOP') || req.query.policy_types.includes('GL')) {
        if (!req.query.industry_code) {
            log.warn('Bad Request: Missing Industry Code');
            return next(serverHelper.requestError('You must supply an industry code'));
        }
    }
    if (req.query.policy_types.includes('WC')) {
        if (!req.query.activity_codes) {
            log.warn('Bad Request: Missing Activity Codes');
            return next(serverHelper.requestError('You must supply one or more activity codes'));
        }
    }

    // Make sure a zip code was provided
    if (!Object.prototype.hasOwnProperty.call(req.query, 'zips') || !req.query.zips) {
        log.warn('Bad Request: Missing Zip Codes');
        return next(serverHelper.requestError('You must supply at least one zip code'));
    }

    let questionSubjectArea = "general";
    if (req.query.questionSubjectArea) {
        questionSubjectArea = req.query.questionSubjectArea;
    }


    // Check if we should return hidden questions also
    let return_hidden = false;
    if (req.query.hidden && req.query.hidden === 'true') {
        // log.info('Returning hidden questions as well');
        return_hidden = true;
    }

    let getQuestionsResult = null;
    try{
        const policyTypeCodeList = req.query.policy_types.split(',')
        const policyTypeJSONArray = [];
        if(policyTypeCodeList && policyTypeCodeList.length > 0){
            for(let i = 0; i < policyTypeCodeList.length; i++){
                policyTypeJSONArray.push({
                    type: policyTypeCodeList[i],
                    effectiveDate: moment().add(1,"day")
                });
            }
        }


        // insurers is optional
        const insurers = req.query.insurers ? req.query.insurers.split(',') : [];

        getQuestionsResult = await questionSvc.GetQuestionsForFrontend(req.query.activity_codes.split(','), req.query.industry_code, req.query.zips.split(','), policyTypeJSONArray, insurers, questionSubjectArea, return_hidden);
    }
    catch(error){
        log.error(`Question route getQuestions error ${error} ` + __location);
        return next(serverHelper.requestError('An error occured while retrieving questions.'));
    }

    if(!getQuestionsResult){
        return next(serverHelper.requestError('An error occured while retrieving questions.'));
    }

    res.send(200, getQuestionsResult);
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAppApi('Get Questions', `${basePath}/list`, getQuestions);
    server.addGetAuthAppApi('Get Questions (depr)', `${basePath}/v1`, getQuestions);
};