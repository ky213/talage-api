'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const crypt = require('../../../shared/services/crypt.js');
const jwt = require('jsonwebtoken');
const serverHelper = global.requireRootPath('server.js');
const validator = global.requireShared('./helpers/validator.js');
const emailsvc = global.requireShared('./services/emailsvc.js');
const slack = global.requireShared('./services/slacksvc.js');
const AgencyNetworkBO = global.requireShared('models/AgencyNetwork-BO.js');
const AgencyBO = global.requireShared('./models/Agency-BO.js');
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

/**
 * Validates a user and returns a clean data object
 *
 * @param {object} user - User Object
 * @return {object} Object containing user information
 */
async function validate(user) {
    // Establish default values
    const data = {
        canSign: 0,
        email: '',
        group: 5,
        agencyNotificationList: null // default to null for easier/faster mongo searches
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
    data.name = user.name;
    data.lastName = user.lastName;
    data.phone = user.phone;

    data.group = user.group;

    if(user.agencyNotificationList && user.agencyNotificationList.length > 0){
        data.agencyNotificationList = user.agencyNotificationList;
    }

    const agencyPortalUserBO = new AgencyPortalUserBO();
    const doesDupExist = await agencyPortalUserBO.checkForDuplicateEmail(user.id, user.email, user.agencyNetworkId).catch(function(err){
        log.error('agencyPortalUser error ' + err + __location);
        throw new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (doesDupExist && doesDupExist.active === true) {
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
    // HACK: Adding backward compatibility so if typeof req.body.user === 'undefined' old ui use case else updated UI
    const userObj = typeof req.body.user === 'undefined' ? req.body : req.body.user;
    const data = await validate(userObj).catch(function(err) {
        error = err.message;
    });
    if (error) {
        log.warn(error);
        return next(serverHelper.requestError(error));
    }

    // Determine if this is an agency or agency network
    let agencyId = null;
    let agencyNetworkId = null;
    let isAgencyNetworkUser = false;
    const agencyBO = new AgencyBO();
    if (req.authentication.isAgencyNetworkUser && (req.body.agency || req.body.agencyId)){
        if(req.body.agencyId){
            agencyId = parseInt(req.body.agencyId, 10);
        }
        else {
            agencyId = parseInt(req.body.agency, 10);
        }
        const agencyDoc = await agencyBO.getById(agencyId).catch(function(err){
            log.error('agencyPortalUser error ' + err + __location);
            throw new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        });
        const reqUserAgencyNetworkId = parseInt(req.authentication.agencyNetworkId, 10)
        let isTalageSuperUser = false;
        if(reqUserAgencyNetworkId === 1 && req.authentication.permissions.talageStaff === true){
            isTalageSuperUser = true;
        }
        if(agencyDoc?.agencyNetworkId !== reqUserAgencyNetworkId && !isTalageSuperUser){
            log.error(`agencyPortalUser Attempt to add user to agency of agency Network request user ${req.authentication.userID}` + __location);
            return next(serverHelper.requestError(new Error("bad agencyId")));
        }
        agencyNetworkId = reqUserAgencyNetworkId;
    }
    else if (req.authentication.isAgencyNetworkUser){
        //TODO update for Global Mode.
        isAgencyNetworkUser = true;
        agencyNetworkId = parseInt(req.authentication.agencyNetworkId, 10)
        //req.authentication.permissions["globalMode"]
        //Determine if in global model - if so look for agency Network in requeset or error out the request.
        //short term if admin for Wheelhouse can add other agency Network user
        if(agencyNetworkId === 1 && req.authentication.permissions.talageStaff === true && parseInt(req.body.agencyNetworkId,10) > 0){
            agencyNetworkId = req.body.agencyNetworkId
        }

    }
    else {
        // Get the agents that we are permitted to view
        const agents = await auth.getAgents(req).catch(function(e) {
            error = e;
        });
        if (error) {
            return next(error);
        }
        agencyId = agents[0];
    }
    if(agencyId){
        //check it is valid agency
        const agencyDoc = await agencyBO.getById(agencyId).catch(function(err){
            log.error('agencyPortalUser error ' + err + __location);
            throw new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        });
        if(!agencyDoc){
            log.error(`agencyPortalUser Attempt to add user to non activeagency ${agencyId} request user ${req.authentication.userID}` + __location);
            return next(serverHelper.requestError(new Error("bad agencyId")));
        }
        agencyNetworkId = agencyDoc.agencyNetworkId;
    }

    // Generate a random password for this user (they won't be using it anyway)
    const passwordHash = await crypt.hashPassword(Math.random().toString(36).substring(2, 15));

    // Add this user to the database
    const newUserJSON = {
        agencyId: agencyId,
        agencyNetworkId: agencyNetworkId,
        isAgencyNetworkUser: isAgencyNetworkUser,
        email: userObj.email,
        password: passwordHash,
        name: userObj.name,
        lastName: userObj.lastName,
        phone: userObj.phone,
        canSign: data.canSign,
        agencyPortalUserGroupId: parseInt(data.group, 10)
    };


    // validate already fa
    // check if this user exists already but has been soft deleted.
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const deActiveUser = false;
    const oldDoc = await agencyPortalUserBO.getByEmailAndAgencyNetworkId(userObj.email, deActiveUser, agencyNetworkId).catch(function(err){
        log.error('agencyPortalUser error ' + err + __location);
        throw new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if(oldDoc){
        newUserJSON.active = true;
        newUserJSON.id = oldDoc.agencyPortalUserId;
    }
    else {
        let existingDoc = null;
        try {
            existingDoc = await agencyPortalUserBO.getByEmailAndAgencyNetworkId(userObj.email, true, agencyNetworkId, isAgencyNetworkUser);
        }
        catch (e) {
            log.error('agencyPortalUser error ' + e + __location);
            throw new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
        }

        if (existingDoc) {
            log.warn(`agencyPortalUser: User with this email already exists.` + __location);
            return next(new Error('A user with this email already exists.'));
        }
    }

    await agencyPortalUserBO.saveModel(newUserJSON).catch(function(err){
        log.error('agencyPortalUser error ' + err + __location);
        throw new Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }
    const userID = agencyPortalUserBO.id;
    //Do not update redis on create.  It will get updated at login.
    // Return the response
    res.send(200, {
        userID: userID,
        code: 'Success',
        message: 'User Created'
    });

    //check for do not send email
    if(req.body.sentEmail === false){
        return next();
    }


    // Check if this is an agency network
    agencyNetworkId = req.authentication.agencyNetworkId;


    // Get the content of the new user email
    let jsonEmailProp = '';
    if(req.authentication.isAgencyNetworkUser && req.body.agency){
        jsonEmailProp = 'new_agency_user';
    }
    else if (req.authentication.isAgencyNetworkUser){
        jsonEmailProp = 'new_agency_network_user';
    }
    else {
        jsonEmailProp = 'new_agency_user';
    }
    //log.debug("jsonEmailProp: " + jsonEmailProp);
    error = null;
    const agencyNetworkBO = new AgencyNetworkBO();
    const emailContentJSON = await agencyNetworkBO.getEmailContent(agencyNetworkId, jsonEmailProp).catch(function(err){
        log.error(`Unable to get email content for New Agency Portal User. agency_network: ${agencyNetworkId}.  error: ${err}` + __location);
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
        let brand = emailContentJSON.emailBrand;
        if(brand){
            brand = `${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
        }
        else {
            log.error(`Email Brand missing for agencyNetworkId ${agencyNetworkId} ` + __location);
        }
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
        const emailResp = await emailsvc.send(emailData.to, emailData.subject, emailData.html, {}, agencyNetworkId, brand);
        if (emailResp === false) {
            log.error(`Unable to send new user email to ${data.email}. Please send manually.`);
            slack.send('#alerts', 'warning', `Unable to send new user email to ${data.email}. Please send manually.`);
        }
    }
    else {
        log.error(`Unable to get email content for New Agency Portal User. agency_network: ${agencyNetworkId}.` + __location);
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


    if (req.authentication.isAgencyNetworkUser && req.query.agency) {
        agencyOrNetworkID = parseInt(req.query.agency,10);
    }
    else if (req.authentication.isAgencyNetworkUser) {
        agencyOrNetworkID = parseInt(req.authentication.agencyNetworkId, 10);
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
    }

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }

    // Validate the ID
    // Since agency network user can update an agency user determine,
    // if this is an agency network user but also has sent an agency (agencyId)
    // then set this to false else let the authentication determine the agencyNetwork truthiness
    const isThisAgencyNetwork = req.authentication.isAgencyNetworkUser && req.query.agency ? false : req.authentication.isAgencyNetworkUser;
    if (!Object.prototype.hasOwnProperty.call(req.query, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }
    if (!await validator.integer(req.query.id, agencyOrNetworkID, isThisAgencyNetwork)) {
        return next(serverHelper.requestError('ID is invalid'));
    }
    const id = req.query.id;

    //TODO need rights check

    const agencyPortalUserBO = new AgencyPortalUserBO();
    const userId = parseInt(id, 10)
    const result = await agencyPortalUserBO.deleteSoftById(userId).catch(function(err){
        log.error('agencyPortalUser error ' + err + __location);
        error = Error('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }

    // Make sure the query was successful
    if (!result) {
        log.error('User delete failed');
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    }
    //remove redis key
    const redisKey = "apuserinfo-" + userId;
    await global.redisSvc.deleteKey(redisKey);

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
    const userQuery = {id: parseInt(req.query.id, 10)};
    // Determine if this is an agency or agency network
    if (req.authentication.isAgencyNetworkUser) {
        userQuery.agencyNetworkId = parseInt(req.authentication.agencyNetworkId, 10);
    }
    else {
        // Get the agents that we are permitted to view
        const agents = await auth.getAgents(req).catch(function(e) {
            error = e;
        });
        if (error) {
            return next(error);
        }
        userQuery.agencyId = parseInt(agents[0], 10);
    }

    const agencyPortalUserBO = new AgencyPortalUserBO();
    const userInfoList = await agencyPortalUserBO.getList(userQuery).catch(function(err){
        log.error('agencyPortalUser error ' + err + __location);
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));

    });
    const userInfo = JSON.parse(JSON.stringify(userInfoList[0]));
    //convert notificationPolicyTypeList to JSON object with enabled.
    // eslint-disable-next-line array-element-newline
    const policyTypeList = ["WC","GL", "BOP", "PL", "CYBER"];
    const notificationPolicyTypeJSONList = [];
    for(const pt of policyTypeList) {
        let enabled = false;
        if(!userInfo.notificationPolicyTypeList || userInfo.notificationPolicyTypeList?.length === 0){
            enabled = true
        }
        else if(userInfo.notificationPolicyTypeList.indexOf(pt) > -1){
            enabled = true
        }

        const ptJSON = {
            policyType: pt,
            "enabled": enabled
        }
        notificationPolicyTypeJSONList.push(ptJSON);
    }

    userInfo.notificationPolicyTypeJSONList = notificationPolicyTypeJSONList;

    log.debug(JSON.stringify(userInfo))
    res.send(200, userInfo);
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
    // HACK: Adding backward compatibility so if typeof req.body.user === 'undefined' old ui use case else updated UI
    const userObj = typeof req.body.user === 'undefined' ? req.body : req.body.user;
    const data = await validate(userObj).catch(function(err) {
        log.warn(`${err.message}  ${__location}`);
        error = serverHelper.requestError(err.message);
    });
    if (error) {
        return next(error);
    }

    // Determine if this is an agency or agency network
    let agencyOrNetworkID = 0;
    if(req.authentication.isAgencyNetworkUser && req.body.agency){
        agencyOrNetworkID = parseInt(req.body.agency, 10);
    }
    else if (req.authentication.isAgencyNetworkUser) {
        agencyOrNetworkID = parseInt(req.authentication.agencyNetworkId, 10);
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
    }

    // Validate the ID
    // Since agency network can update an agency user determine, if this is an agency network but also has sent an agency (agencyId) then set this to false else let the authentication determine the agencyNetwork truthiness
    const isThisAgencyNetwork = req.authentication.isAgencyNetworkUser && req.body.agency ? false : req.authentication.isAgencyNetworkUser;

    if (!Object.prototype.hasOwnProperty.call(userObj, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }
    if (!await validator.userId(userObj.id, agencyOrNetworkID, isThisAgencyNetwork)) {
        log.error(`update user did not pass ID validation ${userObj.id} agencyOrNetworkID ${agencyOrNetworkID}`)
        return next(serverHelper.requestError('ID is invalid'));
    }

    data.id = userObj.id;
    const userId = parseInt(data.id, 10)
    // Prepare the email address
    const newUserJSON = {
        id: userId,
        canSign: data.canSign,
        email: data.email,
        name: data.name,
        lastName: data.lastName,
        phone: data.phone,
        agencyPortalUserGroupId: data.group,
        agencyNotificationList: data.agencyNotificationList
    }
    // if(data.notificationPolicyTypeList){
    //     newUserJSON.notificationPolicyTypeList = data.notificationPolicyTypeList
    // }
    if(req.body.user.notificationPolicyTypeJSONList?.length > 0){
        newUserJSON.notificationPolicyTypeList = [];
        for(const pt of req.body.user.notificationPolicyTypeJSONList){
            if(pt.enabled){
                newUserJSON.notificationPolicyTypeList.push(pt.policyType);
            }
        }
        log.debug(`newUserJSON.notificationPolicyTypeList  ${JSON.stringify(newUserJSON.notificationPolicyTypeList)}`)
    }
    const agencyPortalUserBO = new AgencyPortalUserBO();
    await agencyPortalUserBO.saveModel(newUserJSON).catch(function(err) {
        log.error('agencyPortalUser error ' + err + __location);
        error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });
    if (error) {
        return next(error);
    }
    await updateRedisCache(userId);
    res.send(200, 'Saved');
}

/**
 * Updates a single user's redis cache
 *
 * @param {integer} userId - userId apUserId
 * @returns {void}
 */
async function updateRedisCache(userId){
    const agencyPortalUserBO = new AgencyPortalUserBO();
    const apuDoc = await agencyPortalUserBO.getById(userId);
    const redisKey = "apuserinfo-" + apuDoc.agencyPortalUserId;
    await global.redisSvc.storeKeyValue(redisKey, JSON.stringify(apuDoc));

}

exports.registerEndpoint = (server, basePath) => {
    server.addGetAuth('Get User', `${basePath}/user`, getUser, 'users', 'manage');
    server.addPostAuth('Post User', `${basePath}/user`, createUser, 'users', 'manage');
    server.addPutAuth('Put User', `${basePath}/user`, updateUser, 'users', 'manage');
    server.addDeleteAuth('Delete User', `${basePath}/user`, deleteUser, 'users', 'manage');
};