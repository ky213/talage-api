/* eslint-disable guard-for-in */
/* eslint-disable prefer-const */
/* eslint-disable array-element-newline */
/* eslint-disable require-jsdoc */
'use strict';
const AgencyLocationModel = global.requireShared('./models/AgencyLocation-model.js');
const AgencyLocationBO = global.requireShared('./models/AgencyLocation-BO.js');
const AgencyLocationInsurerBO = global.requireShared('./models/AgencyLocationInsurer-BO.js');
const AgencyLocationTerritoryBO = global.requireShared('./models/AgencyLocationTerritory-BO.js');

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
    const locationJSON = await agencyLocationBO.getByIdAndAgencyListForAgencyPortal(id, agencyList).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    if (locationJSON) {
        res.send(200, locationJSON);
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
    //correct legacy properties
    await legacyFieldUpdate(req.body)
    //log.debug("update legacy " + JSON.stringify(req.body))
    //get Agency insures data from body


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
  
    //process insurers
    // body.insurers
    if(req.body.insurers){
        for(let i = 0; i < req.body.insurers.length; i++){
            let reqAlInsurer  = req.body.insurers[i];
            reqAlInsurer.agency_location = agencyLocationBO.id;
            let agencyLocationInsurerBO = new AgencyLocationInsurerBO()
            await agencyLocationInsurerBO.saveModel(reqAlInsurer).catch(function(err) {
                log.error("agencyLocationInsurerBO.save error " + err + __location);
                error = err;
            });
            if (error) {
                return next(error);
            }
            
        }
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
    if (!await validator.agencyLocation(req.query.id)) {
        return next(serverHelper.requestError('ID is invalid'));
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

        // Get the agency ID to which this location belongs
        const sql = `
			SELECT
				\`agency\`
			FROM
				\`#__agency_locations\`
			WHERE
				\`id\` = ${db.escape(id)}
			LIMIT 1;
		`;
        const result = await db.query(sql).catch(function(e) {
            log.error(e.message + __location);
            reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
        });

        // Make sure an agency was found
        if (result.length !== 1) {
            log.warn('Agency ID not found in getAgencyLocation()' + __location);
            reject(serverHelper.requestError('No agency found. Please contact us.'));
        }

        // Isolate and return the agency ID
        fulfill(result[0].agency);
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
    if (!await validator.agencyLocation(req.body.id)) {
        return next(serverHelper.requestError('ID is invalid'));
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
            if (insurer.locationID) {
                insurer.agencyLocation = insurer.locationID;

            }
            else {
                //Fix client not setting location id
                insurer.agencyLocation = req.body.id;
            }
        }
    }

    //correct legacy properties
    await legacyFieldUpdate(req.body)
    // log.debug("update legacy " + JSON.stringify(req.body))


    // Initialize an agency object
    const agencyLocationBO = new AgencyLocationBO();
    await agencyLocationBO.saveModel(req.body).catch(function(err) {
        log.error("agencyLocationBO.save error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
  
    //process insurers
    // body.insurers
    if(req.body.insurers){
        for(let i = 0; i < req.body.insurers.length; i++){
            let reqAlInsurer  = req.body.insurers[i];
            reqAlInsurer.agency_location = agencyLocationBO.id;
            let agencyLocationInsurerBO = new AgencyLocationInsurerBO()
            await agencyLocationInsurerBO.saveModel(reqAlInsurer).catch(function(err) {
                log.error("agencyLocationInsurerBO.save error " + err + __location);
                error = err;
            });
            if (error) {
                return next(error);
            }
            
        }
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


    // Determine the agency ID
    const agencyId = req.authentication.agents[0];

    // Initialize an agency object
    const agencyLocationBO = new AgencyLocationBO();

    // Load the request data into it
    const locationList = await agencyLocationBO.getSelectionList(agencyId).catch(function(err) {
        log.error("Location load error " + err + __location);
        error = err;
    });
    if (error) {
        return next(error);
    }
    // Send back a success response
    res.send(200, locationList);
    return next();
}
// Agency portal does not send bop, gl, wc properties, just policy_type_info
async function legacyFieldUpdate(requestALJSON) {
    const policyTypeList = ["GL", "WC", "BOP"];
    if (requestALJSON.insurers) {
        for (let i = 0; i < requestALJSON.insurers.length; i++) {
            let insurer = requestALJSON.insurers[i];
            insurer.bop = 0;
            insurer.gl = 0;
            insurer.wc = 0;
            if (insurer.policy_type_info) {
                for (let j = 0; j < policyTypeList.length; j++) {
                    const policyType = policyTypeList[j];
                    //log.debug("policyType " + policyType);
                    if (insurer.policy_type_info[policyType] && insurer.policy_type_info[policyType].enabled) {
                        insurer[policyType.toLowerCase()] = insurer.policy_type_info[policyType].enabled ? 1 : 0;
                    }
                    else {
                        insurer[policyType.toLowerCase()] = 0;
                    }
                    // log.debug(`Set ${policyType.toLowerCase()} to ` + insurer[policyType.toLowerCase()])
                }
            }
            //log.debug("insurer: " + JSON.stringify(insurer))
        }

    }

    return true;
}

exports.registerEndpoint = (server, basePath) => {
    server.addDeleteAuth('Delete Agency Location', `${basePath}/agency-location`, deleteAgencyLocation);
    server.addPostAuth('Post Agency Location', `${basePath}/agency-location`, createAgencyLocation);
    server.addPutAuth('Put Agency Location', `${basePath}/agency-location`, updateAgencyLocation);
    server.addGetAuth('GET Agency Location List for Selection', `${basePath}/agency-location/selectionlist`, getSelectionList);
    server.addGetAuth('GET Agency Location Object', `${basePath}/agency-location/:id`, getbyId);
};