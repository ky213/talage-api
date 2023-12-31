/* eslint-disable dot-notation */
/* eslint-disable require-jsdoc */

/**
 * Handles all tasks related to application
 */
"use strict";
const serverHelper = require("../../../server.js");
const validator = global.requireShared("./helpers/validator.js");
const ApplicationBO = global.requireShared("models/Application-BO.js");
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const ApplicationQuoting = global.requireRootPath('quotesystem/models/Application.js');
const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');
const tokenSvc = global.requireShared('./services/tokensvc.js');
const fileSvc = global.requireShared('./services/filesvc.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const LimitsBO = global.requireShared('models/Limits-BO.js');
const QuoteBind = global.requireRootPath('quotesystem/models/QuoteBind.js');
const clonedeep = require('lodash.clonedeep');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');
const requiredFieldSvc = global.requireShared('./services/required-app-fields-svc.js');

const moment = require('moment');

async function isAuthForApplication(req, applicationId){

    if(!applicationId){
        log.error(`request processing error isAuthForApplication no applicationId ` + __location)
        return false;
    }
    let canAccessApp = false;
    if(!req.userTokenData){
        log.error(`request processing error no userTokenData ` + __location)
        return false;
    }
    if(req.userTokenData && req.userTokenData.quoteApp){
        if(req.userTokenData.applicationId === applicationId){
            canAccessApp = true;
        }
    }
    else if (req.userTokenData && req.userTokenData.apiToken){
        if(req.userTokenData.userId){

            // check which agencies the user has access to
            const agencyPortalUserBO = new AgencyPortalUserBO();
            const apUser = await agencyPortalUserBO.getById(req.userTokenData.userId);
            if(apUser){
                // get the application to check against
                const applicationBO = new ApplicationBO();
                const applicationDB = await applicationBO.getById(applicationId);

                // if no application was found, just log for us and dont check anything else
                if(!applicationDB){
                    log.warn("Application requested not found " + __location);
                }
                // if the user is part of an agency network, get the list of agencies
                else if(apUser.isAgencyNetworkUser){
                    canAccessApp = applicationDB.agencyNetworkId === apUser.agencyNetworkId;
                    //log.debug(`isAuthForApplication AgencyNetwork user ${apUser.agencyNetworkId} canAccessApp ${canAccessApp} `)
                }
                // if not part of a network, just look at the single agency
                else if(apUser.agencyId) {
                    canAccessApp = applicationDB.agencyId === apUser.agencyId;
                    //log.debug(`isAuthForApplication Agencyk user ${apUser.agencyId} canAccessApp ${canAccessApp} `)
                }
                else {
                    log.warn(`user ${JSON.stringify(apUser)} attempted to access app ${applicationId}`)
                }
            }
            else {
                log.warn(`User ${req.userTokenData.userId} not found in user system` + __location);
            }
        }
        else {
            log.warn("Recieved request with token but no user id " + __location);
        }
    }
    else {
        log.warn(`Unauthorized Attempt to modify or access Application JWT type unknown  token: ${JSON.stringify(req.userTokenData)}` + __location);
    }

    if(canAccessApp === false){
        log.warn("Unauthorized Attempt to modify or access Application " + __location);
    }

    return canAccessApp;
}


async function isAuthForAgency(req, agencyId, agencyJSON = null){
    let canAccessAgency = false;
    if(!req.userTokenData){
        log.error(`request processing error no userTokenData ` + __location)
        return false;
    }
    //handle quote app adding an application
    if(req.userTokenData && req.userTokenData.quoteApp && !req.userTokenData.applicationId){
        log.debug(`isAuthForAgency passed for Quote App Post  ` + __location)
        return true;
    }


    if(!agencyJSON){
        try {
            //TODO check rights to agency.
            const agencyBO = new AgencyBO();
            agencyJSON = await agencyBO.getById(agencyId);
            if (!agencyJSON) {
                return false;
            }
        }
        catch (err) {
            log.error(`Application Save get agencyNetworkId  agencyID: ${req.body.agencyId} ` +
                    err +
                    __location);
            return false;
        }
    }


    if (req.userTokenData && req.userTokenData.apiToken){
        if(req.userTokenData.userId){
            // check which agencies the user has access to
            const agencyPortalUserBO = new AgencyPortalUserBO();
            const apUser = await agencyPortalUserBO.getById(req.userTokenData.userId);
            if(apUser){
                //Is talage super user......
                if(apUser.agencyNetworkId === 1 && apUser.isAgencyNetworkUser === true && apUser.agencyPortalUserGroupId === 6){
                    log.debug(`isAuthForAgency passed for Talage Super User ` + __location)
                    canAccessAgency = true
                }
                else if(apUser.isAgencyNetworkUser === true && apUser.agencyNetworkId === agencyJSON.agencyNetworkId && apUser.agencyNetworkId > 0){
                    log.debug(`isAuthForAgency passed for Agency Network Check ` + __location)
                    canAccessAgency = true
                }
                if(apUser.agencyId === agencyId){
                    log.debug(`isAuthForAgency passed for Agency Check ` + __location)
                    canAccessAgency = true
                }

            }
            else {
                log.warn(`User ${req.userTokenData.userId} not found in user system` + __location);
            }
        }
        else {
            log.warn("Recieved request with token but no user id " + __location);
        }
    }
    else {
        log.warn(`Unauthorized Attempt to modify or access Application JWT type unknown  token: ${JSON.stringify(req.userTokenData)}` + __location);
    }

    if(canAccessAgency === false){
        log.warn("Unauthorized Attempt to modify or access Application " + __location);
    }

    return canAccessAgency;
}


async function applicationSave(req, res, next) {
    // log.debug("Application Post: " + JSON.stringify(req.body));

    //Does user have rights to manage applications
    if(!req.userTokenData.quoteApp && !(req.userTokenData?.apiToken && req.userTokenData?.permissions?.applications?.manage === true)){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    if (!req.body || typeof req.body !== "object") {
        log.error("Bad Request: No data received " + __location);
        return next(serverHelper.requestError("Bad Request: No data received"));
    }

    //Why are we doing this check? -BP
    if (!req.body.applicationId && !req.body.uuid && req.body.id) {
        log.error("Bad Request: Missing applicationId " + __location);
        return next(serverHelper.requestError("Bad Request: Missing applicationId"));
    }

    //uuid -> applicationId
    if (!req.body.applicationId && req.body.uuid) {
        req.body.applicationId = req.body.uuid;
    }

    const applicationBO = new ApplicationBO();

    //Insert checks
    if (!req.body.applicationId) {
        log.debug(`API Saving new application`);

        // Auto added agencyId for agency level user. (or overwrite)
        if(!req.userTokenData.quoteApp && req.userTokenData?.apiToken && !req.userTokenData.isAgencyNetworkUser){
            if(req.userTokenData.agencyId){
                req.body.agencyId = req.userTokenData.agencyId
            }
            else {
                return next(serverHelper.forbiddenError(`Not Authorized`));
            }
        }
        //Required fields for an insert.
        // eslint-disable-next-line array-element-newline
        const requiredPropertyList = ["agencyId", "businessName"];
        for (let i = 0; i < requiredPropertyList.length; i++) {
            if (!req.body[requiredPropertyList[i]]) {
                log.error(`Bad Request: Missing ${requiredPropertyList[i]}` + __location);
                return next(serverHelper.requestError(`Bad Request: Missing ${requiredPropertyList[i]}`));
            }
        }

        //Get AgencyNetworkID
        let hasAccessToAgency = false;
        try {
            //check rights to agency.
            const agencyBO = new AgencyBO();
            const agencyDB = await agencyBO.getById(req.body.agencyId);
            if(agencyDB){
                hasAccessToAgency = await isAuthForAgency(req,req.body.agencyId, agencyDB)
            }
            else {
                log.warn("Application Save agencyId not found in db " +
                        req.body.agencyId +
                        __location);
                return next(serverHelper.requestError("Not Found Agency"));
            }
            if(hasAccessToAgency){
                if (!req.body.agencyNetworkId) {
                    req.body.agencyNetworkId = agencyDB.agencyNetworkId;
                }
                else if(req.body.agencyNetworkId !== agencyDB.agencyNetworkId){
                    hasAccessToAgency = false;
                }
            }
            else {
                log.warn("Application Save agencyId access denied " +
                        req.body.agencyId +
                        __location);
            }
        }
        catch (err) {
            log.error(`Application Save get agencyNetworkId  agencyID: ${req.body.agencyId} ` +
                    err +
                    __location);
            return next(serverHelper.internalError("error checking agency"));
        }
        if(!hasAccessToAgency){
            res.send(400, "Bad Agency information");
            return next();
        }

        //if agencyLocationId is not sent for insert get primary
        if (!req.body.agencyLocationId) {
            log.info(`API AppSave setting agencyLocationId to primary ` + __location);
            const agencyLocationBO = new AgencyLocationBO();
            const locationPrimaryJSON = await agencyLocationBO.
                getByAgencyPrimary(req.body.agencyId).
                catch(function(err) {
                    log.error(`Error getting Agency Primary Location ${req.body.agencyId} ` +
                            err +
                            __location);
                });
            if (locationPrimaryJSON && locationPrimaryJSON.systemId) {
                req.body.agencyLocationId = locationPrimaryJSON.systemId;
            }
        }
        //referrer check - if nothing sent set to API.
        if(!req.body.referrer){
            req.body.referrer = "API";
            if(req.body.agencyPortalCreatedUser !== "system"){
                req.body.agencyPortalCreatedUser = req.userTokenData.userId
            }
            req.body.apiCreated = true;
        }
    }
    else {
        // Need to now if we get locations for the first thiem
        //get application and valid agency
        // check JWT has access to this application.
        const rightsToApp = await isAuthForApplication(req, req.body.applicationId);
        if(rightsToApp !== true){
            return next(serverHelper.forbiddenError(`Not Authorized`));
        }
        try {
            const applicationDB = await applicationBO.getById(req.body.applicationId);
            if (!applicationDB) {
                return next(serverHelper.requestError("Not Found"));
            }
            //check appStatusId to see if updating is allowed.  not allow updating if quoting or >= referred.

            //Only allow DEAD status to be set via the API.

            //cannot be udpated via API
            const changeNotUpdateList = [
                "abandonedEmail",
                "abandonedAppEmail",
                "optedOutOnlineEmailsent",
                "optedOutOnline",
                "stoppedAfterPricingEmailSent",
                "stoppedAfterPricing",
                "processStateOld",
                "solepro",
                "wholesale",
                "progress",
                "status",
                "referrer",
                "einEncrypted",
                "einEncryptedT2",
                "einHash",
                "businessDataJSON",
                "agencyPortalCreatedUser",
                "agencyPortalModifiedUser",
                "quotingStartedDate",
                "metrics",
                "handledByTalage",
                "copiedFromAppId",
                "renewal",
                "pricingInfo"
            ]

            for (let i = 0; i < changeNotUpdateList.length; i++) {
                if (req.body.hasOwnProperty(changeNotUpdateList[i])) {
                    delete req.body[changeNotUpdateList[i]];
                }
            }

        }
        catch (err) {
            log.error("Error checking application doc " + err + __location);
            return next(serverHelper.requestError(`Bad Request: check error ${err}`));
        }
    }

    // TODO: should the name be more ambiguous or is this a good name?
    let refreshToken = false;
    if(req.body.refreshToken){
        refreshToken = true;
        delete req.body.refreshToken;
    }

    let responseAppDoc = null;
    try {
        //const updateMysql = false;

        // if activityPayrollList exists, populate activityCode data from it
        // extract location part_time_employees and full_time_employees from location payroll data.
        const activityCodes = [];
        if (req.body.locations && req.body.locations.length) {
            req.body.locations.forEach((location) => {
                let fteCount = 0;
                let pteCount = 0;
                // make sure we have an activityPayrollList to check
                if(location.activityPayrollList){
                    location.activityPayrollList.forEach(activityCode => {
                        //check if using new JSON
                        if(!activityCode.activtyCodeId){
                            activityCode.activtyCodeId = activityCode.ncciCode;
                        }
                        if(activityCode.employeeTypeList){
                            activityCode.payroll = activityCode.employeeTypeList.reduce((total, type) => {
                            // use the functionality of reduce to double as forEach to calculate employment totals
                                if (type.employeeType === "Full Time") {
                                    fteCount += parseInt(type.employeeTypeCount, 10);
                                }
                                else if (type.employeeType === "Part Time") {
                                    pteCount += parseInt(type.employeeTypeCount, 10);
                                }
                                return total + parseInt(type.employeeTypePayroll, 10);
                            }, 0);
                        }

                        // if another location had this activity, just add to the total payroll
                        const foundCode = activityCodes.find((code) => code.activityCodeId === activityCode.activityCodeId);
                        if (foundCode) {
                            foundCode.payroll += parseInt(activityCode.payroll, 10);
                        }
                        else if(activityCode.payroll && activityCode.activityCodeId) {

                            const newActivityCode = {
                                activityCodeId: activityCode.activityCodeId,
                                ncciCode: activityCode.ncciCode,
                                payroll: activityCode.payroll
                            };
                            activityCodes.push(newActivityCode);
                        }
                    });
                    if(fteCount !== 0){
                        location.full_time_employees = fteCount;
                    }
                    if(pteCount !== 0){
                        location.part_time_employees = pteCount;
                    }
                }
            });
        }
        // assign our list if activityCodes was populated
        if(activityCodes.length > 0){
            req.body.activityCodes = activityCodes;
        }

        if (req.body.applicationId) {
            log.debug("App Doc UPDATE.....");
            responseAppDoc = await applicationBO.updateMongo(req.body.applicationId,
                req.body);
        }
        else {
            //insert.
            //TODO if API (not quote app) we want the real user stored.
            log.debug("App Doc INSERT.....");
            if(!req.body.agencyPortalCreatedUser){
                req.body.agencyPortalCreatedUser = "applicant";
                req.body.agencyPortalCreated = false;
            }
            if(!req.body.agencyPortalCreated){
                req.body.agencyPortalCreated = false;
            }
            if(!req.body.apiCreated){
                req.body.apiCreated = false;
            }


            responseAppDoc = await applicationBO.insertMongo(req.body);

            // update JWT
            if(responseAppDoc && req.userTokenData && req.userTokenData.quoteApp){
                try{
                    const newToken = await tokenSvc.createApplicationToken(req, responseAppDoc.applicationId);
                    if(newToken){
                        responseAppDoc.token = newToken;
                    }
                }
                catch(err){
                    log.error(`Error Create JWT with ApplicationId ${responseAppDoc.applicationId} ${err}` + __location);
                }

            }
            else {
                //API request do create newtoken
                // add application to Redis for JWT
                try{
                    const newToken = await tokenSvc.addApplicationToToken(req, responseAppDoc.applicationId);
                    if(newToken){
                        responseAppDoc.token = newToken;
                    }
                }
                catch(err){
                    log.error(`Error Create JWT with ApplicationId ${responseAppDoc.applicationId} ${err}` + __location);
                }
            }
        }
    }
    catch (err) {
        //mongoose parse errors will end up there.
        log.error("Error saving application " + err + __location);
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
    }
    await setupReturnedApplicationJSON(responseAppDoc);

    // if they ask for a new token (refreshToken: "please") or... true
    // set up and attach a refreshed token.
    try{
        if(refreshToken){
            const newToken = await tokenSvc.refreshToken(req);
            if(newToken){
                responseAppDoc.token = newToken;
            }
            else {
                log.debug(`No RefreshToken was created for with ApplicationId ${responseAppDoc.applicationId} NULL returned` + __location);
            }
        }
    }
    catch(err){
        log.error(`Error Creating RefreshToken with ApplicationId ${responseAppDoc.applicationId} ${err}` + __location);
    }

    if (responseAppDoc) {
        res.send(200, responseAppDoc);
        return next();
    }
    else {
        res.send(500, "No updated document");
        return next(serverHelper.internalError("No updated document"));
    }
}


async function applicationLocationSave(req, res, next) {
    log.debug("Application Location Post: " + JSON.stringify(req.body));
    if (!req.body || typeof req.body !== "object") {
        log.error("Bad Request: No data received " + __location);
        return next(serverHelper.requestError("Bad Request: No data received"));
    }

    if (!req.body.applicationId) {
        log.error("Bad Request: Missing applicationId " + __location);
        return next(serverHelper.requestError("Bad Request: Missing applicationId"));
    }

    if (!req.body.location) {
        log.error("Bad Request: Missing location object " + __location);
        return next(serverHelper.requestError("Bad Request: Missing location"));
    }

    const applicationBO = new ApplicationBO();
    let applicationDB = null;
    //get application and valid agency
    // check JWT has access to this application.
    const rightsToApp = await isAuthForApplication(req, req.body.applicationId)
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    try {
        const applicationDocDB = await applicationBO.getById(req.body.applicationId);
        if (!applicationDocDB) {
            return next(serverHelper.requestError("Not Found"));
        }
        if(applicationDocDB.agencyLocationId){
            log.debug(`applicationLocationSave  - app load - applicationDB.agencyLocationId ${applicationDocDB.agencyLocationId}` + __location)
        }
        //make applicationDB pure JSON not a mongoose doc it gets from getById so we can add things.
        applicationDB = JSON.parse(JSON.stringify(applicationDocDB));
    }
    catch (err) {
        log.error("Error checking application doc " + err + __location);
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }
    let responseAppDoc = null;
    try {
        if(applicationDB){
            const reqLocation = req.body.location

            //check
            if(reqLocation.locationId){
                if(req.body.delete === true){
                    const newLocationList = applicationDB.locations.filter(function(locationDB){
                        return locationDB.locationId !== reqLocation.locationId;
                    });
                    applicationDB.locations = newLocationList;
                }
                else {
                    //update
                    for(const locationDB of applicationDB.locations){
                        if(locationDB.locationId === reqLocation.locationId){
                            const doNotUpdateList = ["_id", "locationId"];
                            // eslint-disable-next-line guard-for-in
                            for (const locationProp in reqLocation) {
                                if(doNotUpdateList.indexOf(locationProp) === -1){
                                    locationDB[locationProp] = reqLocation[locationProp];
                                }
                            }
                            locationDB.activityPayrollList.forEach((activityPayrollList) => {
                                if(!activityPayrollList.activityCodeId){
                                    activityPayrollList.activityCodeId = activityPayrollList.ncciCode;
                                }
                            });
                        }
                    }
                }
            }
            else {
            //add location
                if(!reqLocation.questions){
                    reqLocation.questions = []
                }
                if(!reqLocation.activityPayrollList){
                    reqLocation.activityPayrollList = []
                }
                else {
                    reqLocation.activityPayrollList.forEach((activityPayrollList) => {
                        if(!activityPayrollList.activityCodeId){
                            activityPayrollList.activityCodeId = activityPayrollList.ncciCode;
                        }
                    });
                }
                applicationDB.locations.push(reqLocation)
            }
            //if billing it is the mailing address.
            if(reqLocation.billing){
                log.debug(`setting mailing address for AppId ${applicationDB.applicationId}`)
                applicationDB.mailingAddress = reqLocation.address;
                applicationDB.mailingAddress2 = reqLocation.address2;
                applicationDB.mailingCity = reqLocation.city;
                applicationDB.mailingState = reqLocation.state;
                applicationDB.mailingZipcode = reqLocation.zipcode;
            }
            if(reqLocation.primary){
                applicationDB.primaryState = reqLocation.state;
            }
            if(reqLocation.primary && reqLocation.billing){
                applicationDB.mailingSameAsPrimary = true;
            }

            //update activity codes
            try{
                if(applicationDB.locations && applicationDB.locations.length > 0){
                    if(!applicationDB.activityCodes){
                        applicationDB.activityCodes = [];
                    }
                    for(const location of applicationDB.locations){
                        for(const activityCode of location.activityPayrollList) {
                            const foundCode = applicationDB.activityCodes.find((code) => code.activityCodeId === activityCode.activityCodeId);
                            if(foundCode){
                                foundCode.payroll += parseInt(activityCode.payroll, 10);
                            }
                            else{
                                // eslint-disable-next-line prefer-const
                                let newActivityCode = {};
                                newActivityCode.activityCodeId = activityCode.activityCodeId;
                                newActivityCode.payroll = parseInt(activityCode.payroll, 10);
                                applicationDB.activityCodes.push(newActivityCode);
                            }
                        }
                    }
                }
                else {
                    log.error(`API App Save Location error  update appDB.activityCodes no locations appIDd ${req.body.applicationId}`)
                }
            }
            catch(err){
                log.error(`API App Save Location error update appDB.activityCodes  appIDd ${req.body.applicationId} ${err}` + __location)
            }

            //updateMongo seems to wipping out the appid sent
            if(applicationDB.agencyLocationId){
                log.debug(`applicationLocationSave applicationDB.agencyLocationId ${applicationDB.agencyLocationId}` + __location)
            }

            const appId = applicationDB.applicationId
            applicationDB.lastPage = "Location";
            responseAppDoc = await applicationBO.updateMongo(applicationDB.applicationId,
                applicationDB);

            //Check/select Agencylocation Choice with new location
            log.debug('applicationDB.applicationId ' + appId + __location)
            const resp = await applicationBO.setAgencyLocation(appId)
            if(resp !== true){
                log.error(`applicationLocationSave Error: setAgencyLocation: ${resp} for appId ${appId} ` + __location);
                throw new Error(`Application Error: setAgencyLocation: ${resp}`);
            }
        }
    }
    catch (err) {
        //mongoose parse errors will end up there.
        log.error("Error saving application Location " + err + __location);
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
    }
    await setupReturnedApplicationJSON(responseAppDoc);

    if (responseAppDoc) {
        res.send(200, responseAppDoc.locations);
        return next();
    }
    else {
        res.send(500, "No updated document");
        return next(serverHelper.internalError("No updated document"));
    }
}

/**
 * Responds to GET requests and returns a list of applications
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplicationList(req, res, next) {
    if (!req.query || typeof req.query !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }
    // if there is no user on the token we cant determine which applications they can see, only allow api users
    if(!req.userTokenData || !req.userTokenData.userId || !req.userTokenData.apiToken){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    // check which agencies the user has access to
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const agencyPortalUserJSON = await agencyPortalUserBO.getById(req.userTokenData.userId);

    let agencyNetworkId = null;
    let agencyId = null;
    // if the user is part of an agency network, use the network id
    if(agencyPortalUserJSON.agencyNetworkId){
        agencyNetworkId = agencyPortalUserJSON.agencyNetworkId;
    }
    // if not part of a network, just look at the single agency
    else if(agencyPortalUserJSON.agencyId) {
        agencyId = agencyPortalUserJSON.agencyId;
    }

    // not currently filtering out any applications via doNotReport
    const applicationQuery = clonedeep(req.query);
    if(agencyNetworkId){
        applicationQuery.agencyNetworkId = agencyNetworkId;
    }
    else if(agencyId){
        applicationQuery.agencyId = agencyId;
    }
    else{
        // no access to any applications
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    const applicationBO = new ApplicationBO();
    const applicationList = await applicationBO.getList(applicationQuery);

    res.send(200, applicationList);
    return next();
}

/**
 * Responds to GET requests and returns an application
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplication(req, res, next) {
    let appId = null;
    if(req.params.id) {
        appId = req.params.id;
    }
    else {
        // Check for data
        if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
            log.error('Bad Request: No data received ' + __location);
            return next(serverHelper.requestError('Bad Request: No data received'));
        }

        // Make sure basic elements are present
        if (!req.query.id) {
            log.error('Bad Request: Missing ID ' + __location);
            return next(serverHelper.requestError('Bad Request: You must supply an ID'));
        }
        appId = req.query.id
    }
    const rightsToApp = await isAuthForApplication(req, appId)
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    //Get agency List check after getting application doc
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.getById(appId);
        await setupReturnedApplicationJSON(applicationDB);
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(applicationDB && applicationDB.applicationId){
        res.send(200, applicationDB);
        return next();
    }
    else {
        res.send(404,"Not found")
        return next(serverHelper.requestError('Not Found'));
    }
}

async function GetQuestions(req, res, next){

    const appId = req.params.id;
    const rightsToApp = await isAuthForApplication(req, appId)
    if(rightsToApp !== true){
        log.warn(`Not Authorized access attempted appId ${appId}` + __location);
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    // insurers is optional

    // Set questionSubjectArea (default to "general" if not specified)
    let questionSubjectArea = "general";
    if (req.query.questionSubjectArea) {
        questionSubjectArea = req.query.questionSubjectArea;
    }

    let activityCodeList = null;
    if (req.query.activityCodeList) {
        activityCodeList = req.query.activityCodeList;
    }

    let stateList = [];
    if (req.query.stateList) {
        stateList = req.query.stateList;
    }

    let locationId = null;
    if(req.query.locationId) {
        locationId = req.query.locationId;
    }

    //Get policyType for claims here.
    let policyType = null;
    if (req.query.policyType) {
        policyType = req.query.policyType;
    }

    //GetQuestion require agencylist to check auth.
    // auth has already been check - use skipAuthCheck.
    // eslint-disable-next-line prefer-const
    let agencies = [];
    const skipAgencyCheck = true;

    let getQuestionsResult = null;
    try{
        const applicationBO = new ApplicationBO();
        getQuestionsResult = await applicationBO.GetQuestions(appId, agencies, questionSubjectArea, locationId, stateList, skipAgencyCheck, activityCodeList, policyType);
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info(`Error getting questions for appId ${appId} ` + err + __location);
        return next(serverHelper.requestError('An error occured while retrieving application questions. ' + err));
    }

    if(!getQuestionsResult){
        log.error(`No response from GetQuestions:  appId ${appId} ${JSON.stringify(getQuestionsResult)}` + __location);
        return next(serverHelper.requestError('An error occured while retrieving application questions.'));
    }

    res.send(200, getQuestionsResult);
}

async function validate(req, res, next) {
    //Double check it is TalageStaff user

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }

    // Make sure basic elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'applicationId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    let error = null;
    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    const id = req.body.applicationId;
    const rightsToApp = await isAuthForApplication(req, id)
    if(rightsToApp !== true){
        log.warn(`Not Authorized access attempted appId ${id}` + __location);
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }


    //Get app and check status
    log.debug("Loading Application by mysqlId for Validation " + __location)
    const applicationDB = await applicationBO.getById(id).catch(function(err) {
        log.error("applicationBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if (!applicationDB) {
        log.warn(`Application not found appId ${id}` + __location);
        return next(serverHelper.requestError('Not Found'));
    }

    const applicationQuoting = new ApplicationQuoting();
    // Populate the Application object
    // Load
    try {
        const forceQuoting = true;
        const loadJson = {"id": id};
        await applicationQuoting.load(loadJson, forceQuoting);
    }
    catch (err) {
        log.error(`Error loading application ${id ? id : ''}: ${err.message}` + __location);
        res.send(err);
        return next();
    }
    // Validate
    let passValidation = false
    try {
        passValidation = await applicationQuoting.validate();
    }
    catch (err) {
        const errMessage = `Error validating application ${id ? id : ''}: ${err.message}`

        if (!err.message?.includes("Application's Agency Location does not cover")) {
            log.error('Application Validation ' + errMessage + __location)
        }

        const responseJSON = {
            "passedValidation": passValidation,
            "validationError":errMessage
        }
        res.send(200,responseJSON);
        return next();
    }

    // Send back the token
    res.send(200, {"passedValidation": passValidation});


    return next();


}

async function startQuoting(req, res, next) {
    //Double check it is TalageStaff user

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }
    // Make sure basic elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'applicationId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    let error = null;
    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    const applicationId = req.body.applicationId;
    const rightsToApp = await isAuthForApplication(req, applicationId);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    //Get app and check status
    const applicationDB = await applicationBO.getById(applicationId).catch(function(err) {
        log.error("applicationBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if (!applicationDB) {
        return next(serverHelper.requestError('Not Found'));
    }


    if (applicationDB.appStatusId > 60) {
        return next(serverHelper.requestError('Cannot Requote Application'));
    }

    // TODO Check/select Agencylocation Choice.

    const applicationQuoting = new ApplicationQuoting();
    // Populate the Application object

    // Load
    try {
        const forceQuoting = true;
        const loadJson = {
            "id": applicationId,
            agencyPortalQuote: false
        };
        if(applicationDB.insurerId && validator.is_valid_id(applicationDB.insurerId)){
            loadJson.insurerId = parseInt(applicationDB.insurerId, 10);
        }
        await applicationQuoting.load(loadJson, forceQuoting);
    }
    catch (err) {
        log.error(`Error loading application ${applicationId}: ${err.message}` + __location);
        res.send(err);
        return next();
    }
    // Validate
    try {
        await applicationQuoting.validate();
    }
    catch (err) {
        const errMessage = `Error validating application ${applicationId}: ${err.message}`;

        if (!err.message?.includes("Application's Agency Location does not cover")) {
            log.error('Application Validation ' + errMessage + __location)
        }

        res.send(400, errMessage);
        return next();
    }

    // Set the application progress to 'quoting'
    try {
        await applicationBO.updateToQuoting(applicationDB.applicationId);
    }
    catch (err) {
        log.error(`Error update appication progress appId = ${applicationDB.applicationId} for quoting. ` + err + __location);
    }

    // Send back the token
    res.send(200);

    // Begin running the quotes
    runQuotes(applicationQuoting);

    return next();
}

/**
 * Runs the quote process for a given application
 *
 * @param {object} application - Application object
 * @returns {void}
 */
async function runQuotes(application) {
    log.debug('running quotes' + __location)
    try {
        await application.run_quotes();
    }
    catch (error) {
        log.error(`Getting quotes on application ${application.id} failed: ${error} ${__location}`);
    }
}


async function setupReturnedApplicationJSON(applicationJSON){
    const mapDoc2OldPropName = {
        agencyLocationId: "agency_location",
        lastStep: "last_step",
        grossSalesAmt: "gross_sales_amt",
        mailingCity: "city",
        mailingAddress: "address",
        mailingAddress2: "address2",
        mailingState: "territory",
        mailingZipcode: "zip",
        optedOutOnlineEmailsent: "opted_out_online_emailsent",
        optedOutOnline: "opted_out_online"
    }
    for(const sourceProp in mapDoc2OldPropName){
        if(typeof applicationJSON[sourceProp] !== "object"){
            if(mapDoc2OldPropName[sourceProp]){
                const appProp = mapDoc2OldPropName[sourceProp]
                applicationJSON[appProp] = applicationJSON[sourceProp];
            }
        }
    }
    // eslint-disable-next-line array-element-newline
    const propsToRemove = ["_id","einEncrypted","einHash","questions","id"];
    for(let i = 0; i < propsToRemove.length; i++){
        if(applicationJSON[propsToRemove[i]]){
            delete applicationJSON[propsToRemove[i]]
        }
    }

    // // owners birthday formatting
    try{
        if(applicationJSON.owners && applicationJSON.owners.length > 0){
            for(let i = 0; i < applicationJSON.owners.length; i++){
                // eslint-disable-next-line prefer-const
                let owner = applicationJSON.owners[i];
                if(owner._id){
                    delete owner._id;
                }
                if(owner.ownership){
                    owner.ownership = owner.ownership.toString();
                }
                if(owner.birthdate){
                    owner.birthdate = moment(owner.birthdate).format("MM/DD/YYYY");
                }
            }
        }
    }
    catch(err){
        log.error("Application Owner processing error " + err + __location)
    }

    // process location for Activity Code Description
    if(applicationJSON.locations && applicationJSON.locations.length > 0){
        for(let i = 0; i < applicationJSON.locations.length; i++){
            const location = applicationJSON.locations[i];
            if(location.activityPayrollList && location.activityPayrollList.length > 0){
                const activityCodeBO = new ActivityCodeBO();
                for(let j = 0; j < location.activityPayrollList.length; j++){
                    try{
                        // eslint-disable-next-line prefer-const
                        let activityPayroll = location.activityPayrollList[j];
                        if(activityPayroll.activityCodeId){
                            const activtyCodeJSON = await activityCodeBO.getById(activityPayroll.activityCodeId);
                            activityPayroll.description = activtyCodeJSON.description;
                        }
                        //If this is for an edit add ownerPayRoll may be a problem.
                        if(activityPayroll.ownerPayRoll){
                            activityPayroll.payroll += activityPayroll.ownerPayRoll
                        }
                        //Check for new employeeType lists - If not present fill
                        // with zero employee count - User will have to fix.
                        if(activityPayroll.employeeTypeList.length === 0){
                            activityPayroll.employeeTypeList = []
                            const payRollJSON = {
                                "employeeType": "Full Time",
                                "employeeTypePayroll": activityPayroll.payroll,
                                "employeeTypeCount": 0

                            }
                            activityPayroll.employeeTypeList.push(payRollJSON);
                        }
                    }
                    catch(err){
                        log.error(`appId ${applicationJSON.applicationId} Error getting activity code  ${location.activityPayrollList[j].activityCodeId} ` + err + __location);
                    }
                }
            }
        }
    }
}

/**
 * Create a quote summary to return to the frontend
 *
 * @param {Object} quote - Quote JSON to be summarized
 * @param {boolean} returnAllQuotes - returns all quotes regardless of status
 *
 * @returns {Object} quote summary
 */
async function createQuoteSummary(quote, returnAllQuotes = false) {
    // Retrieve the quote
    if(!quote){
        log.error(`Quote object not supplied to createQuoteSummary ` + __location);
        return null;
    }
    // Retrieve the insurer
    const insurerModel = new InsurerBO();
    let insurer = null;
    try {
        insurer = await insurerModel.getById(quote.insurerId);
    }
    catch (error) {
        log.error(`Could not get insurer for ${quote.insurerId}:` + error + __location);
        return null;
    }

    let addLimitAndDoc = false;

    if(returnAllQuotes && quote.quoteStatusId < quoteStatus.quoted_referred.id){
        const quoteSummary = JSON.parse(JSON.stringify(quote));
        if(quoteSummary._id){
            delete quoteSummary._id
        }
        //compatible with Quote V2 decline.
        quote.id = quote.qouteId
        quote.policy_type = quote.policyType
        // quote.status = 'declined'
        quoteSummary.message = `${insurer.name} has declined to offer you coverage at this time`
        if(insurer){
            quoteSummary.insurer = {
                id: insurer.id,
                logo: global.settings.IMAGE_URL + '/' + insurer.logo,
                name: insurer.name,
                rating: insurer.rating
            }
        }
        return quoteSummary;

    }
    else if(quote.quoteStatusId === quoteStatus.declined.id){
        // Return a declined quote summary
        //TODO full quote object for the carrier response json is available.
        return {
            id: quote.qouteId,
            policy_type: quote.policyType,
            status: 'declined',
            message: `${insurer.name} has declined to offer you coverage at this time`,
            insurer: {
                id: insurer.id,
                logo: global.settings.IMAGE_URL + '/' + insurer.logo,
                name: insurer.name,
                rating: insurer.rating
            }
        };
    }
    else if(returnAllQuotes && quote.quoteStatusId >= quoteStatus.quoted_referred.id){
        addLimitAndDoc = true


    }
    else if(quote.quoteStatusId === quoteStatus.quoted_referred.id
            || quote.quoteStatusId === quoteStatus.quoted.id){
        addLimitAndDoc = true;

    }


    if(addLimitAndDoc){
        const instantBuy = quote.quoteStatusId === quoteStatus.quoted.id;
        // Retrieve the limits and create the limits object
        const limits = {};
        const limitsModel = new LimitsBO();
        if(quote.limits){
            for (const quoteLimit of quote.limits) {
                try {
                    const limit = await limitsModel.getById(quoteLimit.limitId);
                    // NOTE: frontend expects a string. -SF
                    limits[limit.description] = `${quoteLimit.amount}`;
                }
                catch (error) {
                    log.error(`Could not get limits for ${quote.insurerId}:` + error + __location);
                    return null;
                }
            }
        }
        if(quote.quoteCoverages){
            // sort ascending order based on id, if no sort value then number will be sorted first
            // eslint-disable-next-line no-inner-declarations
            function ascendingOrder(a, b){
                if(a.sort && b.sort){
                    // this sorts in ascending order
                    return a.sort - b.sort;
                }
                else if (a.sort && !b.sort){
                    // since no sort order on "b" then return -1
                    return -1;
                }
                else if (!a.sort && b.sort){
                    // since no sort order on "a" return 1
                    return 1;
                }
                else {
                    return 0;
                }
            }
            const sortedCoverageList = quote.quoteCoverages.sort(ascendingOrder);
            for(const quoteCoverage of sortedCoverageList){
                limits[quoteCoverage.description] = `${quoteCoverage.value}`;
            }
        }

        // Retrieve the insurer's payment plan
        const insurerPaymentPlanList = insurer.paymentPlans;

        // Retrieve the payment plans and create the payment options object
        const paymentOptions = [];
        for (const insurerPaymentPlan of insurerPaymentPlanList) {
            if (quote.amount > insurerPaymentPlan.premium_threshold) {
                try {
                    const PaymentPlanSvc = global.requireShared('services/paymentplansvc.js');
                    const paymentPlan = PaymentPlanSvc.getById(insurerPaymentPlan.payment_plan);
                    log.debug(`payment plan service added ` + __location);
                    paymentOptions.push({
                        id: paymentPlan.id,
                        name: paymentPlan.name,
                        description: paymentPlan.description
                    });
                }
                catch (error) {
                    log.error(`Could not get payment plan for ${insurerPaymentPlan.id}:` + error + __location);
                    return null;
                }
            }
        }

        // If we have a quote letter then retrieve the file from our cloud storage service
        let quoteLetterContent = '';
        const quoteLetterName = quote.quoteLetter;
        if (quoteLetterName) {
            // Get the file from our cloud storage service
            let error = null;
            const data = await fileSvc.GetFileSecure(`secure/quote-letters/${quoteLetterName}`).catch(function(err) {
                log.error('file get error: ' + err.message + __location);
                error = err;
            });
            if(error){
                return null;
            }

            // Return the response
            if (data && data.Body) {
                quoteLetterContent = data.Body;
            }
            else {
                log.error('file get error: no file content' + __location);
            }
        }
        let insurerLogoUrl = global.settings.IMAGE_URL + insurer.logo;
        // checking below to see if images path inserted twice, the IMAGE_URL ends with /images and the insurer.logos starts with images/
        // the following check should fix the double images path issue
        if(insurerLogoUrl.includes("imagesimages")){
            insurerLogoUrl = insurerLogoUrl.replace("imagesimages","images")
        }
        else if (insurerLogoUrl.includes("images/images")){
            insurerLogoUrl = insurerLogoUrl.replace("images/images","images")
        }
        const quoteSummary = JSON.parse(JSON.stringify(quote));
        if(quoteSummary._id){
            delete quoteSummary._id
        }
        quoteSummary.id = quote.quoteId;
        quoteSummary.policy_type = quote.policyType;
        quoteSummary.instant_buy = instantBuy;
        quoteSummary.letter = quoteLetterContent;
        quoteSummary.insurer = {
            id: insurer.id,
            logo: insurerLogoUrl,
            name: insurer.name,
            rating: insurer.rating
        };

        quoteSummary.limits = limits
        quoteSummary.payment_options = paymentOptions
        return quoteSummary
    }
    else {
        //Quote V2 Error - incomplete, initiated...
        return null;
    }

}

//For Quote V2 during Quoting
async function quotingCheck(req, res, next) {

    // Check for data
    if (!req.params || !req.params.id) {
        log.warn('No id was received' + __location);
        return next(serverHelper.requestError('No id was received'));
    }

    const rightsToApp = await isAuthForApplication(req, req.params.id);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    const applicationId = req.params.id;

    // Retrieve if we are complete. Must be done first or we may miss quotes.
    // return not complete if there is db error.
    // app will try again.
    let progress = 'quoting';
    const applicationBO = new ApplicationBO();
    try{
        progress = await applicationBO.getProgress(applicationId);
        log.debug("Application progress check " + progress + __location);
    }
    catch(err){
        log.error(`Error getting application progress appId = ${applicationId}. ` + err + __location);
        res.send(400, `Could not get quote list: ${err}`);
        return next();
    }

    const complete = progress !== 'quoting';

    // Retrieve quotes newer than the last quote ID
    // use createdAt Datetime instead.
    const quoteModel = new QuoteBO();
    let quoteList = null;


    const query = {applicationId: applicationId};
    try {
        quoteList = await quoteModel.getNewAppQuotes(query);
    }
    catch (error) {
        log.error(`Could not get quote list for appId ${applicationId} error:` + error + __location);
        res.send(400, `Could not get quote list: ${error}`);
        return next();
    }
    if(!quoteList){
        return null;
    }
    // eslint-disable-next-line prefer-const
    let returnedQuoteList = [];
    for(const quote of quoteList){
        const quoteSummary = await createQuoteSummary(quote);
        if (quoteSummary !== null) {
            returnedQuoteList.push(quoteSummary);
        }
    }

    res.send(200, {
        complete: complete,
        quotes: returnedQuoteList
    });
    return next();
}

//For Getting all the applications quotes
async function getQuoteList(req, res, next) {

    // Check for data
    if (!req.params || !req.params.id) {
        log.warn('No id was received' + __location);
        return next(serverHelper.requestError('No id was received'));
    }

    const rightsToApp = await isAuthForApplication(req, req.params.id);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    const applicationId = req.params.id;

    // Retrieve if we are complete. Must be done first or we may miss quotes.
    // return not complete if there is db error.
    // app will try again.
    let progress = 'quoting';
    const applicationBO = new ApplicationBO();
    try{
        progress = await applicationBO.getProgress(applicationId);
        log.debug("Application progress check " + progress + __location);
    }
    catch(err){
        log.error(`Error getting application progress appId = ${applicationId}. ` + err + __location);
        res.send(400, `Could not get quote list: ${err}`);
        return next();
    }

    const complete = progress !== 'quoting';

    // Retrieve quotes newer than the last quote ID
    // use createdAt Datetime instead.
    const quoteModel = new QuoteBO();
    let quoteList = null;


    const query = {applicationId: applicationId};
    try {
        quoteList = await quoteModel.getNewAppQuotes(query);
    }
    catch (error) {
        log.error(`Could not get quote list for appId ${applicationId} error:` + error + __location);
        res.send(400, `Could not get quote list: ${error}`);
        return next();
    }
    if(!quoteList){
        return null;
    }
    // eslint-disable-next-line prefer-const
    let returnedQuoteList = [];
    for(const quote of quoteList){
        //Return the full quote object plus insurer info.
        const RETURN_ALL_QUOTE = true;
        const quoteSummary = await createQuoteSummary(quote, RETURN_ALL_QUOTE);
        if (quoteSummary !== null) {
            returnedQuoteList.push(quoteSummary);
        }
    }

    res.send(200, {
        complete: complete,
        quotes: returnedQuoteList
    });
    return next();
}

async function requestToBindQuote(req, res, next) {

    // This only marks quote with request to bind.
    // trigger no logic that does API level binding - 2021-04-18

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }
    // Make sure basic elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'applicationId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'quoteId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, 'paymentPlanId') && !Object.prototype.hasOwnProperty.call(req.body, 'insurerPaymentPlanId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    // make sure the caller has the correct rights
    let applicationId = req.body.applicationId;
    const rightsToApp = await isAuthForApplication(req, applicationId);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    //Double check it is TalageStaff user
    log.debug("Bind request: " + JSON.stringify(req.body));
    // Check if binding is disabled

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }

    let error = null;
    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    const quoteId = req.body.quoteId;
    const paymentPlanId = req.body.paymentPlanId;
    const insurerPaymentPlanId = req.body.insurerPaymentPlanId;
    const lastPage = req.body.lastPage ? req.body.lastPage : "request-to-bind";

    //assume uuid input
    log.debug(`Getting app id  ${applicationId} from mongo` + __location)
    const applicationDB = await applicationBO.getById(applicationId).catch(function(err) {
        log.error(`Error getting application Doc for bound ${applicationId} ` + err + __location);
        log.error('Bad Request: Invalid id ' + __location);
        error = err;
    });
    if (error) {
        return next(Error);
    }

    if(applicationDB){
        applicationId = applicationDB.applicationId;
        try{
            const quoteJSON = {
                quoteId: quoteId,
                paymentPlanId: paymentPlanId,
                insurerPaymentPlanId: insurerPaymentPlanId,
                lastPage: lastPage
            };
            await applicationBO.processRequestToBind(applicationId,quoteJSON);

            // When API level binding is implemented.
            // the calls for processRequestToBind sould be enhanced.
        }
        catch(err){
            log.error(`Bind request error app ${applicationId} error ${err}` + __location)
            return next(serverHelper.internalError('process error'));
        }
    }
    else {
        log.error(`Did not find application Doc for bound ${applicationId}` + __location);
        return next(serverHelper.requestError('Invalid id'));
    }

    res.send(200, {"bound": true});
    return next();
}

