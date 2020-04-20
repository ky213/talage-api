'use strict';
const crypt = requireShared('./services/crypt.js');
const util = require('util');
const sendOnboardingEmail = require('./helpers/send-onboarding-email.js');
const auth = require('./helpers/auth.js');
const validator = requireShared('./helpers/validator.js');

// /**
//  * Generates a random key for an agency
//  *
//  * @return {string} - A random 16 character string
//  */
// Function generateKey(){
// 	Const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
// 	Const result = [];
//
// 	For(let i = 0; i < 16; i++){
// 		Result.push(characters.charAt(Math.floor(Math.random() * 64)));
// 	}
//
// 	Return result.join('');
// }

/**
 * Generates a random password for the user's first login
 *
 * @return {string} - A random 8 character or number string
 */
function generatePassword() {
	return Math.random().toString(36).substr(2, 8);
}

/**
 * Returns the record for a single Agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetAgency(req, res, next) {
	// Get the agents that we are permitted to view
	let error = false;
	const agents = await auth.getAgents(req).catch(function (e) {
		error = e;
	});
	if (error) {
		return next(error);
	}

	// Make sure this is an agency network
	if (req.authentication.agencyNetwork === false) {
		log.info('Forbidden: User is not authorized to access agency information');
		return next(ServerForbiddenError('You are not authorized to access this resource'));
	}

	// Check that query parameters were recieved
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.info('Bad Request: Query parameters missing');
		return next(ServerRequestError('Query parameters missing'));
	}

	// Check for required parameters
	if (!Object.prototype.hasOwnProperty.call(req.query, 'agent') || !req.query.agent) {
		log.info('Bad Request: You must specify an agent');
		return next(ServerRequestError('You must specify an agent'));
	}

	// Localize and sanitize the agent id
	const agent = parseInt(req.query.agent, 10);

	// Make sure this user has access to the requested agent (Done before validation to prevent leaking valid Agent IDs)
	if (!agents.includes(parseInt(agent, 10))) {
		log.info('Forbidden: User is not authorized to access the requested agent');
		return next(ServerForbiddenError('You are not authorized to access the requested agent'));
	}

	// Validate parameters
	if (!await validator.agent(agent)) {
		log.info('Bad Request: Invalid agent selected');
		return next(ServerRequestError('The agent you selected is invalid'));
	}

	// Prepare to get the information for this agency
	const agencyInfoSQL = `
			SELECT
				${db.quoteName('id')},
				IF(${db.quoteName('state')} >= 1, 'Active', 'Inactive') AS ${db.quoteName('state')},
				${db.quoteName('name', 'agencyName')},
				${db.quoteName('ca_license_number', 'californiaLicenseNumber')},
				${db.quoteName('email')},
				${db.quoteName('fname')},
				${db.quoteName('lname')},
				${db.quoteName('phone')},
				${db.quoteName('logo')},
				${db.quoteName('website')},
				${db.quoteName('slug')}
			FROM ${db.quoteName('#__agencies')}
			WHERE ${db.quoteName('id')} = ${agent}
			LIMIT 1;
		`;

	// Going to the database to get the user's info
	const agencyInfo = await db.query(agencyInfoSQL).catch(function (err) {
		log.error(err.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure we got back the expected data
	if (!agencyInfo || agencyInfo.length !== 1) {
		log.error('Agency not found after having passed validation');
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	// Get the agency from the response and do some cleanup
	const agency = agencyInfo[0];
	for (const property in agency) {
		if (typeof agency[property] === 'object' && agency[property] !== null && agency[property].length === 0) {
			agency[property] = null;
		}
	}

	// Define some queries to get locations, pages and users
	const locationsSQL = `
			SELECT
				${db.quoteName('l.id')},
				${db.quoteName('l.email')},
				${db.quoteName('l.fname')},
				${db.quoteName('l.lname')},
				${db.quoteName('l.phone')},
				${db.quoteName('l.address')},
				${db.quoteName('l.address2')},
				${db.quoteName('z.city')},
				${db.quoteName('z.territory')},
				${db.quoteName('l.zip')},
				${db.quoteName('l.open_time', 'openTime')},
				${db.quoteName('l.close_time', 'closeTime')},
				${db.quoteName('l.primary')}
			FROM ${db.quoteName('#__agency_locations', 'l')}
			LEFT JOIN ${db.quoteName('#__zip_codes', 'z')} ON z.zip = l.zip
			WHERE ${db.quoteName('l.agency')} = ${agent} AND l.state > 0;
		`;
	const pagesSQL = `
			SELECT
				${db.quoteName('id')},
				${db.quoteName('about')},
				${db.quoteName('banner')},
				${db.quoteName('color_scheme', 'colorScheme')},
				${db.quoteName('hits')},
				${db.quoteName('name')},
				${db.quoteName('primary')},
				${db.quoteName('slug')}
			FROM ${db.quoteName('#__agency_landing_pages')}
			WHERE ${db.quoteName('agency')} = ${agent} AND state > 0;
		`;
	const userSQL = `
			SELECT
				${db.quoteName('id')},
				${db.quoteName('last_login')},
				IF(${db.quoteName('state')} >= 1, 'Active', 'Inactive') AS ${db.quoteName('state')},
				${db.quoteName('email')}
			FROM ${db.quoteName('#__agency_portal_users')}
			WHERE ${db.quoteName('agency')} = ${agent};
		`;

	// Query the database
	const locations = await db.query(locationsSQL).catch(function (err) {
		log.error(err.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});
	const pages = await db.query(pagesSQL).catch(function (err) {
		log.error(err.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});
	const users = await db.query(userSQL).catch(function (err) {
		log.error(err.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Separate out location IDs and define some variables
	const locationIDs = locations.map((location) => location.id);
	let insurers = [];
	let territories = [];

	// If this is an agency network user, get the insurers and territories
	if (req.authentication.agencyNetwork && req.authentication.insurers.length && locationIDs.length) {
		// Define queries for insurers and territories
		const insurersSQL = `
				SELECT
					${db.quoteName('i.id')},
					${db.quoteName('i.logo')},
					${db.quoteName('i.name')},
					${db.quoteName('li.agency_location', 'locationID')},
					${db.quoteName('li.agency_id', 'agencyID')},
					${db.quoteName('li.agent_id', 'agentID')}
				FROM ${db.quoteName('#__agency_location_insurers', 'li')}
				LEFT JOIN ${db.quoteName('#__insurers', 'i')} ON ${db.quoteName('li.insurer')} = ${db.quoteName('i.id')}
				WHERE
					${db.quoteName('li.agency_location')} IN (${locationIDs.join(',')}) AND
					${db.quoteName('i.id')} IN (${req.authentication.insurers.join(',')}) AND
					${db.quoteName('i.state')} > 0
				ORDER BY ${db.quoteName('i.name')} ASC;
			`;
		const territoriesSQL = `
				SELECT
					${db.quoteName('lt.agency_location', 'locationID')},
					${db.quoteName('t.abbr')},
					${db.quoteName('t.name')}
				FROM ${db.quoteName('#__agency_location_territories', 'lt')}
				LEFT JOIN ${db.quoteName('#__territories', 't')} ON ${db.quoteName('lt.territory')} = ${db.quoteName('t.abbr')}
				WHERE ${db.quoteName('lt.agency_location')} IN (${locationIDs.join(',')})
				ORDER BY ${db.quoteName('t.name')} ASC;
			`;
		insurers = await db.query(insurersSQL).catch(function (err) {
			log.error(err.message);
			return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
		});
		territories = await db.query(territoriesSQL).catch(function (err) {
			log.error(err.message);
			return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
		});
	}

	// Decrypt data from all the queries so far
	const agencyDecrypt = crypt.batchProcessObject(agency, 'decrypt', [
		'californiaLicenseNumber',
		'email',
		'fname',
		'lname',
		'phone',
		'website'
	]);
	const locationsDecrypt = crypt.batchProcessObjectArray(locations, 'decrypt', [
		'address',
		'address2',
		'email',
		'fname',
		'lname',
		'phone'
	]);
	const usersDecrypt = crypt.batchProcessObjectArray(users, 'decrypt', ['email']);
	const insurersDecrypt = crypt.batchProcessObjectArray(insurers, 'decrypt', [
		'agencyID', 'agentID'
	]);

	// Wait for all data to decrypt
	await Promise.all([agencyDecrypt,
		locationsDecrypt,
		usersDecrypt,
		insurersDecrypt]);

	// Sort insurers and territories into the appropriate locations if necessary
	if (insurers.length || territories.length) {
		locations.forEach((location) => {
			location.insurers = insurers.filter((insurer) => insurer.locationID === location.id);
			location.territories = territories.filter((territory) => territory.locationID === location.id);
		});
	}

	// Build the response
	const response = {
		...agency,
		'locations': locations,
		'pages': pages,
		'users': users
	};

	// Return the response
	res.send(200, response);
	return next();
}

/**
 * Creates a single Agency
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function PostAgency(req, res, next) {
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req).catch(function (e) {
		error = e;
	});
	if (error) {
		return next(error);
	}

	// Make sure this is an agency network
	if (req.authentication.agencyNetwork === false) {
		log.info('Forbidden: User is not authorized to create agencies');
		return next(ServerForbiddenError('You are not authorized to create agencies'));
	}

	// Check for data
	if (!req.body || typeof req.body === 'object' && Object.keys(req.body).length === 0) {
		log.warn('No data was received');
		return next(ServerRequestError('No data was received'));
	}

	// Log the entire request
	log.verbose(util.inspect(req.body, false, null));

	// Make sure all information is present
	if (!Object.prototype.hasOwnProperty.call(req.body, 'firstName') || typeof req.body.firstName !== 'string' || !req.body.firstName) {
		log.warn('firstName is required');
		return next(ServerRequestError('You must enter an the First Name of the agent'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'lastName') || typeof req.body.lastName !== 'string' || !req.body.lastName) {
		log.warn('lastName is required');
		return next(ServerRequestError('You must enter an the Last Name of the agent'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'name') || typeof req.body.name !== 'string' || !req.body.name) {
		log.warn('name is required');
		return next(ServerRequestError('You must enter an Agency Name'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'email') || typeof req.body.email !== 'string' || !req.body.email) {
		log.warn('email is required');
		return next(ServerRequestError('You must enter an Email Address'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'territories') || typeof req.body.territories !== 'object' || req.body.territories.length < 1) {
		log.warn('territories are required');
		return next(ServerRequestError('You must select at least one Territory'));
	}
	if (!Object.prototype.hasOwnProperty.call(req.body, 'agencyIDs') || typeof req.body.agencyIDs !== 'object' || Object.keys(req.body.agencyIDs).length < 1) {
		log.warn('agencyIDs are required');
		return next(ServerRequestError('You must enter at least one Agency ID'));
	}

	// Begin compiling a list of territories
	const insurerIDs = [];
	let territoryAbbreviations = [];

	// Build a query for getting all insurers with their territories
	const insurersSQL = `
			SELECT
				${db.quoteName('i.id')},
				GROUP_CONCAT(${db.quoteName('it.territory')}) AS ${db.quoteName('territories')}
			FROM ${db.quoteName('#__insurers', 'i')}
			LEFT JOIN ${db.quoteName('#__insurer_territories', 'it')} ON ${db.quoteName('it.insurer')} = ${db.quoteName('i.id')}
			WHERE ${db.quoteName('i.id')} IN (${req.authentication.insurers.join(',')}) AND ${db.quoteName('i.state')} > 0
			GROUP BY ${db.quoteName('i.id')}
			ORDER BY ${db.quoteName('i.name')} ASC;
		`;

	// Run the query
	const insurers = await db.query(insurersSQL).catch(function (err) {
		log.error(err.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Convert the territories list into an array
	insurers.forEach(function (insurer) {
		insurer.territories = insurer.territories.split(',');
		territoryAbbreviations = territoryAbbreviations.concat(insurer.territories);
		insurerIDs.push(insurer.id);
	});

	// Validate
	if (!validator.agency_name(req.body.name)) {
		log.warn('Invalid agency name');
		return next(ServerRequestError('The agency name entered is not valid.'));
	}
	if (!validator.email(req.body.email)) {
		log.warn('Invalid email address');
		return next(ServerRequestError('The email address entered is not valid.'));
	}
	req.body.territories.forEach(function (territoryAbbreviation) {
		if (!territoryAbbreviations.includes(territoryAbbreviation)) {
			error = ServerRequestError('Invalid territory in request. Please contact us.');
		}
	});
	if (error) {
		return next(error);
	}
	for (let insurerID in req.body.agencyIDs) {
		if (Object.prototype.hasOwnProperty.call(req.body.agencyIDs, insurerID)) {
			// Convert the insurer ID into a number
			insurerID = parseInt(insurerID, 10);

			// Make sure the insurer ID is permitted
			if (!insurerIDs.includes(insurerID)) {
				return next(ServerRequestError('Invalid insurer ID in request. Please contact us.'));
			}

			// Make sure the field wasn't left blank
			if (!req.body.agencyIDs[insurerID]) {
				return next(ServerRequestError('An agency ID is required for each insurer.'));
			}
		}
	}

	// Localize data variables
	const email = req.body.email.toLowerCase();
	const firstName = req.body.firstName;
	const lastName = req.body.lastName;
	const name = req.body.name;
	const territories = req.body.territories;
	const agencyIDs = req.body.agencyIDs;

	// Make sure we don't already have an user tied to this email address
	const emailHash = await crypt.hash(email);
	const emailHashSQL = `
			SELECT ${db.quoteName('id')}
			FROM \`#__agency_portal_users\`
			WHERE \`email_hash\` = ${db.escape(emailHash)}
			LIMIT 1;
		`;
	const emailHashResult = await db.query(emailHashSQL).catch(function (e) {
		log.error(e.message);
		error = ServerInternalError('Error querying database. Check logs.');
	});
	if (error) {
		return next(error);
	}
	if (emailHashResult.length > 0) {
		return next(ServerRequestError('The email address you specified is already associated with another agency. Please check the email address.'));
	}

	// Generate a slug for this agency (will be used to define their unique storefront link)
	const initalSlug = name.trim().replace(/\s/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase().substring(0, 30);

	// Make sure the slug is unique
	let slug = initalSlug;
	let verifiedUnique = false;
	let slugCount = 1;
	while (!verifiedUnique) {
		// SQL to check if the generated agency slug already exists
		const slugSQL = `
				SELECT ${db.quoteName('id')}
				FROM ${db.quoteName('#__agencies')}
				WHERE ${db.quoteName('slug')} = ${db.escape(slug)}
				LIMIT 1;
			`;

		// Run the query
		// eslint-disable-next-line  no-await-in-loop
		const slugExists = await db.query(slugSQL).catch(function (e) {
			log.error(e.message);
			return next(ServerInternalError('Error querying database. Check logs.'));
		});

		// If no response was received, this is unique
		if (slugExists.length === 0) {
			verifiedUnique = true;
		} else {
			if (slugCount === 1) {
				slug = `${slug.substring(0, 27)}-${slugCount}`;
			} else {
				slug = slug.substring(0, slug.length - slugCount.toString().length) + slugCount;
			}
			slugCount++;
		}
	}

	// Encrypt the user's information
	const encrypted = {
		'email': email,
		'firstName': firstName,
		'lastName': lastName
	};
	await crypt.batchProcessObject(encrypted, 'encrypt', [
		'email',
		'firstName',
		'lastName'
	]);

	/*
	 * Create the agency
	 * log.debug('TO DO: We need a wholesale toggle switch on the screen, but hidden for some Agency Networks');
	 */
	const createAgencySQL = `
			INSERT INTO ${db.quoteName('#__agencies')} (
				${db.quoteName('name')},
				${db.quoteName('email')},
				${db.quoteName('agency_network')},
				${db.quoteName('fname')},
				${db.quoteName('lname')},
				${db.quoteName('slug')},
				${db.quoteName('wholesale')}
			) VALUES (
				${db.escape(name)},
				${db.escape(encrypted.email)},
				${db.escape(req.authentication.agencyNetwork)},
				${db.escape(encrypted.firstName)},
				${db.escape(encrypted.lastName)},
				${db.escape(slug)},
				1
			);
		`;

	// Insert the value into the database
	const createAgencyResult = await db.query(createAgencySQL).catch(function (e) {
		log.error(e.message);
		error = ServerInternalError('Error querying database. Check logs.');
	});
	if (error) {
		return next(error);
	}

	// Get the ID of the new agency
	const agencyID = createAgencyResult.insertId;

	// Create a default location for this agency
	const createDefaultLocationSQL = `
			INSERT INTO ${db.quoteName('#__agency_locations')} (
				${db.quoteName('agency')},
				${db.quoteName('email')},
				${db.quoteName('fname')},
				${db.quoteName('lname')},
				${db.quoteName('primary')}
			) VALUES (
				${db.escape(agencyID)},
				${db.escape(encrypted.email)},
				${db.escape(encrypted.firstName)},
				${db.escape(encrypted.lastName)},
				1
			);
		`;

	// Insert the value into the database
	const createLocationResult = await db.query(createDefaultLocationSQL).catch(function (e) {
		log.error(e.message);
		error = ServerInternalError('Error querying database. Check logs.');
	});
	if (error) {
		return next(error);
	}

	// Get the ID of the new agency
	const locationID = createLocationResult.insertId;

	// Store the territories for this agency
	const territoryValues = [];
	territories.forEach((territoryAbbreviation) => {
		territoryValues.push(`(${db.escape(locationID)}, ${db.escape(territoryAbbreviation)})`);
	});

	// SQL to insert territories
	const associateTerritoriesSQL = `
			INSERT INTO ${db.quoteName('#__agency_location_territories')} (${db.quoteName('agency_location')}, ${db.quoteName('territory')})
			VALUES ${territoryValues.join(',')};
		`;

	// Insert the territories
	await db.query(associateTerritoriesSQL).catch(function (e) {
		log.error(e.message);
		error = ServerInternalError('Error querying database. Check logs.');
	});
	if (error) {
		return next(error);
	}

	// Store the insurers for this agency
	const agencyIDValues = [];
	for (const insurerID in agencyIDs) {
		if (Object.prototype.hasOwnProperty.call(agencyIDs, insurerID)) {
			// eslint-disable-next-line  no-await-in-loop
			const insurerAgencyID = await crypt.encrypt(agencyIDs[insurerID]);
			// eslint-disable-next-line  no-await-in-loop
			const insurerAgentID = await crypt.encrypt('placeholder-unsupported');
			agencyIDValues.push(`(${db.escape(locationID)}, ${db.escape(insurerID)}, ${db.escape(insurerAgencyID)}, ${db.escape(insurerAgentID)}, 0, 0 ,1)`);
		}
	}
	const associateInsurersSQL = `
			INSERT INTO ${db.quoteName('#__agency_location_insurers')} (
				${db.quoteName('agency_location')},
				${db.quoteName('insurer')},
				${db.quoteName('agency_id')},
				${db.quoteName('agent_id')},
				${db.quoteName('bop')},
				${db.quoteName('gl')},
				${db.quoteName('wc')}
			) VALUES ${agencyIDValues.join(',')};
		`;
	await db.query(associateInsurersSQL).catch(function (e) {
		log.error(e.message);
		return next(ServerInternalError('Error querying database. Check logs.'));
	});

	// Create a landing page for this agency
	const landingPageSQL = `
			INSERT INTO  ${db.quoteName('#__agency_landing_pages')} (
				${db.quoteName('agency')},
				${db.quoteName('name')},
				${db.quoteName('slug')},
				${db.quoteName('primary')}
			) VALUES (
				${db.escape(agencyID)},
				${db.escape('Get Quotes')},
				${db.escape('get-quotes')},
				${db.escape(1)}
			);
		`;

	await db.query(landingPageSQL).catch(function (e) {
		log.error(e.message);
		return next(ServerInternalError('Error querying database. Check logs.'));
	});

	// Create a user for agency portal access
	const password = generatePassword();
	const hashedPassword = await crypt.hashPassword(password);
	const createUserSQL = `
			INSERT INTO \`#__agency_portal_users\` (\`agency\`, \`email\`, \`email_hash\`, \`password\`)
			VALUES (${db.escape(agencyID)}, ${db.escape(encrypted.email)}, ${db.escape(emailHash)}, ${db.escape(hashedPassword)});
		`;
	log.info('creating user');
	const createUserResult = await db.query(createUserSQL).catch(function (e) {
		log.error(e.message);
		return next(ServerInternalError('Error querying database. Check logs.'));
	});

	// Get the ID of the new agency user
	const userID = createUserResult.insertId;

	const onboardingEmailResponse = await sendOnboardingEmail(req.authentication.agencyNetwork, userID, firstName, lastName, name, slug, email);

	if (onboardingEmailResponse) {
		return next(ServerInternalError(onboardingEmailResponse));
	}

	// Return the response
	res.send(200, {
		'agencyID': agencyID,
		'code': 'Success',
		'message': 'Agency Created'
	});
	return next();
}

exports.RegisterEndpoint = (basePath) => {
	ServerAddGetAuth('Get Agency', basePath + '/agency', GetAgency);
	ServerAddPostAuth('Post Agency', basePath + '/agency', PostAgency);
};