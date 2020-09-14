'use strict';

const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');
const {SharedIniFileCredentials} = require('aws-sdk');

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
    const account_sql = `SELECT \`a\`.\`email\`
				FROM   \`#__agency_portal_users\` AS \`a\`
				WHERE  \`a\`.\`id\` = ${parseInt(req.authentication.userID, 10)};`;

    let account_data = await db.query(account_sql).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    });

    // There will only ever be one result
    account_data = account_data[0];

    // Decrypt the user's email address
    account_data.email = await crypt.decrypt(account_data.email);

    const timezone_sql = `SELECT \`tz\`, \`id\`
								FROM \`#__timezones\`;`;

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

    // Establish some variables
    let email = '';
    let password = '';
    let timezone = 0;
    let timezone_name = null;

    let error = null;

    // If an email was provided, validate it and encrypt
    if(Object.prototype.hasOwnProperty.call(req.body, 'email')){
        if(validator.email(req.body.email)){
            // Encrypt the email
            email = await crypt.encrypt(req.body.email);
        }
        else{
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
            timezone = req.body.timezone;
        }
        else{
            log.warn('Timezone is not an int');
            return next(serverHelper.requestError('Timezone could not be validated'));
        }
    }

    //Todo Add validator for TimeZone name
    if(Object.prototype.hasOwnProperty.call(req.body, 'timezone_name')){
        timezone_name = req.body.timezone_name;
    }
    else if(Object.prototype.hasOwnProperty.call(req.body, 'timezoneName')){
        timezone_name = req.body.timezoneName;
    }
    else if(timezone > 0){
        //look up timezone from db and get
        const sqlTz = `select * from clw_talage_timezones where id ${db.escape(timezone)}`
        const results = await db.query(sqlTz).catch(function(err){
            log.error(err.message + __location);
            error = err;
        });
        if(error){
            return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
        }
        if(results && results.length > 0){
            timezone_name = results[0].tz;
        }
        else {
            return next(serverHelper.requestError('Timezone ID could not found'));
        }


    }

    // Do we have something to update?
    if(!email && !password && !timezone && !timezone_name){
        log.warn('There is nothing to update');
        return next(serverHelper.requestError('There is nothing to update. Please check the documentation.'));
    }

    // Compile the set statements for the update query
    const set_statements = [];
    if(email){
        set_statements.push(`\`email\`=${db.escape(email)}`);
        set_statements.push(`\`email_hash\`=${db.escape(await crypt.hash(req.body.email))}`);
    }
    if(password){
        set_statements.push(`\`password\`=${db.escape(password)}`);
    }
    if(timezone){
        set_statements.push(`\`timezone\`=${db.escape(timezone)}`);
    }
    if(timezone_name){
        set_statements.push(`\`timezone_name\`=${db.escape(timezone_name)}`);
    }

    // Create and run the UPDATE query

    const sql = `UPDATE \`#__agency_portal_users\` SET ${set_statements.join(', ')} WHERE id = ${db.escape(req.authentication.userID)} LIMIT 1;`;
    await db.query(sql).catch(function(err){
        log.error(err.message + __location);
        error = err;
    });
    if(error){
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    }

    // Everything went okay, send a success response
    res.send(200, 'Account Updated');
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get account', `${basePath}/account`, get_account);
    server.addPutAuth('Update account', `${basePath}/account`, put_account);
};