'use strict';

const serverHelper = require('../../../server.js');
const auth = require('./helpers/auth.js');
const colorConverter = require('color-converter').default;

function calculateAccentColor(rgbColorString) {
	// TODO: move this to retrieving the color scheme so that we can adjust this on-the-fly -SF
	// We calculate the accents based on the HSV color space.
	const color = colorConverter.fromHex(rgbColorString);
	console.log(color.saturation + ' ' + color.value);
	// Keep the saturation in the range of 0.2 - 0.8
	if (color.saturation > 0.5) {
		color.saturation = Math.max(0.2, color.saturation - 0.5);
	} else {
		color.saturation = Math.min(0.8, color.saturation + 0.5);
	}
	return color.toHex();
}

async function validate(request, next) {
	// Establish default values
	const data = {
		primary: '',
		primary_accent: '',
		secondary: '',
		secondary_accent: '',
		tertiary: '',
		tertiary_accent: ''
	};

	// For now only validating the primary and secondary color schemes
	if (!Object.prototype.hasOwnProperty.call(request.body, 'primary') || !request.body.primary) {
		throw new Error('You must choose a primary color');
	} else {
		data.primary = request.body.primary;
	}
	if (!Object.prototype.hasOwnProperty.call(request.body, 'secondary') || !request.body.secondary) {
		throw new Error('You must choose a secondary color');
	} else {
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
async function GetColorScheme(req, res, next) {
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'view').catch(function (e) {
		error = e;
	});
	if (error) {
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
	const colorSchemes = await db.query(colorSchemesSQL).catch(function (err) {
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
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
async function PutColorScheme(req, res, next) {
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'manage').catch(function (e) {
		error = e;
	});
	if (error) {
		return next(error);
	}

	// Check that at least some put parameters were received
	if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
		log.info('Bad Request: Parameters missing');
		return next(serverHelper.requestError('Parameters missing'));
	}

	// Validate the request and get back the data
	const data = await validate(req, next).catch(function (err) {
		error = err.message;
	});
	if (error) {
		log.warn(error);
		return next(serverHelper.requestError(error));
	}

	// see if record already exists
	const recordSearchQuery = `
		SELECT 
			\`id\`
		FROM \`#__color_schemes\` 					
		WHERE \`primary\` = ${db.escape(data.primary)} && \`secondary\` = ${db.escape(data.secondary)}
	`;
	// variable to hold existing id
	const exisitingColorId = await db.query(recordSearchQuery).catch(function (err) {
		log.error(`Error when trying to check if custom color already exists. \n ${err.message}`);
		return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
	});
	// variable to hold new color id
	let newColorId = null;

	if (!data.primary_accent || data.primary_accent.length === 0) {
		data.primary_accent = calculateAccentColor(data.primary);
		data.secondary_accent = calculateAccentColor(data.secondary);
		// We hard code the tertiary color at white for now
		data.tertiary = '#FFFFFF';
		data.tertiary_accent = '#FFFFFF';
	}

	// if record does not exist then go ahead and insert into db
	// commit this update to the database
	if (exisitingColorId.length === 0) {
		const sql = `
				INSERT INTO \`#__color_schemes\` 
				(\`name\`, \`primary\`,\`primary_accent\`,\`secondary\`,\`secondary_accent\`,\`tertiary\`,\`tertiary_accent\`)
				VALUES (${db.escape(`Custom`)}, ${db.escape(data.primary)}, ${db.escape(data.primary_accent)}, ${db.escape(data.secondary)}, ${db.escape(data.secondary_accent)}, ${db.escape(
			data.tertiary
		)}, ${db.escape(data.tertiary_accent)})
		`;
		// Run the query
		const createCustomColorResult = await db.query(sql).catch(function (err) {
			log.error(err.message);
			return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
		});
		// Make sure the query was successful
		if (createCustomColorResult.affectedRows === 1) {
			newColorId = createCustomColorResult.insertId;
		} else {
			log.error('Custom color scheme update failed. Query ran successfully; however, no records were affected.');
			return next(serverHelper.internalError('Well, that wasn’t supposed to happen, but hang on, we’ll get it figured out quickly and be in touch.'));
		}
	}

	const customColorId = exisitingColorId.length === 0 ? newColorId : exisitingColorId[0].id;

	//send back the color id
	res.send(200, customColorId);
	return next();
}

exports.registerEndpoint = (server, basePath) => {
	server.addGetAuth('Get Color Scheme', `${basePath}/color-scheme`, GetColorScheme);
	server.addPutAuth('Put Color Scheme', `${basePath}/color-scheme`, PutColorScheme);
};
