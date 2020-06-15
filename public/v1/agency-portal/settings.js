'use strict';

const crypt = global.requireShared('./services/crypt.js');
const validator = global.requireShared('./helpers/validator.js');
const auth = require('./helpers/auth.js');
const request = require('request');
const serverHelper = require('../../../server.js');

/**
 * Responds to get requests for the certificate endpoint
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function getSettings(req, res, next){
	let error = false;

	const agents = await auth.getAgents(req).catch(function(e){
		error = e;
	});
	if (error){
		return next(error);
	}

	const sql = `
			SELECT
				\`name\`,
				\`email\`,
				\`fname\`,
				\`lname\`,
				\`logo\`,
				\`phone\`,
				\`slug\`,
				\`website\`,
				\`ca_license_number\`
			FROM \`#__agencies\`
			WHERE \`id\` = ${db.escape(agents[0])}
			LIMIT 1;
		`;
	const result = await db.query(sql).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Reduce the result to just the data we need
	const settings = result[0];

	// Decrypt everything we need
	await crypt.batchProcessObject(settings, 'decrypt', ['ca_license_number',
'email',
'fname',
'lname',
'phone',
'website']);

	// Get all locations for this agency
	const locationSQL = `
			SELECT
				\`al\`.\`id\`,
				\`al\`.\`address\`,
				\`al\`.\`address2\`,
				\`al\`.\`close_time\`,
				\`al\`.\`email\`,
				\`al\`.\`fname\`,
				\`al\`.\`lname\`,
				\`al\`.\`open_time\`,
				\`al\`.\`phone\`,
				\`al\`.\`primary\`,
				\`al\`.\`zip\`,
				GROUP_CONCAT(\`t\`.\`name\`) AS \`territories\`
			FROM \`#__agency_locations\` AS \`al\`
			LEFT JOIN \`#__agency_location_territories\` AS \`alt\` ON \`alt\`.\`agency_location\` = \`al\`.\`id\`
			LEFT JOIN \`#__territories\` AS \`t\` ON \`alt\`.\`territory\` = \`t\`.\`abbr\`
			WHERE \`al\`.\`agency\` = ${db.escape(agents[0])}
			GROUP BY \`al\`.\`id\`;
		`;
	const locations = await db.query(locationSQL).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Process each location
	settings.locations = {};
	if (locations.length){
		// Decrypt data for all locations
		await crypt.batchProcessObjectArray(locations, 'decrypt', ['address',
'address2',
'email',
'fname',
'lname',
'phone']);

		// Add each location to the settings indexed by ID
		locations.forEach(function(location){
			settings.locations[location.id] = location;
		});

		// Get insurer settings for all locations
		const insurerSQL = `
				SELECT
					\`ali\`.\`agency_location\`,
					\`i\`.\`name\` AS 'insurer',
					\`ali\`.\`agency_id\`,
					\`ali\`.\`agent_id\`,
					\`ali\`.\`bop\`,
					\`ali\`.\`gl\`,
					\`ali\`.\`wc\`
				FROM \`#__agency_location_insurers\` AS \`ali\`
				LEFT JOIN \`#__insurers\` AS \`i\` ON \`ali\`.\`insurer\` = \`i\`.\`id\`
				WHERE \`ali\`.\`agency_location\` IN (${Object.keys(settings.locations)});
			`;
		const insurers = await db.query(insurerSQL).catch(function(err){
			log.error(err.message);
			return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
		});

		// Process insurers
		if (insurers.length){
			// Decrypt data for all insurers
			await crypt.batchProcessObjectArray(insurers, 'decrypt', ['agency_id', 'agent_id']);

			// Match the insurers to their locations
			insurers.forEach(function(insurer){
				// Make sure this location has an insurers array
				if (!Object.prototype.hasOwnProperty.call(settings.locations[insurer.agency_location], 'insurers')){
					settings.locations[insurer.agency_location].insurers = [];
				}

				// Add this insurer to the location
				settings.locations[insurer.agency_location].insurers.push(insurer);
			});
		}
	}

	// Remove some data we don't need to return
	for (const locationIndex in settings.locations){
		if (Object.prototype.hasOwnProperty.call(settings.locations, locationIndex)){
			// Remove the location ID (it is indexed on this anyway)
			delete settings.locations[locationIndex].id;

			// Remove the agency_location from insurers
			settings.locations[locationIndex].insurers.forEach(function(insurer){
				delete insurer.agency_location;
			});
		}
	}

	// Return the settings
	res.send(200, settings);
}

/**
 * Updates the settings of a single user
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function updateSettings(req, res, next){
	let error = false;

	const agents = await auth.getAgents(req).catch(function(e){
		error = e;
	});
	if (error){
		return next(error);
	}

	// Check for data
	if (!req.body){
		log.warn('No data was received');
		return next(serverHelper.requestError('No data was received'));
	}

	if (typeof req.body === 'object' && Object.keys(req.body).length === 0){
		res.send(200, 'Nothing to update');
		return next();
	}

	// Establish some variables
	const settings = {
		"ca_license_number": '',
		"email": '',
		"fname": '',
		"lname": '',
		"name": '',
		"phone": '',
		"slug": '',
		"website": ''
	};

	settings.slug = req.body.settings.slug ? req.body.settings.slug : '';

	let logo = null;
	if (Object.prototype.hasOwnProperty.call(req.body.settings, 'logo') && req.body.settings.logo){
		settings.logo = req.body.settings.logo;

		if (Object.prototype.hasOwnProperty.call(req.body, 'removeLogo') && req.body.removeLogo){
			// Establish the options for the request
			const options = {
				"method": 'DELETE',
				"url": `http://localhost:${global.settings.PRIVATE_API_PORT}/v1/file/file?path=public/agency-logos/${req.body.removeLogo}`
			};
			// Send the request
			await request(options, function(e, response, body){
				// If there was an error, reject
				if (e){
					error = serverHelper.internalError('Well, that wasn’t supposed to happen. Please try again and if this continues please contact us. (Failed to delete old logo)');
					log.error('Failed to connect to file service.');
					return;
				}

				// If the response was anything but a success, reject
				if (response.statusCode !== 200){
					// The response is JSON, parse out the error
					const message = `${response.statusCode} - ${body.message}`;
					log.warn(message);
				}
			});
			if (error){
				return next(error);
			}
		}

		if (Object.prototype.hasOwnProperty.call(req.body, 'logo') && req.body.logo){
			// Establish the options for the request
			logo = `${agents[0]}-${req.body.settings.logo.replace(/[^a-zA-Z0-9-_]/g, '')}`;
			settings.logo = logo;
			const options = {
				"headers": {'content-type': 'application/json'},
				"json": {
					"data": req.body.logo,
					"path": `public/agency-logos/${logo}`
				},
				"method": 'PUT',
				"url": `http://localhost:${global.settings.PRIVATE_API_PORT}/v1/file/file`
			};

			// Send the request
			await request(options, function(e, response, body){
				// If there was an error, reject
				if (e){
					error = serverHelper.internalError('Well, that wasn’t supposed to happen. Please try again and if this continues please contact us. (Failed to upload new logo)');
					log.error('Failed to connect to file service.');
					return;
				}

				// If the response was anything but a success, reject
				if (response.statusCode !== 200){
					// The response is JSON, parse out the error
					const message = `${response.statusCode} - ${body.message}`;
					log.warn(message);
				}
			});
			if (error){
				return next(error);
			}
		}
	}

	// Agency Name (required)
	if (Object.prototype.hasOwnProperty.call(req.body.settings, 'name')){
		if (validator.agency_name(req.body.settings.name)){
			settings.name = req.body.settings.name;
		}
 else {
			log.warn('Agency name does not meet requirements');
			return next(serverHelper.requestError('Agency name is invalid'));
		}
	}
 else {
		log.warn('Agent name is required');
		return next(serverHelper.requestError('Agent name is required'));
	}

	// Agency Email Address (required)
	if (Object.prototype.hasOwnProperty.call(req.body.settings, 'email')){
		if (validator.email(req.body.settings.email)){
			settings.email = await crypt.encrypt(req.body.settings.email);
		}
 else {
			log.warn('Agency email does not meet requirements');
			return next(serverHelper.requestError('Agency email is invalid'));
		}
	}
 else {
		log.warn('Agency email is required');
		return next(serverHelper.requestError('Agency email is required'));
	}

	// Phone Number (required)
	if (Object.prototype.hasOwnProperty.call(req.body.settings, 'phone') && req.body.settings.phone){
		if (validator.phone(req.body.settings.phone)){
			// Strip out all non-numeric characters
			req.body.settings.phone = req.body.settings.phone.replace(/\D/g, '');

			settings.phone = await crypt.encrypt(req.body.settings.phone);
		}
 else {
			log.warn('Agency phone does not meet requirements');
			return next(serverHelper.requestError('Agency phone is invalid'));
		}
	}
 else {
		log.warn('Agency phone number is required');
		return next(serverHelper.requestError('Agency phone number is required'));
	}

	// California License Number (optional)
	if (Object.prototype.hasOwnProperty.call(req.body.settings, 'ca_license_number') && req.body.settings.ca_license_number){
		// eslint-disable-next-line new-cap
		if (validator.CALicense(req.body.settings.ca_license_number)){
			settings.ca_license_number = await crypt.encrypt(req.body.settings.ca_license_number);
		}
 else {
			log.warn('CA License number does not meet requirements');
			return next(serverHelper.requestError('CA License number is invalid'));
		}
	}

	// Website (optional)
	if (Object.prototype.hasOwnProperty.call(req.body.settings, 'website') && req.body.settings.website){
		if (validator.website(req.body.settings.website)){
			// Add http:// if it is not present
			if (req.body.settings.website.indexOf('http://') === -1 && req.body.settings.website.indexOf('https://') === -1){
				req.body.settings.website = `http://${req.body.settings.website}`;
			}

			// Encrypt the website
			settings.website = await crypt.encrypt(req.body.settings.website);
		}
 else {
			log.warn('Website does not meet requirements');
			return next(serverHelper.requestError('Website could not be validated'));
		}
	}

	// First Name (required)
	if (Object.prototype.hasOwnProperty.call(req.body.settings, 'fname')){
		if (validator.name(req.body.settings.fname)){
			settings.fname = await crypt.encrypt(req.body.settings.fname);
		}
 else {
			log.warn('Agent first name does not meet requirements');
			return next(serverHelper.requestError('Agent first name is invalid'));
		}
	}
 else {
		log.warn('Agent first name is required');
		return next(serverHelper.requestError('Agent first name is required'));
	}

	// Last Name (required)
	if (Object.prototype.hasOwnProperty.call(req.body.settings, 'lname')){
		if (validator.name(req.body.settings.lname)){
			settings.lname = await crypt.encrypt(req.body.settings.lname);
		}
 else {
			log.warn('Agent last name does not meet requirements');
			return next(serverHelper.requestError('Agent last name is invalid'));
		}
	}
 else {
		log.warn('Agent last name is required');
		return next(serverHelper.requestError('Agent first last is required'));
	}

	// Validate locations
	let primaryFound = false;
	let locationNum = 1;
	const locations = req.body.settings.locations;
	for (const locationID in locations){
		if (Object.prototype.hasOwnProperty.call(locations, locationID)){
			const location = req.body.settings.locations[locationID];

			// Address (required)
			if (Object.prototype.hasOwnProperty.call(location, 'address')){
				if (validator.address(location.address)){
					// eslint-disable-next-line no-await-in-loop
					location.address = await crypt.encrypt(location.address);
				}
 else {
					const message = `The Address you entered for location ${locationNum} is not valid`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}
 else {
				const message = `An Address is required for location ${locationNum}`;
				log.warn(message);
				return next(serverHelper.requestError(message));
			}

			// Address Line 2 (optional)
			if (Object.prototype.hasOwnProperty.call(location, 'address2') && location.address2){
				if (validator.address2(location.address2)){
					// eslint-disable-next-line no-await-in-loop
					location.address2 = await crypt.encrypt(location.address2);
				}
 else {
					const message = `The Address Line 2 you entered for location ${locationNum} is not valid`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}
 else {
				location.address2 = null;
			}

			// Close Time
			if (Object.prototype.hasOwnProperty.call(location, 'close_time')){
				if (![3,
4,
5,
6,
7,
8].includes(location.close_time)){
					const message = `The Close Time you entered for location ${locationNum} is not valid (must be 3, 4, 5, 6, 7, or 8)`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}

			// Email Address (required)
			if (Object.prototype.hasOwnProperty.call(location, 'email')){
				if (validator.email(location.email)){
					// eslint-disable-next-line no-await-in-loop
					location.email = await crypt.encrypt(location.email);
				}
 else {
					const message = `The Email Address you entered for location ${locationNum} is not valid`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}
 else {
				const message = `An Email Address is required for location ${locationNum}`;
				log.warn(message);
				return next(serverHelper.requestError(message));
			}

			// First Name (required)
			if (Object.prototype.hasOwnProperty.call(location, 'fname')){
				if (validator.name(location.fname)){
					// eslint-disable-next-line no-await-in-loop
					location.fname = await crypt.encrypt(location.fname);
				}
 else {
					const message = `The First Name you entered for location ${locationNum} is not valid`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}
 else {
				const message = `A First Name is required for location ${locationNum}`;
				log.warn(message);
				return next(serverHelper.requestError(message));
			}

			// Last Name (required)
			if (Object.prototype.hasOwnProperty.call(location, 'lname')){
				if (validator.name(location.lname)){
					// eslint-disable-next-line no-await-in-loop
					location.lname = await crypt.encrypt(location.lname);
				}
 else {
					const message = `The Last Name you entered for location ${locationNum} is not valid`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}
 else {
				const message = `A Last Name is required for location ${locationNum}`;
				log.warn(message);
				return next(serverHelper.requestError(message));
			}

			// Open Time
			if (Object.prototype.hasOwnProperty.call(location, 'open_time')){
				if (![7,
8,
9,
10,
11].includes(location.open_time)){
					const message = `The Open Time you entered for location ${locationNum} is not valid (must be 7, 8, 9, 10, or 11)`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}

			// Phone
			if (Object.prototype.hasOwnProperty.call(location, 'phone') && location.phone){
				if (validator.phone(location.phone)){
					// Strip out all non-numeric characters
					location.phone = location.phone.replace(/\D/g, '');

					// eslint-disable-next-line no-await-in-loop
					location.phone = await crypt.encrypt(location.phone);
				}
 else {
					const message = `The Phone Number you entered for location ${locationNum} is not valid`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}
 else {
				location.phone = null;
			}

			// Primary
			if (Object.prototype.hasOwnProperty.call(location, 'primary') && location.primary){
				if (primaryFound){
					const message = 'Only one location can be marked as your primary location';
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
				primaryFound = true;
				location.primary = 1;
			}
 else {
				location.primary = 0;
			}

			// Zip (required)
			if (Object.prototype.hasOwnProperty.call(location, 'zip')){
				if (!validator.zip(location.zip)){
					const message = `The Zip Code you entered for location ${locationNum} is not valid`;
					log.warn(message);
					return next(serverHelper.requestError(message));
				}
			}
 else {
				const message = `A Zip Code is required for location ${locationNum}`;
				log.warn(message);
				return next(serverHelper.requestError(message));
			}

			locationNum++;
		}
	}

	// Make sure there was a primary location
	if (!primaryFound){
		const message = 'You must select a location as your primary location';
		log.warn(message);
		return next(serverHelper.requestError(message));
	}

	// Compile the set statements for the update query
	const setStatements = [];

	Object.entries(settings).forEach(([key, value]) => {
		setStatements.push(`\`${key}\`=${db.escape(value)}`);
	});

	// Create and run the UPDATE query for the agency
	const agencySQL = `UPDATE \`#__agencies\` SET ${setStatements.join(', ')} WHERE id = ${db.escape(agents[0])} LIMIT 1;`;
	await db.query(agencySQL).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});

	// Update each location
	for (const locationID in locations){
		if (Object.prototype.hasOwnProperty.call(locations, locationID)){
			const location = locations[locationID];

			const locationSQL = `
				UPDATE \`#__agency_locations\`
				SET
					\`address\` = ${db.escape(location.address)},
					\`address2\` = ${location.address2 ? db.escape(location.address2) : 'NULL'},
					\`close_time\` = ${db.escape(location.close_time)},
					\`email\` = ${db.escape(location.email)},
					\`fname\` = ${db.escape(location.fname)},
					\`lname\` = ${db.escape(location.lname)},
					\`open_time\` = ${db.escape(location.open_time)},
					\`phone\` = ${location.phone ? db.escape(location.phone) : 'NULL'},
					\`primary\` = ${db.escape(location.primary)},
					\`zip\` = ${db.escape(location.zip)}
				WHERE
					\`id\` = ${db.escape(locationID)} AND
					\`agency\` = ${db.escape(agents[0])}
				LIMIT 1;
			`;

			// eslint-disable-next-line  no-await-in-loop
			await db.query(locationSQL).catch(function(err){
				log.error(err.message);
				return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
			});
		}
	}

	// Return a success message
	res.send(200, {"logo": logo});
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get settings', `${basePath}/settings`, getSettings, 'settings', 'view');
	server.addPutAuth('Update settings', `${basePath}/settings`, updateSettings, 'settings', 'manage');
};