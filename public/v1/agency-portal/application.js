/* eslint-disable dot-notation */
/* eslint-disable require-jsdoc */
'use strict';
const validator = global.requireShared('./helpers/validator.js');
const auth = require('./helpers/auth.js');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBO = global.requireShared('models/Quote-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
const IndustryCodeCategoryBO = global.requireShared('models/IndustryCodeCategory-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const PolicyTypeBO = global.requireShared('models/PolicyType-BO.js');
const PaymentPlanBO = global.requireShared('models/PaymentPlan-BO.js');
const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');

const ApplicationQuoting = global.requireRootPath('public/v1/quote/helpers/models/Application.js');
const status = global.requireShared('./models/application-businesslogic/status.js');
const jwt = require('jsonwebtoken');
const moment = require('moment');


/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getApplication(req, res, next) {
    let error = false;

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

    if(id > 0){
        // Validate the application ID
        if (!await validator.is_valid_id(id)) {
            log.error(`Bad Request: Invalid id ${id}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
    }

    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error);
    }

    // // Check if this is Solepro and grant them special access
    // let where = `${db.quoteName('a.agency')} IN (${agents.join(',')})`;
    // if (agents.length === 1 && agents[0] === 12) {
    //     // This is Solepro (no restriction on agency ID, just applications tagged to them)
    //     where = `${db.quoteName('a.solepro')} = 1`;
    // }
    const applicationBO = new ApplicationBO();
    let passedAgencyCheck = false;
    let applicationJSON = null;
    try{
        let applicationDBDoc = null;
        if(id > 0){
            applicationDBDoc = await applicationBO.loadfromMongoBymysqlId(id);
        }
        else {
            log.debug("Getting id from mongo")
            applicationDBDoc = await applicationBO.getfromMongoByAppId(id);
        }


        if(applicationDBDoc && agents.includes(applicationDBDoc.agencyId)){
            passedAgencyCheck = true;
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
                        if(activityPayroll.ownerPayRoll){
                            activityPayroll.payroll += activityPayroll.ownerPayRoll
                        }
                    }
                    catch(err){
                        log.error(`Error getting activity code  ${location.activityPayrollList[j].ncciCode} ` + err + __location);
                    }
                }
            }
        }
    }

    //add Agency name
    const agencyBO = new AgencyBO();
    try{
        await agencyBO.loadFromId(applicationJSON.agencyId)
        applicationJSON.name = agencyBO.name;
        applicationJSON.agencyName = agencyBO.name;

    }
    catch(err){
        log.error("Error getting agencyBO " + err + __location);
        error = true;

    }
    //add industry description
    const industryCodeBO = new IndustryCodeBO();
    try{
        const industryCodeJson = await industryCodeBO.getById(applicationJSON.industryCode);
        if(industryCodeJson){
            applicationJSON.industryCodeName = industryCodeJson.description;
            const industryCodeCategoryBO = new IndustryCodeCategoryBO()
            const industryCodeCategoryJson = await industryCodeCategoryBO.getById(industryCodeJson.category);
            if(industryCodeCategoryJson){
                applicationJSON.industryCodeCategory = industryCodeCategoryJson.name;
            }
        }
    }
    catch(err){
        log.error("Error getting industryCodeBO " + err + __location);
    }
    //Primary Contact
    const customerContact = applicationJSON.contacts.find(contactTest => contactTest.primary === true);
    applicationJSON.email = customerContact.email;
    applicationJSON.fname = customerContact.firstName;
    applicationJSON.lname = customerContact.lastName;
    applicationJSON.phone = customerContact.phone;

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
        const paymentPlanBO = new PaymentPlanBO()
        try{
            paymentPlanList = await paymentPlanBO.getList();
        }
        catch(err){
            log.error("Error get paymentPlanList " + err + __location)
        }


        for (let i = 0; i < quoteList.length; i++) {
            // eslint-disable-next-line prefer-const
            let quoteJSON = quoteList[i];
            if(quoteJSON.quoteLetter){
                quoteJSON.quote_letter = quoteJSON.quoteLetter;
            }
            if (!quoteJSON.status && quoteJSON.apiResult) {
                quoteJSON.status = quoteJSON.apiResult;
            }
            quoteJSON.number = quoteJSON.quoteNumber;
            // Change the name of autodeclined
            if (quoteJSON.status === 'autodeclined') {
                quoteJSON.status = 'Out of Market';
            }
            if (quoteJSON.status === 'bind_requested'
                || quoteJSON.bound
                || quoteJSON.status === 'quoted') {

                quoteJSON.reasons = '';
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
        }
        // Add the quotes to the response
        applicationJSON.quotes = quoteList;
        if (req.authentication.permissions.applications.viewlogs) {
            applicationJSON.showLogs = true;
        }
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
        applicationDB = await applicationBO.loadfromMongoByAppId(appId);
        if(applicationDB && agencies.includes(applicationDB.agencyId)){
            passedAgencyCheck = true;
        }
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
                req.body.agencyNetworkId = agencyDB.agency_network;
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
            if(locationPrimaryJSON && locationPrimaryJSON.id){
                req.body.agencyLocationId = locationPrimaryJSON.id;
            }
        }
    }
    else {
        //get application and valid agency
        let passedAgencyCheck = false;
        try{
            const applicationDB = await applicationBO.loadfromMongoByAppId(req.body.applicationId);
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
        const updateMysql = true;
        if(req.body.applicationId){
            log.debug("App Doc UPDATE.....")
            //update
            req.body.agencyPortalModifiedUser = userId
            responseAppDoc = await applicationBO.updateMongo(req.body.applicationId, req.body, updateMysql);
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
        const applicationDocDB = await applicationBO.loadfromMongoByAppId(req.body.applicationId);
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
        const propsToRemove = ["_id","id","applicationId", "uuid","mysqlId"]
        for(let i = 0; i < propsToRemove.length; i++){
            if(newApplicationDoc[propsToRemove[i]]){
                delete newApplicationDoc[propsToRemove[i]]
            }
        }

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
        req.body.agencyPortalCreatedUser = userId
        req.body.agencyPortalCreated = true;
        const updateMysql = true;
        responseAppDoc = await applicationBO.insertMongo(newApplicationDoc, updateMysql);
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
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }
    //Deletes only by AgencyNetwork Users.

    const agencyNetwork = req.authentication.agencyNetwork;
    if (!agencyNetwork) {
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
    if (appAgencyNetworkId !== agencyNetwork) {
        log.warn("Application Delete agencynetowrk miss match")
        res.send(403);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }


    await applicationBO.deleteSoftById(id).catch(function(err) {
        log.error("Location load error " + err + __location);
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
        log.debug("Getting id from mongo")
        const appDoc = await applicationBO.getfromMongoByAppId(id).catch(function(err) {
            log.error(`Error getting application Doc for validate ${id} ` + err + __location);
            log.error('Bad Request: Invalid id ' + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        if(appDoc){
            log.debug("Have doc for " + appDoc.mysqlId)
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
    log.debug("Loading Application by mysqlId")
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
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error)

    }

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
        log.debug("Getting id from mongo")
        const appDoc = await applicationBO.getfromMongoByAppId(id).catch(function(err) {
            log.error(`Error getting application Doc for validate ${id} ` + err + __location);
            log.error('Bad Request: Invalid id ' + __location);
            error = err;
        });
        if (error) {
            return next(error);
        }
        if(appDoc){
            log.debug("Have doc for " + appDoc.mysqlId)
            id = appDoc.mysqlId;
        }
        else {
            log.error(`Did not find application Doc for validate ${id}` + __location);
            return next(serverHelper.requestError('Invalid id'));
        }
    }

    //Get app and check status
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
    // Check agency Network or Agency rights....
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error)

    }

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


    if (applicationDB.appStatusId > 60) {
        return next(serverHelper.requestError('Cannot Requote Application'));
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
        log.error(`Error loading application ${req.body.id ? req.body.id : ''}: ${err.message}` + __location);
        res.send(err);
        return next();
    }
    // Validate
    try {
        await applicationQuoting.validate();
    }
    catch (err) {
        const errMessage = `Error validating application ${id ? id : ''}: ${err.message}`
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
        log.error(`Error update appication progress appId = ${req.body.id}  for quoting. ` + err + __location);
    }


    // Build a JWT that contains the application ID that expires in 5 minutes.
    const tokenPayload = {applicationID: req.body.id};
    const token = jwt.sign(tokenPayload, global.settings.AUTH_SECRET_KEY, {expiresIn: '5m'});
    // Send back the token
    res.send(200, token);

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
    log.debug('running quotes')
    try {
        await application.run_quotes();
    }
    catch (error) {
        log.error(`Getting quotes on application ${application.id} failed: ${error} ${__location}`);
    }

    // Update the application quote progress to "complete"
    const applicationBO = new ApplicationBO();
    try {
        await applicationBO.updateProgress(application.id, "complete");
    }
    catch (err) {
        log.error(`Error update appication progress appId = ${application.id}  for complete. ` + err + __location);
    }

    // Update the application status
    await status.updateApplicationStatus(application.id);
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
    const responseObj = {};
    let rejected = false;
    const sql = `select id, introtext from clw_content where id in (10,11)`
    const result = await db.query(sql).catch(function(error) {
        // Check if this was
        rejected = true;
        log.error(`clw_content error on select ` + error + __location);
    });
    if (!rejected) {
        const legalArticles = {};
        for(let i = 0; i < result.length; i++){
            const dbRec = result[0];
            legalArticles[dbRec.id] = dbRec
        }
        responseObj.legalArticles = legalArticles;
    }
    rejected = false;
    const sql2 = `select abbr as type,description,heading, name from clw_talage_policy_types where abbr in ('BOP', 'GL', 'WC')`
    const result2 = await db.query(sql2).catch(function(error) {
        // Check if this was
        rejected = true;
        log.error(`clw_talage_policy_types error on select ` + error + __location);
    });
    if (!rejected) {
        responseObj.policyTypes = result2;
    }

    rejected = false;
    const sql3 = `select abbr, name from clw_talage_territories`
    const result3 = await db.query(sql3).catch(function(error) {
        // Check if this was
        rejected = true;
        log.error(`clw_talage_territories error on select ` + error + __location);
    });
    if (!rejected) {
        responseObj.territories = result3;
    }
    rejected = false;
    const sql4 = `SELECT officerTitle FROM \`officer_titles\``;
    const result4 = await db.query(sql4).catch(function(error) {
        // Check if this was
        rejected = true;
        log.error(`officer_titles error on select ` + error + __location);
    });
    if (!rejected) {
        responseObj.officerTitles = result4.map(officerTitleObj => officerTitleObj.officerTitle);
    }

    responseObj.limits = {
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
        let rejected = false;
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

        await zipCodeBO.loadByZipCode(zipCode).catch(function(err) {
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

        // log.debug("zipCodeBO: " + JSON.stringify(zipCodeBO.cleanJSON()))

        // Check if we have coverage.
        const sql = `select  z.territory, t.name, t.licensed 
            from clw_talage_zip_codes z
            inner join clw_talage_territories t  on z.territory = t.abbr
            where z.zip  = ${db.escape(req.body.zip)}`;
        const result = await db.query(sql).catch(function(err) {
            // Check if this was
            rejected = true;
            log.error(`clw_content error on select ` + err + __location);
        });
        if (!rejected) {
            if(result && result.length > 0){
                responseObj.territory = result[0].territory
                if(result[0].licensed === 1){
                    responseObj['error'] = false;
                    responseObj['message'] = '';
                }
                else {
                    responseObj['error'] = true;
                    responseObj['message'] = 'We do not currently provide coverage in ' + responseObj.territory;
                }
                res.send(200, responseObj);
                return next();

            }
            else {
                responseObj['error'] = true;
                responseObj['message'] = 'The zip code you entered is invalid.';
                res.send(404, responseObj);
                return next(serverHelper.requestError('The zip code you entered is invalid.'));
            }
        }
        else {
            responseObj['error'] = true;
            responseObj['message'] = 'internal error.';
            res.send(500, responseObj);
            return next(serverHelper.requestError('internal error'));
        }
    }
    else {
        responseObj['error'] = true;
        responseObj['message'] = 'Invalid input received.';
        res.send(400, responseObj);
        return next(serverHelper.requestError('Bad request'));
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
        var inList = new Array(territoryList.length).fill('?').join(',');
        let rejected = false;
        const sql = `select  a.id, a.name
            from clw_talage_associations a
            inner join clw_talage_association_territories at on at.association = a.id
            where a.state  = 1
            AND at.territory in (${inList})
            order by a.name ASC`;

        const result = await db.queryParam(sql,territoryList).catch(function(error) {
            // Check if this was
            rejected = true;
            log.error(`clw_content error on select ` + error + __location);
        });
        if (!rejected) {
            if(result && result.length > 0){
                responseObj['error'] = false;
                responseObj['message'] = '';
                responseObj['associations'] = result;
                res.send(200, responseObj);
                return next();

            }
            else {
                responseObj['error'] = true;
                responseObj['message'] = 'No associations returned.';
                res.send(404, responseObj);
            }
        }
        else {
            responseObj['error'] = true;
            responseObj['message'] = 'internal error.';
            res.send(500, responseObj);
            return next(serverHelper.requestError('internal error'));
        }
    }
    else {
        responseObj['error'] = true;
        responseObj['message'] = 'Invalid input received.';
        res.send(400, responseObj);
        return next(serverHelper.requestError('Bad request'));
    }

}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Application', `${basePath}/application`, getApplication, 'applications', 'view');
    server.addGetAuth('Get Application Doc', `${basePath}/application/:id`, getApplicationDoc, 'applications', 'view');
    server.addPostAuth('POST Create Application', `${basePath}/application`, applicationSave, 'applications', 'manage');
    server.addPutAuth('PUT Save Application', `${basePath}/application`, applicationSave, 'applications', 'manage');
    server.addPutAuth('PUT Re-Quote Application', `${basePath}/application/:id/requote`, requote, 'applications', 'manage');
    server.addPutAuth('PUT Re-Quote Application', `${basePath}/application/:id/validate`, validate, 'applications', 'manage');

    server.addDeleteAuth('DELETE Application', `${basePath}/application/:id`, deleteObject, 'applications', 'manage');

    server.addPostAuth('POST Copy Application', `${basePath}/application/copy`, applicationCopy, 'applications', 'manage');

    server.addGetAuth('GetQuestions for AP Application', `${basePath}/application/:id/questions`, GetQuestions, 'applications', 'manage')

    server.addGetAuth('Get Agency Application Resources', `${basePath}/application/getresources`, GetResources)
    server.addGetAuth('GetAssociations', `${basePath}/application/getassociations`, GetAssociations)
    server.addPostAuth('Checkzip for Quote Engine', `${basePath}/application/checkzip`, CheckZip)

};