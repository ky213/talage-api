'use strict';

const validator = requireShared('./helpers/validator.js');

/**
 * Validates a landing page and returns a clean data object
 *
 * @param {object} request - HTTP request object
 * @param {function} next - The next function from the request
 * @return {object} Object containing landing page information
 */
async function validate(request, next) {
	// Establish default values
	const data = {
		'about': '',
		'banner': '',
		'colorScheme': 1,
		'heading': null,
		'name': '',
		'slug': ''
	};

	// Determine the agency ID
	const agency = request.authentication.agents[0];

	// Validate each parameter

	// Name
	if (!Object.prototype.hasOwnProperty.call(request.body, 'name') || !request.body.name) {
		throw new Error('You must enter a page name');
	}
	if (!validator.landingPageName(request.body.name)) {
		throw new Error('Page name is invalid');
	}
	data.name = request.body.name;

	// Slug (a.k.a. Link)
	if (!Object.prototype.hasOwnProperty.call(request.body, 'slug') || !request.body.slug) {
		throw new Error('You must enter a link');
	}
	if (!validator.slug(request.body.slug)) {
		throw new Error('Link is invalid');
	}
	data.slug = request.body.slug;

	// Heading
	if (Object.prototype.hasOwnProperty.call(request.body, 'heading') && request.body.heading) {
		if (request.body.heading.length > 70) {
			throw new Error('Heading must be less the 70 characters');
		} else {
			data.heading = request.body.heading;
		}
	}

	// Banner
	if (Object.prototype.hasOwnProperty.call(request.body, 'banner') && request.body.banner) {
		// TO DO: Validate
		data.banner = request.body.banner;
	}

	// Color Scheme (a.k.a Theme)
	if (Object.prototype.hasOwnProperty.call(request.body, 'colorScheme') && request.body.colorScheme) {
		// TO DO: Validate
		data.colorScheme = request.body.colorScheme;
	}

	// About
	if (Object.prototype.hasOwnProperty.call(request.body, 'about') && request.body.about) {
		// Strip out HTML
		request.body.about = request.body.about.replace(/(<([^>]+)>)/ig, '');

		// Check lengths
		if (request.body.about.length > 400) {
			throw new Error('Reduce the length of your about text to less than 400 characters');
		}

		data.about = request.body.about;
	}

	// Check for duplicate name
	const nameSQL = `
			SELECT \`id\`
			FROM \`#__agency_landing_pages\`
			WHERE \`name\` = ${db.escape(data.name)}
				AND \`state\` > -2
				AND \`agency\` = ${db.escape(agency)}
				${request.body.id ? `AND \`id\` != ${db.escape(request.body.id)}` : ''}
			;
		`;
	const nameResult = await db.query(nameSQL).catch(function (error) {
		log.error(error.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});
	if (nameResult.length > 0) {
		throw new Error('This name is already in use. Choose a different one.');
	}

	// Check for duplicate slug
	const slugSQL = `
			SELECT \`id\`
			FROM \`#__agency_landing_pages\`
			WHERE \`slug\` = ${db.escape(data.slug)}
				AND \`state\` > -2
				AND \`agency\` = ${db.escape(agency)}
				${request.body.id ? `AND \`id\` != ${db.escape(request.body.id)}` : ''}
			;
		`;
	const slugResult = await db.query(slugSQL).catch(function (error) {
		log.error(error.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});
	if (slugResult.length > 0) {
		throw new Error('This link is already in use. Choose a different one.');
	}

	// Return the clean data
	return data;
}


/**
 * Retrieves the details of a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function GetLandingPage(req, res, next) {
	// Check that query parameters were received
	if (!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0) {
		log.info('Bad Request: Query parameters missing');
		return next(ServerRequestError('Query parameters missing'));
	}

	// Check for required parameters
	if (!Object.prototype.hasOwnProperty.call(req.query, 'page') || !req.query.page) {
		log.info('Bad Request: You must specify a page');
		return next(ServerRequestError('You must specify a page'));
	}

	// TO DO: Add support for Agency Networks (take in an agency as a parameter)
	const agency = req.authentication.agents[0];

	// Build a query that will return all of the landing pages
	const landingPageSQL = `
			SELECT
				\`id\`,
				\`about\`,
				\`banner\`,
				\`color_scheme\` AS 'colorScheme',
				\`name\`,
				\`slug\`,
				\`primary\`,
				\`heading\`
			FROM \`#__agency_landing_pages\`
			WHERE \`agency\` = ${parseInt(agency, 10)} AND \`state\` > 0 AND \`id\` = ${parseInt(req.query.page, 10)}
			LIMIT 1;
		`;

	// Run the query
	const landingPage = await db.query(landingPageSQL).catch(function (err) {
		log.error(err.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure a page was found
	if (landingPage.length !== 1) {
		log.warn('Page not found');
		return next(ServerRequestError('Page not found'));
	}

	// Send the user's data back
	res.send(200, landingPage[0]);
	return next();
}

/**
 * Creates a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function PostLandingPage(req, res, next) {
	// Determine the agency ID
	const agency = req.authentication.agents[0];

	// Check that at least some post parameters were received
	if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
		log.info('Bad Request: Parameters missing');
		return next(ServerRequestError('Parameters missing'));
	}

	// Validate the request and get back the data
	let error = false;
	const data = await validate(req, next).catch(function (err) {
		error = err.message;
	});
	if (error) {
		log.warn(error);
		return next(ServerRequestError(error));
	}

	// Commit this update to the database
	const sql = `
			INSERT INTO \`#__agency_landing_pages\` (\`about\`, \`agency\`, \`banner\`, \`color_scheme\`, \`heading\`, \`name\`, \`slug\`)
			VALUES (${db.escape(data.about)}, ${db.escape(agency)}, ${db.escape(data.banner)}, ${db.escape(data.colorScheme)}, ${db.escape(data.heading)}, ${db.escape(data.name)}, ${db.escape(data.slug)});
		`;

	// Run the query
	const result = await db.query(sql).catch(function (err) {
		log.error(err.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure the query was successful
	if (result.affectedRows !== 1) {
		log.error('Landing page update failed. Query ran successfully; however, no records were affected.');
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	// Send back a success response
	res.send(200, 'Created');
	return next();
}

/**
 * Updates a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function PutLandingPage(req, res, next) {
	// Determine the agency ID
	const agency = req.authentication.agents[0];

	// Check that at least some post parameters were recieved
	if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
		log.info('Bad Request: Parameters missing');
		return next(ServerRequestError('Parameters missing'));
	}

	// Validate the request and get back the data
	let error = false;
	const data = await validate(req, next).catch(function (err) {
		error = err.message;
	});
	if (error) {
		log.warn(error);
		return next(ServerRequestError(error));
	}

	// Validate the ID
	if (!Object.prototype.hasOwnProperty.call(req.body, 'id')) {
		throw new Error('ID missing');
	}
	if (!await validator.landingPageId(req.body.id)) {
		throw new Error('ID is invalid');
	}
	data.id = req.body.id;

	// Commit this update to the database
	const sql = `
			UPDATE \`#__agency_landing_pages\`
			SET \`about\` = ${db.escape(data.about)},
				\`banner\` = ${db.escape(data.banner)},
				\`color_scheme\` = ${db.escape(data.colorScheme)},
				\`heading\` = ${db.escape(data.heading)},
				\`name\` = ${db.escape(data.name)},
				\`slug\` = ${db.escape(data.slug)}
			WHERE \`id\` = ${db.escape(data.id)} AND \`agency\` = ${db.escape(agency)}
			LIMIT 1;
		`;

	// Run the query
	const result = await db.query(sql).catch(function (err) {
		log.error(err.message);
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure the query was successful
	if (result.affectedRows !== 1) {
		log.error('Landing page update failed. Query ran successfully; however, no records were affected.');
		return next(ServerInternalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	// Send back a success response
	res.send(200, 'Saved');
	return next();
}

exports.RegisterEndpoint = (basePath) => {
	ServerAddGetAuth('Get Landing Page', basePath + '/landing-page', GetLandingPage);
	ServerAddPostAuth('Post Landing Page', basePath + '/landing-page', PostLandingPage);
	ServerAddPutAuth('Put Landing Page', basePath + '/landing-page', PutLandingPage);
};