'use strict';

const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = global.requireRootPath('server.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');
const timezonesvc = global.requireShared('services/timezonesvc.js');

/**
 * Responds to GET requests for account information
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function get_account(req, res, next){


    const agencyPortalUserBO = new AgencyPortalUserBO();
    const agencyPortalUserJSON = await agencyPortalUserBO.getById(parseInt(req.authentication.userID,10)).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    });
    if(agencyPortalUserJSON.password){
        delete agencyPortalUserJSON.password
    }

    // const account_sql = `SELECT \`a\`.\`email\`

    // There will only ever be one result only gets email
    const account_data = {email: agencyPortalUserJSON.email}

    const timezoneList = timezonesvc.getList();
    const timezones = [];
    for (const timezone of timezoneList) {
        timezones.push({
            tz: timezone.tz,
            id: timezone.id
        })
    }
    const accountInformationObj = {
        'account_data': account_data,
        'timezones': timezones
    };
    // Additional logic that removes this property if user should not be able to edit this setting.
    // The request must be from agencyNetworkId 1, and must have talageStaff permissions
    let agencyNetworkId = null;
    if(req.authentication.isAgencyNetworkUser){
        agencyNetworkId = req.authentication.agencyNetworkId;
    }
    if(agencyPortalUserJSON.hasOwnProperty('enableGlobalView') && agencyNetworkId === 1 && req.authentication.permissions.talageStaff === true){
        accountInformationObj.enableGlobalView = agencyPortalUserJSON.enableGlobalView;
    }
    res.send(200, accountInformationObj);
    return next();
}

/**
 * Responds to PUT requests updating account information
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function put_account(req, res, next){
    // Check for data
    if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }
    log.debug(`ap/account put ${JSON.stringify(req.body)}`)
    // Establish some variables
    let password = '';
    let timezoneId = 0;
    let timezoneName = null;

    // If an email was provided, validate it and encrypt
    if(Object.prototype.hasOwnProperty.call(req.body, 'email')){
        if(!validator.email(req.body.email)){
            log.warn('Email does not meet requirements');
            return next(serverHelper.requestError('Email could not be validated'));
        }
    }

    // If a password was provided, validate it and hash
    if(Object.prototype.hasOwnProperty.call(req.body, 'password')){
        if(validator.password(req.body.password)){
            // Hash the password
            password = await crypt.hashPassword(req.body.password);
        }
        else{
            log.warn('Password does not meet requirements');
            return next(serverHelper.requestError('Password does not meet the complexity requirements. It must be at least 8 characters and contain one uppercase letter, one lowercase letter, one number, and one special character'));
        }
    }

    if(Object.prototype.hasOwnProperty.call(req.body, 'timezone')){
        if(validator.timezone(req.body.timezone)){
            timezoneId = req.body.timezone;
        }
        else{
            log.warn('Timezone is not an int');
            return next(serverHelper.requestError('Timezone could not be validated'));
        }
    }

    //Todo Add validator for TimeZone name
    if(Object.prototype.hasOwnProperty.call(req.body, 'timezone_name')){
        timezoneName = req.body.timezone_name;
    }
    else if(Object.prototype.hasOwnProperty.call(req.body, 'timezoneName')){
        timezoneName = req.body.timezoneName;
    }
    else if(timezoneId > 0){
        //look up timezone from service and get
        const timezoneResult = timezonesvc.getById(timezoneId);
        if(timezoneResult){
            timezoneName = timezoneResult.tz;
        }
        else {
            return next(serverHelper.requestError('Timezone ID could not found'));
        }


    }
    let enableGlobalView = null;
    if(req.body.hasOwnProperty('enableGlobalView')){
        enableGlobalView = req.body.enableGlobalView;
    }
    // Do we have something to update?
    if(!req.body.email && !password && !timezoneName && !enableGlobalView){
        log.warn('There is nothing to update');
        return next(serverHelper.requestError('There is nothing to update. Please check the documentation.'));
    }
    try{
        //req.userTokenData.userId
        const newJson = {id: parseInt(req.authentication.userID, 10)};
        if(req.body.email){
            newJson.email = req.body.email
        }
        if(password){
            newJson.password = password
        }
        if(timezoneName){
            newJson.timezoneName = timezoneName
        }

        const agencyPortalUserBO = new AgencyPortalUserBO();
        // Additional logic that removes this property if user should not be able to edit this setting.
        // The request must have enableGlobalView on the body, and be from agencyNetworkId 1, and must have talageStaff permissions
        let agencyNetworkId = null;
        if(req.authentication.isAgencyNetworkUser){
            agencyNetworkId = req.authentication.agencyNetworkId;
        }
        if(enableGlobalView !== null && agencyNetworkId === 1 && req.authentication.permissions.talageStaff === true){
            newJson.enableGlobalView = enableGlobalView;
        }
        await agencyPortalUserBO.saveModel(newJson);
    }
    catch(err){
        log.error(err.message + __location);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }

    // Create and run the UPDATE query

    // Everything went okay, send a success response
    res.send(200, 'Account Updated');
    return next();
}

/**
 * Responds to PUT requests updating account preferences
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function putAccountPreferences(req, res, next){
    // Check for data
    if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }

    if(!req.body.tableOptions || !req.body.tableOptions.applicationsTable || !req.body.tableOptions.agenciesTable){
        log.warn('No valid data was received');
        return next(serverHelper.requestError('No valid data was received'));
    }

    const agencyPortalUserBO = new AgencyPortalUserBO();
    const agencyPortalUserJSON = await agencyPortalUserBO.getById(parseInt(req.authentication.userID, 10)).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    });

    const newPreferences = {
        id: parseInt(req.authentication.userID, 10),
        tableOptions: agencyPortalUserJSON.tableOptions ? agencyPortalUserJSON.tableOptions : {}
    };

    try{
        // applicationsTable
        if(!newPreferences.tableOptions.applicationsTable){
            newPreferences.tableOptions.applicationsTable = {};
        }
        if(req.body.tableOptions.applicationsTable?.hasOwnProperty("compactMode")){
            newPreferences.tableOptions.applicationsTable.compactMode = req.body.tableOptions.applicationsTable.compactMode;
        }
        if(req.body.tableOptions.applicationsTable?.hasOwnProperty("rowsPerPage")){
            newPreferences.tableOptions.applicationsTable.rowsPerPage = req.body.tableOptions.applicationsTable.rowsPerPage;
        }

        // agenciesTable
        if(!newPreferences.tableOptions.agenciesTable){
            newPreferences.tableOptions.agenciesTable = {};
        }
        if(req.body.tableOptions.agenciesTable?.hasOwnProperty("compactMode")){
            newPreferences.tableOptions.agenciesTable.compactMode = req.body.tableOptions.agenciesTable.compactMode;
        }
        if(req.body.tableOptions.agenciesTable?.hasOwnProperty("rowsPerPage")){
            newPreferences.tableOptions.agenciesTable.rowsPerPage = req.body.tableOptions.agenciesTable.rowsPerPage;
        }

    }
    catch(err){
        log.error(err.message + __location);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }

    await agencyPortalUserBO.saveModel(newPreferences);

    // Everything went okay, send a success response
    res.send(200, 'Account Preferences Updated');
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get account', `${basePath}/account`, get_account);
    server.addPutAuth('Update account', `${basePath}/account`, put_account);
    server.addPutAuth('Update account preferences', `${basePath}/account-preferences`, putAccountPreferences);
};