async function markQuoteAsBound(req, res, next) {
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }
    // Make sure basic elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'applicationId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'quoteId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    let error = null;
    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    let applicationId = req.body.applicationId;
    const quoteId = req.body.quoteId;

    // make sure the caller has the correct rights
    const rightsToApp = await isAuthForApplication(req, applicationId);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    //assume uuid input
    log.debug(`Getting app id  ${applicationId} from mongo` + __location);
    const applicationDB = await applicationBO.getById(applicationId).catch(function(err) {
        log.error(`Error getting application Doc for bound ${applicationId} ` + err + __location);
        log.error('Bad Request: Invalid id ' + __location);
        error = err;
    });
    if (error) {
        return next(Error);
    }

    if(applicationDB){
        applicationId = applicationDB.applicationId;
    }
    else {
        log.error(`Did not find application Doc for bound ${applicationId}` + __location);
        return next(serverHelper.requestError('Invalid id'));
    }

    //Mark Quote Doc as bound.
    const quoteBO = new QuoteBO();
    let markAsBoundSuccess = false;
    const markAsBoundFailureMessage = "Failed to mark quote as bound. If this continues please contact us.";
    try {
        const policyInfo = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'premiumAmount')) {
            policyInfo.policyPremium = parseInt(req.body.premiumAmount,10);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'policyNumber')) {
            policyInfo.policyNumber = req.body.policyNumber;
        }

        markAsBoundSuccess = await quoteBO.markQuoteAsBound(quoteId, applicationId, req.authentication.userID, policyInfo);
        //a different prolicy type might already be the reason for app.status being bound.
        if(applicationDB.appStatusId !== 90){
            // Update application status
            await applicationBO.updateStatus(applicationId, "bound", 90);
        }
        else {
            log.info(`Application ${applicationId} is already bound with appStatusId ${applicationDB.appStatusId} ` + __location);
        }
        // Update Application-level quote metrics when we do a bind. Need to pickup the new bound quote.
        await applicationBO.recalculateQuoteMetrics(applicationId);
    }
    catch (err) {
        // We Do not pass error object directly to Client - May cause info leak.
        log.error(`Error trying to mark quoteId #${quoteId} as bound on applicationId #${applicationId} ` + err + __location);
        res.send({'message': markAsBoundFailureMessage});
        return next();
    }

    if(markAsBoundSuccess){
        res.send(200, {"bound": true});
    }
    else {
        res.send({'message': markAsBoundFailureMessage});
    }
    return next();
}

