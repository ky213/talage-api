'use strict';
const auth = require('./helpers/auth.js');
const crypt = require('../../../shared/services/crypt.js');
const jwt = require('jsonwebtoken');
const serverHelper = require('../../../server.js');
const validator = global.requireShared('./helpers/validator.js');
const emailsvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

/**
 * Checks whether the provided agency has an owner other than the current user
 *
 * @param {int} agency - The ID of the agency to check
 * @param {int} user - The ID of the user to exempt from the check
 * @param {boolean} agencyNetwork - (optional) Whether or not this is an agency network
 *
 * @return {boolean} - True if the agency has an owner; false otherwise
 */
function hasOtherOwner(agency, user, agencyNetwork = false) {
    return new Promise(async function(fulfill) {
        let error = false;

        // Determine which where statement is needed
        let where = '';
        if (agencyNetwork) {
            where = `\`agency_network\` = ${parseInt(agency, 10)}`;
        }
        else {
            where = `\`agency\` = ${parseInt(agency, 10)}`;
        }

        const sql = `
				SELECT id
				FROM \`#__agency_portal_users\`
				WHERE
					\`group\` = 1 AND
					\`id\` != ${parseInt(user, 10)} AND
					\`state\` > 0 AND
					${where}
				LIMIT 1;
			`;

        // Run the query
        const result = await db.query(sql).catch(function(err) {
            log.error('__agency_portal_users error ' + err + __location);
            error = true;
            fulfill(false);
        });
        if (error) {
            return;
        }

        // Check the result
        if (!result || !result.length) {
            fulfill(false);
            return;
        }

        fulfill(true);
    });
}

exports.hasOtherOwner = hasOtherOwner;

/**
 * Checks whether the provided agency has a signing authority other than the current user
 *
 * @param {int} agency - The ID of the agency to check
 * @param {int} user - The ID of the user to exempt from the check
 *
 * @return {boolean} - True if the agency has a signing authority; false otherwise
 */
function hasOtherSigningAuthority(agency, user) {
    return new Promise(async function(fulfill) {
        let error = false;

        const sql = `
				SELECT id
				FROM \`#__agency_portal_users\`
				WHERE
					\`can_sign\` = 1 AND
					\`id\` != ${parseInt(user, 10)} AND
					\`state\` > 0 AND
					\`agency\` = ${parseInt(agency, 10)}
				LIMIT 1;
			`;

        // Run the query
        const result = await db.query(sql).catch(function(err) {
            log.error('__agency_portal_users error ' + err + __location);
            error = true;
            fulfill(false);
        });
        if (error) {
            return;
        }

        // Check the result
        if (!result || !result.length) {
            fulfill(false);
            return;
        }

        fulfill(true);
    });
}

exports.hasOtherSigningAuthority = hasOtherSigningAuthority;

/**
 * Validates a user and returns a clean data object
 *
 * @param {object} req - HTTP request object
 * @param {object} user - User Object
 * @return {object} Object containing user information
 */
