/* eslint-disable no-trailing-spaces */
/* eslint-disable object-curly-newline */
/* eslint-disable object-property-newline */
/* eslint-disable no-catch-shadow */
/* eslint-disable dot-notation */
/* eslint-disable require-jsdoc */
const validator = global.requireShared('./helpers/validator.js');
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const QuoteBO = global.requireShared('models/Quote-BO.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');
const IndustryCodeBO = global.requireShared('models/IndustryCode-BO.js');
const IndustryCodeCategoryBO = global.requireShared('models/IndustryCodeCategory-BO.js');
const InsurerBO = global.requireShared('models/Insurer-BO.js');
const PolicyTypeBO = global.requireShared('models/PolicyType-BO.js');
const ActivityCodeBO = global.requireShared('models/ActivityCode-BO.js');
const LimitsBO = global.requireShared('models/Limits-BO.js');
const ApplicationQuoting = global.requireRootPath('quotesystem/models/Application.js');
const QuoteBind = global.requireRootPath('quotesystem/models/QuoteBind.js');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const {Error} = require('mongoose');
const {applicationStatus} = global.requireShared('./models/status/applicationStatus.js');
const {quoteStatus, QuoteStatusDesc} = global.requireShared('./models/status/quoteStatus.js');
const ActivityCodeSvc = global.requireShared('services/activitycodesvc.js');
const appLinkCreator = global.requireShared('./services/application-link-svc.js');
const requiredFieldSvc = global.requireShared('./services/required-app-fields-svc.js');

