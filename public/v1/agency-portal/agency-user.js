'use strict';
const auth = require('./helpers/auth-agencyportal.js');
const serverHelper = global.requireRootPath('server.js');
const validator = global.requireShared('./helpers/validator.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

//const hasOtherOwner = require('./user').hasOtherOwner;
//const hasOtherSigningAuthority = require('./user').hasOtherSigningAuthority;
const AgencyPortalUserBO = global.requireShared('models/AgencyPortalUser-BO.js');

/**
 * Deletes a single agency user (by an agency network)
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function deleteAgencyUser(req, res, next){
    let error = false;

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }

    // Validate the ID
    if (!Object.prototype.hasOwnProperty.call(req.query, 'id')){
        return next(serverHelper.requestError('ID missing'));
    }
    if (!await validator.integer(req.query.id)){
        return next(serverHelper.requestError('ID is invalid'));
    }
    const id = req.query.id;

    const agencyPortalUserBO = new AgencyPortalUserBO();
    const userResult = await agencyPortalUserBO.getById(parseInt(id, 10)).catch(function(err){
        log.error(err.message);
        return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
    });

    if(!userResult){
        return next(serverHelper.requestError('ID is invalid'));
    }


    // Isolate the user's agency
    const userAgency = userResult.agencyId;

    // Get the agencies that we are permitted to manage
    const agencies = await auth.getAgents(req).catch(function(e){
        error = e;
    });
    if (error){
        return next(error);
    }

    // Check that this Agency Network can manage this user
    if (!agencies.includes(userAgency)){
        log.warn('You do not have permission to manage users from this agency');
        return next(serverHelper.forbiddenError('You do not have permission to manage users from this agency'));
    }

    // Make sure there is an owner for this agency (we are not removing the last owner)
    // if (!await hasOtherOwner(userAgency, id)){
    //     // Log a warning and return an error
    //     log.warn('This user is the account owner. You must assign ownership to another user before deleting this account');
    //     return next(serverHelper.requestError('This user is the account owner. You must assign ownership to another user before deleting this account.'));
    // }

    // // Make sure there is another signing authority (we are not removing the last one)
    // if (!await hasOtherSigningAuthority(userAgency, id)){
    //     // Log a warning and return an error
    //     log.warn('This user is the account signing authority. You must assign signing authority to another user before deleting this account');
    //     return next(serverHelper.requestError('This user is the account signing authority. You must assign signing authority to another user before deleting this account.'));
    // }

    await agencyPortalUserBO.deleteSoftById(parseInt(id, 10)).catch(function(err){
        log.error(err.message);
        error = serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.');
    });

    if (error){
        return next(error);
    }

    res.send(200, 'Deleted');
}

exports.registerEndpoint = (server, basePath) => {
    server.addDeleteAuth('Delete Agency User', `${basePath}/agency-user`, deleteAgencyUser, 'agencies', 'manage');
};