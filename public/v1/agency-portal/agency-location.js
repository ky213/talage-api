/* eslint-disable object-property-newline */
/* eslint-disable guard-for-in */
/* eslint-disable prefer-const */
/* eslint-disable array-element-newline */
/* eslint-disable require-jsdoc */
'use strict';

const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');


// const util = require('util');
const auth = require('./helpers/auth.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');
const stringFunctions = global.requireShared('./helpers/stringFunctions.js');


/**
     * Return AgencyLocation Object with Children
     *
     * @param {object} req - HTTP request object
     * @param {object} res - HTTP response object
     * @param {function} next - The next function to execute
     *
     * @returns {void}
     */
async function getbyId(req, res, next) {
    let error = false;
    //santize id.
    const id = stringFunctions.santizeNumber(req.params.id, true);
    if (!id) {
        return next(new Error("bad parameter"));
    }

    // Determine which permissions group to use (start with the default permission needed by an agency network)
    let permissionGroup = 'agencies';

    // If this is not an agency network, use the agency specific permissions
    if (req.authentication.agencyNetwork === false) {
        permissionGroup = 'settings';
    }

    // Make sure the authentication payload has everything we are expecting
    await auth.validateJWT(req, permissionGroup, 'view').catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }


    // Determine the agency ID
    const agencyList = req.authentication.agents;

    // Initialize an agency object
    const agencyLocationBO = new AgencyLocationBO();

    // Load the request data into it
    //const locationJSON = await agencyLocationBO.getByIdAndAgencyListForAgencyPortal(id, agencyList).catch(function(err) {
    // eslint-disable-next-line object-curly-newline
    const query = {"systemId": id, agencyId: agencyList};
    log.debug("AL GET query: " + JSON.stringify(query));
    const getAgencyName = false;
    const loadChildren = true;
    const locationJSONList = await agencyLocationBO.getList(query, getAgencyName, loadChildren).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (locationJSONList && locationJSONList.length > 0) {
        let location = locationJSONList[0];
        location.id = location.systemId;
        if(location.insurers){
            for(let i = 0; i < location.insurers.length; i++) {
                let insurer = location.insurers[i];
                //backward compatible for Quote App.  properties for WC, BOP, GL
                if(insurer.policyTypeInfo){
                    insurer.policy_type_info = insurer.policyTypeInfo
                    const policyTypeCd = ['WC','BOP','GL']
                    for(const pt of policyTypeCd){
                        if(insurer.policy_type_info[pt] && insurer.policy_type_info[pt].enabled === true){
                            insurer[pt.toLowerCase()] = 1;
                        }
                        else {
                            insurer[pt.toLowerCase()] = 0;
                        }
                    }
                }
            }
        }
        res.send(200, locationJSONList[0]);
        return next();
    }
    else {
        res.send(404);
        return next(serverHelper.notFoundError('Agency Location not found'));
    }
}


