'use strict';

const serverHelper = require('../../../server.js');
const auth = require('./helpers/auth.js');

async function validate(request, next){
	// Establish default values
	const data = {
		'primary': '',
		'primary_accent': '',
		'secondary': '',
		'secondary_accent': '',
		'tertiary': '',
		'tertiary_accent': ''
	};

	// Determine the agency ID
	const agency = request.authentication.agents[0];

	// TODO: Validate each parameter
	// For now only validating the primary and secondary color schemes
	if( !Object.prototype.hasOwnProperty.call(request.body, 'primary') || !request.body.primary){
		throw new Error('You must choose a primary color');
	}else {
		data.primary = request.body.primary;
	}
	if (!Object.prototype.hasOwnProperty.call(request.body, 'secondary') || !request.body.secondary){
		throw new Error ('You must choose a secondary color');
	}else{
		data.secondary = request.body.secondary;
	}
	return data;
}
/**
 * Retrieves available color schemes
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function GetColorScheme(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'view').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Build a query that will return all of the landing pages
	// We are excluding custom colors name 
	const colorSchemesSQL = `
			SELECT
				\`id\`,
				\`name\`,
				\`primary\`,
				\`secondary\`
			FROM \`#__color_schemes\`
			WHERE \`state\` > 0 && \`name\` != \'Custom\'
			ORDER BY \`name\` ASC;
		`;

	// Run the query
	const colorSchemes = await db.query(colorSchemesSQL).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Send the data back
	res.send(200, colorSchemes);
	return next();
}

/**
 * Updates a custom color scheme for landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function PutColorScheme(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'manage').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Check that at least some put parameters were received
	if(!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0){
		log.info('Bad Request: Parameters missing');
		return next(serverHelper.requestError('Parameters missing'));
	}

	// Validate the request and get back the data
	const data = await validate(req, next).catch(function(err){
		error = err.message;
	});
	if(error){
		log.warn(error);
		return next(serverHelper.requestError(error));
	}

	// commit this update to the database
	const sql = `
			INSERT INTO \`#__color_schemes\` 
			(\`name\`, \`primary\`,\`primary_accent\`,\`secondary\`,\`secondary_accent\`,\`tertiary\`,\`tertiary_accent\`)
			VALUES (${db.escape(`Custom`)}, ${db.escape(data.primary)}, ${db.escape(data.primary_accent)}, ${db.escape(data.secondary)}, ${db.escape(data.secondary_accent)}, ${db.escape(data.tertiary)}, ${db.escape(data.tertiary_accent)})
	`;

	// Run the query
	const createCustomColorResult = await db.query(sql).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure the query was successful
	if(createCustomColorResult.affectedRows !== 1){
		log.error('Custom color scheme update failed. Query ran successfully; however, no records were affected.');
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	// get the id of the custom color
	const customColorId = createCustomColorResult.insertId;

	//send back the color id
	res.send(200, customColorId);
	return next();

}
exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Color Scheme', `${basePath}/color-scheme`, GetColorScheme);
	server.addPutAuth('Put Color Scheme', `${basePath}/color-scheme`, PutColorScheme);
};