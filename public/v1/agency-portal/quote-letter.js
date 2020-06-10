'use strict';

const fileSvc = global.requireShared('./services/filesvc.js');
const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');

/**
 * Responds to requests to get quote letters
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetQuoteLetter(req, res, next){
	let error = false;

	// Check for data
	if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
		log.info('Bad Request: No data received' + __location);
		return next(serverHelper.requestError('Bad Request: No data received'));
	}

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'applications', 'view').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Get the agents that we are permitted to view
	const agents = await auth.getAgents(req).catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Make sure basic elements are present
	if(!req.query.file){
		log.info('Bad Request: Missing File' + __location);
		return next(serverHelper.requestError('Bad Request: You must supply a File'));
	}

	// Verify that this quote letter is valid AND the user has access to it
	const securityCheckSQL = `
			SELECT
				\`q\`.\`quote_letter\`
			FROM \`#__quotes\` AS \`q\`
			LEFT JOIN \`#__applications\` AS \`a\` ON \`q\`.\`application\` = \`a\`.\`id\`
			WHERE
				\`q\`.\`quote_letter\` = ${db.escape(req.query.file)}
				AND \`a\`.\`agency\` IN (${agents.join(',')})
			LIMIT 1;
		`;

	// Run the security check
	const result = await db.query(securityCheckSQL).catch(function(err){
		log.error(err.message + __location);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure we received a valid result
	if(!result || !result[0] || !Object.prototype.hasOwnProperty.call(result[0], 'quote_letter') || !result[0].quote_letter){
		log.error('Request for quote letter denied. Possible security violation.' + __location);
		return next(serverHelper.notAuthorizedError('You do not have permission to access this resource.'));
	}

	// Reduce the result down to what we need
	const fileName = result[0].quote_letter;

	// Get the file from our cloud storage service
	const data = await fileSvc.get(`secure/quote-letters/${fileName}`).catch(function(err){
		log.error("file get error: " + err.message + __location);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Return the response
	if(data && data.Body){
		res.send(200, data.Body);
		return next();
	}
	else {
		log.error("file get error: no file content" + __location);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Quote Letter', `${basePath}/quote-letter`, GetQuoteLetter);
};