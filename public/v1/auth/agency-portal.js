/**
 * Returns an auth token for the Agency Portal
 */

'use strict';

const crypt = global.requireShared('services/crypt.js');
const jwt = require('jsonwebtoken');
const serverHelper = require('../../../server.js');

/**
 * Responds to get requests for an authorization token
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - The next function to execute
 *
 * @returns {object} res - Returns an authorization token
 */
async function PostToken(req, res, next){
	let error = false;

	// Check for data
	if(!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0){
		log.info('Bad Request: Missing both email and password');
		return next(serverHelper.requestError('You must supply an email address and password'));
	}

	// Make sure an email was provided
	if(!req.body.email){
		log.info('Missing email');
		res.send(400, serverHelper.requestError('Email address is required'));
		return next();
	}

	// Makes sure a password was provided
	if(!req.body.password){
		log.info('Missing password');
		res.send(400, serverHelper.requestError('Password is required'));
		return next();
	}

	// This is a complete hack. Plus signs in email addresses are valid, but the Restify queryParser removes plus signs. Add them back in
	req.body.email = req.body.email.replace(' ', '+');

	// Begin constructing the payload
	const payload = {
		'agencyNetwork': false,
		'agents': [],
		'signatureRequired': false
	};

	// Authenticate the information provided by the user
	const emailHash = await crypt.hash(req.body.email);
	const agencySQL = `
		SELECT
			\`apu\`.\`agency_network\`,
			\`apu\`.\`agency\`,
			\`apu\`.\`can_sign\`,
			\`apu\`.\`id\`,
			\`apu\`.\`last_login\`,
			\`apu\`.\`password\`,
			\`apu\`.\`reset_required\`,
			\`apug\`.\`permissions\`,
			\`la\`.\`version\` AS 'termsOfServiceVersion'
		FROM \`#__agency_portal_users\` AS \`apu\`
		LEFT JOIN \`#__agency_portal_user_groups\` AS \`apug\` ON \`apu\`.\`group\` = \`apug\`.\`id\`
		LEFT JOIN \`#__legal_acceptances\` AS \`la\` ON \`la\`.\`agency_portal_user\` = \`apu\`.\`id\`
		WHERE \`apu\`.\`email_hash\` = ${db.escape(emailHash)} AND \`apu\`.\`state\` > 0
		LIMIT 1;
	`;
	const result = await db.query(agencySQL).catch(function(e){
		log.error(e.message);
		res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
		error = true;
	});
	if(error){
		return next(false);
	}

	// Make sure we found the user
	if(!result || !result.length){
		log.info('Authentication failed - Account not found');
		log.verbose(emailHash);
		res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
		return next();
	}

	// Check the password
	if(!await crypt.verifyPassword(result[0].password, req.body.password)){
		log.info('Authentication failed - Bad password');
		res.send(401, serverHelper.invalidCredentialsError('Invalid API Credentials'));
		return next();
	}

	// Record the time this user logged in
	const lastLoginSQL = `
		UPDATE \`#__agency_portal_users\`
		SET \`last_login\` = NOW()
		WHERE \`id\` = ${result[0].id}
		LIMIT 1;
	`;
	db.query(lastLoginSQL).catch(function(e){
		// If this fails, log the failure but do nothing else
		log.error(e.message);
	});

	// Check if this was an agency network
	if(result[0].agency_network){
		payload.agencyNetwork = result[0].agency_network;
	}

	// For agency networks get the agencies they are allowed to access
	if(payload.agencyNetwork){

		// Build and execute the query
		const agenciesSQL = `
			SELECT \`id\`
			FROM \`#__agencies\`
			WHERE \`agency_network\` = ${db.escape(payload.agencyNetwork)} AND \`state\` > 0;
		`;
		const agencies = await db.query(agenciesSQL).catch(function(e){
			log.error(e.message);
			res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
			error = true;
		});
		if(error){
			return next(false);
		}

		// Store the agencies in the payload
		payload.agents = [];
		agencies.forEach((agency) => {
			payload.agents.push(agency.id);
		});

		// Build a query to get all of the insurers this agency network can use
		const insurersSQL = `
			SELECT \`i\`.\`id\`
			FROM \`#__insurers\` AS \`i\`
			RIGHT JOIN \`#__agency_network_insurers\` AS \`ani\` ON \`i\`.\`id\` = \`ani\`.\`insurer\`
			WHERE \`ani\`.\`agency_network\` = ${db.escape(payload.agencyNetwork)} AND \`i\`.\`state\` > 0;
		`;

		// Query the database
		const insurersData = await db.query(insurersSQL).catch(function(e){
			log.error(e.message);
			res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
			error = true;
		});
		if(error){
			return next(false);
		}

		// Store the insurers in the payload
		payload.insurers = [];
		insurersData.forEach((insurer) => {
			payload.insurers.push(insurer.id);
		});
	}else{
		// Just allow access to the current agency
		payload.agents.push(result[0].agency);

		// Add the signing authority permission to the payload
		payload.canSign = Boolean(result[0].can_sign);

		// Determine whether or not the user needs to sign a wholesale agreement
		const wholesaleSQL = `
			SELECT
				\`wholesale\` ,
				\`wholesale_agreement_signed\`
			FROM \`#__agencies\`
			WHERE \`id\` = ${db.escape(result[0].agency)} AND \`state\` > 0
			LIMIT 1;
		`;
		const wholesaleInfo = await db.query(wholesaleSQL).catch(function(e){
			log.error(e.message);
			res.send(500, serverHelper.internalError('Error querying database. Check logs.'));
			error = true;
		});
		if(error){
			return next(false);
		}

		// Only agencies who have wholesale enabled and have not signed before should be required to sign
		if(wholesaleInfo[0].wholesale && !wholesaleInfo[0].wholesale_agreement_signed){
			payload.signatureRequired = true;
		}
	}

	// Add the user ID to the payload
	payload.userID = result[0].id;

	// Add the permissions to the payload
	payload.permissions = JSON.parse(result[0].permissions);

	// Check whether or not this is the first time the user is logging in
	payload.firstLogin = Boolean(result[0].last_login);

	// Report back whether or not a password reset is required
	payload.resetRequired = Boolean(result[0].reset_required);

	// Return the version of the Terms of Service
	payload.termsOfServiceVersion = result[0].termsOfServiceVersion;

	// This is a valid user, generate and return a token
	const token = `Bearer ${jwt.sign(payload, global.settings.AUTH_SECRET_KEY, {'expiresIn': '15h'})}`;
	log.info('Token Created');
	res.send(201, {
		'status': 'Created',
		'token': token
	});
	return next();
}

/* -----==== Endpoints ====-----*/
exports.registerEndpoint = (server, basePath) => {
	server.addPost('Get Token', `${basePath}/agency-portal`, PostToken);
};