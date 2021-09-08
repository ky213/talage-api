/* eslint-disable no-trailing-spaces */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable no-catch-shadow */
/* eslint-disable dot-notation */
/* eslint-disable require-jsdoc */
'use strict';
const validator = global.requireShared('./helpers/validator.js');
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBO = global.requireShared('models/Quote-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
const IndustryCodeCategoryBO = global.requireShared('models/IndustryCodeCategory-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const PolicyTypeBO = global.requireShared('models/PolicyType-BO.js');
const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');
const LimitsBO = global.requireShared('models/Limits-BO.js');
const ApplicationNotesCollectionBO = global.requireShared('models/ApplicationNotesCollection-BO.js');
const ApplicationQuoting = global.requireRootPath('quotesystem/models/Application.js');
const QuoteBind = global.requireRootPath('quotesystem/models/QuoteBind.js');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const {Error} = require('mongoose');
const {quoteStatus} = global.requireShared('./models/status/quoteStatus.js');


// Application Messages Imports
//const mongoUtils = global.requireShared('./helpers/mongoutils.js');
var Message = require('mongoose').model('Message');

/**
 * Responds to get requests for the application endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplication(req, res, next) {
    let error = false;

    // sort ascending order based on id, if no sort value then number will be sorted first
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

    //check if it for the Application Document
    if (req.query.mode && req.query.mode === "doc") {
        return getApplicationDoc(req, res, next);
    }

    //Determine Integer vs uuid.
    const id = req.query.id;

    // Get the agents that we are permitted to view
    

    const applicationBO = new ApplicationBO();
    let passedAgencyCheck = false;
    let applicationJSON = null;
    try{
        const applicationDBDoc = await applicationBO.getById(id);
        if(applicationDBDoc){
            if(req.authentication.isAgencyNetworkUser && applicationDBDoc.agencyNetworkId === req.authentication.agencyNetworkId){
                passedAgencyCheck = true;
            }
            else {
                const agents = await auth.getAgents(req).catch(function(e) {
                    error = e;
                });
                if (error) {
                    log.error('Error get application getAgents ' + error + __location);
                    return next(error);
                }   
                if(agents.includes(applicationDBDoc.agencyId)){
                    passedAgencyCheck = true;
                }
            }
        }
        

        if(applicationDBDoc){
            applicationJSON = JSON.parse(JSON.stringify(applicationDBDoc))
        }
    }
    catch(err){
        log.error("Error Getting application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(applicationJSON && applicationJSON.applicationId && passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this application' + __location);
        //Return not found so do not expose that the application exists
        return next(serverHelper.notFoundError('Application Not Found'));
    }
    await setupReturnedApplicationJSON(applicationJSON)

    // Get the quotes from the database
    const quoteBO = new QuoteBO()
    let quoteList = null;
    try {
        //sort by policyType
        const quoteQuery = {
            "applicationId": applicationJSON.applicationId,
            "sort": "policyType"
        }
        quoteList = await quoteBO.getList(quoteQuery);
    }
    catch(err){
        log.error("Error getting quotes for Application GET " + err + __location);
    }

    // Add the quotes to the return object and determine the application status
    applicationJSON.quotes = [];
    if (quoteList.length > 0) {
        let insurerList = null;
        const insurerBO = new InsurerBO();
        try{
            insurerList = await insurerBO.getList();
        }
        catch(err){
            log.error("Error get InsurerList " + err + __location)
        }
        let policyTypeList = null;
        const policyTypeBO = new PolicyTypeBO()
        try{
            policyTypeList = await policyTypeBO.getList();
        }
        catch(err){
            log.error("Error get policyTypeList " + err + __location)
        }

        let paymentPlanList = null;
        const PaymentPlanSvc = global.requireShared('services/paymentplansvc.js');
        paymentPlanList = PaymentPlanSvc.getList();
       
        for (let i = 0; i < quoteList.length; i++) {
            // eslint-disable-next-line prefer-const
            let quoteJSON = quoteList[i];

            if(quoteJSON.quoteLetter){
                quoteJSON.quote_letter = quoteJSON.quoteLetter;
            }
            if (!quoteJSON.status && quoteJSON.apiResult) {
                // if quoteStatus is error, but apiResult is initiated, we likely hit a timeout and should use quoteStatus over apiResult
                if (quoteJSON.quoteStatusId === quoteStatus.error.id && quoteJSON.apiResult === quoteStatus.initiated.description) {
                    quoteJSON.status = quoteStatus.error.description;
                }
                else {
                    quoteJSON.status = quoteJSON.apiResult;
                }
            }
            quoteJSON.number = quoteJSON.quoteNumber;
            if (quoteJSON.status === 'bind_requested' || quoteJSON.bound || quoteJSON.status === 'quoted') {
                quoteJSON.reasons = '';
            }
            // Change the name of autodeclined
            if (quoteJSON.status === 'autodeclined') {
                quoteJSON.status = 'Out of Market';
                quoteJSON.displayStatus = 'Out of Market';
            }
            else if(typeof quoteJSON.status === 'string'){
                //ucase word
                const wrkingString = stringFunctions.strUnderscoretoSpace(quoteJSON.status)
                quoteJSON.displayStatus = stringFunctions.ucwords(wrkingString)
            }

            // can see log?
            try {
                if (!req.authentication.permissions.applications.viewlogs) {
                    delete quoteJSON.log;
                }
            }
            catch (e) {
                delete quoteJSON.log;
            }
            //Insurer
            if(insurerList){
                const insurer = insurerList.find(insurertest => insurertest.id === quoteJSON.insurerId);
                // i.logo,
                //i.name as insurerName,
                quoteJSON.logo = insurer.logo
                quoteJSON.insurerName = insurer.name
                quoteJSON.website = insurer.website
            }
            //policyType
            if(policyTypeList){
                const policyTypeJSON = policyTypeList.find(policyTypeTest => policyTypeTest.abbr === quoteJSON.policyType)
                quoteJSON.policyTypeName = policyTypeJSON.name
            }
            //paymentplan.
            if(paymentPlanList){
                const paymentPlanJson = paymentPlanList.find(paymentPlanTest => paymentPlanTest.id === quoteJSON.paymentPlanId)
                if(paymentPlanJson){
                    quoteJSON.paymentPlan = paymentPlanJson.name
                }
            }
            //limits information
            const limitsList = {}
            // Retrieve the limits and create the limits object
            if(quoteJSON.limits){
                const limitsModel = new LimitsBO();
                for (const quoteLimit of quoteJSON.limits) {
                    try {
                        const limit = await limitsModel.getById(quoteLimit.limitId);
                        if(limit?.description){
                            // NOTE: frontend expects a string.
                            limitsList[limit.description] = `${quoteLimit.amount}`;
                        }
                    }
                    catch (err) {
                        log.error(`Could not get limits for ${quoteJSON.insurerId}:` + err + __location);
                    }
                }
            }
            if(quoteJSON.quoteCoverages){
                const sortedCoverageList = quoteJSON.quoteCoverages.sort(ascendingOrder);
                for(const quoteCoverage of sortedCoverageList){
                    limitsList[quoteCoverage.description] = `${quoteCoverage.value}`;
                }
            }
            const keys = Object.keys(limitsList);
            if(keys && keys.length && keys.length > 0){
                quoteJSON.limits = limitsList;
            }
        }
        // Add the quotes to the response
        applicationJSON.quotes = quoteList;
        if (req.authentication.permissions.applications.viewlogs) {
            applicationJSON.showLogs = true;
        }
    }

    let docList = null;
    try {
        docList = await Message.find({'applicationId':applicationJSON.applicationId}, '-__v');
    }
    catch (err) {
        log.error(err + __location);
        return serverHelper.sendError(res, next, 'Internal Error');
    }
    
    if(docList.length){
        applicationJSON.messages = docList;
    }
    // Return the response
    res.send(200, applicationJSON);
    return next();
}
async function getApplicationDoc(req, res ,next){
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
    let error = null
    const agencies = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }
    let passedAgencyCheck = false;
    let applicationDB = null;
    const applicationBO = new ApplicationBO();
    try{
        applicationDB = await applicationBO.getById(appId);
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

        // figure out if a location is already set to primary
        const hasPrimary = applicationJSON.locations.some(loc => loc.primary === true);

        for(let i = 0; i < applicationJSON.locations.length; i++){
            const location = applicationJSON.locations[i];
            
            // make sure primary (address) boolean is present
            // if both exist they could be different, so only do this if billing is present and primary is not
            if(location.hasOwnProperty("billing") && !location.hasOwnProperty("primary")){
                if(hasPrimary) {
                    location.primary = false;
                }
                else {
                    location.primary = location.billing;
                }
            }

            if(location.activityPayrollList && location.activityPayrollList.length > 0){
                const activityCodeBO = new ActivityCodeBO();
                for(let j = 0; j < location.activityPayrollList.length; j++){
                    try{
                        // eslint-disable-next-line prefer-const
                        let activityPayroll = location.activityPayrollList[j];
                        let activtyCodeJSON = {};
                        if(activityPayroll.activityCodeId){
                            activtyCodeJSON = await activityCodeBO.getById(activityPayroll.activityCodeId);
                        }
                        else {
                            activtyCodeJSON = await activityCodeBO.getById(activityPayroll.ncciCode);
                        }
                        activityPayroll.description = activtyCodeJSON.description;
                        //If this is for an edit add ownerPayRoll may be a problem.
                        if(activityPayroll.ownerPayRoll){
                            activityPayroll.payroll += activityPayroll.ownerPayRoll
                        }
                        //Check for new employeeType lists - If not present fill
                        // with zero employee count - User will have to fix.
                        // TODO determine if there was only one activity code entered.
                        // and only FTE.  if so the FTE count is the employeeTypeCount.
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

    //add Agency name
    const agencyBO = new AgencyBO();
    try{
        const returnDoc = false;
        const returnDeleted = true
        const agencyJSON = await agencyBO.getById(applicationJSON.agencyId, returnDoc, returnDeleted)
        applicationJSON.name = agencyJSON.name;
        applicationJSON.agencyName = agencyJSON.name;
        applicationJSON.agencyPhone = agencyJSON.phone;
        applicationJSON.agencyOwnerName = `${agencyJSON.firstName} ${agencyJSON.lastName}`;
        applicationJSON.agencyOwnerEmail = agencyJSON.email;
    }
    catch(err){
        log.error("Error getting agencyBO " + err + __location);
    }

    // add information about the creator if it was created in the agency portal
    if(applicationJSON.agencyPortalCreatedUser === "system"){
        applicationJSON.creatorEmail = "system"
    }
    else if(applicationJSON.agencyPortalCreatedUser === "applicant"){
        applicationJSON.creatorEmail = "Applicant"
    }
    else if(applicationJSON.agencyPortalCreated && applicationJSON.agencyPortalCreatedUser){
        const agencyPortalUserBO = new AgencyPortalUserBO();
        try{
            const userId = parseInt(applicationJSON.agencyPortalCreatedUser,10);
            const apUser = await agencyPortalUserBO.getById(userId);
            applicationJSON.creatorEmail = apUser.email;
        }
        catch(err){
            log.error("Error getting agencyPortalUserBO " + err + __location);
        }
    }

    //add industry description
    const industryCodeBO = new IndustryCodeBO();
    try{
        const industryCodeJson = await industryCodeBO.getById(applicationJSON.industryCode);
        if(industryCodeJson){
            applicationJSON.industryCodeName = industryCodeJson.description;
            const industryCodeCategoryBO = new IndustryCodeCategoryBO()
            const industryCodeCategoryJson = await industryCodeCategoryBO.getById(industryCodeJson.industryCodeCategoryId);
            if(industryCodeCategoryJson){
                applicationJSON.industryCodeCategory = industryCodeCategoryJson.name;
            }
        }
    }
    catch(err){
        log.error(`Error getting industryCodeBO for appId ${applicationJSON.applicationId} ` + err + __location);
    }
    //Primary Contact
    const customerContact = applicationJSON.contacts.find(contactTest => contactTest.primary === true);
    if(customerContact){
        applicationJSON.email = customerContact.email;
        applicationJSON.fname = customerContact.firstName;
        applicationJSON.lname = customerContact.lastName;
        applicationJSON.phone = customerContact.phone;
    }
}

//Both POST and PUT
async function applicationSave(req, res, next) {
    log.debug("Application Post: " + JSON.stringify(req.body));
    if (!req.body || typeof req.body !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    if (!req.body.applicationId && !req.body.uuid && req.body.id) {
        log.error('Bad Request: Missing applicationId ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing applicationId'));
    }

    //uuid -> applicationId
    if (!req.body.applicationId && req.body.uuid) {
        req.body.applicationId = req.body.uuid
    }


    //get user's agency List
    let error = null
    const agencies = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    const applicationBO = new ApplicationBO();

    //Insert checks
    if (!req.body.applicationId) {
        //Required fields for an insert.
        // eslint-disable-next-line array-element-newline
        const requiredPropertyList = ["agencyId", "businessName"];
        for(let i = 0; i < requiredPropertyList.length; i++){
            if (!req.body[requiredPropertyList[i]]) {
                log.error(`Bad Request: Missing ${requiredPropertyList[i]}` + __location);
                return next(serverHelper.requestError(`Bad Request: Missing ${requiredPropertyList[i]}`));
            }
        }
        //Insert agency check.
        if (!agencies.includes(req.body.agencyId)) {
            log.info('Forbidden: User is not authorized for this agency' + __location);
            return next(serverHelper.forbiddenError('You are not authorized for this agency'));
        }

        //Get AgencyNetworkID
        try{
            const agencyBO = new AgencyBO()
            const agencyDB = await agencyBO.getById(req.body.agencyId)
            if(agencyDB){
                req.body.agencyNetworkId = agencyDB.agencyNetworkId;
            }
            else {
                log.warn("Application Save agencyId not found in db " + req.body.agencyId + __location)
                return next(serverHelper.requestError('Not Found Agency'));
            }
        }
        catch(err){
            log.error(`Application Save get agencyNetworkId  agencyID: ${req.body.agencyId} ` + err + __location)
            return next(serverHelper.internalError("error checking agency"));
        }


        //if agencyLocationId is not sent for insert get primary
        if(!req.body.agencyLocationId){
            const agencyLocationBO = new AgencyLocationBO();
            const locationPrimaryJSON = await agencyLocationBO.getByAgencyPrimary(req.body.agencyId).catch(function(err) {
                log.error(`Error getting Agency Primary Location ${req.body.agencyId} ` + err + __location);
            });
            if(locationPrimaryJSON && locationPrimaryJSON.systemId){
                req.body.agencyLocationId = locationPrimaryJSON.systemId;
            }
        }
    }
    else {
        //get application and valid agency
        let passedAgencyCheck = false;
        try{
            const applicationDB = await applicationBO.getById(req.body.applicationId);
            if(applicationDB && agencies.includes(applicationDB.agencyId)){
                passedAgencyCheck = true;
            }
            if(!applicationDB){
                return next(serverHelper.requestError('Not Found'));
            }
        }
        catch(err){
            log.error("Error checking application doc " + err + __location)
            return next(serverHelper.requestError(`Bad Request: check error ${err}`));
        }

        if(passedAgencyCheck === false){
            log.info('Forbidden: User is not authorized for this agency' + __location);
            return next(serverHelper.forbiddenError('You are not authorized for this agency'));
        }
    }


    let responseAppDoc = null;
    let userId = null;
    try{
        userId = req.authentication.userID;
    }
    catch(err){
        log.error("Error gettign userID " + err + __location);
    }


    try{
        // if there were no activity codes passed in on the application, pull them from the locations activityPayrollList
        const activityCodes = [];
        if(req.body.locations && req.body.locations.length){
            req.body.locations.forEach((location) => {
                location.activityPayrollList.forEach((activityCode) => {
                    const foundCode = activityCodes.find((code) => code.activityCodeId === activityCode.activityCodeId);
                    if(foundCode){
                        foundCode.payroll += parseInt(activityCode.payroll, 10);
                    }
                    else{
                        // eslint-disable-next-line prefer-const
                        let newActivityCode = {};
                        newActivityCode.activityCodeId = activityCode.activityCodeId;
                        newActivityCode.ncciCode = activityCode.ncciCode;
                        newActivityCode.payroll = parseInt(activityCode.payroll, 10);
                        activityCodes.push(newActivityCode);
                    }
                });
            });
        }
        req.body.activityCodes = activityCodes;
        const updateMysql = true;
        if(req.body.applicationId){
            log.debug("App Doc UPDATE.....")
            //update
            req.body.agencyPortalModifiedUser = userId
            responseAppDoc = await applicationBO.updateMongo(req.body.applicationId, req.body);
        }
        else {
            //insert.
            log.debug("App Doc INSERT.....")
            req.body.agencyPortalCreatedUser = userId
            req.body.agencyPortalCreated = true;
            responseAppDoc = await applicationBO.insertMongo(req.body, updateMysql);
        }
    }
    catch(err){
        //mongoose parse errors will end up there.
        log.error("Error saving application " + err + __location)
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
    }

    if(responseAppDoc){
        res.send(200, responseAppDoc);
        return next();
    }
    else{
        res.send(500, "No updated document");
        return next(serverHelper.internalError("No updated document"));
    }
}


async function applicationCopy(req, res, next) {
    //const exampleBody = {"applicationId": "cb3b4d82-7bb6-438d-82cb-9f520c3db925", includeQuestions: true}
    log.debug("Application Copy Post: " + JSON.stringify(req.body));
    if (!req.body || typeof req.body !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    if (!req.body.applicationId && !req.body.uuid && req.body.id) {
        log.error('Bad Request: Missing applicationId ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing applicationId'));
    }

    //uuid -> applicationId
    if (!req.body.applicationId && req.body.uuid) {
        req.body.applicationId = req.body.uuid
    }


    //get user's agency List
    let error = null
    const agencies = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    const applicationBO = new ApplicationBO();


    //get application and valid agency
    let passedAgencyCheck = false;
    let responseAppDoc = null;
    try{
        const applicationDocDB = await applicationBO.getById(req.body.applicationId);
        if(applicationDocDB && agencies.includes(applicationDocDB.agencyId)){
            passedAgencyCheck = true;
        }
        if(!applicationDocDB){
            return next(serverHelper.requestError('Not Found'));
        }
        if(passedAgencyCheck === false){
            log.info('Forbidden: User is not authorized for this agency' + __location);
            return next(serverHelper.forbiddenError('You are not authorized for this agency'));
        }
        // eslint-disable-next-line prefer-const
        let newApplicationDoc = JSON.parse(JSON.stringify(applicationDocDB));
        // eslint-disable-next-line array-element-newline
        const propsToRemove = ["_id", "id", "applicationId", "uuid", "mysqlId", "createdAt"];
        for(let i = 0; i < propsToRemove.length; i++){
            if(newApplicationDoc[propsToRemove[i]]){
                delete newApplicationDoc[propsToRemove[i]]
            }
        }
        //default back not pre quoting for mysql State.
        newApplicationDoc.processStateOld = 1;

        //fix missing activityCodeId
        newApplicationDoc.locations.forEach((location) => {
            location.activityPayrollList.forEach((activityPayroll) => {
                if(!activityPayroll.activityCodeId && activityPayroll.ncciCode){
                    activityPayroll.activityCodeId = activityPayroll.ncciCode
                }
            });
        });
        newApplicationDoc.activityCodes.forEach((activityCode) => {
            if(!activityCode.activityCodeId && activityCode.ncciCode){
                activityCode.activityCodeId = activityCode.ncciCode
            }
        });


        //include Questions
        if(req.body.includeQuestions === false){
            newApplicationDoc.questions = [];
            if(newApplicationDoc.appStatusId >= 10){
                newApplicationDoc.appStatusId = 0;
                newApplicationDoc.status = 'incomplete';
            }
        }
        else if (newApplicationDoc.questions && newApplicationDoc.questions.length > 0) {
            newApplicationDoc.appStatusId = 10;
            newApplicationDoc.status = 'questions_done';
        }
        else {
            newApplicationDoc.appStatusId = 0;
            newApplicationDoc.status = 'incomplete';
        }

        let userId = null;
        try{
            userId = req.authentication.userID;
        }
        catch(err){
            log.error("Error gettign userID " + err + __location);
        }
        newApplicationDoc.copiedFromAppId = req.body.applicationId;
        newApplicationDoc.agencyPortalCreatedUser = userId
        newApplicationDoc.agencyPortalCreated = true;
        newApplicationDoc.handledByTalage = false;
        newApplicationDoc.referrer = null;
        newApplicationDoc.quotingStartedDate = null;
        newApplicationDoc.metrics = null;

        const updateMysql = true;
        responseAppDoc = await applicationBO.insertMongo(newApplicationDoc, updateMysql);
        await setupReturnedApplicationJSON(responseAppDoc)
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(responseAppDoc){
        res.send(200, responseAppDoc);
        return next();
    }
    else{
        res.send(500, "No copied Application");
        return next(serverHelper.internalError("No copied Application"));
    }
}

async function deleteObject(req, res, next) {
    const id = req.params.id;
    if (!id) {
        return next(new Error("bad parameter"));
    }
    
    //Deletes only by AgencyNetwork Users.
    const agencyNetworkId = req.authentication.agencyNetworkId;
    if (req.authentication.isAgencyNetworkUser === false) {
        log.warn('App Delete not agency network user ' + __location)
        res.send(403);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }
    //check that application is agency network.
    let error = null;
    const applicationBO = new ApplicationBO();
    // Load the request data into it
    const appAgencyNetworkId = await applicationBO.getAgencyNewtorkIdById(id).catch(function(err) {
        log.error("Getting  appAgencyNetworkId error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    if (appAgencyNetworkId !== agencyNetworkId) {
        log.warn("Application Delete agencynetowrk miss match")
        res.send(403);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }


    await applicationBO.deleteSoftById(id).catch(function(err) {
        log.error("deleteSoftById load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    res.send(200, {"success": true});
    return next();

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
    const id = req.body.id;
    let applicationDocDB = null;
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
        applicationDocDB = await applicationBO.getfromMongoByAppId(id).catch(function(err) {
            log.error(`Error getting application Doc for validate ${id} ` + err + __location);
            log.error('Bad Request: Invalid id ' + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        if(!applicationDocDB){
            log.error(`Did not find application Doc for validate ${id}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
        log.debug('got application ' + __location)
    }

    //Get app and check status
    log.debug("Loading Application for Validation " + __location)
    if(!applicationDocDB){
        log.debug('Loading app using mysqlId ' + __location)
        applicationDocDB = await applicationBO.getById(id).catch(function(err) {
            log.error("applicationBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
    }

    if (!applicationDocDB) {
        return next(serverHelper.requestError('Not Found'));
    }
    //TODO Check agency Network or Agency rights....
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error)

    }

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!agents.includes(parseInt(applicationDocDB.agencyId, 10))) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
    }

    // if(agencyNetwork !== applicationDB.agency_network){
    //     log.warn('App requote not agency network user does not match application agency_network ' + __location)
    //     res.send(403);
    //     return next(serverHelper.forbiddenError('Do Not have Permissions'));
    // }


    const applicationQuoting = new ApplicationQuoting();
    let passValidation = false
    // Populate the Application object
    // Load - Does some validation do to transformation of data.
    try {
        const forceQuoting = true;
        const loadJson = {
            "id": id,
            agencyPortalQuote: true
        };
        await applicationQuoting.load(loadJson, forceQuoting);
    }
    catch (err) {
        const errMessage = `Error loading application data ${id ? id : ''}: ${err.message}`
        log.error(errMessage + __location);

        //res.send(err);
        const responseJSON = {
            "passedValidation": passValidation,
            "validationError":errMessage
        }
        res.send(200,responseJSON);
        return next();
    }
    // Validate
    try {
        const doNotLogValidationErrors = false
        passValidation = await applicationQuoting.validate(doNotLogValidationErrors);
    }
    catch (err) {
        const errMessage = `Error validating application ${id ? id : ''}: ${err.message}`
        // This is a user triggered validation check.  Do not log.
        // log.error(errMessage + __location);
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


async function requote(req, res, next) {
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
    const id = req.body.id;
    let applicationDB = null;
    if(id > 0){
        // requote the application ID
        if (!await validator.is_valid_id(req.body.id)) {
            log.error(`Bad Request: Invalid id ${id}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
    }
    else {
        //assume uuid input
        log.debug(`Getting app id  ${id} from mongo` + __location)
        applicationDB = await applicationBO.getfromMongoByAppId(id).catch(function(err) {
            log.error(`Error getting application Doc for requote ${id} ` + err + __location);
            log.error('Bad Request: Invalid id ' + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        if(!applicationDB) {
            log.error(`Did not find application Doc for requote ${id}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
    }

    //Get app and check status
    if(!applicationDB) {
        applicationDB = await applicationBO.getById(id).catch(function(err) {
            log.error("applicationBO load error " + err + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
    }
    if (!applicationDB) {
        return next(serverHelper.requestError('Not Found'));
    }
    // Check agency Network or Agency rights....
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error)

    }

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!agents.includes(parseInt(applicationDB.agencyId, 10))) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
    }

    // if(agencyNetwork !== applicationDB.agency_network){
    //     log.warn('App requote not agency network user does not match application agency_network ' + __location)
    //     res.send(403);
    //     return next(serverHelper.forbiddenError('Do Not have Permissions'));
    // }


    if (applicationDB.appStatusId > 60) {
        log.warn(`Cannot Requote Application ${req.body.id}` + __location)
        return next(serverHelper.requestError('Cannot Requote Application'));
    }

    const applicationQuoting = new ApplicationQuoting();
    // Populate the Application object

    // Load
    try {
        const forceQuoting = true;
        const loadJson = {
            "id": applicationDB.applicationId,
            agencyPortalQuote: true
        };
        if(req.body.insurerId && validator.is_valid_id(req.body.insurerId)){
            loadJson.insurerId = parseInt(req.body.insurerId, 10);
        }
        await applicationQuoting.load(loadJson, forceQuoting);
    }
    catch (err) {
        log.error(`Error loading application ${req.body.id ? req.body.id : ''}: ${err.message}` + __location);
        res.send(err);
        return next();
    }
    // Validate
    try {
        await applicationQuoting.validate();
    }
    catch (err) {
        //pre quote validation log any errors
        const errMessage = `Error validating application ${id ? id : ''}: ${err.message}`
        log.warn(errMessage + __location);
        res.send(400, errMessage);
        return next();
    }

    // Set the application progress to 'quoting'
    try {
        await applicationBO.updateProgress(applicationDB.applicationId, "quoting");
        const appStatusIdQuoting = 15;
        await applicationBO.updateStatus(applicationDB.applicationId, "quoting", appStatusIdQuoting);
    }
    catch (err) {
        log.error(`Error update appication progress appId = ${applicationDB.applicationId} for quoting. ` + err + __location);
    }

    // Build a JWT that contains the application ID that expires in 5 minutes.
    const tokenPayload = {applicationID: req.body.id};
    const token = jwt.sign(tokenPayload, global.settings.AUTH_SECRET_KEY, {expiresIn: '5m'});
    // Send back the token
    res.send(200, token);

    // Begin running the quotes
    runQuotes(applicationQuoting, req);

    return next();
}

/**
 * Runs the quote process for a given application
 *
 * @param {object} application - Application object
 * @returns {void}
 */
async function runQuotes(application, req) {
    log.debug('running quotes' + __location)

    await application.run_quotes(req);

    // try {
    //     await application.run_quotes();
    // }
    // catch (error) {
    //     log.error(`Getting quotes on application ${application.id} failed: ${error} ${__location}`);
    // }
}

async function GetQuestions(req, res, next){

    // insurers is optional
    let error = null
    const agencies = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Set the question subject area. Default to "general" if not specified.
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

    let getQuestionsResult = null;
    
    //Get policyType for claims here.
    let policyType = null;
    if (req.query.policyType) {
        policyType = req.query.policyType;
    }

    const skipAgencyCheck = true;
    const requestActivityCodeList = []
    try{
        const applicationBO = new ApplicationBO();
        getQuestionsResult = await applicationBO.GetQuestions(req.params.id, agencies, questionSubjectArea, locationId, stateList,skipAgencyCheck,requestActivityCodeList, policyType);
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info("Error getting questions " + err + __location);
        res.send(200, {});
        //return next(serverHelper.requestError('An error occured while retrieving application questions. ' + err));
    }

    if(!getQuestionsResult){
        res.send(200, {});
        //return next(serverHelper.requestError('An error occured while retrieving application questions.'));
    }

    res.send(200, getQuestionsResult);
}

async function bindQuote(req, res, next) {
    //Double check it is TalageStaff user
    log.debug("Bind request: " + JSON.stringify(req.body))
    // Check if binding is disabled
    if (global.settings.DISABLE_BINDING === "YES" && req.body.markAsBound !== true && req.body.requestBind !== true) {
        return next(serverHelper.requestError('Binding is disabled'));
    }

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

    let error = null;
    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    let applicationId = req.body.applicationId;

    const quoteId = req.body.quoteId;

    //assume uuid input
    log.debug(`Getting app id  ${applicationId} from mongo` + __location)
    const applicationDB = await applicationBO.getfromMongoByAppId(applicationId).catch(function(err) {
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

    //TODO Check agency Network or Agency rights....
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error)

    }

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!agents.includes(parseInt(applicationDB.agencyId, 10))) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
    }
    let bindSuccess = false;
    let bindFailureMessage = '';
    try {
        if (req.body.markAsBound !== true && req.body.requestBind !== true) {
            //const insurerBO = new InsurerBO();
            // API binding with Insures...

            const quoteBind = new QuoteBind();
            let paymentPlanId = 1;
            if(req.body.paymentPlanId){
                paymentPlanId = req.body.paymentPlanId
            }
            await quoteBind.load(quoteId, paymentPlanId, req.authentication.userID,req.body.insurerPaymentPlanId);
            const bindResp = await quoteBind.bindPolicy();
            if(bindResp === "success"){
                log.info(`succesfully API bound AppId: ${applicationDB.applicationId} QuoteId: ${quoteId}` + __location)
                bindSuccess = true;
            }
            else if(bindResp === "updated"){
                log.info(`succesfully API update via bound AppId: ${applicationDB.applicationId} QuoteId: ${quoteId}` + __location)
                bindSuccess = true;
            }
            else if(bindResp === "cannot_bind_quote" || bindResp === "rejected"){
                log.error(`Error Binding Quote ${quoteId} application ${applicationId ? applicationId : ''}: cannot_bind_quote` + __location);
                bindFailureMessage = "Cannot Bind Quote"
            }
            else {
                log.error(`Error Binding Quote ${quoteId} application ${applicationId ? applicationId : ''}: BindQuote did not return a response` + __location);
                bindFailureMessage = "Could not confirm Bind Quote"
            }
            if(bindSuccess){
                log.debug("quoteBind.policyInfo " + JSON.stringify(quoteBind.policyInfo));
                res.send(200, {"bound": true, policyNumber: quoteBind.policyInfo.policyNumber});
            }
            else {
                res.send({"message":bindFailureMessage});
            }

            return next();


        }
        else if(req.body.requestBind){
            const quoteBO = new QuoteBO();
            let quoteDoc = null;
            try {
                quoteDoc = await quoteBO.getById(quoteId);
            }
            catch(err){
                log.error("Error getting quote for bindQuote " + err + __location);
            }
            //setup quoteObj for applicationBO.processRequestToBind
            let paymentPlanId = 1;
            if(req.body.paymentPlanId){
                paymentPlanId = stringFunctions.santizeNumber(req.body.paymentPlanId);
            }
            const quoteObj = {
                quote: quoteDoc.quoteId,
                quoteId: quoteDoc.quoteId,
                paymentPlanId: paymentPlanId,
                insurerPaymentPlanId: req.body.insurerPaymentPlanId,
                noCustomerEmail: true
            }
            const requestBindResponse = await applicationBO.processRequestToBind(applicationId, quoteObj).catch(function(err){
                log.error(`Error trying to request bind for quoteId #${quoteId} on applicationId #${applicationId} ` + err + __location);
                bindFailureMessage = "Failed to request bind. If this continues please contact us.";
            });
            
            if(requestBindResponse === true){
                bindSuccess = true;
            }
        }
        else {
            //Mark Quote Doc as bound.
            const quoteBO = new QuoteBO()
            // const markAsBoundResponse = await quoteBO.markQuoteAsBound(quoteId, applicationId, req.authentication.userID).catch(function(err){ 
            //     log.error(`Error trying to mark quoteId #${quoteId} as bound on applicationId #${applicationId} ` + err + __location);
            //     bindFailureMessage = "Failed to mark quote as bound. If this continues please contact us.";
            // });

            // if(markAsBoundResponse === true){
            //     bindSuccess = true;
            // }
            let markAsBoundResponse = false;
            try {
                markAsBoundResponse = await quoteBO.markQuoteAsBound(quoteId, applicationId, req.authentication.userID)
                if(applicationDB.appStatusId !== 90){
                    // Update application status
                    await applicationBO.updateStatus(applicationId,"bound", 90);
                   
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
                res.send({'message': "Failed to mark quote as bound. If this continues please contact us."});
                return next();
            }
            if(markAsBoundResponse === true){
                bindSuccess = true;
            }
        }
    }

    catch (err) {
        // We Do not pass error object directly to Client - May cause info leak.
        log.error(`Error Binding Quote ${quoteId} application ${applicationId ? applicationId : ''}: ${err}` + __location);
        res.send({'message': "Failed To Bind"});
        return next();
    }

    // Send back bound for both request, mark and API binds.
    if(bindSuccess){
        res.send(200, {"bound": true});
    }
    else {
        res.send({'message': bindFailureMessage});
    }

    return next();
}

/**
 * Function that will return policy limits based on the agency
 *
 * @param {String} agencyId - Id of agency for which we will send back policy limits
 *
 * @returns {Object} returns the policy limits object
 */
async function GetPolicyLimits(agencyId){
    log.debug(`policy limits for ${agencyId}` + __location)
    // eslint-disable-next-line prefer-const
    let limits = {
        "BOP": [
            {
                "key": "1000000/1000000/1000000",
                "value": "$1,000,000 / $1,000,000 / $1,000,000"
            },
            {
                "key": "1000000/2000000/1000000",
                "value": "$1,000,000 / $2,000,000 / $1,000,000"
            },
            {
                "key": "1000000/2000000/2000000",
                "value": "$1,000,000 / $2,000,000 / $2,000,000"
            }
        ],
        "GL": [
            {
                "key": "1000000/1000000/1000000",
                "value": "$1,000,000 / $1,000,000 / $1,000,000"
            },
            {
                "key": "1000000/2000000/1000000",
                "value": "$1,000,000 / $2,000,000 / $1,000,000"
            },
            {
                "key": "1000000/2000000/2000000",
                "value": "$1,000,000 / $2,000,000 / $2,000,000"
            }
        ],
        "WC": [
            {
                "key": "100000/500000/100000",
                "value": "$100,000 / $500,000 / $100,000"
            },
            {
                "key": "500000/500000/500000",
                "value": "$500,000 / $500,000 / $500,000"
            },
            {
                "key": "500000/1000000/500000",
                "value": "$500,000 / $1,000,000 / $500,000"
            },
            {
                "key": "1000000/1000000/1000000",
                "value": "$1,000,000 / $1,000,000 / $1,000,000"
            }
        ]
    };
    return limits;
}

/**
 * GET returns resources Quote Engine needs
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetResources(req, res, next){
    // Retrieve agencyId if it is avail
    let agencyId = null;
    if (req.query.agencyId) {
        agencyId = req.query.agencyId;
    }
    const responseObj = {};
    let rejected = false;

    responseObj.legalArticles = {};
    rejected = false;
    //const PolicyTypeBO = global.requireShared('./models/PolicyType-BO.js');
    const policyTypeBO = new PolicyTypeBO();
    const policyTypeList = await policyTypeBO.getList({wheelhouse_support: true}).catch(function(error) {
        // Check if this was
        rejected = true;
        log.error(`policyTypeBO error on getList ` + error + __location);
    });
    if (!rejected && policyTypeList) {
        responseObj.policyTypes = policyTypeList;
    }

    rejected = false;
    const TerritoryBO = global.requireShared('./models/Territory-BO.js');
    const territoryBO = new TerritoryBO();
    let error = null;
    const allTerritories = await territoryBO.getAbbrNameList().catch(function(err) {
        log.error("territory get getAbbrNameList " + err + __location);
        error = err;
    });
    if(error){
        log.error('DB query for territories list failed: ' + error.message + __location);
    }
    if (allTerritories) {
        responseObj.territories = allTerritories;
    }
    rejected = false;
   
    // TODO: pull from officer_titles BO
    responseObj.officerTitles =
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

    // TODO: uncomment below once we start utilizing logic to return policy limits based on agency
    responseObj.limits = await GetPolicyLimits(agencyId);

    responseObj.unemploymentNumberStates = [
        'CO',
        'HI',
        'ME',
        'MI',
        'MN',
        'NJ',
        'RI',
        'UT'
    ];

    res.send(200, responseObj);
    return next();
}

/**
 * GET returns resources Quote Engine needs
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function CheckZip(req, res, next){
    const responseObj = {};
    if(req.body && req.body.zip){
        //make sure we have a valid zip code
        const zipCodeBO = new ZipCodeBO();
        let error = null;
        const zipCode = stringFunctions.santizeNumber(req.body.zip, false);
        if(!zipCode){
            responseObj['error'] = true;
            responseObj['message'] = 'The zip code you entered is invalid.';
            res.send(404, responseObj);
            return next(serverHelper.requestError('The zip code you entered is invalid.'));
        }

        const zipCodeDoc = await zipCodeBO.loadByZipCode(zipCode).catch(function(err) {
            error = err;
            log.error("Unable to get ZipCode records for " + req.body.zip + err + __location);
        });
        if (error) {
            if(error.message === "not found"){
                responseObj['error'] = true;
                responseObj['message'] = 'The zip code you entered is invalid.';
                res.send(404, responseObj);
                return next(serverHelper.requestError('The zip code you entered is invalid.'));

            }
            else {
                responseObj['error'] = true;
                responseObj['message'] = 'internal error.';
                res.send(500, responseObj);
                return next(serverHelper.requestError('internal error'));
            }
        }
        if(zipCodeDoc.state){
            responseObj.territory = zipCodeDoc.state;
            res.send(200, responseObj);
            return next();
        }
        else {
            responseObj['error'] = true;
            responseObj['message'] = 'The zip code you entered is invalid.';
            res.send(404, responseObj);
            return next(serverHelper.requestError('The zip code you entered is invalid.'));
        }
        // log.debug("zipCodeBO: " + JSON.stringify(zipCodeBO.cleanJSON()))
    }

}

/**
 * GET returns associations Quote Engine needs
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetAssociations(req, res, next){
    const responseObj = {};
    if(req.query && req.query.territories){
        const territoryList = req.query.territories.split(',')
        const AssociationSvc = global.requireShared('./services/associationsvc.js');
        responseObj['error'] = false;
        responseObj['message'] = '';
        responseObj['associations'] = AssociationSvc.GetAssociationList(territoryList);
        res.send(200, responseObj);
        return next();        
    }
    else {
        responseObj['error'] = true;
        responseObj['message'] = 'Invalid input received.';
        res.send(400, responseObj);
        return next(serverHelper.requestError('Bad request'));
    }

}

async function GetInsurerPaymentPlanOptions(req, res, next) {

    const id = stringFunctions.santizeNumber(req.query.insurerId, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    let error = null;
    const insurerBO = new InsurerBO();
    const insurer = await insurerBO.getById(id).catch(function(err) {
        log.error("admin insurercontact error: " + err + __location);
        error = err;
    })
    if (error) {
        return next(error);
    }
    const insurerPaymentPlanList = insurer.paymentPlans;
    
    // TODO: Review if this is this valid, if quote amount not returned set to zero this will result in an empty paymentOptionsList
    const quoteAmount = req.query.quoteAmount ? req.query.quoteAmount : 0;
    // Retrieve the payment plans and create the payment options object
    const paymentOptions = [];
    
    for (const insurerPaymentPlan of insurerPaymentPlanList) {
        if (quoteAmount > insurerPaymentPlan.premium_threshold) {
            try {
                const PaymentPlanSvc = global.requireShared('services/paymentplansvc.js');
                const paymentPlan = PaymentPlanSvc.getById(insurerPaymentPlan.payment_plan);
                paymentOptions.push({
                    id: paymentPlan.id,
                    name: paymentPlan.name,
                    description: paymentPlan.description
                });
            }
            catch (err) {
                log.error(`Could not get payment plan for ${insurerPaymentPlan.id}:` + err + __location);
                res.send(500, []);
                return next();
            }
        }
    }
    if (paymentOptions) {
        if(paymentOptions.length === 0){
            log.warn(`Not able to find any payment plans for insurerId ${id}. Please review and make sure not an issue.` + __location);
        }
        res.send(200, paymentOptions);
        return next();
    }
}

async function GetQuoteLimits(req, res, next){
    if (!req.query || !req.query.quoteId) {
        log.warn(`Missing quote id. ${__location}`)
        return next(serverHelper.requestError("Missing Id."));
    }
    const id = req.query.quoteId;
    let error = null;
    const quoteModel = new QuoteBO();
    let quote = null;
    quote = await quoteModel.getById(id).catch(function(err) {
        log.error(`Error no quote found for quote id: ${id}. ` + err + __location)
        error = err;
    });

    if(error){
        return next(error);
    }
    // Retrieve the limits and create the limits object
    const limits = {};
    const limitsModel = new LimitsBO();
    for (const quoteLimit of quote.limits) {
        try {
            const limit = await limitsModel.getById(quoteLimit.limitId);
            // NOTE: frontend expects a string.
            limits[limit.description] = `${quoteLimit.amount}`;
        }
        catch (err) {
            log.error(`Could not get limits for ${quote.insurerId}:` + err + __location);
        }
    }

    res.send(200, {limits: limits});
    return next();

}

async function getApplicationNotes(req, res, next){

    // Check for data
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    // Make sure basic elements are present
    if (!req.query.applicationId) {
        log.error('Bad Request: Missing application id ' + __location);
        return next(serverHelper.requestError('Bad Request: You must supply an application id'));
    }

    const id = req.query.applicationId;

    // Get the agents that we are permitted to view
    let error = false;
    const agencies = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error);
    }

    const applicationBO = new ApplicationBO();
    //get application and valid agency
    let passedAgencyCheck = false;
    try{
        const applicationDB = await applicationBO.getById(req.query.applicationId);
        if(applicationDB && agencies.includes(applicationDB.agencyId)){
            passedAgencyCheck = true;
        }
        if(!applicationDB){
            return next(serverHelper.requestError('Not Found'));
        }
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this agency' + __location);
        return next(serverHelper.forbiddenError('You are not authorized for this agency'));
    }
    const applicationNotesCollectionBO = new ApplicationNotesCollectionBO();
    let applicationNotesJSON = null;
    try{
        log.debug(`Getting app notes using app id  ${id} from mongo` + __location)
        let applicationNotesDBDoc = null;
        applicationNotesDBDoc = await applicationNotesCollectionBO.getById(id);
        if(applicationNotesDBDoc){
            applicationNotesJSON = JSON.parse(JSON.stringify(applicationNotesDBDoc))
        }
    }
    catch(err){
        log.error("Error Getting application notes doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    // Return the response
    res.send(200, {applicationNotesCollection: applicationNotesJSON});
    return next();
}

async function saveApplicationNotes(req, res, next){
    if (!req.body || typeof req.body !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    if (!req.body.applicationId) {
        log.error('Bad Request: Missing applicationId ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing applicationId'));
    }

    //get user's agency List
    let error = null
    const agencies = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    const applicationBO = new ApplicationBO();
    //get application and valid agency
    let passedAgencyCheck = false;
    try{
        const applicationDB = await applicationBO.getById(req.body.applicationId);
        if(applicationDB && agencies.includes(applicationDB.agencyId)){
            passedAgencyCheck = true;
        }
        if(!applicationDB){
            return next(serverHelper.requestError('Not Found'));
        }
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    if(passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this agency' + __location);
        return next(serverHelper.forbiddenError('You are not authorized for this agency'));
    }

    let responseAppNotesDoc = null;
    let userId = null;
    try{
        userId = req.authentication.userID;
    }
    catch(err){
        log.error("Error gettign userID " + err + __location);
    }
    try{
        const applicationNotesCollectionBO = new ApplicationNotesCollectionBO();
        log.debug('Saving app notes doc');
        responseAppNotesDoc = await applicationNotesCollectionBO.saveModel(req.body, userId);
    }
    catch(err){
        //mongoose parse errors will end up there.
        log.error("Error saving application notes " + err + __location)
        return next(serverHelper.requestError(`Bad Request: Save error ${err}`));
    }

    if(responseAppNotesDoc){
        const resposeAppNotesJSON = JSON.parse(JSON.stringify(responseAppNotesDoc));
        res.send(200, {applicationNotesCollection: resposeAppNotesJSON});
        return next();
    }
    else{
        // res.send(500, "No updated document");
        return next(serverHelper.internalError(new Error('No updated document')));
    }
}
async function markQuoteAsDead(req, res, next){
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

    let error = null;
    const applicationBO = new ApplicationBO();
    let applicationId = req.body.applicationId;
    const quoteId = req.body.quoteId;

    log.debug(`Getting app id  ${applicationId} from mongo` + __location)
    const applicationDB = await applicationBO.getfromMongoByAppId(applicationId).catch(function(err) {
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
        log.error(`Did not find application Doc for mark as dead ${applicationId}` + __location);
        return next(serverHelper.requestError('Invalid id'));
    }

    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error)

    }
    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!agents.includes(parseInt(applicationDB.agencyId, 10))) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
    }
    // Find userinfo
    const id = stringFunctions.santizeNumber(req.authentication.userID, true);
    const agencyPortalUserBO = new AgencyPortalUserBO();
    // Load the request data into it
    const userJSON = await agencyPortalUserBO.getById(id).catch(function(err) {
        log.error("agencyPortalUserBO load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    let userName = null;
    if (userJSON) {
        userName = userJSON.clear_email;
    }
    else {
        log.error(`Could not find user json for user id ${req.authentication.userID} : ` + __location);
        return next(serverHelper.notFoundError('Error trying to find user information.'));
    }

    const quoteBO = new QuoteBO();
    const markAsDeadResponse = await quoteBO.markQuoteAsDead(quoteId, applicationId, userName).catch(function(err){ 
        log.error(`Error trying to mark quoteId #${quoteId} as dead on applicationId #${applicationId} ` + err + __location);
    });
    // Send back mark status.
    if(markAsDeadResponse === true){
        res.send(200, {"marked": true});
    }
    else {
        res.send({'message': 'Failed to mark quote as dead. If this continues please contact us.'});
    }
    return next();
}


async function GetBopCodes(req, res, next){
    let bopIcList = null;
    try{
        const applicationBO = new ApplicationBO();
        bopIcList = await applicationBO.getAppBopCodes(req.params.id);
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info("Error getting questions " + err + __location);
        res.send(200, {});
        //return next(serverHelper.requestError('An error occured while retrieving application questions. ' + err));
    }

    if(!bopIcList){
        res.send(200, {});
        return next();
        //return next(serverHelper.requestError('An error occured while retrieving application questions.'));
    }

    res.send(200, bopIcList);
    return next();
}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Application', `${basePath}/application`, getApplication, 'applications', 'view');
    server.addGetAuth('Get Application Doc', `${basePath}/application/:id`, getApplicationDoc, 'applications', 'view');
    server.addPostAuth('POST Create Application', `${basePath}/application`, applicationSave, 'applications', 'manage');
    server.addPutAuth('PUT Save Application', `${basePath}/application`, applicationSave, 'applications', 'manage');
    server.addPutAuth('PUT Re-Quote Application', `${basePath}/application/:id/requote`, requote, 'applications', 'manage');
    server.addPutAuth('PUT Validate Application', `${basePath}/application/:id/validate`, validate, 'applications', 'manage');

    server.addPutAuth('PUT bindQuote Application', `${basePath}/application/:id/bind`, bindQuote, 'applications', 'bind');

    server.addPutAuth('PUT requestBindQuote Application', `${basePath}/application/:id/requestbind`, bindQuote, 'applications', 'manage');

    server.addDeleteAuth('DELETE Application', `${basePath}/application/:id`, deleteObject, 'applications', 'manage');

    server.addPostAuth('POST Copy Application', `${basePath}/application/copy`, applicationCopy, 'applications', 'manage');

    server.addGetAuth('GetQuestions for AP Application', `${basePath}/application/:id/questions`, GetQuestions, 'applications', 'manage')
    server.addGetAuth('GetBopCodes for AP Application', `${basePath}/application/:id/bopcodes`, GetBopCodes, 'applications', 'manage')

    server.addGetAuth('Get Agency Application Resources', `${basePath}/application/getresources`, GetResources)
    server.addGetAuth('GetAssociations', `${basePath}/application/getassociations`, GetAssociations)
    server.addPostAuth('Checkzip for Quote Engine', `${basePath}/application/checkzip`, CheckZip)
    server.addGetAuth('Get Insurer Payment Options', `${basePath}/application/insurer-payment-options`, GetInsurerPaymentPlanOptions);
    server.addGetAuth('Get Quote Limits Info',`${basePath}/application/quote-limits`, GetQuoteLimits)
    server.addGetAuth('GET Application Notes', `${basePath}/application/notes`, getApplicationNotes, 'applications', 'view');
    server.addPostAuth('POST Create Application Notes', `${basePath}/application/notes`, saveApplicationNotes, 'applications', 'manage');
    server.addPutAuth('PUT Update Application Notes', `${basePath}/application/notes`, saveApplicationNotes, 'applications', 'manage');
    server.addPutAuth('PUT Mark Quote As Dead', `${basePath}/application/:id/mark-as-dead`, markQuoteAsDead, 'applications', 'manage');
};