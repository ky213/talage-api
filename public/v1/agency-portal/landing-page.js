'use strict';

const auth = require('./helpers/auth.js');
const serverHelper = require('../../../server.js');
const validator = global.requireShared('./helpers/validator.js');

/**
 * Checks whether the provided agency has a primary page other than the current page
 *
 * @param {int} agency - The ID of the agency to check
 * @param {int} page - The ID of the page to exempt from the check
 *
 * @return {boolean} - True if the agency has a primary page; false otherwise
 */
function hasOtherPrimary(agency, page){
	return new Promise(async function(fulfill){
		let error = false;

		const sql = `
				SELECT id
				FROM \`#__agency_landing_pages\`
				WHERE
					\`agency\` = ${parseInt(agency, 10)} AND
					\`primary\` = 1 AND
					\`id\` != ${parseInt(page, 10)} AND
					\`state\` > 0
				LIMIT 1;
			`;

		// Run the query
		const result = await db.query(sql).catch(function(){
			error = true;
			fulfill(false);
		});
		if(error){
			return;
		}

		// Check the result
		if(!result || !result.length){
			fulfill(false);
			return;
		}

		fulfill(true);
	});
}

/**
 * Validates a landing page and returns a clean data object
 *
 * @param {object} request - HTTP request object
 * @param {function} next - The next function from the request
 * @return {object} Object containing landing page information
 */