/**
 * Creates a single Agency Location
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function createAgencyLocation(req, res, next) {
    let error = false;

    // Make sure the authentication payload has everything we are expecting
    await auth.validateJWT(req, 'agencies', 'manage').catch(function(e) {
        log.error("auth.validateJWT error " + e + __location);
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Make sure this is an agency network
    if (req.authentication.agencyNetwork === false) {
        log.info('Forbidden: Only Agency Networks are authorized to create agency locations');
        return next(serverHelper.forbiddenError('You are not authorized to create agency locations'));
    }

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }

    // Make sure the ID is 0 (this is how the system knows to create a new record)
    req.body.id = 0;

    //log.debug("update legacy " + JSON.stringify(req.body))
    //get Agency insures data from body


    log.debug("AP Agency location POST " + JSON.stringify(req.body))
    if(req.body.fname){
        req.body.firstName = req.body.fname
    }

    if(req.body.lname){
        req.body.lastName = req.body.lname
    }

    if(req.body.policy_type_info){
        req.body.policyTypeInfo = req.body.policy_type_info
    }

    //Fix insures
    if (req.body.insurers) {
        for (let i = 0; i < req.body.insurers.length; i++) {
            // eslint-disable-next-line prefer-const
            let insurer = req.body.insurers[i];
            if(insurer.insurer){
                insurer.insurerId = insurer.insurer;
            }
            if(insurer.policy_type_info){
                insurer.policyTypeInfo = insurer.policy_type_info
            }
        }
    }

    //convert legacy property Name
    if(req.body.agency){
        req.body.agencyId = req.body.agency;
    }

    // Initialize an agency object
    const agencyLocationBO = new AgencyLocationBO();

    // Load the request data into it
    await agencyLocationBO.saveModel(req.body).catch(function(err) {
        log.error("agencyLocationBO.save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }


    // Return the response
    res.send(200, {
        'id': agencyLocationBO.id,
        'code': 'Success',
        'message': 'Created'
    });
    return next();
}

/**
 * Deletes a single Agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function deleteAgencyLocation(req, res, next) {
    let error = false;

    // Make sure the authentication payload has everything we are expecting
    await auth.validateJWT(req, 'agencies', 'manage').catch(function(e) {
        log.error("auth.validateJWT error " + e + __location);
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Make sure this is an agency network
    if (req.authentication.agencyNetwork === false) {
        log.info('Forbidden: Only Agency Networks are authorized to delete agency locations');
        return next(serverHelper.forbiddenError('You are not authorized to delete agency locations'));
    }

    // Check that query parameters were received
    if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
        log.info('Bad Request: Query parameters missing');
        return next(serverHelper.requestError('Query parameters missing'));
    }

    // Validate the ID
    if (!Object.prototype.hasOwnProperty.call(req.query, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }

    const id = parseInt(req.query.id, 10);

    // Get the Agency ID corresponding to this location and load it into the request object
    try {
        req.query.agency = await getAgencyByLocationId(id);
    }
    catch (err) {
        log.error("Get Agency by ID error: " + err + __location)
        return next(err);
    }

    // Get the agencies that the user is permitted to manage
    const agencies = await auth.getAgents(req).catch(function(e) {
        log.error("auth.getAgents error " + e + __location);
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Security Check: Make sure this Agency Network has access to this Agency
    if (!agencies.includes(req.query.agency)) {
        log.info('Forbidden: User is not authorized to manage this agency');
        return next(serverHelper.forbiddenError('You are not authorized to manage this agency'));
    }


    const agencyLocationBO = new AgencyLocationBO();
    await agencyLocationBO.deleteSoftById(id).catch(function(err) {
        log.error("agencyLocationBO deleteSoft load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    res.send(200, 'Deleted');
}

/**
 * Gets the Agency ID corresponding to a given Agency Location ID
 *
 * @param {int} id - The ID of an Agency Location
 * @returns {Promise.<Boolean, Error>} A promise that returns an Agency ID if resolved, or an Error if rejected
 */
function getAgencyByLocationId(id) {
    return new Promise(async(fulfill, reject) => {
        if (!id || typeof id !== 'number') {
            log.warn('Invalid ID passed to getAgencyByLocationId()');
            reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
            return;
        }
        const agencyLocationBO = new AgencyLocationBO();
        const locationJSON = await agencyLocationBO.getById(id).catch(function(err) {
            log.error("Location load error " + err + __location);
            reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
        });
        if(locationJSON){
            fulfill(locationJSON.agencyId);
        }
        else{
            log.warn(`Agency ID not found in getAgencyLocation() id ${id}` + __location);
            reject(serverHelper.requestError('No agency found. Please contact us.'));
        }
    });
}