async function bindQuote(req, res, next) {
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }
    // Make sure basic elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'applicationId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }
    if (!Object.prototype.hasOwnProperty.call(req.body, 'quoteId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    const applicationId = req.body.applicationId;
    const quoteId = req.body.quoteId;
    let error = null;

    // make sure the caller has the correct rights
    const rightsToApp = await isAuthForApplication(req, applicationId);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    //assume uuid input
    log.debug(`Getting app id  ${applicationId} from mongo` + __location)
    const applicationDB = await applicationBO.getById(applicationId).catch(function(err) {
        log.error(`Error getting application Doc for bound ${applicationId} ` + err + __location);
        log.error('Bad Request: Invalid id ' + __location);
        error = err;
    });

    if (error) {
        return next(Error);
    }

    let bindSuccess = false;
    let bindFailureMessage = "Failed to bind. If this continues please contact us.";
    const quoteBind = new QuoteBind();
    try{
        // 1 is annual
        let paymentPlanId = 1;
        if(req.body.paymentPlanId){
            paymentPlanId = req.body.paymentPlanId
        }
        await quoteBind.load(quoteId, paymentPlanId, req.authentication.userID, req.body.insurerPaymentPlanId);
        const bindResp = await quoteBind.bindPolicy();
        if(bindResp === "success"){
            log.info(`succesfully API bound AppId: ${applicationDB.applicationId} QuoteId: ${quoteId}` + __location);
            bindSuccess = true;
        }
        else if(bindResp === "updated"){
            log.info(`succesfully API update via bound AppId: ${applicationDB.applicationId} QuoteId: ${quoteId}` + __location);
            bindSuccess = true;
        }
        else if(bindResp === "cannot_bind_quote" || bindResp === "rejected"){
            log.error(`Error Binding Quote ${quoteId} application ${applicationId ? applicationId : ''}: cannot_bind_quote` + __location);
            bindFailureMessage = "Cannot Bind Quote";
        }
        else {
            log.error(`Error Binding Quote ${quoteId} application ${applicationId ? applicationId : ''}: BindQuote did not return a response` + __location);
            bindFailureMessage = "Could not confirm Bind Quote";
        }
    }
    catch (err) {
        // We Do not pass error object directly to Client - May cause info leak.
        log.error(`Error Binding Quote ${quoteId} application ${applicationId ? applicationId : ''}: ${err}` + __location);
        res.send({'message': bindFailureMessage});
        return next();
    }

    if(bindSuccess){
        log.debug("quoteBind.policyInfo " + JSON.stringify(quoteBind.policyInfo));
        res.send(200, {
            "bound": true,
            policyNumber: quoteBind.policyInfo.policyNumber
        });
    }
    else {
        res.send(bindFailureMessage);
    }

    return next();
}

async function getFireCodes(req, res, next) {
    const appId = req.params.id;
    const rightsToApp = await isAuthForApplication(req, appId);
    if (!rightsToApp) {
        log.warn(`Not Authorized access attempted appId ${appId}` + __location);
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    let fireCodes = [];
    try {
        const applicationBO = new ApplicationBO();
        fireCodes = await applicationBO.getAppFireCodes(appId);
    }
    catch (e) {
        log.error(`Error getting Fire Codes for appId ${appId}: ${e}. ` + __location);
        // do not return error to client
        //return next(serverHelper.requestError(`An error occured while retrieving Fire Codes: ${e}. `));
    }

    // most insurers do not have fire codes this is no an error.  Client cannot be expect
    // to only call for firecode with there should be firecodes
    // if (!fireCodes) {
    //     log.error(`No Fire Codes were returned for appId ${appId}. ` + __location);
    //     //return next(serverHelper.requestError(`An error occurred while retrieving Fire Codes.`));
    // }

    res.send(200, fireCodes);
}

async function getBopCodes(req, res, next){

    const appId = req.params.id;
    const rightsToApp = await isAuthForApplication(req, appId)
    if(rightsToApp !== true){
        log.warn(`Not Authorized access attempted appId ${appId}` + __location);
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    //GetQuestion require agencylist to check auth.
    // auth has already been check - use skipAuthCheck.
    // eslint-disable-next-line prefer-const

    let bopIcList = null;
    try{
        const applicationBO = new ApplicationBO();
        bopIcList = await applicationBO.getAppBopCodes(appId);
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info(`Error getting BOP codes for appId ${appId} ` + err + __location);
        return next(serverHelper.requestError(`An error occured while retrieving BOP codes: ${err}.`));
    }

    if(!bopIcList){
        log.error(`No BOP codes were returned: appId ${appId} ${JSON.stringify(bopIcList)}` + __location);
        return next(serverHelper.requestError('An error occured while retrieving BOP codes.'));
    }

    res.send(200, bopIcList);
}

async function getPricing(req, res, next){
    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }
    // Make sure basic elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'applicationId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    let error = null;
    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    const applicationId = req.body.applicationId;
    const rightsToApp = await isAuthForApplication(req, applicationId);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    //Get app and check status
    const applicationDB = await applicationBO.getById(applicationId).catch(function(err) {
        log.error("applicationBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if (!applicationDB) {
        return next(serverHelper.requestError('Not Found'));
    }


    if (applicationDB.appStatusId > 60) {
        return next(serverHelper.requestError('Cannot Requote Application'));
    }

    const applicationQuoting = new ApplicationQuoting();
    // Populate the Application object

    // Load
    try {
        const forceQuoting = true;
        const loadJson = {
            "id": applicationId,
            agencyPortalQuote: false
        };
        if(applicationDB.insurerId && validator.is_valid_id(applicationDB.insurerId)){
            loadJson.insurerId = parseInt(applicationDB.insurerId, 10);
        }
        await applicationQuoting.load(loadJson, forceQuoting);
    }
    catch (err) {
        log.error(`Error loading application ${applicationId}: ${err.message}` + __location);
        res.send(err);
        return next();
    }
    let pricingJSON = {}
    try {
        pricingJSON = await applicationQuoting.run_pricing()
    }
    catch (err) {
        pricingJSON = {
            gotPricing: false,
            outOfAppetite: false,
            pricingError: true
        }
        log.error(`Getting pricing on application ${applicationId} failed: ${err} ${__location}`);
    }
    res.send(200, pricingJSON);
    return next();

    // const examplePricingData = {
    //     gotPricing: true,
    //     price: 1200,
    //     highPrice: 1500,
    //     outOfAppetite: false,
    //     pricingError: false
    //   };
    // };

}

/**
 * GET returns required field structure
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetRequiredFields(req, res, next){
    let requireFieldJSON = {}
    //
    const appId = req.params.id;
    log.debug(`GetRequiredFields appId: ${appId}` + __location)
    const rightsToApp = await isAuthForApplication(req, appId)
    if(rightsToApp !== true){
        log.warn(`Not Authorized access attempted appId ${appId}` + __location);
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    //call requiredField svc to get a required field structure.
    requireFieldJSON = await requiredFieldSvc.requiredFields(appId);

    res.send(200, requireFieldJSON);
    return next();

}

async function CheckAppetite(req, res, next){
    let appetitePolicyTypeList = null;
    const appId = req.params.id;
    const rightsToApp = await isAuthForApplication(req, appId)
    if(rightsToApp !== true){
        log.warn(`Not Authorized access attempted appId ${appId}` + __location);
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    try{
        const applicationBO = new ApplicationBO();
        appetitePolicyTypeList = await applicationBO.checkAppetite(appId, req.query);
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info("Error getting questions " + err + __location);
        res.send(200, {});
        //return next(serverHelper.requestError('An error occured while retrieving application questions. ' + err));
    }

    if(!appetitePolicyTypeList){
        res.send(200, {});
        return next();
        //return next(serverHelper.requestError('An error occured while retrieving application questions.'));
    }

    res.send(200, appetitePolicyTypeList);
    return next();
}


/**
 * Responds to post requests for all activity codes related to a given NCCI activity code
 *
 * @param {object} req - Expects {territory: 'NV', industry_code: 2880, code:005, sub:01}
 * @param {object} res - Response object: list of activity codes
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an array of objects containing activity codes [{"id": 2866}]
 */
async function GetActivityCodesByNCCICode(req, res, next){

    const appId = req.params.id;
    const rightsToApp = await isAuthForApplication(req, appId)
    if(rightsToApp !== true){
        log.warn(`Not Authorized access attempted appId ${appId}` + __location);
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }

    if (!req.query?.territory) {
        log.info('GetActivityCodesByNCCICode Bad Request: You must supply a territory' + __location);
        res.send(400, {
            message: 'You must supply a territory',
            status: 'error'
        });
        return next();
    }

    if (!req.query?.ncci_code) {
        log.info('GetActivityCodesByNCCICode Bad Request: You must supply an NCCI code' + __location);
        res.send(400, {
            message: 'You must supply an NCCI code',
            status: 'error'
        });
        return next();
    }

    const {
        ncci_code, territory
    } = req.query

    // Get activity codes by ncci codes, filtered by territory
    try {
        //Call Application BO to determine what insurerId should be used.
        log.info('GetActivityCodesByNCCICode calling applicationBO.NcciActivityCodeLookup ' + __location);
        // const activityCodes = await ActivityCodeSvc.getActivityCodesByNCCICode(ncci_code, territory)
        const applicationBO = new ApplicationBO();
        const activityCodes = await applicationBO.NcciActivityCodeLookup(req.params.id, ncci_code, territory);
        if (activityCodes?.length) {
            res.send(200, activityCodes);
            return next();
        }
        else{
            log.info('No Codes Available' + __location);
            res.send(404, {
                message: 'No Codes Available',
                status: 'error'
            });
            return next(false);
        }
    }
    catch (error) {
        log.error(`GetActivityCodesByNCCICode appId ${req.params.id} ${error}` + __location);
        res.send(500, {
            message: 'Internal Server Error',
            status: 'error'
        });
        return next(false);
    }
}


async function getStarterInsurerList(req, res, next){
    let insurerListObj = null;
    const appId = req.params.id;
    const rightsToApp = await isAuthForApplication(req, appId)
    if(rightsToApp !== true){
        log.warn(`Not Authorized access attempted appId ${appId}` + __location);
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    try{
        const applicationBO = new ApplicationBO();
        insurerListObj = await applicationBO.getInsurerListforApplications(appId, req.query);
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info("Error getting questions " + err + __location);
        res.send(200, {});
        //return next(serverHelper.requestError('An error occured while retrieving application questions. ' + err));
    }

    if(!insurerListObj){
        res.send(200, {});
        return next();
        //return next(serverHelper.requestError('An error occured while retrieving application questions.'));
    }

    res.send(200, insurerListObj);
    return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addPostAuthAppApi("POST Application",`${basePath}/application`, applicationSave);
    server.addPutAuthAppApi("PUT Application",`${basePath}/application`, applicationSave);
    server.addPutAuthAppApi("PUT Application Location",`${basePath}/application/location`, applicationLocationSave);
    server.addGetAuthAppApi("GET Application",`${basePath}/application/:id`, getApplication);
    server.addGetAuthAppApi("GET Application List",`${basePath}/application`, getApplicationList);
    server.addGetAuthAppApi('GET Questions for Application', `${basePath}/application/:id/questions`, GetQuestions);
    server.addGetAuthAppApi('GET Application Fire Codes', `${basePath}/application/:id/firecodes`, getFireCodes);
    server.addGetAuthAppApi('GET Application BOP Codes', `${basePath}/application/:id/bopcodes`, getBopCodes);
    server.addPutAuthAppApi('PUT Price Indication for Application', `${basePath}/application/price`, getPricing);
    server.addGetAuthAppApi('GET Required Fields', `${basePath}/application/:id/getrequiredfields`, GetRequiredFields);
    server.addGetAuthAppApi('CheckAppetite for  Application', `${basePath}/application/:id/checkappetite`, CheckAppetite, 'applications', 'view');
    server.addGetAuthAppApi('Get Activity Codes by NCCI code', `${basePath}/application/:id/ncci-activity-codes`, GetActivityCodesByNCCICode);

    server.addGetAuthAppApi('Get Application starter InsurerList For Apps', `${basePath}/application/:id/starterinsurerlist`, getStarterInsurerList, 'applications', 'view');

    server.addPutAuthAppApi('PUT Validate Application', `${basePath}/application/:id/validate`, validate);
    server.addPutAuthAppApi('PUT Start Quoting Application', `${basePath}/application/quote`, startQuoting);
    server.addGetAuthAppApi('GET Quoting check Application', `${basePath}/application/:id/quoting`, quotingCheck);
    server.addGetAuthAppApi('GET Quotes for Application', `${basePath}/application/:id/quotes`, getQuoteList);
    server.addPutAuthAppApi('PUT Request Bind Quote', `${basePath}/application/request-bind-quote`, requestToBindQuote);
    server.addPutAuthAppApi('PUT Mark Quote Bound', `${basePath}/application/mark-quote-bound`, markQuoteAsBound);
    server.addPutAuthAppApi('PUT Bind Quote', `${basePath}/application/bind-quote`, bindQuote);

}