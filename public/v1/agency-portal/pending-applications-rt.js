/* eslint-disable array-element-newline */
/* eslint-disable object-property-newline */
/* eslint-disable object-curly-newline */
/* eslint-disable no-extra-parens */
'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');

const AgencyBO = global.requireShared('./models/Agency-BO.js');
const IndustryCodeBO = global.requireShared('./models/IndustryCode-BO.js');
const ApplicationUploadBO = global.requireShared('./models/ApplicationUpload-BO.js');

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getPendingApplications(req, res, next){
    try{
        log.debug(`AP getApplications parms ${JSON.stringify(req.params)}` + __location);
        let isGlobalViewMode = false;
        const query = {active: true};
        const agencyNetworkId = parseInt(req.authentication.agencyNetworkId, 10);
        const orClauseArray = [];
        const productTypeList = ["WC","GL", "BOP", "CYBER", "PL"];
        if (req.params.searchText && req.params.searchText.length > 1){
            if(productTypeList.indexOf(req.params.searchText.toUpperCase()) > -1){
                orClauseArray.push({"policies.policyType":  req.params.searchText.toUpperCase()})
            }
            const industryCodeBO = new IndustryCodeBO();
            const industryCodeQuery = {};
            if(req.params.searchText.length > 2){
                industryCodeQuery.description = req.params.searchText
                const industryCodeList = await industryCodeBO.getList(industryCodeQuery);
                if (industryCodeList && industryCodeList.length > 0) {
                    const industryCodeIdArray = [];
                    for (const industryCode of industryCodeList) {
                        industryCodeIdArray.push(industryCode.id);
                    }
                    const industryCodeListFilter = {industryCode: {$in: industryCodeIdArray}};
                    orClauseArray.push(industryCodeListFilter);
                }
            }
            req.params.searchText = req.params.searchText.toLowerCase();
            const businessName = {businessName: `%${req.params.searchText}%`}
            const dba = {dba: `%${req.params.searchText}%`}
            orClauseArray.push(businessName);
            orClauseArray.push(dba);
            const mailingCity = {mailingCity: `%${req.params.searchText}%`}
            orClauseArray.push(mailingCity);
            if(req.params.searchText.length === 2){
                const mailingState = {mailingState: `%${req.params.searchText}%`}
                orClauseArray.push(mailingState);
            }
            if(req.params.searchText.length > 2){
                const uuid = {uuid: `%${req.params.searchText}%`}
                orClauseArray.push(uuid);
                const agencyCode = {agencyCode: `%${req.params.searchText}%`}
                orClauseArray.push(agencyCode);
            }
            if(isNaN(req.params.searchText) === false && req.params.searchText.length > 3){
                const testInteger = Number(req.params.searchText);
                if(Number.isInteger(testInteger)){
                    const mysqlId = {mysqlId: testInteger}
                    const mailingZipcode = {mailingZipcode: `${req.params.searchText}%`}
                    orClauseArray.push(mysqlId);
                    orClauseArray.push(mailingZipcode);
                }
            }
        }
        if(req.authentication.isAgencyNetworkUser){
            const agencyQuery = {
                doNotReport: true
            }
            if(req.authentication.isAgencyNetworkUser && agencyNetworkId === 1
                && req.authentication.permissions.talageStaff === true
                && req.authentication.enableGlobalView === true){
                isGlobalViewMode = true;
                if(req.body.agencyNetworkId){
                    query.agencyNetworkId = !isNaN(req.params.agencyNetworkId) ? parseInt(`${req.params.agencyNetworkId}`,10) : -1;
                }
            }
            else {
                query.agencyNetworkId = agencyNetworkId;
                agencyQuery.agencyNetworkId = agencyNetworkId
            }
            const agencyBO = new AgencyBO();
            const donotReportAgencyIdArray = [];
            const noReportAgencyList = await agencyBO.getByAgencyNetworkDoNotReport(agencyNetworkId);
            if(noReportAgencyList && noReportAgencyList?.length > 0){
                for(const agencyJSON of noReportAgencyList){
                    donotReportAgencyIdArray.push(agencyJSON.systemId);
                }
                if (donotReportAgencyIdArray?.length > 0) {
                    if(query.agencyId){
                        query.agencyId = {$nin: donotReportAgencyIdArray, $eq: query.agencyId}
                    }
                    else {
                        query.agencyId = {$nin: donotReportAgencyIdArray};
                    }
                }
            }
            if(req.params.searchText?.length > 2){
                agencyQuery.name = req.params.searchText + "%"
                agencyQuery.doNotReport = false;
                const noActiveCheck = true;
                const donotGetAGencyNetowork = false;
                const agencyList = await agencyBO.getList(agencyQuery,donotGetAGencyNetowork, noActiveCheck);
                if (agencyList && agencyList?.length > 0) {
                    let agencyIdArray = [];
                    for (const agency of agencyList) {
                        agencyIdArray.push(agency.systemId);
                        if(agencyIdArray?.length > 100){
                            log.debug(`Get Agency maxed out agency filter` + __location)
                            break;
                        }
                    }
                    agencyIdArray = agencyIdArray.filter(function(value){
                        return donotReportAgencyIdArray.indexOf(value) === -1;
                    });
                    const agencyListFilter = {agencyId: {$in: agencyIdArray}};
                    orClauseArray.push(agencyListFilter);
                }
                else {
                    log.debug("Application Search no agencies found " + __location);
                }
            }
        }
        else {
            const agents = await auth.getAgents(req);
            if(agents?.length > 0) {
                query.agencyId = agents[0];
            }
        }
        const requestParams = JSON.parse(JSON.stringify(req.params));
        const applicationUploadBO = new ApplicationUploadBO();
        const applicationsSearchCount = await applicationUploadBO.getList(query, orClauseArray, {count: 1});
        const applicationList = await applicationUploadBO.getList(query, orClauseArray, requestParams, isGlobalViewMode);
        if(applicationList?.length > 0) {
            res.send({
                "applications": applicationList,
                "applicationsSearchCount": applicationsSearchCount
            });
        }
        else {
            res.send({
                "applications": [],
                "applicationsSearchCount": 0
            });
        }
        return next();
    }
    catch(err){
        log.error("AP get Pending App list error " + err + __location);
        return next(err);
    }
}