/**
 * Updates a single Agency Location
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function updateAgencyLocation(req, res, next) {

    // log.debug("AP Agency location PUT " + JSON.stringify(req.body))

    let error = false;

    // Determine which permissions group to use (start with the default permission needed by an agency network)
    let permissionGroup = 'agencies';

    // If this is not an agency network, use the agency specific permissions
    if (req.authentication.agencyNetwork === false) {
        permissionGroup = 'settings';
    }

    // Make sure the authentication payload has everything we are expecting
    await auth.validateJWT(req, permissionGroup, 'view').catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }

    // Check for data
    if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        log.warn('No data was received');
        return next(serverHelper.requestError('No data was received'));
    }

    // Validate the ID
    if (!Object.prototype.hasOwnProperty.call(req.body, 'id')) {
        return next(serverHelper.requestError('ID missing'));
    }

    const id = parseInt(req.body.id, 10);

    // Get the agencies that the user is permitted to manage
    const agencies = await auth.getAgents(req).catch(function(e) {
        log.error("auth.getAgents error " + e + __location)
        error = e;
    });
    if (error) {
        return next(error);
    }

    // If no agency is supplied, get one
    if (!req.body.agency) {
        // Determine how to get the agency ID
        if (req.authentication.agencyNetwork === false) {
            // If this is an Agency Network User, get the agency from the location
            try {
                req.body.agency = await getAgencyByLocationId(id);
            }
            catch (err) {
                log.error("getAgencyByLocationId error " + err + __location);
                return next(err);
            }
        }
        else {
            // If this is an Agency User, get the agency from their permissions
            req.body.agency = agencies[0];
        }
    }

    // Security Check: Make sure this Agency Network has access to this Agency
    if (!agencies.includes(req.body.agency)) {
        log.info('Forbidden: User is not authorized to manage this agency');
        return next(serverHelper.forbiddenError('You are not authorized to manage this agency'));
    }
    //Fix location:
    if (req.body.insurers) {
        for (let i = 0; i < req.body.insurers.length; i++) {
            // eslint-disable-next-line prefer-const
            let insurer = req.body.insurers[i];

            if(insurer.insurer){
                insurer.insurerId = insurer.insurer;
            }
            if(insurer.policy_type_info){
                insurer.policyTypeInfo = insurer.policy_type_info
            }
        }
    }

    //convert legacy property Name
    if(req.body.fname){
        req.body.firstName = req.body.fname
    }

    if(req.body.lname){
        req.body.lastName = req.body.lname
    }

    // Initialize an agency object
    const agencyLocationBO = new AgencyLocationBO();
    await agencyLocationBO.saveModel(req.body).catch(function(err) {
        log.error("agencyLocationBO.save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }

    // Send back a success response
    res.send(200, 'Updated');
    return next();
}

/**
 * Return location List used for selecting a location
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getSelectionList(req, res, next) {
    //log.debug('getSelectionList: ' + JSON.stringify(req.body))
    let error = false;
    // Determine which permissions group to use (start with the default permission needed by an agency network)
    let permissionGroup = 'agencies';

    // If this is not an agency network, use the agency specific permissions
    if (req.authentication.agencyNetwork === false) {
        permissionGroup = 'settings';
    }

    // Make sure the authentication payload has everything we are expecting
    await auth.validateJWT(req, permissionGroup, 'view').catch(function(e) {
        error = e;
    });
    if (error) {
        return next(error);
    }


    // Determine the agency ID, if network id then we will have an agencyId in the query else not
    let agencyId = parseInt(req.authentication.agents[0], 10);

    if(req.authentication.agencyNetwork){
        // Get the agencies that the user is permitted to manage
        const agencies = await auth.getAgents(req).catch(function(e) {
            log.error("auth.getAgents error " + e + __location);
            error = e;
        });
        if (error) {
            return next(error);
        }
        if(Object.prototype.hasOwnProperty.call(req.query, 'agencyId')){
            agencyId = parseInt(req.query.agencyId, 10);
        }

        // Security Check: Make sure this Agency Network has access to this Agency
        if (!agencies.includes(agencyId)) {
            log.info('Forbidden: User is not authorized to manage this agency');
            return next(serverHelper.forbiddenError('You are not authorized to manage this agency'));
        }
    }
    // Initialize
    const agencyLocationBO = new AgencyLocationBO();

    let locationList = null;
    const query = {"agencyId": agencyId}
    const getAgencyName = true;
    const getChildren = true;

    locationList = await agencyLocationBO.getList(query, getAgencyName, getChildren).catch(function(err){
        log.error(err.message + __location);
        error = err;
        return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
    });
    //Backward compatible for mysql columns
    locationList.forEach((location) => {
        location.fname = location.firstName;
        location.lname = location.lastName;
        location.id = location.systemId;
        if(location.insurers){
            for(let i = 0; i < location.insurers.length; i++) {
                let insurer = location.insurers[i];
                insurer.insurer = insurer.insurerId
                //backward compatible for Quote App.  properties for WC, BOP, GL
                if(insurer.policyTypeInfo){
                    insurer.policy_type_info = insurer.policyTypeInfo
                    const policyTypeCd = ['WC','BOP','GL']
                    for(const pt of policyTypeCd){
                        if(insurer.policy_type_info[pt] && insurer.policy_type_info[pt].enabled === true){
                            insurer[pt] = 1;
                        }
                        else {
                            insurer[pt] = 0;
                        }
                    }
                }
            }
        }
    });
    // Send back a success response
    res.send(200, locationList);
    return next();
}

exports.registerEndpoint = (server, basePath) => {
    server.addDeleteAuth('Delete Agency Location', `${basePath}/agency-location`, deleteAgencyLocation);
    server.addPostAuth('Post Agency Location', `${basePath}/agency-location`, createAgencyLocation);
    server.addPutAuth('Put Agency Location', `${basePath}/agency-location`, updateAgencyLocation);
    server.addGetAuth('GET Agency Location List for Selection', `${basePath}/agency-location/selectionlist`, getSelectionList);
    server.addGetAuth('GET Agency Location Object', `${basePath}/agency-location/:id`, getbyId);
};