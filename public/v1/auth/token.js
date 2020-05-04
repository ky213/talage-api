/**
 * Returns an auth token for the API system
 */

'use strict';

const crypt = requireShared('services/crypt.js');
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
async function GetToken(req, res, next) {
	let error = false;

	// Check for data
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.info('Bad Request: You must supply a user and key');
		return next(serverHelper.BadRequestError('You must supply a user and key'));
	}

	// Make sure an API User was provided
	if (!req.query.user) {
		log.info('Missing User');
		res.send(400, serverHelper.BadRequestError('user is required'));
		return next();
	}

	// Makes sure an API Key was provided
	if (!req.query.key) {
		log.info('Missing Key');
		res.send(400, serverHelper.BadRequestError('key is required'));
		return next();
	}

	// Read in the optional joomla_user
	if (req.query.joomla_user) {
		// Makre sure this is a number
		req.query.joomla_user = Number(req.query.joomla_user);

		// Query the database for this joomla_user
		const user_sql = `SELECT \`id\` FROM \`clw_users\` WHERE \`id\` = ${db.escape(req.query.joomla_user)} LIMIT 1;`;
		const user_result = await db.query(user_sql).catch(function (e) {
			log.error(e.message);
			res.send(500, serverHelper.InternalError('Error querying database. Check logs.'));
			error = true;
		});
		if (error) {
			return next(false);
		}

		// Check that the joomla_user was valid
		if (!user_result.length) {
			res.send(401, serverHelper.BadRequestError('Invalid Joomla! User'));
			return next();
		}
	}

	// Authenticate the information provided by the user
	const sql = `SELECT \`id\`, \`key\` FROM \`#__api_users\` WHERE \`user\` = ${db.escape(req.query.user)} LIMIT 1;`;
	const result = await db.query(sql).catch(function (e) {
		log.error(e.message);
		res.send(500, serverHelper.InternalError('Error querying database. Check logs.'));
		error = true;
	});
	if (error) {
		return next(false);
	}

	// Check that the key was valid
	if (!result.length) {
		log.info('Authentication failed');
		res.send(401, serverHelper.InvalidCredentialsError('Invalid API Credentials'));
		return next();
	}

	// Check the key
	if (!await crypt.verifyPassword(result[0].key, req.query.key)) {
		log.info('Authentication failed');
		res.send(401, serverHelper.InvalidCredentialsError('Invalid API Credentials'));
		return next();
	}

	// Construct the payload
	const payload = {};
	payload.api_id = result[0].id;
	if (req.query.joomla_user) {
		payload.joomla_user = req.query.joomla_user;
	}

	// This is a valid user, generate and return a token
	const jwt = require('jsonwebtoken');
	const token = `Bearer ${jwt.sign(payload, settings.AUTH_SECRET_KEY, {
		'expiresIn': '1h'
	})}`;
	res.send(201, {
		'status': 'Created',
		token
	});
	return next();
}

/* -----==== Endpoints ====-----*/
exports.RegisterEndpoint = (server, basePath) => {
	server.AddGet('Get Token', basePath + '/token', GetToken);
	server.AddGet('Get Token (depr)', basePath + '/', GetToken);
};
