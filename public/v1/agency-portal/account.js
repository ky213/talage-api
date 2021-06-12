'use strict';

const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = global.requireRootPath('server.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

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


    const timezone_sql = `SELECT tz, id
								FROM clw_talage_timezones;`;

    const timezones = await db.query(timezone_sql).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    });

    res.send(200, {
        'account_data': account_data,
        'timezones': timezones
    });
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

    let error = null;

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
        //look up timezone from db and get
        const sqlTz = `select * from clw_talage_timezones where id ${db.escape(timezoneId)}`
        const results = await db.query(sqlTz).catch(function(err){
            log.error(err.message + __location);
            error = err;
        });
        if(error){
            return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
        }
        if(results && results.length > 0){
            timezoneName = results[0].tz;
        }
        else {
            return next(serverHelper.requestError('Timezone ID could not found'));
        }


    }

    // Do we have something to update?
    if(!req.body.email && !password && !timezoneName){
        log.warn('There is nothing to update');
        return next(serverHelper.requestError('There is nothing to update. Please check the documentation.'));
    }
    try{
        //req.userTokenData.userId
        const newJson = {id:  parseInt(req.authentication.userID,10)};
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

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get account', `${basePath}/account`, get_account);
    server.addPutAuth('Update account', `${basePath}/account`, put_account);
};