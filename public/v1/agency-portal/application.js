/* eslint-disable dot-notation */
/* eslint-disable require-jsdoc */
'use strict';
const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');
const ApplicationBO = global.requireShared('models/Application-BO.js');
const ApplicationQuoting = global.requireRootPath('public/v1/quote/helpers/models/Application.js');
const AgencyLocationBO = global.requireShared('models/AgencyLocation-BO.js');
const AgencyBO = global.requireShared('models/Agency-BO.js');
const ZipCodeBO = global.requireShared('./models/ZipCode-BO.js');
const status = global.requireShared('./models/application-businesslogic/status.js');
const jwt = require('jsonwebtoken');
const {loggers} = require('winston');
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


    // Validate the application ID
    if (!await validator.is_valid_id(req.query.id)) {
        log.error('Bad Request: Invalid id ' + __location);
        return next(serverHelper.requestError('Invalid id'));
    }

    // Get the agents that we are permitted to view
    const agents = await auth.getAgents(req).catch(function(e) {
        error = e;
    });
    if (error) {
        log.error('Error get application getAgents ' + error + __location);
        return next(error);
    }

    // Check if this is Solepro and grant them special access
    let where = `${db.quoteName('a.agency')} IN (${agents.join(',')})`;
    if (agents.length === 1 && agents[0] === 12) {
        // This is Solepro (no restriction on agency ID, just applications tagged to them)
        where = `${db.quoteName('a.solepro')} = 1`;
    }

    // Define a query for retrieving basic application information
    const sql = `
        SELECT
            a.additional_insured as additionalInsured,
            a.agency,
            a.agency_location,
            a.status,
            a.id,
            a.last_step as lastStep,
            a.solepro,
            a.waiver_subrogation as waiverSubrogation,
            a.years_of_exp as yearsOfExp,
            b.website,
            a.wholesale,
            a.bop_effective_date as businessOwnersPolicyEffectiveDate,
            a.bop_expiration_date as businessOwnersPolicyExpirationDate,
            a.gl_effective_date as generalLiabilityEffectiveDate,
            a.gl_expiration_date as generalLiabilityExpirationDate,
            a.wc_effective_date as workersCompensationEffectiveDate,
            a.wc_expiration_date as workersCompensationExpirationDate,
            a.limits,
            a.wc_limits as wcLimits,
            a.deductible,
            a.coverage_lapse as coverageLapse,
            a.gross_sales_amt,
            a.created,
            ad.unemployment_num as unemploymentNum,
            ag.name as agencyName,
            b.id as businessID,
            b.name as businessName,
            b.dba,
            b.ein,
            b.mailing_address as address,
            b.mailing_address2 as address2,
            b.owners,
            b.founded,
            b.entity_type as entityType,
            b.mailing_city as city,
            b.mailing_state_abbr as territory,
            b.mailing_zipcode as zip,
            c.email,
            c.fname,
            c.lname,
            c.phone,
            ic.description as industryCodeName,
            icc.name as industryCodeCategory,
            a.opted_out_online, 
            a.opted_out_online_emailsent,
            GROUP_CONCAT(apt.policy_type) AS policy_types
        FROM clw_talage_applications as a
			LEFT JOIN clw_talage_application_policy_types as apt ON a.id = apt.application
			LEFT JOIN clw_talage_businesses as b ON a.business = b.id
			LEFT JOIN clw_talage_contacts as c ON c.business = b.id
			LEFT JOIN clw_talage_agencies as ag ON a.agency = ag.id
            LEFT JOIN clw_talage_addresses as ad ON a.business = ad.business AND ad.billing = 1
            LEFT JOIN clw_talage_industry_codes as ic ON ic.id = a.industry_code
            LEFT JOIN clw_talage_industry_code_categories icc on icc.id = ic.category
        WHERE  a.id = ${req.query.id} AND ${where}
        GROUP BY a.id
        LIMIT 1;
		`;

    // Query the database
    const applicationData = await db.query(sql).catch(function(err) {
        log.error('Error get application database query ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Make sure an application was found
    if (applicationData.length !== 1) {
        log.error('Error get application, application not found sql: ' + sql + __location);
        return next(serverHelper.notFoundError('The application could not be found.'));
    }

    // Get the application from the response
    const application = applicationData[0];

    // Decrypt any necessary fields
    await crypt.batchProcessObject(application, 'decrypt', ['address',
        'address2',
        'businessName',
        'dba',
        'ein',
        'email',
        'fname',
        'lname',
        'owners',
        'phone',
        'website']);

    // Decode the owners
    try{
        if(typeof application.owners !== "object"){
            application.owners = JSON.parse(application.owners);
        }
        else {
            log.debug("Application Owner: " + JSON.stringify(application.owners))
        }
        if(application.owners && application.owners.length > 0){
            for(let i = 0; i < application.owners.length; i++){
                // eslint-disable-next-line prefer-const
                let owner = application.owners[i];
                if(owner._id){
                    delete owner._id;
                }
                if(owner.ownership){
                    owner.ownership = owner.ownership.toString();
                }
                if(owner.birthdate && owner.birthdate.includes("Z")){
                    owner.birthdate = moment(owner.birthdate).format("MM/DD/YYYY");
                }
            }
        }
    }
    catch(err){
        log.error("Application Owner parse error " + err + __location)
    }


    // Get all addresses for this business
    const addressSQL = `
        SELECT
            id,
            address,
            address2,
            billing,
            ein,
            zipcode,
            full_time_employees,
            part_time_employees,
            square_footage,
            unemployment_num,
            city,
            state_abbr as territory
        FROM clw_talage_addresses
        WHERE business = ${application.businessID};
		`;

    // Query the database
    const addressData = await db.query(addressSQL).catch(function(err) {
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Decrypt the encrypted fields
    try{
        await crypt.batchProcessObjectArray(addressData, 'decrypt', ['address',
            'address2',
            'ein']);
    }
    catch(err){
        log.error("Get Application decrypt error " + err + __location);
    }


    // Only process addresses if some were returned
    application.locations = [];
    if (addressData.length > 0) {
        // Get the activity codes for all addresses
        const codesSQL = `
				SELECT
					${db.quoteName('aac.address')},
					${db.quoteName('ac.description')},
					${db.quoteName('aac.payroll')}
				FROM ${db.quoteName('#__address_activity_codes', 'aac')}
				LEFT JOIN ${db.quoteName('#__activity_codes', 'ac')} ON ${db.quoteName('ac.id')} = ${db.quoteName('aac.ncci_code')}
				WHERE ${db.quoteName('aac.address')} IN (${addressData.map(function(address) {
    return address.id;
})});
			`;

        // Query the database
        const codesData = await db.query(codesSQL).catch(function(err) {
            log.error(err.message);
            return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
        });

        // Loop over each address and do a bit more work
        addressData.forEach(function(address) {
            // Get all codes that are associated with this address and add them
            address.activityCodes = [];
            if (codesData.length > 0) {
                codesData.forEach(function(code) {
                    if (code.address === address.id) {
                        address.activityCodes.push(code);
                    }
                });
            }

            // Add this address to the application object
            application.locations.push(address);
        });
    }

    // Get the quotes from the database
    const quotesSQL = `
            SELECT
                q.api_result,
                q.policy_type,
                pt.name as policyTypeName,
                pay.name as paymentPlan,
                q.insurer,
                q.amount,
                q.bound,
                q.reasons,
                i.logo,
                i.name as insurerName,
                q.quote_letter,
                q.number,
                q.status,
                q.log
            FROM clw_talage_quotes as q
            LEFT JOIN  clw_talage_policies as p ON p.quote = q.id
            LEFT JOIN  clw_talage_payment_plans as pay ON pay.id = q.payment_plan
            LEFT JOIN  clw_talage_insurers as i ON i.id = q.insurer
            LEFT JOIN  clw_talage_policy_types as pt ON pt.abbr = q.policy_type
            LEFT JOIN  clw_talage_applications as a ON q.application = a.id

            WHERE q.application = ${req.query.id} AND q.state = 1;
		`;


    const quotes = await db.query(quotesSQL).catch(function(err) {
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });


    // Add the quotes to the return object and determine the application status
    application.quotes = [];
    if (quotes.length > 0) {
        for (let i = 0; i < quotes.length; i++) {
            // eslint-disable-next-line prefer-const
            let quote = quotes[i];
            if (!quote.status && quote.api_result) {
                quote.status = quote.api_result;
            }

            // Change the name of autodeclined
            if (quote.status === 'autodeclined') {
                quote.status = 'Out of Market';
            }
            if (quote.status === 'bind_requested'
                || quote.bound
                || quote.status === 'quoted') {

                quote.reasons = '';
            }
            // can see log?
            try {
                if (req.authentication.permissions.applications.viewlogs) {
                    quote.log = await crypt.decrypt(quote.log);
                }
                else {
                    delete quote.log;
                }
            }
            catch (e) {
                delete quote.log;
            }

        }


        // Add the quotes to the response
        application.quotes = quotes;
        if (req.authentication.permissions.applications.viewlogs) {
            application.showLogs = true;
        }
    }

    // Get any existing claims for the application from the data base
    const claimsSQL = `
			SELECT
				${db.quoteName('c.amount_paid', 'amountPaid')},
				${db.quoteName('c.amount_reserved', 'amountReserved')},
				${db.quoteName('c.date')},
				${db.quoteName('c.missed_work', 'missedWork')},
				${db.quoteName('c.open')},
				${db.quoteName('c.policy_type', 'policyType')}
			FROM ${db.quoteName('#__claims', 'c')}
			
			WHERE ${db.quoteName('c.application')} = ${req.query.id};
		`;

    // Run query for claims
    const claims = await db.query(claimsSQL).catch(function(err) {
        log.error('Error get application database query (claims) ' + err.message + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    application.claims = [];
    if (claims.length > 0) {
        // Add the claims to the response if they exist
        application.claims = claims;
    }

    // Return the response
    res.send(200, application);
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
        loggers.error("Error gettign userID " + err + __location);
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
            loggers.error("Error gettign userID " + err + __location);
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

    const agencyNetwork = req.authentication.agencyNetwork;
    if (!agencyNetwork) {
        log.warn('App requote not agency network user ' + __location)
        res.send(403);
        return next(serverHelper.forbiddenError('Do Not have Permissions'));
    }

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
        log.error(`Error validating application ${req.body.id ? req.body.id : ''}: ${err.message}` + __location);
        res.send(err);
        return next();
    }

    // Set the application progress to 'quoting'
    try {
        await applicationBO.updateProgress(req.body.id, "quoting");
        const appStatusIdQuoting = 15;
        await applicationBO.updateStatus(req.body.id, "quoting", appStatusIdQuoting);
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