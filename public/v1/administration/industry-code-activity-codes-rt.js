const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const ActivityCodeBO = global.requireShared('./models/ActivityCode-BO.js');
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
    const industryCodeBO = new IndustryCodeBO();
    const icDoc = await industryCodeBO.getById(industryCodeId).catch(function(err){
        log.error(err.message + __location);
        res.send(500, 'Error retrieving activity codes related to an industry code.');
        return next(serverHelper.internalError('Error retrieving activity codes related to an industry code.'));
    });

    if(icDoc && icDoc.activityCodeIdList && icDoc.activityCodeIdList.length > 0){
        const activityCodeBO = new ActivityCodeBO();
        const query = {activityCodeId: icDoc.activityCodeIdList}
        const acList = await activityCodeBO.getList(query).catch(function(err){
            log.error(err.message + __location);
            res.send(500, 'Error retrieving activity codes related to an industry code.');
            return next(serverHelper.internalError('Error retrieving activity codes related to an industry code.'));
        });
        res.send(200, acList);
        return next();
    }
    else {
        res.send(200, []);
        return next();
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthAdmin('GET Industry Code Activity Code list', `${basePath}/industry-code-activity-codes`, getIdustryCodeActivityCodes, 'administration', 'all');
};