// Application Messages Imports
//const mongoUtils = global.requireShared('./helpers/mongoutils.js');
var Message = global.mongoose.Message;

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
            passedAgencyCheck = await auth.authorizedForAgency(req, applicationDBDoc.agencyId, applicationDBDoc.agencyNetworkId)
        }
        
        if(applicationDBDoc && passedAgencyCheck){
            applicationJSON = JSON.parse(JSON.stringify(applicationDBDoc))
        }
       
    }
    catch(err){
        log.error("Error Getting application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }
    if(passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this application' + __location);
        //Return not found so do not expose that the application exists
        return next(serverHelper.notFoundError('Application Not Found'));
    }
    
    if(!applicationJSON){
        return next(serverHelper.notFoundError('Application Not Found'));
    }
    

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

    await setupReturnedApplicationJSON(applicationJSON, quoteList)


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

        // need agencyNetwork feature controling status text
        let agencyNetworkList = null;
        const agencyNetworkBO = new AgencyNetworkBO();
        try {
            agencyNetworkList = await agencyNetworkBO.getList({});
        }
        catch (err) {
            log.error("Error getting Agency Network List " + err + __location);
            throw err;
        }


        const delimiter = ' '
        applicationJSON.displayStatus = applicationJSON.status.replace('_referred', '*').replace(/_/g, ' ')
        applicationJSON.displayStatus = applicationJSON.displayStatus.toLowerCase().split(delimiter).map((s) => `${s.charAt(0).toUpperCase()}${s.substring(1)}`).join(' ');
        applicationJSON.displayStatus = applicationJSON.displayStatus.replace('Uw', 'UW')

        if(applicationJSON.agencyNetworkId === 4 && (applicationJSON.appStatusId === applicationStatus.requestToBind.appStatusId || applicationJSON.appStatusId === applicationStatus.requestToBindReferred.appStatusId)){
            applicationJSON.status = "submitted_to_uw";
            applicationJSON.displayStatus = 'Submitted To UW';
        }


        //? titleCase(data.item.displayStatus.replace('_referred', '*').replace(/_/g, ' ')).replace('Uw', 'UW')
        const agencyNetworkDoc = agencyNetworkList.find((an) => an.agencyNetworkId === applicationJSON.agencyNetworkId)
        if(applicationJSON.agencyNetworkId > 1 && (applicationJSON.appStatusId === applicationStatus.requestToBind.appStatusId || applicationJSON.appStatusId === applicationStatus.requestToBindReferred.appStatusId)){
            if(applicationJSON.agencyNetworkId === 4){
                // quoteJSON.status = "Submitted To UW";
                applicationJSON.displayStatus = 'Submitted To UW';
            }
            else if(agencyNetworkDoc?.featureJson?.requestToBindProcessedText.length > 3 && applicationJSON.appStatusId === applicationStatus.requestToBind.appStatusId){
                applicationJSON.displayStatus = agencyNetworkDoc.featureJson.requestToBindProcessedText;
                //quoteJSON.displayStatus = appAgencyNetwork.featureJson.requestToBindProcessedText;
            }
            else if(agencyNetworkDoc?.featureJson?.requestToBindReferredProcessedText.length > 3 && applicationJSON.appStatusId === applicationStatus.requestToBindReferred.appStatusId){
                applicationJSON.displayStatus = agencyNetworkDoc.featureJson.requestToBindReferredProcessedText;
                //quoteJSON.displayStatus = appAgencyNetwork.featureJson.requestToBindReferredProcessedText;
            }
        }
        log.debug(`applicationJSON.displayStatus ${applicationJSON.displayStatus}`)
       
        for (let i = 0; i < quoteList.length; i++) {
            // eslint-disable-next-line prefer-const
            let quoteJSON = quoteList[i];

            if(quoteJSON.quoteLetter){
                quoteJSON.quote_letter = quoteJSON.quoteLetter;
            }
           
            if(quoteJSON.quoteStatusDescription){
                quoteJSON.status = quoteJSON.quoteStatusDescription
            }
            quoteJSON.displayStatus = QuoteStatusDesc(quoteJSON.quoteStatusId)
            quoteJSON.number = quoteJSON.quoteNumber;
            //filter out referred with price that is 55.
            if (quoteJSON.quoteStatusId === quoteStatus.quoted.id || quoteJSON.quoteStatusId > quoteStatus.quoted_referred.id || quoteJSON.bound){
                quoteJSON.reasons = '';
                if(quoteJSON.quoteStatusId === quoteStatus.bound.id || quoteJSON.bound){
                    quoteJSON.status = quoteStatus.bound.description;
                }
            }
            // Change the name of autodeclined
            if (quoteJSON.quoteStatusId === quoteStatus.autodeclined.id) {
                quoteJSON.status = 'Out of Market';
                quoteJSON.displayStatus = 'Out of Market';
            }
            else if(!quoteJSON.displayStatus && typeof quoteJSON.status === 'string'){
                //ucase word
                const wrkingString = stringFunctions.strUnderscoretoSpace(quoteJSON.status)
                quoteJSON.displayStatus = stringFunctions.ucwords(wrkingString)
            }

            const appAgencyNetwork = agencyNetworkList.find((an) => an.agencyNetworkId === applicationJSON.agencyNetworkId)
            //Look up Agency Network's Request to Bind Text
            if(applicationJSON.agencyNetworkId > 1 && (quoteJSON.quoteStatusId === quoteStatus.bind_requested.id || quoteJSON.quoteStatusId === quoteStatus.bind_requested_referred.id)){
                if(applicationJSON.agencyNetworkId === 4){
                    quoteJSON.status = "Submitted To UW";
                    quoteJSON.displayStatus = 'Submitted To UW';
                }
                else if(appAgencyNetwork?.featureJson?.requestToBindProcessedText.length > 3 && quoteJSON.quoteStatusId === quoteStatus.bind_requested.id){
                    quoteJSON.status = appAgencyNetwork.featureJson.requestToBindProcessedText;
                    quoteJSON.displayStatus = appAgencyNetwork.featureJson.requestToBindProcessedText;
                } 
                else if(appAgencyNetwork?.featureJson?.requestToBindReferredProcessedText.length > 3 && quoteJSON.quoteStatusId === quoteStatus.bind_requested_referred.id){
                    quoteJSON.status = appAgencyNetwork.featureJson.requestToBindReferredProcessedText;
                    quoteJSON.displayStatus = appAgencyNetwork.featureJson.requestToBindReferredProcessedText;
                }
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
                if(insurer){
                    // i.logo,
                    //i.name as insurerName,
                    quoteJSON.logo = insurer.logo
                    quoteJSON.insurerName = insurer.name
                    quoteJSON.website = insurer.website
                }
                else {
                    log.error(`Error Quote insurer ${quoteJSON.insurerId} not found in database for Application GET  appId ${applicationJSON.applicationId}` + __location);
                    quoteJSON.insurerName = "unknown";
                }
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
        if(applicationDB && agencies.includes(applicationDB?.agencyId)){
            passedAgencyCheck = true;
        }
        await setupReturnedApplicationJSON(applicationDB);
    }
    catch(err){
        log.error("Error checking application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }

    try{
        applicationDB = await applicationBO.getById(appId);
        if(applicationDB){
            passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB.agencyId, applicationDB.agencyNetworkId)
        }
    }
    catch(err){
        log.error("Error Getting application doc " + err + __location)
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


async function setupReturnedApplicationJSON(applicationJSON, quoteList){
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

    //TODO update for customizeable status descriptions
    try{
        if(applicationJSON.agencyNetworkId === 4 && (applicationJSON.appStatusId === applicationStatus.requestToBind.appStatusId || applicationJSON.appStatusId === applicationStatus.requestToBindReferred.appStatusId)){
            applicationJSON.status = "submitted_to_uw";
        }
    }
    catch(err){
        log.error("Application Status processing error " + err + __location)
    }
    // // owners birthday formatting
    try{
        const activityCodeBO = new ActivityCodeBO()
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
                if(owner.activityCodeId > 0){
                    const activityCode = await activityCodeBO.getById(owner.activityCodeId, true)
                    if(activityCode){
                        owner.activityDescription = !activityCode.description ? '' : activityCode.description;
                    }
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
                        if(activityPayroll.activityCodeId){
                            const activtyCodeJSON = await activityCodeBO.getById(activityPayroll.activityCodeId);
                            activityPayroll.description = activtyCodeJSON?.description;
                        }
                       
                       
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
                        log.error(`AppId ${applicationJSON.applicationId} Error getting activity code  ${location.activityPayrollList[j].activityCodeId} ` + err + __location);
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
        applicationJSON.showAmsButton = false;
        applicationJSON.AmsButtonText = "Push to AMS";
        applicationJSON.AmsName = "AMS";
        //check for AMS connection
        let amsCred = await agencyBO.getAmsCredentials(applicationJSON.agencyId);
        
        if(!amsCred && quoteList?.length > 0){
            // check for TalageWhole - (TODO wholesale agency)
            const talageWholeQuote = quoteList.find((q) => q.handledByTalage);
            if(talageWholeQuote){
                amsCred = await agencyBO.getAmsCredentials(1);
            }
        }

        if(amsCred?.amsType){
            applicationJSON.showAmsButton = true;
            //TODO Switch when more AMS's added
            if(amsCred?.amsType === "Nextsure"){
                applicationJSON.AmsButtonText = "Push to Nextsure";
                applicationJSON.AmsName = "Nextsure";
            }
        }
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
    else if((applicationJSON.agencyPortalCreated || applicationJSON.apiCreated) && parseInt(applicationJSON.agencyPortalCreatedUser,10) > 0){
        const agencyPortalUserBO = new AgencyPortalUserBO();
        try{
            const userId = parseInt(applicationJSON.agencyPortalCreatedUser,10);
            const apUser = await agencyPortalUserBO.getById(userId);
            if(apUser){
                applicationJSON.creatorEmail = apUser.email;
            }
            else {
                log.error(`Did not find agencyPortalUser ${applicationJSON.agencyPortalCreatedUser} for appId: ${applicationJSON.applicationId} ` + __location);
            }
        }
        catch(err){
            log.error(`Error getting agencyPortalUserBO for appId: ${applicationJSON.applicationId} ` + err + __location);
        }
    }

    //add industry description
    if(applicationJSON.industryCode && parseInt(applicationJSON.industryCode, 10) > 0){
        const industryCodeBO = new IndustryCodeBO();
        try{
            const industryCodeId = parseInt(applicationJSON.industryCode, 10);
            const industryCodeJson = await industryCodeBO.getById(industryCodeId);
            if(industryCodeJson){
                applicationJSON.industryCodeName = industryCodeJson.description;
                const industryCodeCategoryBO = new IndustryCodeCategoryBO()
                const industryCodeCategoryJson = await industryCodeCategoryBO.getById(industryCodeJson.industryCodeCategoryId);
                if(industryCodeCategoryJson){
                    applicationJSON.industryCodeCategory = industryCodeCategoryJson.name;
                }
            }
            const bopPolicy = applicationJSON.policies.find((p) => p.policyType === "BOP")
            if(bopPolicy && bopPolicy.bopIndustryCodeId){
                const bopIcJson = await industryCodeBO.getById(bopPolicy.bopIndustryCodeId);
                if(bopIcJson){
                    log.debug(`setting bopCodeIndustryCodeName ${bopIcJson.description}` + __location)
                    applicationJSON.bopCodeIndustryCodeName = bopIcJson.description
                }
                else {
                    applicationJSON.bopCodeIndustryCodeName = "";
                }   
            }
            else {
                applicationJSON.bopCodeIndustryCodeName = "";
            }
        }
        catch(err){
            log.warn(`Error getting industryCodeBO for appId ${applicationJSON.applicationId} ` + err + __location);
        }
    }
    else {
        applicationJSON.industryCodeName = "";
        applicationJSON.industryCodeCategory = "";
        applicationJSON.bopCodeIndustryCodeName = "";
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
    // log.debug("Application Post: " + JSON.stringify(req.body));
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
       

        //Get AgencyNetworkID
        let agencyDB = null
        try{
            const agencyBO = new AgencyBO()
            agencyDB = await agencyBO.getById(req.body.agencyId)
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
        
        const passedAgencyCheck = await auth.authorizedForAgency(req, agencyDB.systemId, agencyDB.agencyNetworkId)


        // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
        if (!passedAgencyCheck) {
            log.info('Forbidden: User is not authorized for this agency' + __location);
            return next(serverHelper.forbiddenError('You are not authorized for this agency'));
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
        let passedAgencyCheck = false;
        try{
            const appId = req.body.applicationId
            const applicationDB = await applicationBO.getById(appId);
            if(applicationDB){
                passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB.agencyId, applicationDB.agencyNetworkId)
            }
        }
        catch(err){
            log.error("Error Getting application doc " + err + __location)
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


    const applicationBO = new ApplicationBO();


    //get application and valid agency
    let passedAgencyCheck = false;
    let responseAppDoc = null;
    try{
        const applicationDocDB = await applicationBO.getById(req.body.applicationId);
        passedAgencyCheck = await auth.authorizedForAgency(req, applicationDocDB?.agencyId, applicationDocDB?.agencyNetworkId)

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
                delete newApplicationDoc[propsToRemove[i]];
            }
        }

        // for cross sell, change the policy and effective date to the ones passed through
        if(req.body.crossSellCopy === true || req.body.crossSellCopy === "true"){
            if(req.body.policyType && req.body.effectiveDate){
                //Validate Agency location Support policyType
                if(applicationDocDB.agencyLocationId){
                    const agencyLocationBO = new AgencyLocationBO();
                    const getChildren = true;
                    const addAgencyPrimaryLocation = true;
                    const agencyLocationJSON = await agencyLocationBO.getById(applicationDocDB.agencyLocationId, getChildren, addAgencyPrimaryLocation).catch(function(err) {
                        log.error(`Error Copying application doc getting Agency Location ${applicationDocDB.agencyLocationId} ${err}` + __location)
                    });
                    if(agencyLocationJSON){
                        let gotHit = false;
                        for(const insurer of agencyLocationJSON.insurers){
                            if(insurer.policyTypeInfo[req.body.policyType.toUpperCase()] && insurer.policyTypeInfo[req.body.policyType.toUpperCase()].enabled === true){
                                gotHit = true;
                                break;
                            }
                        }
                        if(!gotHit){
                            log.warn(`Application copy Agency Location does not cover -  ${req.body.policyType} AppId ${req.body.applicationId} ` + __location)
                            res.send(400, `Application agency location does not cover -  ${req.body.policyType}`);
                            return next(serverHelper.requestError(`Bad Request: check error `));
                        }
                    }
                    else {
                        log.warn(`Application copy Agency Location is no longer available  -  ${req.body.applicationId}  ` + __location)
                        res.send(500, `Application agency location is no longer available`);
                        return next(serverHelper.internalError(`Application agency location is no longer available `));
                    }
                }   
                else {
                    log.error("Error Copying application doc no Agency Location " + __location)
                    res.send(500, `Application corrupted no agency location`);
                    return next(serverHelper.internalError(`Application corrupted no agency location`));
                }

                newApplicationDoc.policies = [{
                    policyType: req.body.policyType,
                    effectiveDate: req.body.effectiveDate
                }];
            }
            newApplicationDoc.claims = [];
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
            log.error("Error getting userID " + err + __location);
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
        log.error("Error Copying application doc " + err + __location)
        res.send(500, `No copied Application = ${err}`);
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
    if (req.authentication.isAgencyNetworkUser === false) {
        log.warn('App Delete not agency network user ' + __location)
        res.send(403);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }
    //check that application is agency network.
    let error = null;
    const applicationBO = new ApplicationBO();
    const applicationDocDB = await applicationBO.getById(id);
    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDocDB?.agencyId, applicationDocDB?.agencyNetworkId)

    if(!passedAgencyCheck){
        log.warn(`Application Delete not authorized to manage this agency userId ${req.authentication.userID}` + __location)
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
   
    
    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDocDB?.agencyId, applicationDocDB?.agencyNetworkId)
    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
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
    
    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
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

        if(!err.message?.includes("Application's Agency Location does not cover")){
            log.warn(errMessage + __location);
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
 * @param {object} req - Restify req object
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

    const applicationBO = new ApplicationBO();
    const applicationDB = await applicationBO.getfromMongoByAppId(req.params.id).catch(function(err) {
        log.error(`Error getting application Doc for runQuotes ${req.params.id} ` + err + __location);
        log.error('Bad Request: Invalid id ' + __location);

    });
    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
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

    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
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
                const policyInfo = {};
                if (Object.prototype.hasOwnProperty.call(req.body, 'premiumAmount')) {
                    policyInfo.policyPremium = parseInt(req.body.premiumAmount,10);
                }
                if (Object.prototype.hasOwnProperty.call(req.body, 'policyNumber')) {
                    policyInfo.policyNumber = req.body.policyNumber;
                }

                markAsBoundResponse = await quoteBO.markQuoteAsBound(quoteId, applicationId, req.authentication.userID, policyInfo)
                if(applicationDB.appStatusId !== 90){
                    // Update application status
                    await applicationBO.updateStatus(applicationId,"bound", 90)
                   
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
            },
            {
                "key": "2000000/4000000/4000000",
                "value": "$2,000,000 / $4,000,000 / $4,000,000"
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

    //TODO Software Hook


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

    const passedAgencyCheck = await auth.authorizedForAgency(req, agencyId)
    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
        log.info('Forbidden: User is not authorized to access the requested resource');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested resource'));
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

    //get agency featureJson.
    if(agencyId){
        const agencyBO = new AgencyBO();
        try{
            const returnDoc = false;
            const returnDeleted = true
            const agencyJSON = await agencyBO.getById(agencyId, returnDoc, returnDeleted)
            responseObj.featureJson = agencyJSON.featureJson;
        }
        catch(err){
            log.error("Error getting agencyBO " + err + __location);
        }
    }


    //TODO Software Hook

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
        const associationList = AssociationSvc.GetAssociationList(territoryList);
        //Agency Network Feature to Enable associations.
        //get agency Network to check if associations should be returned
        if(associationList.length > 0){
            const agencyNetworkBO = new AgencyNetworkBO();
            const agencyNetworkJSON = await agencyNetworkBO.getById(req.authentication.agencyNetworkId);
            if(agencyNetworkJSON && agencyNetworkJSON.featureJson?.showAppAssociationsField !== false){
                responseObj['associations'] = associationList;
            }
        }     
        //TODO Software Hook

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
        //TODO Software Hook
        
        res.send(200, paymentOptions);
        return next();
    }
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
    const id = req.query.id
    const applicationBO = new ApplicationBO();
    let passedAgencyCheck = false;
    let applicationJSON = null;
    try{
        const applicationDBDoc = await applicationBO.getById(id);
        if(applicationDBDoc){
            passedAgencyCheck = await auth.authorizedForAgency(req, applicationDBDoc.agencyId, applicationDBDoc.agencyNetworkId)
        }
        
        if(applicationDBDoc && passedAgencyCheck){
            applicationJSON = JSON.parse(JSON.stringify(applicationDBDoc))
        }
       
    }
    catch(err){
        log.error("Error Getting application doc " + err + __location)
        return next(serverHelper.requestError(`Bad Request: check error ${err}`));
    }
    if(passedAgencyCheck === false){
        log.info('Forbidden: User is not authorized for this application' + __location);
        //Return not found so do not expose that the application exists
        return next(serverHelper.notFoundError('Application Not Found'));
    }

    //call requiredField svc to get a required field structure.
    requireFieldJSON = await requiredFieldSvc.requiredFields(applicationJSON.applicationId);

    res.send(200, requireFieldJSON);
    return next();

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

    const passedAgencyCheck = await auth.authorizedForAgency(req, quote?.agencyId, quote?.agencyNetworkId)

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
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

    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)
    
    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
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
        userName = userJSON.email;
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

async function GetFireCodes(req, res, next) {
    let hasAccess = false;
    try {
        hasAccess = await accesscheck(req.params.id, req);
    }
    catch (e) {
        log.error(`application <GetFireCodes>: Error getting application hasAccess rights: ${e}. ` + __location);
        return next(serverHelper.requestError(`Bad Request: ${e}`));
    }

    if (!hasAccess) {
        log.error(`application <GetFireCodes>: Caller does not have access to this application. ` + __location);
        return next(serverHelper.requestError(`Forbidden: Caller doesn't have the rights to access this application.`));
    }

    let fireCodes = null;
    try {
        const applicationBO = new ApplicationBO();
        fireCodes = await applicationBO.getAppFireCodes(req.params.id);
    }
    catch (e) {
        log.error(`application <GetFireCodes>: Error retrieving Fire Codes: ${e}. ` + __location);
        // return next(serverHelper.requestError(`Server Error: ${e}`));
        res.send(200, {});
        return next();
    }

    if (!fireCodes) {
        log.error(`application <GetFireCodes>: No Fire Codes returned. ` + __location);
        res.send(200, {});
        return next();
    }

    res.send(200, fireCodes);
    return next();
}

async function GetBopCodes(req, res, next){
    let bopIcList = null;
    try{
        const hasAccess = await accesscheck(req.params.id, req).catch(function(e){
            log.error('Error get application hasAccess ' + e + __location);
            return next(serverHelper.requestError(`Bad Request: check error ${e}`));
        });
        if(hasAccess === true){
            const applicationBO = new ApplicationBO();
            bopIcList = await applicationBO.getAppBopCodes(req.params.id);
        }
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

async function putApplicationLink(req, res, next){
    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received' + __location);
        return next(serverHelper.requestError('No data was received'));
    }

    // Make sure all elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'applicationId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing - applicationId. Please check the documentation.'));
    }

  
    // eslint-disable-next-line prefer-const
    let retObject = {};
    const hasAccess = await accesscheck(req.body.applicationId, req, retObject).catch(function(e){
        log.error('Error get application hasAccess ' + e + __location);
        return next(serverHelper.requestError(`Bad Request: check error ${e}`));
    });
    if(hasAccess === true){
        const appDocJson = retObject.appDoc;
        //check toEmail rights.
       

        req.body.isAgencyNetworkUser = req.authentication.isAgencyNetworkUser;
        req.body.fromAgencyPortalUserId = req.authentication.userID;
        let link = null;
        if (req.body.isAgencyPortalLink) {
            if (!Object.prototype.hasOwnProperty.call(req.body, 'toEmail')) {
                log.warn('Some required data is missing' + __location);
                return next(serverHelper.requestError('Some required data is missing - toEmail. Please check the documentation.'));
            }

            const emailHasAccess = await accesscheckEmail(req.body.toEmail, appDocJson);
            if(!emailHasAccess){
                return next(serverHelper.requestError(`User doesn't have access to view this application`));
            }

            link = await appLinkCreator.createAgencyPortalApplicationLink(req.body.applicationId, req.body);
        }
        else {
            link = await appLinkCreator.createQuoteApplicationLink(req.body.applicationId, req.body);
        }
        // eslint-disable-next-line object-shorthand
        res.send(200, {link});
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.requestError('Not found'));
    }
}


async function getOfficerEmployeeTypes(req, res, next){
    if (!req.query || typeof req.query !== 'object') {
        log.error('Bad Request: No data received ' + __location);
        return next(serverHelper.requestError('Bad Request: No data received'));
    }

    if (!req.query.zipcode) {
        log.error('Bad Request: Missing zipcode ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing zipcode'));
    }

    if (!req.query.industryCodeId){
        log.error('Bad Request: Missing industryCodeId ' + __location);
        return next(serverHelper.requestError('Bad Request: Missing industryCodeId'));
    }

    const zipcode = req.query.zipcode;
    const industryCodeId = req.query.industryCodeId;

    let activityCodes = [];
    try{
        // use the zipcode from the primary location
        const zipCodeBO = new ZipCodeBO();
        const zipCodeData = await zipCodeBO.loadByZipCode(zipcode);

        // get the activity codes for the territory of the zipcode provided
        activityCodes = await ActivityCodeSvc.GetActivityCodes(zipCodeData?.state, industryCodeId);

        // filter it down to only suggested activity codes
        activityCodes = activityCodes.filter(ac => ac.suggested);
        const officeEmployeeActivityCodeId = 2869;
        const hasOfficeEmployeeCode = activityCodes.some(code => code.activityCodeId === officeEmployeeActivityCodeId);
        if(hasOfficeEmployeeCode !== true){
            activityCodes.push({
                description: "Office Employees",
                activityCodeId: 2869
            });
        }
    }
    catch(err){
        log.warn(`Failed to fetch suggested activity codes. ${err} ` + __location);
    }

    res.send(200, activityCodes);
    return next();
}

async function manualQuote(req, res, next) {
    //Double check it is TalageStaff user
    log.debug("manualQuote request: " + JSON.stringify(req.body))
   

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

    // Make sure basic elements are present
    if (!Object.prototype.hasOwnProperty.call(req.body, 'insurerId')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, 'policyType')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, 'amount')) {
        log.warn('Some required data is missing' + __location);
        return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    }


    let error = null;
    //accept applicationId or uuid also.
    const applicationBO = new ApplicationBO();
    let applicationId = req.body.applicationId;

    //assume uuid input
    log.debug(`Getting app id  ${applicationId} from mongo` + __location)
    const applicationDoc = await applicationBO.loadDocfromMongoByAppId(applicationId).catch(function(err) {
        log.error(`Error getting application Doc for bound ${applicationId} ` + err + __location);
        log.error('Bad Request: Invalid id ' + __location);
        error = err;
    });
    if (error) {
        return next(Error);
    }
    if(applicationDoc){
        applicationId = applicationDoc.applicationId;
    }
    else {
        log.error(`Did not find application Doc for bound ${applicationId}` + __location);
        return next(serverHelper.requestError('Invalid id'));
    }

    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDoc?.agencyId, applicationDoc?.agencyNetworkId)

    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
    }


    let addQuoteSuccess = false;
   
    try {

        //check if application has policyType.
        let hasPolicyType = false;
        const policy = applicationDoc.policies.find((pt) => pt.policyType === req.body.policyType)
    
        //if not check if valid policyType.
        if(policy){
            hasPolicyType = true
        }
        else {
            const policyTypeBO = new PolicyTypeBO();
            const policyTypeJSON = await policyTypeBO.getByPolicyTypeCd(req.body.policyType)
            if (policyTypeJSON) {
                //add policy to application.
                const policyJSON = {
                    policyType: req.body.policyType
                }
                if(req.body.effectiveDate){
                    policyJSON.effectiveDate = moment(req.body.effectiveDate)
                }
                if(req.body.effectiveDate){
                    policyJSON.expirationDate = moment(req.body.expirationDate)
                }
                if(req.body.limits){
                    policyJSON.limits = req.body.limits
                }
                applicationDoc.policies.push(policyJSON)
                await applicationDoc.save()
                hasPolicyType = true;
            }
        }
        if(!hasPolicyType){
            log.warn(`Manual Quote bad policy type ${req.body.policyType} appId ${req.body.policyType} ` + __location);
            return next(serverHelper.requestError('Invalid data - policy type. Please check the documentation.'));
        }
        const quoteJSON = JSON.parse(JSON.stringify(req.body))
        //Determine quotingAgencyId (Wholesalers)
        const quoteInsurerId = parseInt(req.body.insurerId,10);
        let quotingAgencyId = applicationDoc.agencyId
        let gotHit = false;
        // look at AGencyLocation to see if the insure is setup for Talage Wholesale or the AgencyNetworl's primary Agency.
        const agencyLocationBO = new AgencyLocationBO();
        const testQuotingAgencyId = await agencyLocationBO.getQuotingAgencyId(applicationDoc.agencyLocationId, quoteInsurerId).catch(function(err) {
            log.error(`Error Manual Quotec getting Agency Location ${applicationDoc.agencyLocationId} ${err}` + __location)
        });
        if(testQuotingAgencyId){
            gotHit = true;
            quotingAgencyId = testQuotingAgencyId;
            if(quotingAgencyId === 1 && applicationDoc.agencyId > 1){
                quoteJSON.talageWholesale = true;
                quoteJSON.handledByTalage = true;
            }
        }
                
        log.debug(`Manual Quote gotHit ${gotHit} quotingAgencyId ${quotingAgencyId} `)
        //If nothing found at AgencyLocation insurer level.
        // Look to see if user is an agency nework user and that network is Wheelhouse or a wholesaler.
        if(!gotHit){
            if(req.authentication.isAgencyNetworkUser
                && req.authentication.agencyNetworkId === 1
                && req.authentication.permissions.talageStaff === true
                && applicationDoc.agencyNetworkId === 1){
                quotingAgencyId = 1;
                quoteJSON.talageWholesale = true;
                quoteJSON.handledByTalage = true;

            }
            else if(req.authentication.isAgencyNetworkUser){
                const primaryAgencyLocation = await agencyLocationBO.getByAgencyPrimary(applicationDoc.agencyId).catch(function(err) {
                    log.error(`Error Manual Quotec getting Agency Location ${applicationDoc.agencyLocationId} ${err}` + __location)
                });
                if(primaryAgencyLocation){
                    quotingAgencyId = primaryAgencyLocation.agencyId;
                }
            }
        }

        
        quoteJSON.isManualQuote = true;
        quoteJSON.log = "Manual Quote";
        quoteJSON.quotingAgencyId = quotingAgencyId;
        quoteJSON.agencyId = applicationDoc.agencyId
        quoteJSON.agencyLocationId = applicationDoc.agencyLocationId
        quoteJSON.agencyNetworkId = applicationDoc.agencyNetworkId;
        quoteJSON.quotedPremium = quoteJSON.amount;
        quoteJSON.quoteStatusId = quoteStatus.quoted.id
        quoteJSON.quoteStatusDescription = quoteStatus.quoted.description
        if(quoteJSON.bound){
            quoteJSON.quoteStatusId = quoteStatus.bound.id
            quoteJSON.quoteStatusDescription = quoteStatus.bound.description
            //req.authentication.userID
        }
        //direct to mongose model
        var QuoteModel = global.mongoose.Quote;
        const quoteDoc = new QuoteModel(quoteJSON);
        await quoteDoc.save()
        //update application metrics
        applicationBO.recalculateQuoteMetrics(applicationId)
        addQuoteSuccess = true
    }

    catch (err) {
        // We Do not pass error object directly to Client - May cause info leak.
        log.error(`Error Manual Quote for application ${applicationId ? applicationId : ''}: ${err}` + __location);
        res.send({'message': "Failed To Saved failed"});
        return next();
    }

    // Send back bound for both request, mark and API binds.
    if(addQuoteSuccess){
        res.send(200, {"saved": true});
    }
    else {
        res.send({'message': "Saved failed"});
    }

    return next();
}

async function getHints(req, res, next){
   
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
    
    
    const hasAccess = await accesscheck(appId, req).catch(function(e){
        log.error('Error get application hasAccess ' + e + __location);
        return next(serverHelper.requestError(`Bad Request: check error ${e}`));
    });
    if(hasAccess === true){
        const applicationBO = new ApplicationBO();    
        const hints = await applicationBO.getHints(appId)
        res.send(200, hints); 
        return next();
    }
    else {
        const hints = {};
        res.send(200, hints); 
        return next();
    }
   
}

async function CheckAppetite(req, res, next){
    let appetitePolicyTypeList = null;
    try{
        const hasAccess = await accesscheck(req.params.id, req).catch(function(e){
            log.error('Error get application hasAccess ' + e + __location);
            return next(serverHelper.requestError(`Bad Request: check error ${e}`));
        });
        if(hasAccess === true){
            const applicationBO = new ApplicationBO();
            appetitePolicyTypeList = await applicationBO.checkAppetite(req.params.id, req.query);
        }
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info("Error CheckAppetite " + err + __location);
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

// eslint-disable-next-line no-unused-vars
async function accesscheckEmail(email, applicationJSON){
    let hasAccess = false;
    try{
        const agencyPortalUserBO = new AgencyPortalUserBO();
        const toUser = await agencyPortalUserBO.getByEmailAndAgencyNetworkId(email, true, applicationJSON.agencyNetworkId);
        if(toUser?.isAgencyNetworkUser){
            if(toUser.agencyNetworkId === applicationJSON.agencyNetworkId){
                hasAccess = true;
            }

        }
        else if(toUser?.agencyId === applicationJSON.agencyId){
            hasAccess = true;
        }
       
    }
    catch(err){
        log.error(`Error accesscheckEmail ${email} appId ${applicationJSON.applicationId} ` + err + __location)
    }

    return hasAccess;
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

    let hasAccess = false
    try{
        hasAccess = await accesscheck(req.params.id, req).catch(function(e){
            log.error('Error get application hasAccess ' + e + __location);
            return next(serverHelper.requestError(`Bad Request: check error ${e}`));
        });
    }
    catch(err){
        //Incomplete Applications throw errors. those error message need to got to client
        log.info("Error GetActivityCodesByNCCICode " + err + __location);
        res.send(200, {});
        //return next(serverHelper.requestError('An error occured while retrieving application questions. ' + err));
    }
    if(hasAccess === false){
        log.info(`GetActivityCodesByNCCICode appId  ${req.params.id} no Access` + __location); 
        res.send(200, []);
        return next();
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
        
        // log.info('GetActivityCodesByNCCICode calling ActivityCodeSvc.getActivityCodesByNCCICode ' + __location); 
        // const activityCodes = await ActivityCodeSvc.getActivityCodesByNCCICode(ncci_code, territory)
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

// eslint-disable-next-line no-unused-vars
async function accesscheck(appId, req, retObject){
    
    let passedAgencyCheck = false;
    try{
        const applicationBO = new ApplicationBO();
        const applicationDBDoc = await applicationBO.getById(appId);
        if(applicationDBDoc){
            passedAgencyCheck = await auth.authorizedForAgency(req, applicationDBDoc?.agencyId, applicationDBDoc?.agencyNetworkId)
            if(retObject){
                retObject.appDoc = JSON.parse(JSON.stringify(applicationDBDoc))
            }
        }
        else {
            log.warn(`access check appId ${appId} not found ` + __location)
        }
        log.debug(`accessCheck ${passedAgencyCheck}` + __location)
      
    }
    catch(err){
        log.error("Error Getting application doc " + err + __location)
        throw err;
    }

    return passedAgencyCheck;
}


async function amsCreateClient(req, res, next){
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

    // if (!Object.prototype.hasOwnProperty.call(req.body, 'quoteId')) {
    //     log.warn('Some required data is missing' + __location);
    //     return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    // }

    let error = null;
    const applicationBO = new ApplicationBO();
    let applicationId = req.body.applicationId;
    
    log.debug(`Getting app id  ${applicationId} from mongo` + __location)
    const applicationDB = await applicationBO.getfromMongoByAppId(applicationId).catch(function(err) {
        log.error(`Error getting application Doc for amsCreateClient ${applicationId} ` + err + __location);
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
        log.error(`Did not find application Doc for  amsCreateClient ${applicationId}` + __location);
        return next(serverHelper.requestError('Invalid id'));
    }

    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)
    
    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
    }
    let amsAgencyId = applicationDB.agencyId;
    let talageWholesaleUser = false;
    //Check if Talage wholesale....(if user )
    if(req.authentication.isAgencyNetworkUser
        && req.authentication.agencyNetworkId === 1
        && req.authentication.permissions.talageStaff === true){

        talageWholesaleUser = true
    }


    //Check if agency has AMS setup
    const query = {
        agencyId: amsAgencyId,
        active: true
    }
    const AgencyAmsCredModel = global.mongoose.AgencyAmsCred;
    const agencyAmsCredJson = await AgencyAmsCredModel.findOne(query, '-__v').lean();
    if(!agencyAmsCredJson && talageWholesaleUser){
        ///TODO check agencyLocation has talageWholes setup
        log.debug(`Nextsure using Talage Agency ` + __location)
        amsAgencyId = 1;
    }
    else if(!amsCreateClient) {
        log.error(`AP: amsCreateClient No AMS configured for agencyId ${applicationDB.agencyId} appId: ${applicationId} ` + __location);
        return next(serverHelper.requestError('No AMS connect has been configured for the Agency.'));
    }
    

    const nextsureClient = global.requireRootPath('ams-integrations/nextsure/nextsure-client.js')

    log.debug(`calling Nextsure to create client` + __location);
    const newClientJSON = await nextsureClient.createClientFromAppDoc(amsAgencyId,applicationDB);


    // Send back mark status.
    if(newClientJSON?.clientId){
        res.send(200, {"done": true, newClientId: newClientJSON.clientId});
    }
    else if(newClientJSON?.message){
        res.send({'message': `Failed to create client record in AMS. resonse: ${newClientJSON.message}`});
    }
    else {
        log.debug(`unexpected response from nextsureClient.createClientFromAppDoc ${JSON.stringify(newClientJSON)}`)
        res.send({'message': 'Failed to create client record in AMS.'});
    }
    return next();
}

//amsGetPolicies

async function amsGetPolicies(req, res, next){
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

    // if (!Object.prototype.hasOwnProperty.call(req.body, 'quoteId')) {
    //     log.warn('Some required data is missing' + __location);
    //     return next(serverHelper.requestError('Some required data is missing. Please check the documentation.'));
    // }

    let error = null;
    const applicationBO = new ApplicationBO();
    let applicationId = req.body.applicationId;
    
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
        return next(serverHelper.requestError('Invalid app id'));
    }

    const passedAgencyCheck = await auth.authorizedForAgency(req, applicationDB?.agencyId, applicationDB?.agencyNetworkId)
    
    // Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
    if (!passedAgencyCheck) {
        log.info('Forbidden: User is not authorized to access the requested application');
        return next(serverHelper.forbiddenError('You are not authorized to access the requested application'));
    }

    let amsAgencyId = applicationDB.agencyId;
    let talageWholesaleUser = false;
    //Check if Talage wholesale....(if user )
    if(req.authentication.isAgencyNetworkUser
        && req.authentication.agencyNetworkId === 1
        && req.authentication.permissions.talageStaff === true){

        talageWholesaleUser = true
    }


    //Check if agency has AMS setup
    const query = {
        agencyId: amsAgencyId,
        active: true
    }
    const AgencyAmsCredModel = global.mongoose.AgencyAmsCred;
    const agencyAmsCredJson = await AgencyAmsCredModel.findOne(query, '-__v').lean();
    if(!agencyAmsCredJson && talageWholesaleUser){
        ///TODO check agencyLocation has talageWholes setup
        log.debug(`Nextsure using Talage Agency ` + __location)
        amsAgencyId = 1;
    }
    else {
        log.error(`AP: amsCreateClient No AMS configured for agencyId ${applicationDB.agencyId} appId: ${applicationId} ` + __location);
        return next(serverHelper.requestError('No AMS connect has been configured for the Agency.'));
    }
    

    const nextsureClient = global.requireRootPath('ams-integrations/nextsure/nextsure-client.js')


    if(!applicationDB.amsInfo?.clientId){
        // TODO do an auto lookup 
        const oldClientList = await nextsureClient.clientSearch(applicationDB.agencyId, applicationDB.businessName, applicationDB.primaryState);
        if(oldClientList?.length > 0){
            const clientId = oldClientList[0].clientId;
            log.info(`calling Nextsure create client found existing client ${clientId} for appId ${applicationDB.applicationId}` + __location)
            try{
                const amsJSON = {amsInfo : {
                    "amsType" : "Nextsure",
                    clientId: clientId
                }};
                await applicationBO.updateMongo(applicationDB.applicationId, amsJSON);
                applicationDB.amsInfo = amsJSON;   
            }
            catch(err){
                log.error(`Nextsure createClientFromAppDoc updating App Doc error ${err}` + __location)
            }
            
        }
        log.error(`AP: amsCreateClient No AMS client Id on application for agencyId ${applicationDB.agencyId} appId: ${applicationId} ` + __location);
        return next(serverHelper.requestError('No AMS ClientId not set on application.'));
    }


    const policies = await nextsureClient.getPoliciesByClientId(amsAgencyId,applicationDB.amsInfo?.clientId, applicationDB, req.body.processBound);


    // Send back mark status.
    if(policies){
        res.send(200, policies);
    }
    else {
        res.send({'message': 'Failed to get policies from AMS.'});
    }
    return next();
}


exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get Application', `${basePath}/application`, getApplication, 'applications', 'view');
    server.addGetAuth('Get Application Doc', `${basePath}/application/:id`, getApplicationDoc, 'applications', 'view');
    server.addPutAuth('PUT Application Link for Quote App', `${basePath}/application/link`, putApplicationLink, 'applications', 'manage');
    server.addPutAuth('PUT Application Link for Agency Portal', `${basePath}/application/agent-link`, putApplicationLink, 'applications', 'manage');
    server.addPostAuth('POST Create Application', `${basePath}/application`, applicationSave, 'applications', 'manage');
    server.addPutAuth('PUT Save Application', `${basePath}/application`, applicationSave, 'applications', 'manage');
    server.addPutAuth('PUT Re-Quote Application', `${basePath}/application/:id/requote`, requote, 'applications', 'manage');
    server.addPutAuth('PUT Validate Application', `${basePath}/application/:id/validate`, validate, 'applications', 'manage');
    server.addPostAuth('POST Add Manual Quote for Application', `${basePath}/application/:id/quote`, manualQuote, 'applications', 'manage');

    server.addPutAuth('PUT bindQuote Application', `${basePath}/application/:id/bind`, bindQuote, 'applications', 'bind');

    server.addPutAuth('PUT requestBindQuote Application', `${basePath}/application/:id/requestbind`, bindQuote, 'applications', 'manage');

    server.addDeleteAuth('DELETE Application', `${basePath}/application/:id`, deleteObject, 'applications', 'manage');

    server.addPostAuth('POST Copy Application', `${basePath}/application/copy`, applicationCopy, 'applications', 'manage');

    server.addGetAuth('GetQuestions for AP Application', `${basePath}/application/:id/questions`, GetQuestions, 'applications', 'manage');
    server.addGetAuth('GetFireCodes for AP Application', `${basePath}/application/:id/firecodes`, GetFireCodes, 'applications', 'manage');
    server.addGetAuth('GetBopCodes for AP Application', `${basePath}/application/:id/bopcodes`, GetBopCodes, 'applications', 'manage');
    server.addGetAuth('CheckAppetite for AP Application', `${basePath}/application/:id/checkappetite`, CheckAppetite, 'applications', 'manage');
    server.addGetAuth('Get Activity Codes by NCCI code', `${basePath}/application/:id/ncci-activity-codes`, GetActivityCodesByNCCICode);

    server.addGetAuth('GetOfficerEmployeeTypes', `${basePath}/application/officer-employee-types`, getOfficerEmployeeTypes);
    server.addGetAuth('Get Agency Application Resources', `${basePath}/application/getresources`, GetResources);
    server.addGetAuth('GetAssociations', `${basePath}/application/getassociations`, GetAssociations);
    server.addGetAuth('Get Required Fields', `${basePath}/application/getrequiredfields`, GetRequiredFields);
    server.addPostAuth('Checkzip for Quote Engine', `${basePath}/application/checkzip`, CheckZip);
    server.addGetAuth('Get Insurer Payment Options', `${basePath}/application/insurer-payment-options`, GetInsurerPaymentPlanOptions);
    server.addGetAuth('Get Quote Limits Info',`${basePath}/application/quote-limits`, GetQuoteLimits);
    server.addGetAuth('GET Appplication Hints', `${basePath}/application/:id/hints`, getHints, 'applications', 'manage');
    server.addPutAuth('PUT Mark Quote As Dead', `${basePath}/application/:id/mark-as-dead`, markQuoteAsDead, 'applications', 'manage');


    server.addPutAuth('PUT Create Client in AMS', `${basePath}/application/:id/ams/create`, amsCreateClient, 'applications', 'manage');
    server.addPutAuth('PUT Check Policies in AMS', `${basePath}/application/:id/ams/policy`, amsGetPolicies, 'applications', 'manage');
};
