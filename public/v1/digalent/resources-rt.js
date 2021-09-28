/* eslint-disable default-case */
/* eslint-disable object-curly-newline */
/* eslint-disable require-jsdoc */

"use strict";
const serverHelper = require("../../../server.js");
// const validator = global.requireShared("./helpers/validator.js");
const ApplicationBO = global.requireShared("models/Application-BO.js");
// const AgencyBO = global.requireShared('models/Agency-BO.js');
// const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
// const ApplicationQuoting = global.requireRootPath('quotesystem/models/Application.js');
// const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');
const ActivityCodeSvc = global.requireShared('services/activitycodesvc.js');
const ZipCodeBO = global.requireShared("models/ZipCode-BO.js");

const policyHelper = require("./resource-building/policies");
const requirementHelper = global.requireShared('./services/required-app-fields-svc.js');
// dummy endpoint to stimulate resources
async function getResources(req, res, next){
    // Let basic through with no app id
    if (!req.query.page || !req.query.appId && req.query.page !== "_basic") {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }

    if(req.userTokenData.applicationId !== req.query.appId){
        log.warn("Unauthorized attempt to access Application resources" + __location);
        res.send(403);
        return;
    }

    // This endpoint recieves application Id, we should be able to utilize that to make this endpoint smart, i.e. agencyId for the application to determine policy limits
    const resources = {};

    switch(req.query.page) {
        case "_basic":
        case "_basic-created":
            break;
        case "_policies":
            await policyHelper.populatePolicyResources(resources, req.query.appId);
            break;
        case "_business-questions":
            membershipTypes(resources);
            entityTypes(resources);
            resources.requiredAppFields = await requirementHelper.requiredFields(req.query.appId);
            break;
        case "_business":
            break;
        case "_claims":
            policyHelper.policyTypes(resources);
            break;
        case "_locations":
            territories(resources);
            employeeTypes(resources);
            unemploymentNumberStates(resources);
            resources.requiredAppFields = await requirementHelper.requiredFields(req.query.appId);
            break;
        case "_mailing-address":
            territories(resources);
            break;
        case "_officers":
            officerTitles(resources);
            await officerEmployeeTypes(resources, req.query.appId);
            resources.requiredAppFields = await requirementHelper.requiredFields(req.query.appId);
            break;
        case "_quotes":
            territories(resources);
            break;
    }

    res.send(200, resources);
}
const officerEmployeeTypes = async(resources, appId) => {
    const applicationBO = new ApplicationBO();
    const applicationDB = await applicationBO.getById(appId);

    let activityCodes = [];
    if(applicationDB){
        try{
            // use the zipcode from the primary location
            const zipCodeBO = new ZipCodeBO();
            const primaryLocation = applicationDB.locations?.find(loc => loc.billing);
            const zipCodeData = await zipCodeBO.loadByZipCode(primaryLocation?.zipcode);

            // get the activity codes for the territory of the zipcode provided
            activityCodes = await ActivityCodeSvc.GetActivityCodes(zipCodeData?.state, applicationDB.industryCodeId);

            // filter it down to only suggested activity codes
            activityCodes = activityCodes.filter(ac => ac.suggested);
        }
        catch(err){
            log.warn(`Failed to fetch suggested activity codes. ${err} ` + __location);
        }
    }
    // make sure that we have atleast clerical employee type
    const officeEmployeeActivityCodeId = 2869;
    const hasOfficeEmployeeCode = activityCodes.some(code => code.activityCodeId === officeEmployeeActivityCodeId);
    if(hasOfficeEmployeeCode !== true){
        log.debug(`No officer activity codes returned so pushing Office Employees to the list of codes. ${__location}`);
        activityCodes.push({
            description: "Office Employees",
            activityCodeId: 2869
        });
    }
    resources.officerEmployeeTypes = activityCodes;
}
const membershipTypes = resources => {
    resources.membershipTypes = ['Nevada Resturant Association'];
}

const unemploymentNumberStates = resources => {
    resources.unemploymentNumberStates = [
        "CO",
        "HI",
        "ME",
        "MI",
        "MN",
        "NJ",
        "RI",
        "UT"
    ];
}

const officerTitles = resources => {
    // TODO: pull from officer_titles BO
    resources.officerTitles =
    [
        "Chief Executive Officer",
        "Chief Financial Officer",
        "Chief Operating Officer",
        "Director",
        "Vice President",
        "Executive Vice President",
        "Executive Secy-VP",
        "Executive Secretary",
        "Treasurer",
        "Secy-Treas",
        "Secretary",
        "President",
        "Pres-VP-Secy-Treas",
        "Pres-VP-Secy",
        "Pres-VP",
        "Pres-Treas",
        "Pres-Secy-Treas",
        "Pres-Secy",
        "VP-Treas",
        "VP-Secy-Treas",
        "VP-Secy"
    ];
}

const employeeTypes = resources => {
    resources.employeeTypes =
    [
        "Full Time",
        "Part Time",
        "Owners",
        "Contractors (1099)"
    ];
}

const entityTypes = resources => {
    resources.entityTypes =
    [
        "Association",
        "Corporation",
        "Limited Liability Company",
        "Limited Partnership",
        "Partnership",
        "Sole Proprietorship",
        "Other"
    ];
}

const territories = resources => {
    resources.territories =
    [
        "AK",
        "AL",
        "AR",
        "AZ",
        "CA",
        "CO",
        "CT",
        "DC",
        "DE",
        "FL",
        "GA",
        "HI",
        "IA",
        "ID",
        "IL",
        "IN",
        "KS",
        "KY",
        "LA",
        "MA",
        "MD",
        "ME",
        "MI",
        "MN",
        "MO",
        "MS",
        "MT",
        "NC",
        "ND",
        "NE",
        "NH",
        "NJ",
        "NM",
        "NV",
        "NY",
        "OH",
        "OK",
        "OR",
        "PA",
        "PR",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VA",
        "VT",
        "WA",
        "WI",
        "WV",
        "WY"
    ];
}

async function getRemoteAddress(req, res, next){
    const remoteAdd = req.connection.remoteAddress;
    if(!remoteAdd){
        next(serverHelper.requestError(`Unable to detect the remote address.`));
        return;
    }
    res.send(200, {remoteAddress: req.connection.remoteAddress});
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthQuoteApp("Get Next Route", `${basePath}/resources`, getResources);
    server.addGetAuthQuoteApp("Get IP Info", `${basePath}/remote-address`, getRemoteAddress);
}