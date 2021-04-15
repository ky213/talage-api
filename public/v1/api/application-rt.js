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
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const ApplicationQuoting = global.requireRootPath('public/v1/quote/helpers/models/Application.js');
const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');
const ApiAuth = require("./auth-api-rt.js");
const fileSvc = global.requireShared('./services/filesvc.js');
const QuoteBO = global.requireShared('./models/Quote-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const LimitsBO = global.requireShared('models/Limits-BO.js');
const PaymentPlanBO = global.requireShared('models/PaymentPlan-BO.js');
const InsurerPaymentPlanBO = global.requireShared('models/InsurerPaymentPlan-BO.js');

const moment = require('moment');

function isAuthForApplication(req, applicationId){
    let canAccessApp = false;
    if(req.userTokenData && req.userTokenData.quoteApp){
        if(req.userTokenData.applicationId === applicationId){
            canAccessApp = true;
        }
        else {
            log.warn("UnAuthorized Attempted to modify or access Application " + __location)
        }
    }
    else if (req.userTokenData && req.userTokenData.apiToken && req.userTokenData.applications && req.userTokenData.applications.length > 0){
        if(req.userTokenData.applications.indexOf(applicationId) > -1){
            canAccessApp = true;
        }
        else {
            //TODO check database Does API JWT owner have access to this
            // agency to add/edit applications.

            log.warn("UnAuthorized Attempted to modify or access Application " + __location)
        }
    }
    return canAccessApp;
}

async function applicationSave(req, res, next) {
    log.debug("Application Post: " + JSON.stringify(req.body));
    if (!req.body || typeof req.body !== "object") {
        log.error("Bad Request: No data received " + __location);
        return next(serverHelper.requestError("Bad Request: No data received"));
    }

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
        try {
            const agencyBO = new AgencyBO();
            const agencyDB = await agencyBO.getById(req.body.agencyId);
            if (agencyDB) {
                req.body.agencyNetworkId = agencyDB.agencyNetworkId;
            }
            else {
                log.warn("Application Save agencyId not found in db " +
                        req.body.agencyId +
                        __location);
                return next(serverHelper.requestError("Not Found Agency"));
            }
        }
        catch (err) {
            log.error(`Application Save get agencyNetworkId  agencyID: ${req.body.agencyId} ` +
                    err +
                    __location);
            return next(serverHelper.internalError("error checking agency"));
        }

        //if agencyLocationId is not sent for insert get primary
        if (!req.body.agencyLocationId) {
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
    }
    else {
        //get application and valid agency
        // check JWT has access to this application.
        const rightsToApp = isAuthForApplication(req, req.body.applicationId)
        if(rightsToApp !== true){
            return next(serverHelper.forbiddenError(`Not Authorized`));
        }
        try {
            const applicationDB = await applicationBO.getById(req.body.applicationId);
            if (!applicationDB) {
                return next(serverHelper.requestError("Not Found"));
            }
        }
        catch (err) {
            log.error("Error checking application doc " + err + __location);
            return next(serverHelper.requestError(`Bad Request: check error ${err}`));
        }

    }


    let responseAppDoc = null;
    try {
        const updateMysql = true;

        // if there were no activity codes passed in on the application, pull them from the locations activityPayrollList
        // WHERE IS THE IF LOGIC???? This simple creates and sets activitycodes  - BP
        //get location part_time_employees and full_time_employees from location payroll data.
        const activityCodes = [];
        let fteCount = 0;
        let pteCount = 0;
        if (req.body.locations && req.body.locations.length) {
            req.body.locations.forEach((location) => {
                location.activityPayrollList.forEach((activityCode) => {
                    //check if using new JSON
                    if(!activityCode.activtyCodeId){
                        activityCode.activtyCodeId = activityCode.ncciCode;
                    }
                    const foundCode = activityCodes.find((code) => code.activityCodeId === activityCode.activityCodeId);
                    if (foundCode) {
                        foundCode.payroll += parseInt(activityCode.payroll, 10);
                    }
                    else {
                        // eslint-disable-next-line prefer-const
                        let newActivityCode = {};
                        newActivityCode.activityCodeId = activityCode.activityCodeId;
                        newActivityCode.ncciCode = activityCode.ncciCode;
                        newActivityCode.payroll = parseInt(activityCode.payroll,10);
                        activityCodes.push(newActivityCode);
                    }
                    activityCode.employeeTypeList.forEach((employeeType) => {
                        if(employeeType.employeeType === 'Full Time'){
                            fteCount += employeeType.employeeType;
                        }
                        else if(employeeType.employeeType === 'Full Time'){
                            pteCount += employeeType.employeeType;
                        }
                    });
                });
                if(!location.full_time_employees){
                    location.full_time_employees = fteCount;
                }
                if(!location.part_time_employees){
                    location.part_time_employees = pteCount;
                }
            });
        }
        req.body.activityCodes = activityCodes;

        if (req.body.applicationId) {
            log.debug("App Doc UPDATE.....");
            responseAppDoc = await applicationBO.updateMongo(req.body.applicationId,
                req.body,
                updateMysql);
        }
        else {
            //insert.
            log.debug("App Doc INSERT.....");
            req.body.agencyPortalCreatedUser = "applicant";
            req.body.agencyPortalCreated = false;
            responseAppDoc = await applicationBO.insertMongo(req.body,
                updateMysql);

            // update JWT
            if(responseAppDoc && req.userTokenData && req.userTokenData.quoteApp){
                try{
                    const newToken = await ApiAuth.createApplicationToken(req, responseAppDoc.applicationId)
                    if(newToken){
                        responseAppDoc.token = newToken;
                    }
                }
                catch(err){
                    log.error(`Error Create JWT with ApplicationId ${err}` + __location);
                }

            }
            else {
                //API request do create newtoken
                // add application to Redis for JWT
                try{
                    const newToken = await ApiAuth.AddApplicationToToken(req, responseAppDoc.applicationId)
                    if(newToken){
                        responseAppDoc.token = newToken;
                    }
                }
                catch(err){
                    log.error(`Error Create JWT with ApplicationId ${err}` + __location);
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
    log.debug("Application Post: " + JSON.stringify(req.body));
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
    const rightsToApp = isAuthForApplication(req, req.body.applicationId)
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    try {
        applicationDB = await applicationBO.getById(req.body.applicationId);
        if (!applicationDB) {
            return next(serverHelper.requestError("Not Found"));
        }
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
            const updateMysql = false;
            responseAppDoc = await applicationBO.updateMongo(applicationDB.applicationId,
                applicationDB,
                updateMysql);
        }
    }
    catch (err) {
        //mongoose parse errors will end up there.
        log.error("Error saving application " + err + __location);
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
 * Responds to GET requests and returns the data for the queried page
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
    const rightsToApp = isAuthForApplication(req, appId)
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

    const rightsToApp = isAuthForApplication(req, req.params.id)
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    // insurers is optional


    // Set questionSubjectArea (default to "general" if not specified
    let questionSubjectArea = "general";
    if (req.query.questionSubjectArea) {
        questionSubjectArea = req.query.questionSubjectArea;
    }

    let stateList = [];
    if (req.query.stateList) {
        stateList = req.query.stateList;
    }

    let locationId = null;
    if(req.query.locationId) {
        locationId = req.query.locationId;
    }

    //GetQuestion require agencylist to check auth.
    // auth has already been check - use skipAuthCheck.
    // eslint-disable-next-line prefer-const
    let agencies = [];
    const skipAgencyCheck = true;

    let getQuestionsResult = null;
    try{
        const applicationBO = new ApplicationBO();
        getQuestionsResult = await applicationBO.GetQuestions(req.params.id, agencies, questionSubjectArea, locationId, stateList, skipAgencyCheck);
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info("Error getting questions " + err + __location);
        return next(serverHelper.requestError('An error occured while retrieving application questions. ' + err));
    }

    if(!getQuestionsResult){
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
    let id = req.body.applicationId;
    const rightsToApp = isAuthForApplication(req, id)
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    if(id > 0){
        // Validate the application ID
        if (!await validator.is_valid_id(req.body.id)) {
            log.error(`Bad Request: Invalid id ${id}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
    }
    else {
        //assume uuid input
        log.debug(`Getting app id  ${id} from mongo` + __location)
        const appDoc = await applicationBO.getfromMongoByAppId(id).catch(function(err) {
            log.error(`Error getting application Doc for validate ${id} ` + err + __location);
            log.error('Bad Request: Invalid id ' + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        if(appDoc){
            log.debug("Have app doc for " + appDoc.mysqlId + __location)
            id = appDoc.mysqlId;
        }
        else {
            log.error(`Did not find application Doc for validate ${id}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
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
        log.error(errMessage + __location);
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
    let applicationId = req.body.applicationId;
    const rightsToApp = isAuthForApplication(req, applicationId);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    if(applicationId > 0){
        // requote the application ID
        if (!await validator.is_valid_id(applicationId)) {
            log.error(`Bad Request: Invalid id ${applicationId}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
    }
    else {
        //assume uuid input
        log.debug(`Getting app id  ${applicationId} from mongo` + __location);
        const appDoc = await applicationBO.getfromMongoByAppId(applicationId).catch(function(err) {
            log.error(`Error getting application Doc for requote ${applicationId} ` + err + __location);
            log.error('Bad Request: Invalid id ' + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        if(appDoc){
            applicationId = appDoc.mysqlId;
        }
        else {
            log.error(`Did not find application Doc for requote ${applicationId}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
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
            agencyPortalQuote: true
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
        log.error(errMessage + __location);
        res.send(400, errMessage);
        return next();
    }

    // Set the application progress to 'quoting'
    try {
        await applicationBO.updateProgress(applicationDB.mysqlId, "quoting");
        const appStatusIdQuoting = 15;
        await applicationBO.updateStatus(applicationDB.mysqlId, "quoting", appStatusIdQuoting);
    }
    catch (err) {
        log.error(`Error update appication progress appId = ${applicationDB.mysqlId} for quoting. ` + err + __location);
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
                        const activtyCodeJSON = await activityCodeBO.getById(activityPayroll.activityCodeId);
                        activityPayroll.description = activtyCodeJSON.description;
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
                        log.error(`Error getting activity code  ${location.activityPayrollList[j].activityCodeId} ` + err + __location);
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
 *
 * @returns {Object} quote summary
 */
async function createQuoteSummary(quote) {
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

    switch (quote.aggregatedStatus) {
        case 'declined':
            // Return a declined quote summary
            return {
                id: quote.mysqlAppId,
                policy_type: quote.policyType,
                status: 'declined',
                message: `${insurer.name} has declined to offer you coverage at this time`,
                insurer: {
                    id: insurer.id,
                    logo: global.settings.SITE_URL + '/' + insurer.logo,
                    name: insurer.name,
                    rating: insurer.rating
                }
            };
        case 'quoted_referred':
        case 'quoted':
            const instantBuy = quote.aggregatedStatus === 'quoted';

            // Retrieve the limits and create the limits object
            const limits = {};
            const limitsModel = new LimitsBO();
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

            // Retrieve the insurer's payment plan
            const insurerPaymentPlanModel = new InsurerPaymentPlanBO();
            let insurerPaymentPlanList = null;
            try {
                insurerPaymentPlanList = await insurerPaymentPlanModel.getList({"insurer": quote.insurerId});
            }
            catch (error) {
                log.error(`Could not get insurer payment plan for ${quote.insurerId}:` + error + __location);
                return null;
            }

            // Retrieve the payment plans and create the payment options object
            const paymentOptions = [];
            const paymentPlanModel = new PaymentPlanBO();
            for (const insurerPaymentPlan of insurerPaymentPlanList) {
                if (quote.amount > insurerPaymentPlan.premium_threshold) {
                    try {
                        const paymentPlan = await paymentPlanModel.getById(insurerPaymentPlan.payment_plan);
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
            // Return the quote summary
            return {
                id: quote.mysqlId,
                policy_type: quote.policyType,
                amount: quote.amount,
                deductible: quote.deductible,
                instant_buy: instantBuy,
                letter: quoteLetterContent,
                insurer: {
                    id: insurer.id,
                    logo: global.settings.IMAGE_URL + insurer.logo,
                    name: insurer.name,
                    rating: insurer.rating
                },
                limits: limits,
                payment_options: paymentOptions
            };
        default:
            // We don't return a quote for any other aggregated status
            // log.error(`Quote ${quote.id} has a unknow aggregated status of ${quote.aggregated_status} when creating quote summary ${__location}`);
            return null;
    }
}

async function quotingCheck(req, res, next) {

    // Check for data
    if (!req.params || !req.params.id) {
        log.warn('No id was received' + __location);
        return next(serverHelper.requestError('No id was received'));
    }

    const rightsToApp = isAuthForApplication(req, req.params.id);
    if(rightsToApp !== true){
        return next(serverHelper.forbiddenError(`Not Authorized`));
    }
    const applicationId = req.params.id;
    // Set the last quote ID retrieved
    let lastQuoteID = -1;
    if (req.query.after) {
        lastQuoteID = req.query.after;
    }

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


    const query = {
        applicationId: applicationId,
        lastMysqlId: lastQuoteID
    };
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

async function bindQuote(req, res, next) {

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

    if (!Object.prototype.hasOwnProperty.call(req.body, 'paymentPlanId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    // make sure the caller has the correct rights
    let applicationId = req.body.applicationId;
    const rightsToApp = isAuthForApplication(req, applicationId);
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
                paymentPlanId: paymentPlanId
            };
            await applicationBO.processRequestToBind(applicationId,quoteJSON);
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


/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    server.addPostAuthAppApi("POST Application",`${basePath}/application`, applicationSave);
    server.addPutAuthAppApi("PUT Application",`${basePath}/application`, applicationSave);
    server.addPutAuthAppApi("PUT Application Location",`${basePath}/application/location`, applicationLocationSave);
    server.addGetAuthAppApi("GET Application",`${basePath}/application/:id`, getApplication);
    server.addGetAuthAppApi('GET Questions for Application', `${basePath}/application/:id/questions`, GetQuestions);

    server.addPutAuthAppApi('PUT Validate Application', `${basePath}/application/:id/validate`, validate);
    server.addPutAuthAppApi('PUT Start Quoting Application', `${basePath}/application/quote`, startQuoting);
    server.addGetAuthAppApi('GET Quoting check Application', `${basePath}/application/:id/quoting`, quotingCheck);
    server.addPutAuthAppApi('PUT Bind Quote', `${basePath}/application/bind-quote`, bindQuote);
}