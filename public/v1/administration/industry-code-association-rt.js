/* eslint-disable object-property-newline */
/* eslint-disable block-scoped-var */
/* eslint-disable object-curly-newline */
/* eslint-disable dot-location */
/* eslint-disable prefer-const */
/* eslint-disable guard-for-in */
/* eslint-disable require-jsdoc */
'use strict';

const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const ActivityCodeBO = global.requireShared('./models/ActivityCode-BO.js');
const serverHelper = global.requireRootPath('server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

async function findAll(req, res, next) {
    let error = null;
    //must have talageIndustryCodeId in query
    if(req.query.talageIndustryCodeId){
        const industryCodeBO = new IndustryCodeBO();
        const icId = parseInt(req.query.talageIndustryCodeId,10);
        const icDoc = await industryCodeBO.getById(icId).catch((err) => {
            error = err;
        });
        if (error) {
            return next(error);
        }

        if(icDoc && icDoc.activityCodeIdList && icDoc.activityCodeIdList.length > 0){
            const activityCodeBO = new ActivityCodeBO();
            const query = {activityCodeId: icDoc.activityCodeIdList}
            const acList = await activityCodeBO.getList(query).catch((err) => {
                error = err;
            });
            if (error) {
                return next(error);
            }
            res.send(200, acList);
            return next();
        }
        else {
            res.send(200, []);
            return next();
        }
    }
    else {
        res.send(400);
        return next(serverHelper.notFoundError('Missing required parameter'));
    }

}

// async function findOne(req, res, next) {
//     res.send(400);
//         return next(serverHelper.notFoundError('Missing required parameter'));
// }

async function add(req, res, next) {
    log.debug("industry code association post " + JSON.stringify(req.body));
    // Validate -- TODO include integer checks.
    if(!req.body.industryCodeId){
        return next(serverHelper.requestError("bad missing industryCodeId"));
    }
    if(!req.body.activityCodeId){
        return next(serverHelper.requestError("bad missing activityCodeId"));
    }
    let error = null;
    const industryCodeBO = new IndustryCodeBO();
    const returnMongooseModel = true;
    const icDoc = await industryCodeBO.getById(req.body.industryCodeId, returnMongooseModel).catch((err) => {
        error = err;
    });
    if (error) {
        return next(error);
    }
    if(icDoc.activityCodeIdList.indexOf(req.body.activityCodeId) === -1){
        icDoc.activityCodeIdList.push(req.body.activityCodeId);
        await icDoc.save();
    }
    const activityCodeBO = new ActivityCodeBO();
    const acDoc = await activityCodeBO.getById(req.body.activityCodeId).catch((err) => {
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, acDoc);
    return next();
}

async function deleteObject(req, res, next) {
    log.debug("industry code association delete " + JSON.stringify(req.body));
    let error = null;
    const industryCodeBO = new IndustryCodeBO();
    const returnMongooseModel = true;
    const icDoc = await industryCodeBO.getById(req.body.industryCodeId, returnMongooseModel).catch((err) => {
        error = err;
    });
    if (error) {
        return next(error);
    }
    //const activityCodeId = req.body.activityCodeId;
    if(icDoc.activityCodeIdList.indexOf(req.body.activityCodeId) > -1){
        const index = icDoc.activityCodeIdList.indexOf(req.body.activityCodeId)
        icDoc.activityCodeIdList.splice(index, 1);
        await icDoc.save();
    }
    res.send(200, {"success": true});
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    // We require the 'administration.read' permission
    server.addGetAuthAdmin('GET Question Answer list', `${basePath}/industry-code-association`, findAll, 'TalageMapper', 'all');
    // does not make sense
    //server.addGetAuthAdmin('GET Question Answer Object', `${basePath}/industry-code-association/:id`, findOne, 'administration', 'all');
    server.addPostAuthAdmin('POST Question Answer Object', `${basePath}/industry-code-association`, add, 'TalageMapper', 'all');
    // server.addPutAuthAdmin('PUT Question Answer Object', `${basePath}/industry-code-association/:id`, update, 'administration', 'all');
    server.addDeleteAuthAdmin('DELETE Question Answer', `${basePath}/industry-code-association`, deleteObject, 'TalageMapper', 'all');
};