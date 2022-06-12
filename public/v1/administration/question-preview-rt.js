'use strict';

const serverHelper = global.requireRootPath('server.js');
const questionSvc = global.requireShared('./services/questionsvc.js');
const InsurerBO = global.requireShared("./models/Insurer-BO");
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
async function getQuestionsPreview(req, res, next){

    /* ---=== Check Request Requirements ===--- */

    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.warn('Bad Request: Required data missing. Please see documentation.');
        return next(serverHelper.requestError('Required data missing. Please see documentation.'));
    }

    // Make sure basic elements are present
    if (!req.query.policy_types) {
        log.warn('Bad Request: Missing Policy Types');
        return next(serverHelper.requestError('You must supply one or more policy types'));
    }

    // Make sure the proper codes were supplied
    if (req.query.policy_types.includes('BOP') || req.query.policy_types.includes('GL')) {
        if (!req.query.industry_codes) {
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
    if (!Object.prototype.hasOwnProperty.call(req.query, 'states') || !req.query.states) {
        log.warn('Bad Request: Missing States');
        return next(serverHelper.requestError('You must supply at least one state'));
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

        const insurerBO = new InsurerBO();
        const insurerQuery = {}
        const insurerDocList = await insurerBO.getList(insurerQuery);

        let insurers = [];

        if(req.query.insurers){
            insurers = req.query.insurers.split(',')
        }
        else {
            insurers = insurerDocList.map(i => i.insurerId)
        }
        getQuestionsResult = await questionSvc.GetQuestionsForBackend(req.query.activity_codes.split(','), req.query.industry_codes.split(','), [], policyTypeJSONArray, insurers, 'general', false, req.query.states.split(','));
        getQuestionsResult.forEach(function(question){
            if(question.insurerIdList?.length > 5){
                question.insurerListText = "Multiple Insurers";
            }
            else if(question.insurerIdList?.length > 0){
                const qInsurerDocList = insurerDocList.filter((i) => question.insurerIdList.indexOf(i.insurerId) > -1)
                const nameList = [];
                for(const iDoc of qInsurerDocList){
                    nameList.push(iDoc.name)
                }
                question.insurerListText = nameList.join(",");
            }
            else {
                question.insurerListText = "";
            }
        });
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
    server.addGetAuthAdmin('Get Question Preview', `${basePath}/question-preview`, getQuestionsPreview, 'TalageMapper', 'all');
};