async function validate(request, next){
	// Establish default values
	const data = {
		'about': '',
		'banner': '',
		'colorScheme': 1,
		'heading': null,
		'industryCode': null,
		'industryCodeCategory': null,
		'introHeading': null,
		'introText': null,
		'name': '',
		'showIndustrySection': true,
		'slug': ''
	};

	// Determine the agency ID
	const agency = request.authentication.agents[0];

	// Validate each parameter

	// About (optional)
	if(Object.prototype.hasOwnProperty.call(request.body, 'about') && request.body.about){
		// Strip out HTML
		request.body.about = request.body.about.replace(/(<([^>]+)>)/ig, '');

		// Check lengths
		if(request.body.about.length > 400){
			throw new Error('Reduce the length of your about text to less than 400 characters');
		}

		data.about = request.body.about;
	}

	// Banner (optional)
	if(Object.prototype.hasOwnProperty.call(request.body, 'banner') && request.body.banner){
		if(!await validator.banner(request.body.banner)){
			throw new Error('Banner is invalid');
		}
		data.banner = request.body.banner;
	}

	// Color Scheme (a.k.a Theme)
	if(Object.prototype.hasOwnProperty.call(request.body, 'colorScheme') && request.body.colorScheme){
		// TO DO: Validate
		data.colorScheme = request.body.colorScheme;
	}

	// Heading (optional)
	if(Object.prototype.hasOwnProperty.call(request.body, 'heading') && request.body.heading){
		if(request.body.heading.length > 70){
			throw new Error('Heading must be less the 70 characters');
		}
		if(!validator.landingPageHeading(request.body.heading)){
			throw new Error('Heading is invalid');
		}
		data.heading = request.body.heading;
	}

	// Industry Code Category (optional)
	if(Object.prototype.hasOwnProperty.call(request.body, 'industryCodeCategory') && request.body.industryCodeCategory){
		if(!await validator.industryCodeCategory(request.body.industryCodeCategory)){
			throw new Error('Industry Code Category is invalid');
		}
		data.industryCodeCategory = request.body.industryCodeCategory;

		// Industry Code (optional) - only applicable if an Industry Code Category is set
		if(Object.prototype.hasOwnProperty.call(request.body, 'industryCode') && request.body.industryCode){
			if(!await validator.industry_code(request.body.industryCode)){
				throw new Error('Industry Code is invalid');
			}
			data.industryCode = request.body.industryCode;
		}
	}

	// Intro Heading (optional)
	if(Object.prototype.hasOwnProperty.call(request.body, 'introHeading') && request.body.introHeading){
		if(request.body.introHeading.length > 70){
			throw new Error('Introduction Heading must be less the 70 characters');
		}
		if(!validator.landingPageHeading(request.body.introHeading)){
			throw new Error('Introduction Heading is invalid');
		}
		data.introHeading = request.body.introHeading;
	}

	// Intro Text (optional)
	if(Object.prototype.hasOwnProperty.call(request.body, 'introText') && request.body.introText){
		// Strip out HTML
		request.body.introText = request.body.introText.replace(/(<([^>]+)>)/ig, '');

		// Check lengths
		if(request.body.introText.length > 400){
			throw new Error('Reduce the length of your introduction text to less than 400 characters');
		}

		data.introText = request.body.introText;
	}

	// Name
	if(!Object.prototype.hasOwnProperty.call(request.body, 'name') || !request.body.name){
		throw new Error('You must enter a page name');
	}
	if(!validator.landingPageName(request.body.name)){
		throw new Error('Page name is invalid');
	}
	data.name = request.body.name;

	// Show Industry Section (optional)
	if(Object.prototype.hasOwnProperty.call(request.body, 'showIndustrySection')){
		if(typeof request.body.showIndustrySection === 'boolean' && !request.body.showIndustrySection){
			data.showIndustrySection = false;
		}
	}

	// Slug (a.k.a. Link)
	if(!Object.prototype.hasOwnProperty.call(request.body, 'slug') || !request.body.slug){
		throw new Error('You must enter a link');
	}
	if(!validator.slug(request.body.slug)){
		throw new Error('Link is invalid');
	}
	data.slug = request.body.slug;

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
	const nameResult = await db.query(nameSQL).catch(function(error){
		log.error(error.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});
	if(nameResult.length > 0){
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
	const slugResult = await db.query(slugSQL).catch(function(error){
		log.error(error.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});
	if(slugResult.length > 0){
		throw new Error('This link is already in use. Choose a different one.');
	}

	// Return the clean data
	return data;
}

/**
 * Creates a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function createLandingPage(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'manage').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Determine the agency ID
	const agency = req.authentication.agents[0];

	// Check that at least some post parameters were received
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

	// Define the data to be inserted, column: value
	const insertData = {
		'about': data.about,
		'agency': agency,
		'banner': data.banner,
		'color_scheme': data.colorScheme,
		'heading': data.heading,
		'industry_code': data.industryCode,
		'industry_code_category': data.industryCodeCategory,
		'intro_heading': data.introHeading,
		'intro_text': data.introText,
		'name': data.name,
		'show_industry_section': data.showIndustrySection,
		'slug': data.slug
	};

	// Create the SQL to insert this item into the database
	const sql = `
			INSERT INTO \`#__agency_landing_pages\` (${Object.keys(insertData).map((key) => `\`${key}\``).join(',')})
			VALUES (${Object.values(insertData).map((key) => db.escape(key)).join(',')});
		`;

	// Commit this update to the database
	const result = await db.query(sql).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure the query was successful
	if(result.affectedRows !== 1){
		log.error('Landing page update failed. Query ran successfully; however, no records were affected.');
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	// Send back a success response
	res.send(200, 'Created');
	return next();
}

/**
 * Deletes a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function deleteLandingPage(req, res, next){
	let agency = null;
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, req.authentication.agencyNetwork ? 'agencies' : 'pages', 'manage').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Check that query parameters were received
	if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
		log.info('Bad Request: Query parameters missing');
		return next(serverHelper.requestError('Query parameters missing'));
	}

	// Determine the agency ID
	if(req.authentication.agencyNetwork){
		// This is an agency network user, they can only modify agencies in their network

		// Get the agencies that we are permitted to manage
		const agencies = await auth.getAgents(req).catch(function(e){
			error = e;
		});
		if(error){
			return next(error);
		}

		// Validate the Agency ID
		if(!Object.prototype.hasOwnProperty.call(req.query, 'agency')){
			return next(serverHelper.requestError('Agency missing'));
		}
		if(!await validator.agent(req.query.agency)){
			return next(serverHelper.requestError('Agency is invalid'));
		}
		if(!agencies.includes(parseInt(req.query.agency, 10))){
			return next(serverHelper.requestError('Agency is invalid'));
		}

		agency = req.query.agency;
	}else{
		// This is an agency user, they can only handle their own agency
		agency = req.authentication.agents[0];
	}

	// Validate the Landing Page ID
	if(!Object.prototype.hasOwnProperty.call(req.query, 'id')){
		return next(serverHelper.requestError('ID missing'));
	}
	if(!await validator.landingPageId(req.query.id, agency)){
		return next(serverHelper.requestError('ID is invalid'));
	}
	const id = req.query.id;

	// Make sure there is a primary page for this agency (we are not removing the primary page)
	if(!await hasOtherPrimary(agency, id)){
		// Log a warning and return an error
		log.warn('This landing page is the primary page. You must make another page primary before deleting this one.');
		return next(serverHelper.requestError('This landing page is the primary page. You must make another page primary before deleting this one.'));
	}

	// Update the landing page (we set the state to -2 to signify that the user is deleted)
	const updateSQL = `
			UPDATE \`#__agency_landing_pages\`
			SET
				\`state\` = -2
			WHERE
				\`id\` = ${parseInt(id, 10)} AND
				\`agency\` = ${parseInt(agency, 10)}
			LIMIT 1;
		`;

	// Run the query
	const result = await db.query(updateSQL).catch(function(){
		error = serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.');
	});
	if(error){
		return next(error);
	}

	// Make sure the query was successful
	if(result.affectedRows !== 1){
		log.error('Landing page delete failed');
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	res.send(200, 'Deleted');
}


/**
 * Retrieves the details of a single landing page
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 * @returns {void}
 */
async function getLandingPage(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'manage').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Check that query parameters were received
	if(!req.query || typeof req.query !== 'object' || Object.keys(req.query).length === 0){
		log.info('Bad Request: Query parameters missing');
		return next(serverHelper.requestError('Query parameters missing'));
	}
	// Check for required parameters
	if(!Object.prototype.hasOwnProperty.call(req.query, 'id') || !req.query.id){
		log.info('Bad Request: You must specify a page');
		return next(serverHelper.requestError('You must specify a page'));
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
				\`industry_code\` AS 'industryCode',
				\`industry_code_category\` AS 'industryCodeCategory',
				\`intro_heading\` AS 'introHeading',
				\`intro_text\` AS 'introText',
				\`name\`,
				\`show_industry_section\` AS 'showIndustrySection',
				\`slug\`,
				\`primary\`,
				\`heading\`
			FROM \`#__agency_landing_pages\`
			WHERE \`agency\` = ${parseInt(agency, 10)} AND \`state\` > 0 AND \`id\` = ${parseInt(req.query.id, 10)}
			LIMIT 1;
		`;

	// Run the query
	const landingPage = await db.query(landingPageSQL).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure a page was found
	if(landingPage.length !== 1){
		log.warn('Page not found');
		return next(serverHelper.requestError('Page not found'));
	}

	// Send the user's data back
	res.send(200, landingPage[0]);
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
async function updateLandingPage(req, res, next){
	let error = false;

	// Make sure the authentication payload has everything we are expecting
	await auth.validateJWT(req, 'pages', 'manage').catch(function(e){
		error = e;
	});
	if(error){
		return next(error);
	}

	// Determine the agency ID
	const agency = req.authentication.agents[0];

	// Check that at least some post parameters were received
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

	// Validate the ID
	if(!Object.prototype.hasOwnProperty.call(req.body, 'id')){
		throw new Error('ID missing');
	}
	if(!await validator.landingPageId(req.body.id)){
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
				\`industry_code\` = ${db.escape(data.industryCode)},
				\`industry_code_category\` = ${db.escape(data.industryCodeCategory)},
				\`intro_heading\` = ${db.escape(data.introHeading)},
				\`intro_text\` = ${db.escape(data.introText)},
				\`name\` = ${db.escape(data.name)},
				\`show_industry_section\` = ${db.escape(data.showIndustrySection)},
				\`slug\` = ${db.escape(data.slug)}
			WHERE \`id\` = ${db.escape(data.id)} AND \`agency\` = ${db.escape(agency)}
			LIMIT 1;
		`;

	// Run the query
	const result = await db.query(sql).catch(function(err){
		log.error(err.message);
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	});

	// Make sure the query was successful
	if(result.affectedRows !== 1){
		log.error('Landing page update failed. Query ran successfully; however, no records were affected.');
		return next(serverHelper.internalError('Well, that wasn\’t supposed to happen, but hang on, we\’ll get it figured out quickly and be in touch.'));
	}

	// Send back a success response
	res.send(200, 'Saved');
	return next();
}


exports.registerEndpoint = (server, basePath) => {
	server.addDeleteAuth('Delete Landing Page', `${basePath}/landing-page`, deleteLandingPage);
	server.addGetAuth('Get Landing Page', `${basePath}/landing-page`, getLandingPage);
	server.addPostAuth('Post Landing Page', `${basePath}/landing-page`, createLandingPage);
	server.addPutAuth('Put Landing Page', `${basePath}/landing-page`, updateLandingPage);
};