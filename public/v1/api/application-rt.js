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

const moment = require('moment');


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
                log.error(`Bad Request: Missing ${requiredPropertyList[i]}` +
                        __location);
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
        // TODO check JWT has access to this application.
        try {
            const applicationDB = await applicationBO.loadfromMongoByAppId(req.body.applicationId);
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
        const activityCodes = [];
        if (req.body.locations && req.body.locations.length) {
            req.body.locations.forEach((location) => {
                location.activityPayrollList.forEach((activityCode) => {
                    const foundCode = activityCodes.find((code) => code.ncciCode === activityCode.ncciCode);
                    if (foundCode) {
                        foundCode.payroll += parseInt(activityCode.payroll, 10);
                    }
                    else {
                        // eslint-disable-next-line prefer-const
                        let newActivityCode = {};
                        newActivityCode.ncciCode = activityCode.ncciCode;
                        newActivityCode.payroll = parseInt(activityCode.payroll,
                            10);
                        activityCodes.push(newActivityCode);
                    }
                });
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
        }
    }
    catch (err) {
        //mongoose parse errors will end up there.
        log.error("Error saving application " + err + __location);
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
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
    //Get agency List check after getting application doc
    const error = null
    const agencies = [];
    //TODO check JWT for application access and agencyId.
    //hard code to Talage.
    agencies.push(1);
    // const agencies = await auth.getAgents(req).catch(function(e) {
    //     error = e;
    // });
    // if (error) {
    //     return next(error);
    // }
    let passedAgencyCheck = false;
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.loadfromMongoByAppId(appId);
        if(applicationDB && agencies.includes(applicationDB.agencyId)){
            passedAgencyCheck = true;
        }
        await setupReturnedApplicationJSON(applicationDB);
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(applicationDB && applicationDB.applicationId && passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this agency' + __location);
        return next(serverHelper.forbiddenError('You are not authorized for this agency'));
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

    // insurers is optional
    const error = null

    // eslint-disable-next-line prefer-const
    let agencies = [];
    //TODO check JWT for application access and agencyId.
    //hard code to Talage.
    agencies.push(1);
    let getQuestionsResult = null;
    try{
        const applicationBO = new ApplicationBO();
        getQuestionsResult = await applicationBO.GetQuestions(req.params.id, agencies);
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
    if (!Object.prototype.hasOwnProperty.call(req.body, 'id')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    let error = null;
    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    let id = req.body.id;
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

    // const agencyNetwork = req.authentication.agencyNetwork;
    // if (!agencyNetwork) {
    //     log.warn('App requote not agency network user ' + __location)
    //     res.send(403);
    //     return next(serverHelper.forbiddenError('Do Not have Permissions'));
    // }

    //Get app and check status
    log.debug("Loading Application by mysqlId for Validation " + __location)
    const applicationDB = await applicationBO.getById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if (!applicationDB) {
        return next(serverHelper.requestError('Not Found'));
    }
    //TODO Check agency Network or Agency rights....
    //TODO check JWT for application Access and agency
    // hardcode to Talage.
    // eslint-disable-next-line prefer-const
    let agents = []
    agents.push(1);

    // const agents = await auth.getAgents(req).catch(function(e) {
    //     error = e;
    // });
    // if (error) {
    //     log.error('Error get application getAgents ' + error + __location);
    //     return next(error)

    // }

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!agents.includes(parseInt(applicationDB.agency, 10))) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
    }

    // if(agencyNetwork !== applicationDB.agency_network){
    //     log.warn('App requote not agency network user does not match application agency_network ' + __location)
    //     res.send(403);
    //     return next(serverHelper.forbiddenError('Do Not have Permissions'));
    // }


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
    const propsToRemove = ["_id","einEncrypted","einHash","questions"];
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
                        const activtyCodeJSON = await activityCodeBO.getById(activityPayroll.ncciCode);
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
                        log.error(`Error getting activity code  ${location.activityPayrollList[j].ncciCode} ` + err + __location);
                    }
                }
            }
        }
    }
}
// dummy endpoint to stimulate routing
async function getNextRoute(req, res, next){
    // Check that at least some post parameters were received
    if ( !req.query.id || !req.query.currentRoute) {
        log.info('Bad Request: Parameters missing' + __location);
        return next(serverHelper.requestError('Parameters missing'));
    }
    // will probably grab info about application and determine the next route but for now use the current route to just go to the next one we have hardcoded
    let nextRouteName = null;
    switch(req.query.currentRoute){
        case 'basic':
            nextRouteName ='policies';
            break;
        case 'policies':
            nextRouteName = "additionalQuestions"
            break;
        case 'additionalQuestions':
            nextRouteName = "mailingAddress";
            break;   
        case 'locations':
                // don't have page set up after locations
            break;
        case 'mailingAddress':
                nextRouteName = 'locations';
            break;

    }
    res.send(200, nextRouteName);
}
/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
    // temporary use AuthAppWF (same as quote app V1)
    // server.addGetAuthAppWF('Get Quote Agency', `${basePath}/agency`, getAgency);
    server.addPostAuthAppWF("POST Application",`${basePath}/application`,applicationSave);
    server.addPutAuthAppWF("PUT Application",`${basePath}/application`,applicationSave);
    server.addGetAuthAppWF("GET Application",`${basePath}/application/:id`,getApplication);

    server.addGetAuthAppWF('GetQuestions for AP Application', `${basePath}/application/:id/questions`, GetQuestions)
    server.addPutAuth('PUT Validate Application', `${basePath}/application/:id/validate`, validate);
    server.addGetAuthAppWF("Get Next Route", `${basePath}/application/nextRoute`, getNextRoute);
}