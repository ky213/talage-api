'use strict';
const AgencyLocation = global.requireShared('./models/AgencyLocation-model.js');
// const crypt = global.requireShared('./services/crypt.js');
// const util = require('util');
const auth = require('./helpers/auth.js');
const validator = global.requireShared('./helpers/validator.js');
const serverHelper = require('../../../server.js');
// eslint-disable-next-line no-unused-vars
const tracker = global.requireShared('./helpers/tracker.js');

/**
 * Creates a single Agency Location
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function createAgencyLocation(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'agencies', 'manage').catch(function(e){
        log.error("auth.validateJWT error " + e + __location);
		error = e;
	});
	if(error){
		return next(error);
	}

	// Make sure this is an agency network
	if(req.authentication.agencyNetwork === false){
		log.info('Forbidden: Only Agency Networks are authorized to create agency locations');
		return next(serverHelper.forbiddenError('You are not authorized to create agency locations'));
	}

	// Check for data
	if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
		log.warn('No data was received');
		return next(serverHelper.requestError('No data was received'));
	}

	// Make sure the ID is 0 (this is how the system knows to create a new record)
	req.body.id = 0;

	// Initialize an agency object
	const location = new AgencyLocation();

	// Load the request data into it
	await location.load(req.body).catch(function(err){
        log.error("location.load error " + err + __location);
		error = err;
	});
	if(error){
		return next(error);
	}

	// Save the location
	await location.save().catch(function(err){
		error = err;
	});
	if(error){
		return next(error);
	}

	// Return the response
	res.send(200, {
		'id': location.id,
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
async function deleteAgencyLocation(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'agencies', 'manage').catch(function(e){
        log.error("auth.validateJWT error " + e + __location);
		error = e;
	});
	if(error){
		return next(error);
	}

	// Make sure this is an agency network
	if(req.authentication.agencyNetwork === false){
		log.info('Forbidden: Only Agency Networks are authorized to delete agency locations');
		return next(serverHelper.forbiddenError('You are not authorized to delete agency locations'));
	}

	// Check that query parameters were received
	if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
		log.info('Bad Request: Query parameters missing');
		return next(serverHelper.requestError('Query parameters missing'));
	}

	// Validate the ID
	if(!Object.prototype.hasOwnProperty.call(req.query, 'id')){
		return next(serverHelper.requestError('ID missing'));
	}
	if(!await validator.agencyLocation(req.query.id)){
		return next(serverHelper.requestError('ID is invalid'));
	}
	const id = parseInt(req.query.id, 10);

	// Get the Agency ID corresponding to this location and load it into the request object
	try{
		req.query.agency = await getAgencyByLocationId(id);
    }
    catch(err){
        log.error("Get Agency by ID error: " + err + __location)
		return next(err);
	}

	// Get the agencies that the user is permitted to manage
	const agencies = await auth.getAgents(req).catch(function(e){
        log.error("auth.getAgents error " + e + __location);
		error = e;
	});
	if(error){
		return next(error);
	}

	// Security Check: Make sure this Agency Network has access to this Agency
	if(!agencies.includes(req.query.agency)){
		log.info('Forbidden: User is not authorized to manage this agency');
		return next(serverHelper.forbiddenError('You are not authorized to manage this agency'));
	}

	// Update the agency location (we set the state to -2 to signify that the agency location is deleted)
	const updateSQL = `
			UPDATE \`#__agency_locations\`
			SET
				\`state\` = -2
			WHERE
				\`id\` = ${id}
			LIMIT 1;
		`;

	// Run the query
	const result = await db.query(updateSQL).catch(function(err){
        error = serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
        log.error('Agency Location delete had an error: ' + err + __location);
	});
	if(error){
		return next(error);
	}

	// Make sure the query was successful
	if(result.affectedRows !== 1){
		log.error('Agency Location delete failed');
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	res.send(200, 'Deleted');
}

/**
 * Gets the Agency ID corresponding to a given Agency Location ID
 *
 * @param {int} id - The ID of an Agency Location
 * @returns {Promise.<Boolean, Error>} A promise that returns an Agency ID if resolved, or an Error if rejected
 */
function getAgencyByLocationId(id){
	return new Promise(async(fulfill, reject) => {
		if(!id || typeof id !== 'number'){
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
		const result = await db.query(sql).catch(function(e){
			log.error(e.message + __location);
			reject(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
		});

		// Make sure an agency was found
		if(result.length !== 1){
			log.warn('Agency ID not found in updateAgencyLocation()');
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
async function updateAgencyLocation(req, res, next){
	let error = false;

	// Determine which permissions group to use (start with the default permission needed by an agency network)
	let permissionGroup = 'agencies';

	// If this is not an agency network, use the agency specific permissions
	if(req.authentication.agencyNetwork === false){
		permissionGroup = 'settings';
	}

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, permissionGroup, 'view').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Check for data
	if(!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0){
		log.warn('No data was received');
		return next(serverHelper.requestError('No data was received'));
	}

	// Validate the ID
	if(!Object.prototype.hasOwnProperty.call(req.body, 'id')){
		return next(serverHelper.requestError('ID missing'));
	}
	if(!await validator.agencyLocation(req.body.id)){
		return next(serverHelper.requestError('ID is invalid'));
	}
	const id = parseInt(req.body.id, 10);

	// Get the agencies that the user is permitted to manage
	const agencies = await auth.getAgents(req).catch(function(e){
        log.error("auth.getAgents error " + e + __location)
		error = e;
	});
	if(error){
		return next(error);
	}

	// If no agency is supplied, get one
	if(!req.body.agency){
		// Determine how to get the agency ID
		if(req.authentication.agencyNetwork === false){
			// If this is an Agency Network User, get the agency from the location
			try{
				req.body.agency = await getAgencyByLocationId(id);
            }
            catch(err){
                log.error("getAgencyByLocationId error " + err + __location);
				return next(err);
			}
        }
        else{
			// If this is an Agency User, get the agency from their permissions
			req.body.agency = agencies[0];
		}
	}

	// Security Check: Make sure this Agency Network has access to this Agency
	if(!agencies.includes(req.body.agency)){
		log.info('Forbidden: User is not authorized to manage this agency');
		return next(serverHelper.forbiddenError('You are not authorized to manage this agency'));
	}

	// Initialize an agency object
	const location = new AgencyLocation();

	// Load the request data into it
	await location.load(req.body).catch(function(err){
        log.error("Location load error " + err + __location);
		error = err;
	});
	if(error){
		return next(error);
	}

	// Save the location
	await location.save().catch(function(err){
        log.error("Location save error " + err + __location);
		error = err;
	});
	if(error){
		return next(error);
	}

	// Send back a success response
	res.send(200, 'Updated');
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addDeleteAuth('Delete Agency Location', `${basePath}/agency-location`, deleteAgencyLocation);
	server.addPostAuth('Post Agency Location', `${basePath}/agency-location`, createAgencyLocation);
	server.addPutAuth('Put Agency Location', `${basePath}/agency-location`, updateAgencyLocation);
};