async function validate(req, user) {
    // Establish default values
    const data = {
        canSign: 0,
        email: '',
        group: 5
    };

    // Validate each parameter

    // Can Sign? (optional)
    if (Object.prototype.hasOwnProperty.call(user, 'canSign') && user.canSign !== true && user.canSign !== false) {
        throw new Error('Invalid canSign value. Please contact us.');
    }
    data.canSign = user.canSign ? 1 : null;

    // Email
    if (!Object.prototype.hasOwnProperty.call(user, 'email') || !user.email) {
        throw new Error('You must enter an email address');
    }
    if (!validator.email(user.email)) {
        throw new Error('Email address is invalid');
    }
    data.email = user.email;

    // Group (optional)
    if (Object.prototype.hasOwnProperty.call(user, 'group') && !validator.userGroup(user.group)) {
        throw new Error('User group (role) is invalid');
    }
    data.group = user.group;

    // Prepare the email hash
    const emailHash = await crypt.hash(user.email);

    // Check for duplicate email address
    const duplicateSQL = `
			SELECT \`id\`
			FROM \`#__agency_portal_users\`
			WHERE \`email_hash\` = ${db.escape(emailHash)}
				AND \`state\` > -2
				${user.id ? `AND \`id\` != ${db.escape(user.id)}` : ''}
			;
		`;
    const duplicateResult = await db.query(duplicateSQL).catch(function(err) {
        log.error('__agency_portal_users error ' + err + __location);
        throw new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (duplicateResult.length > 0) {
        throw new Error('This email address is already in use for another user account. Choose a different one.');
    }

    // Return the clean data
    return data;
}

/**
 * Creates a single user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function createUser(req, res, next) {
    let error = false;

    // Check that at least some post parameters were received
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        log.info('Bad Request: Parameters missing');
        return next(serverHelper.requestError('Parameters missing'));
    }

    // Validate the request and get back the data
    const data = await validate(req, req.body.user).catch(function(err) {
        error = err.message;
    });
    if (error) {
        log.warn(error);
        return next(serverHelper.requestError(error));
    }

    // Determine if this is an agency or agency network
    let where = ``;
    if (req.authentication.agencyNetwork && req.body.agency) {
        where = `\`agency\`= ${parseInt(req.body.agency, 10)}`;
    }else if (req.authentication.agencyNetwork){
		where = `\`agency_network\`= ${parseInt(req.authentication.agencyNetwork, 10)}`;
	}
    else {
        // Get the agents that we are permitted to view
        const agents = await auth.getAgents(req).catch(function(e) {
            error = e;
        });
        if (error) {
            return next(error);
        }
        where = ` \`agency\` = ${parseInt(agents[0], 10)}`;
    }

    // Begin a database transaction
    const connection = await db.beginTransaction().catch(function(err) {
        log.error('db beginTransaction error ' + err + __location);
        error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }

    // If this user is to be set as owner, remove the current owner (they will become a super administrator)
    if (data.group === 1) {
        const removeOwnerSQL = `
				UPDATE
					\`#__agency_portal_users\`
				SET
					\`group\` = 2
				WHERE
					\`group\` = 1 AND
					${where}
				LIMIT 1;
			`;

        // Run the query
        await db.query(removeOwnerSQL, connection).catch(function(err) {
            log.error('__agency_portal_users error ' + err + __location);
            error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        });
        if (error) {
            return next(error);
        }
    }

    // If the user is being set as the signing authority, remove the current signing authority
    if (data.canSign) {
        const removeCanSignSQL = `
				UPDATE
					\`#__agency_portal_users\`
				SET
					\`can_sign\` = NULL
				WHERE
					${where};
			`;

        // Run the query
        await db.query(removeCanSignSQL, connection).catch(function(err) {
            log.error('__agency_portal_users error ' + err + __location);
            error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        });
        if (error) {
            return next(error);
        }
    }

    // Prepare the email address
    const emailHash = await crypt.hash(data.email);
    const encryptedEmail = await crypt.encrypt(data.email);

    // Generate a random password for this user (they won't be using it anyway)
    const passwordHash = await crypt.hashPassword(Math.random().toString(36).substring(2, 15));

    // Add this user to the database
    let controlColumn = '';
	let controlValue = '';
    if (req.authentication.agencyNetwork && req.body.agency) {
        controlColumn = 'agency';
        controlValue = req.body.agency;
    }
    else if (req.authentication.agencyNetwork) {
        controlColumn = 'agency_network';
        controlValue = req.authentication.agencyNetwork;
    }
    else {
        // Get the agents that we are permitted to view
        const agents = await auth.getAgents(req).catch(function(e) {
            error = e;
        });
        if (error) {
            return next(error);
        }

        controlColumn = 'agency';
        controlValue = agents[0];
    }

    const insertSQL = `
			INSERT INTO \`#__agency_portal_users\` (\`state\`, \`${controlColumn}\`, \`can_sign\`, \`email\`, \`email_hash\`, \`group\`, \`password\`, \`reset_required\`)
			VALUES (1, ${parseInt(controlValue, 10)}, ${data.canSign}, ${db.escape(encryptedEmail)}, ${db.escape(emailHash)}, ${parseInt(data.group, 10)}, ${db.escape(passwordHash)}, 1);
		`;

    // Run the query
    const result = await db.query(insertSQL, connection).catch(function(err) {
        log.error('__agency_portal_users error ' + err + __location);
        error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }
    const userID = result.insertId;

    // Make sure the query was successful
    if (!result || result.affectedRows !== 1) {
        // Rollback the transaction
        db.rollback(connection);

        log.error('User update failed.');
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // Commit the transaction
    db.commit(connection);

    // Return the response
    res.send(200, {
        userID: userID,
        code: 'Success',
        message: 'User Created'
    });

    // Check if this is an agency network
    let agencyNetwork = req.authentication.agencyNetwork;
    if (!agencyNetwork ) {
        // Determine the agency network of this agency
        const agencyNetworkSQL = `
				SELECT
					\`agency_network\`
				FROM
					\`#__agencies\`
				WHERE
					${where.replace('agency', 'id')};
			`;

        // Run the query
        const agencyNetworkResult = await db.query(agencyNetworkSQL).catch(function(err) {
            log.error('__agency_network error ' + err + __location);
            error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        });
        if (error) {
            return;
        }
        agencyNetwork = agencyNetworkResult[0].agency_network;
    }

    // Get the content of the new user email
    //Refactor to use AgencyNetworkBO
    log.debug("req.authentication.agencyNetwork: " + req.authentication.agencyNetwork);
	let jsonEmailProp = '';
	if(req.authentication.agencyNetwork && req.body.agency){
		jsonEmailProp =  'new_agency_user';
	}else if (req.authentication.agencyNetwork){
		jsonEmailProp = 'new_agency_network_user';
	}else {
		jsonEmailProp =  'new_agency_user';
	}
    log.debug("jsonEmailProp: " + jsonEmailProp);
    error = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    const emailContentJSON = await agencyNetworkBO.getEmailContent(agencyNetwork, jsonEmailProp).catch(function(err){
        log.error(`Unable to get email content for New Agency Portal User. agency_network: ${agencyNetwork}.  error: ${err}` + __location);
        error = true;
    });
    if(error){
        return false;
    }

    if(emailContentJSON && emailContentJSON.message){

        // By default, use the message and subject of the agency network
        const emailMessage = emailContentJSON.message;
        const emailSubject = emailContentJSON.subject;

        // Create a limited life JWT
        const token = jwt.sign({userID: userID}, global.settings.AUTH_SECRET_KEY, {expiresIn: '7d'});

        // Format the brands
        let brand = emailContentJSON.emailBrand.toLowerCase();
        brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
        const portalurl = emailContentJSON.PORTAL_URL;

        // Prepare the email to send to the user
        const emailData = {
            html: emailMessage.
                replace(/{{Brand}}/g, brand).
                replace(/{{Activation Link}}/g,
                    `<a href="${portalurl}/reset-password/${token}" style="background-color:#ED7D31;border-radius:0.25rem;color:#FFF;font-size:1.3rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-top:0.75rem;padding-right:1.5rem;text-decoration:none;text-transform:uppercase;">Activate My Account</a>`),
            subject: emailSubject.replace('{{Brand}}', brand),
            to: data.email
        };
        const emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, agencyNetwork, brand);
        if (emailResp === false) {
            log.error(`Unable to send new user email to ${data.email}. Please send manually.`);
            slack.send('#alerts', 'warning', `Unable to send new user email to ${data.email}. Please send manually.`);
        }
    }
    else {
        log.error(`Unable to get email content for New Agency Portal User. agency_network: ${agencyNetwork}.` + __location);
        slack.send('#alerts', 'warning', `Unable to send new user email to ${data.email}. Please send manually.`);
    }
}

/**
 * Deletes a single user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function deleteUser(req, res, next) {
    let error = false;

    // Determine if this is an agency or agency network
	let agencyOrNetworkID = 0;

	let where = ``;
	
    if (req.authentication.agencyNetwork && req.query.agency) {
        agencyOrNetworkID = parseInt(req.query.agency);
        where = ` \`agency\` = ${agencyOrNetworkID}`;
    }else if (req.authentication.agencyNetwork ) {
        agencyOrNetworkID = parseInt(req.authentication.agencyNetwork, 10);
        where = `\`agency_network\`= ${agencyOrNetworkID}`;
	}
    else {
        // Get the agents that we are permitted to view
        const agents = await auth.getAgents(req).catch(function(e) {
            error = e;
        });
        if (error) {
            return next(error);
        }
        agencyOrNetworkID = parseInt(agents[0], 10);
        where = ` \`agency\` = ${agencyOrNetworkID}`;
    }

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }

	// Validate the ID
	// Since agency network can update an agency user determine, if this is an agency network but also has sent an agency (agencyId) then set this to false else let the authentication determine the agencyNetwork truthiness
	const  isThisAgencyNetwork = req.authentication.agencyNetwork && req.query.agency ? false : req.authentication.agencyNetwork;
    if (!Object.prototype.hasOwnProperty.call(req.query, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }
    if (!await validator.userId(req.query.id, agencyOrNetworkID, isThisAgencyNetwork)) {
        return next(serverHelper.requestError('ID is invalid'));
    }
    const id = req.query.id;

    // Make sure there is an owner for this agency (we are not removing the last owner)
    if (!await hasOtherOwner(agencyOrNetworkID, id, isThisAgencyNetwork)) {
        // Log a warning and return an error
        log.warn('This user is the account owner. You must assign ownership to another user before deleting this account.');
        return next(serverHelper.requestError('This user is the account owner. You must assign ownership to another user before deleting this account.'));
    }

    // Make sure there is another signing authority (we are not removing the last one) (this setting does not apply to agency networks)
    if (!req.authentication.agencyNetwork) {
        if (!await hasOtherSigningAuthority(agencyOrNetworkID, id)) {
            // Log a warning and return an error
            log.warn('This user is the account signing authority. You must assign signing authority to another user before deleting this account.');
            return next(serverHelper.requestError('This user is the account signing authority. You must assign signing authority to another user before deleting this account.'));
        }
    }

    // Update the user (we set the state to -2 to signify that the user is deleted)
    const updateSQL = `
			UPDATE \`#__agency_portal_users\`
			SET
				\`state\` = -2
			WHERE
				\`id\` = ${parseInt(id, 10)} AND
				${where}
			LIMIT 1;
		`;

    // Run the query
    const result = await db.query(updateSQL).catch(function(err) {
        log.error('__agency_portal_users error ' + err + __location);
        error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }

    // Make sure the query was successful
    if (result.affectedRows !== 1) {
        log.error('User delete failed');
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    res.send(200, 'Deleted');
}

/**
 * Retrieves the details of a single user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function getUser(req, res, next) {
    let error = false;

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }

    // Check for required parameters
    if (!Object.prototype.hasOwnProperty.call(req.query, 'id') || !req.query.id) {
        log.info('Bad Request: You must specify a user');
        return next(serverHelper.requestError('You must specify a user'));
    }

    // Determine if this is an agency or agency network
    let where = ``;
    if (req.authentication.agencyNetwork) {
        where = `\`agency_network\`= ${parseInt(req.authentication.agencyNetwork, 10)}`;
    }
    else {
        // Get the agents that we are permitted to view
        const agents = await auth.getAgents(req).catch(function(e) {
            error = e;
        });
        if (error) {
            return next(error);
        }
        where = ` \`agency\` = ${parseInt(agents[0], 10)}`;
    }

    // Get the user from the database
    const userSQL = `
			SELECT
				\`id\`,
				\`email\`,
				\`group\`,
				\`last_login\` AS \`lastLogin\`,
				\`can_sign\` = 1 AS \`canSign\`
			FROM
				\`#__agency_portal_users\`
			WHERE
				\`id\` = ${parseInt(req.query.id, 10)} AND
				${where};
		`;

    const userInfo = await db.query(userSQL).catch(function(err) {
        log.error('__agency_portal_users error ' + err + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });

    // Decrypt everything we need
    await crypt.batchProcessObjectArray(userInfo, 'decrypt', ['email']);

    res.send(200, userInfo[0]);
}

/**
 * Updates a single user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function updateUser(req, res, next) {
    let error = false;

    // Check that at least some post parameters were received
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        log.info('Bad Request: Parameters missing');
        return next(serverHelper.requestError('Parameters missing'));
    }

    // Validate the request and get back the data
    const data = await validate(req, req.body.user).catch(function(err) {
        log.warn(`${err.message}  ${__location}`);
        error = serverHelper.requestError(err.message);
    });
    if (error) {
        return next(error);
    }

    // Determine if this is an agency or agency network
    let agencyOrNetworkID = 0;
	let where = ``;
	if(req.authentication.agencyNetwork && req.body.agency){
		agencyOrNetworkID = parseInt(req.body.agency, 10);
		where = ` \`agency\` = ${agencyOrNetworkID}`;
	}
    else if (req.authentication.agencyNetwork) {
        agencyOrNetworkID = parseInt(req.authentication.agencyNetwork, 10);
        where = `\`agency_network\`= ${agencyOrNetworkID}`;
    }
    else {
        // Get the agents that we are permitted to view
        const agents = await auth.getAgents(req).catch(function(e) {
            error = e;
        });
        if (error) {
            return next(error);
        }
        agencyOrNetworkID = parseInt(agents[0], 10);
        where = ` \`agency\` = ${agencyOrNetworkID}`;
    }

	// Validate the ID
	// Since agency network can update an agency user determine, if this is an agency network but also has sent an agency (agencyId) then set this to false else let the authentication determine the agencyNetwork truthiness
	const  isThisAgencyNetwork = req.authentication.agencyNetwork && req.body.agency ? false : req.authentication.agencyNetwork;

    if (!Object.prototype.hasOwnProperty.call(req.body.user, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }
    if (!await validator.userId(req.body.user.id, agencyOrNetworkID, isThisAgencyNetwork)) {
        return next(serverHelper.requestError('ID is invalid'));
    }
    data.id = req.body.user.id;

    // Begin a database transaction
    const connection = await db.beginTransaction().catch(function(err) {
        log.error('db beginTransaction error ' + err + __location);
        error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }

	
    // If this user is to be set as owner, remove the current owner (they will become a super administrator)
    if (data.group === 1) {
        const removeOwnerSQL = `
				UPDATE
					\`#__agency_portal_users\`
				SET
					\`group\` = 2
				WHERE
					\`group\` = 1 AND
					${where}
				LIMIT 1;
			`;

        // Run the query
        await db.query(removeOwnerSQL, connection).catch(function(err) {
            log.error('__agency_portal_users error ' + err + __location);
            error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        });
        if (error) {
            return next(error);
        }

        // Make sure there is an owner for this agency (we are not removing the last owner)
    }
    else if (!await hasOtherOwner(agencyOrNetworkID, data.id, isThisAgencyNetwork)) {
        // Rollback the transaction
        db.rollback(connection);

        // Log a warning and return an error
        log.warn('This user must be an owner as no other owners exist. Create a new owner first.');
        return next(serverHelper.requestError('This user must be an owner as no other owners exist. Create a new owner first.'));
    }

	// If the user is being set as the signing authority, remove the current signing authority (this setting does not apply to agency networks)
	// However adding functionality to update user from agency network so also need to make sure no agency id was sent in the req.body
    if (!req.authentication.agencyNetwork && !req.body.agency) {
        if (data.canSign) {
            const removeCanSignSQL = `
					UPDATE
						\`#__agency_portal_users\`
					SET
						\`can_sign\` = NULL
					WHERE
						${where};
				`;

            // Run the query
            await db.query(removeCanSignSQL, connection).catch(function(err) {
                log.error('__agency_portal_users error ' + err + __location);
                error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
            });
            if (error) {
                return next(error);
            }

            // Make sure there is another signing authority (we are not removing the last one)
        }
        else if (!await hasOtherSigningAuthority(agencyOrNetworkID, data.id)) {
            // Rollback the transaction
            db.rollback(connection);

            // Log a warning and return an error
            log.warn('This user must be the signing authority as no other signing authority exists. Set another user as signing authority first.');
            return next(serverHelper.requestError('This user must be the signing authority as no other signing authority exists. Set another user as signing authority first.'));
        }
    }

    // Prepare the email address
    const emailHash = await crypt.hash(data.email);
    data.email = await crypt.encrypt(data.email);

    // Update the user
    const updateSQL = `
			UPDATE \`#__agency_portal_users\`
			SET
				\`can_sign\` = ${data.canSign},
				\`email\` = ${db.escape(data.email)},
				\`email_hash\` = ${db.escape(emailHash)},
				\`group\` = ${parseInt(data.group, 10)}
			WHERE
				\`id\` = ${parseInt(data.id, 10)} AND
				${where}
			LIMIT 1;
		`;

    // Run the query
    const result = await db.query(updateSQL, connection).catch(function(err) {
        log.error('__agency_portal_users error ' + err + __location);
        error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }

    // Make sure the query was successful
    if (result.affectedRows !== 1) {
        // Rollback the transaction
        db.rollback(connection);

        log.error('User update failed.');
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }

    // Commit the transaction
    db.commit(connection);
    res.send(200, 'Saved');
}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get User', `${basePath}/user`, getUser, 'users', 'manage');
    server.addPostAuth('Post User', `${basePath}/user`, createUser, 'users', 'manage');
    server.addPutAuth('Put User', `${basePath}/user`, updateUser, 'users', 'manage');
    server.addDeleteAuth('Delete User', `${basePath}/user`, deleteUser, 'users', 'manage');
};