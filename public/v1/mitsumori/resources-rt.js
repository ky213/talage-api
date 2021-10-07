/* eslint-disable default-case */
/* eslint-disable object-curly-newline */
/* eslint-disable require-jsdoc */

"use strict";
const serverHelper = require("../../../server.js");
const ApplicationBO = global.requireShared("models/Application-BO.js");
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO');
const ActivityCodeSvc = global.requireShared('services/activitycodesvc.js');
const ZipCodeBO = global.requireShared("models/ZipCode-BO.js");

const policyHelper = require("./resource-building/policies");
const requirementHelper = global.requireShared('./services/required-app-fields-svc.js');
// dummy endpoint to stimulate resources
async function getResources(req, res, next){
    // Let basic through with no app id
    const listOfInitialLandingPages = ["_basic", "_am-basic"]
    if (!req.query.page || !req.query.appId && listOfInitialLandingPages.indexOf(req.query.page) === -1) {
        log.debug('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }

    if(req.userTokenData.applicationId !== req.query.appId){
        log.warn("Unauthorized attempt to access Application resources" + __location);
        res.send(403);
        return next(serverHelper.requestError('Unauthorized'));
    }

    // This endpoint recieves application Id, we should be able to utilize that to make this endpoint smart, i.e. agencyId for the application to determine policy limits
    const resources = {};

    switch(req.query.page) {
        case "_basic":
        case "_basic-created":
        case "_am-basic":
            entityTypes(resources);
            if(req.query.agencyNetworkId){
                await agencyNetworkFeatures(resources, null, req.query.agencyNetworkId);
            }
            break;
        case "_policies":
            await policyHelper.populatePolicyResources(resources, req.query.appId);
            
            break;
        case "_business-questions":
            membershipTypes(resources);
            resources.requiredAppFields = await requirementHelper.requiredFields(req.query.appId);
            break;
        case "_business":
            break;
        case "_claims":
            policyHelper.policyTypes(resources);
            break;
        case "_locations":
        case "_am-locations":
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
            await agencyNetworkFeatures(resources, req.query.appId);
            break;
    }

    res.send(200, resources);
    return next();
}

const officerEmployeeTypes = async(resources, appId) => {
    const applicationBO = new ApplicationBO();
    const applicationDB = await applicationBO.getById(appId);

    let activityCodes = [];
    if(applicationDB){
        try{
            // use the zipcode from the primary location
            const zipCodeBO = new ZipCodeBO();
            const primaryLocation = applicationDB.locations?.find(loc => loc.primary);
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

    resources.officerEmployeeTypes = activityCodes;
}

const agencyNetworkFeatures = async(resources, appId, agencyNetworkId) => {
    let agencyNetworkDB = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    if(appId){
        const applicationBO = new ApplicationBO();
        const applicationDB = await applicationBO.getById(appId);
        if(applicationDB){
            agencyNetworkDB = await agencyNetworkBO.getById(applicationDB.agencyNetworkId);
        }
    }else {
        agencyNetworkDB = await agencyNetworkBO.getById(agencyNetworkId);
    }

    // be very explicit so any accidental set to something like "not the right value" in the admin does not enable this feature.
    const quoteAppBinding = agencyNetworkDB?.featureJson?.quoteAppBinding === true;
    const appSingleQuotePath = agencyNetworkDB?.featureJson?.appSingleQuotePath === true;
    const agencyCodeField = agencyNetworkDB?.featureJson.enableAgencyCodeField === true;
    // get the agency network features we care about here.
    resources.agencyNetworkFeatures = {
        quoteAppBinding,
        appSingleQuotePath,
        agencyCodeField
    };
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
        "VP-Secy",
        "Member",
        "Manager"
    ];
}

const employeeTypes = resources => {
    resources.employeeTypes =
    [
        "Full Time",
        "Part Time",
        "Owners"
    ];
}

const entityTypes = resources => {
    resources.entityTypes =
    [
        "Association",
        "Corporation (C-Corp)",
        "Corporation (S-Corp)",
        "Non Profit Corporation",
        "Limited Liability Company (Member Managed)",
        "Limited Liability Company (Manager Managed)",
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
        return next(serverHelper.requestError(`Unable to detect the remote address.`));
    }
    res.send(200, {remoteAddress: req.connection.remoteAddress});
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addGetAuthQuoteApp("Get Page Resources", `${basePath}/resources`, getResources);
    server.addGetAuthQuoteApp("Get IP Info", `${basePath}/remote-address`, getRemoteAddress);
}