/**
 * Responds to get requests for the applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function moveToApplication(req, res, next){
    try {
        if(!req.params?.id) {
            return next(serverHelper.requestError('Bad Request: missing pending application id'));
        }
        const pendingApplicationId = req.params.id;
        const applicationUploadBO = new ApplicationUploadBO();
        await applicationUploadBO.moveToApplication(pendingApplicationId);
        res.send(200, "Move successful");
    }
    catch(error) {
        log.error("API server error: " + error + __location);
        res.send(500, error);
    }
}

/**
 * Responds to delete requests for the pending applications endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function deletePendingApplication(req, res, next){
    try {
        if(!req.params?.id) {
            return next(serverHelper.requestError('Bad Request: missing pending application id'));
        }
        const pendingApplicationId = req.params.id;
        const applicationUploadBO = new ApplicationUploadBO();
        await applicationUploadBO.deleteSoftById(pendingApplicationId);
        res.send(200, "Delete successful");
    }
    catch(error) {
        log.error("API server error: " + error + __location);
        res.send(500, error);
    }
}

exports.registerEndpoint = (server, basePath) => {
    server.addPutAuth('Move pending application', `${basePath}/pending-application/move/:id`, moveToApplication, 'applications', 'manage');
    server.addDeleteAuth('Delete pending application', `${basePath}/pending-application/:id`, deletePendingApplication, 'applications', 'manage');
    server.addPostAuth('Get pending applications', `${basePath}/pending-applications`, getPendingApplications, 'applications', 'view');
};
